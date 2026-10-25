import {
  AppRoute,
  PuppyFilter,
  SituationVideosState,
  createAppMarkup,
  getAllAppAssetPaths,
  getVideoSourceSlugForRoute,
} from './app';
import { fetchSituationVideos } from './lib/videos';
import {
  getTelegramWebApp,
  isTelegramMiniAppLaunch,
  type TelegramWebApp,
} from './lib/telegram';
import {
  ComplexRevealOrigin,
  animateComplexRevealTransition,
  getComplexRevealOrigin,
} from './complex-reveal';
import { setupLessonVideoPlayer } from './video-player';
import { setupFeedbackFlow } from './feedback';
import {
  canUseBrowserBack,
  createFallbackHistoryState,
  createForwardHistoryState,
  normalizeInitialHistoryState,
} from './lib/navigation-history';
import './styles.css';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root element was not found.');
}

const root = appRoot;
const webApp = isTelegramMiniAppLaunch() ? getTelegramWebApp() : null;

let activeFilter: PuppyFilter = 'all';
let videosState: SituationVideosState = { status: 'idle' };
let lastBottomNavIndicatorLeft = '50%';
let lastRenderedRoute: AppRoute | null = null;
let pendingTransitionDirection: PageTransitionDirection | null = null;
const pageScrollPositions = new Map<AppRoute, number>();
let pendingComplexTransitionOrigin: ComplexRevealOrigin | null = null;
let destroyLessonVideoPlayer: (() => void) | null = null;
let routeSyncSequence = 0;
let videoCatalogAbortController: AbortController | null = null;
let renderSequence = 0;
let playerTitleFitFrame: number | null = null;
const preloadedImages = new Map<string, HTMLImageElement>();
const assetPreloadPromises = new Map<string, Promise<void>>();
const ASSET_PRELOAD_TIMEOUT_MS = 15_000;

type PageTransitionDirection = 'forward' | 'back' | 'fade';

if (webApp) {
  document.documentElement.dataset.launchContext = 'telegram';
  document.documentElement.dataset.tgPlatform = webApp.platform || 'unknown';
} else {
  document.documentElement.dataset.launchContext = 'browser';
}

setupAppViewportHeight(webApp);
initializeRouteHistory();
export const appReady = startPrivateApp();
setupFeedbackFlow(root, webApp);
window.addEventListener('hashchange', () => {
  void syncRouteState();
});
window.addEventListener('popstate', () => {
  void syncRouteState();
});
window.addEventListener('resize', () => {
  updateBottomNavIndicatorPosition();
  schedulePlayerHeaderTitleFit();
});

document.addEventListener('keydown', (event) => {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.key !== 'Escape' && event.key !== 'Backspace') ||
    (event.key === 'Backspace' && isEditableElement(event.target))
  ) {
    return;
  }

  const backButton = root.querySelector<HTMLButtonElement>('.back-button[data-route]');

  if (!backButton) {
    return;
  }

  event.preventDefault();
  activateBackControl(backButton);
});

window.addEventListener(
  'mousedown',
  (event) => {
    if (event.button !== 3 && event.button !== 4) {
      return;
    }

    const direction: PageTransitionDirection = event.button === 3 ? 'back' : 'forward';
    pendingTransitionDirection = direction;
    window.setTimeout(() => {
      if (pendingTransitionDirection === direction) {
        pendingTransitionDirection = null;
      }
    }, 1000);
  },
  { capture: true },
);
document.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const routeButton = target.closest<HTMLElement>('[data-route]');

  if (routeButton) {
    const route = routeButton.dataset.route as AppRoute | undefined;

    if (!route) {
      return;
    }

    const currentRoute = getCurrentRoute();

    if (currentRoute === 'complex' && route.startsWith('complex-levels:')) {
      pendingComplexTransitionOrigin = getComplexRevealOrigin(routeButton, event);
    }

    if (routeButton.classList.contains('back-button')) {
      pendingTransitionDirection = 'back';
      navigateBack(route);
      return;
    }

    pendingTransitionDirection = getRouteTransitionDirection(currentRoute, route);
    navigateTo(route);
    return;
  }

  const filterButton = target.closest<HTMLButtonElement>('[data-filter]');

  if (filterButton) {
    const nextFilter = filterButton.dataset.filter as PuppyFilter | undefined;

    if (!nextFilter || nextFilter === activeFilter) {
      return;
    }

    activeFilter = nextFilter;
    void render();
    return;
  }

  const externalButton = target.closest<HTMLElement>('[data-external-url]');

  if (externalButton) {
    const url = externalButton.dataset.externalUrl;

    if (url) {
      openExternalUrl(url);
      return;
    }
  }

  const feedbackButton = target.closest<HTMLButtonElement>('.js-feedback');

  if (!feedbackButton) {
    return;
  }

  const message = feedbackButton.dataset.feedback;

  if (!message) {
    return;
  }

  showFeedback(message);
});

async function startPrivateApp(): Promise<void> {
  void preloadAllAssets(getAllAppAssetPaths());
  await syncRouteState();
}

function setupAppViewportHeight(webApp: TelegramWebApp | null): void {
  let pendingFrame: number | null = null;

  const applyHeight = (): void => {
    pendingFrame = null;
    const viewportHeights = [
      window.innerHeight,
      window.visualViewport?.height,
      webApp?.viewportHeight,
    ].filter((height): height is number => Number.isFinite(height) && (height ?? 0) > 0);
    const visibleHeight = Math.min(...viewportHeights);

    if (Number.isFinite(visibleHeight) && visibleHeight > 0) {
      document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(visibleHeight)}px`);
    }
  };

  const scheduleHeightUpdate = (): void => {
    if (pendingFrame !== null) {
      window.cancelAnimationFrame(pendingFrame);
    }

    pendingFrame = window.requestAnimationFrame(applyHeight);
  };

  applyHeight();
  window.addEventListener('resize', scheduleHeightUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleHeightUpdate, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleHeightUpdate, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleHeightUpdate, { passive: true });
  webApp?.onEvent?.('viewportChanged', scheduleHeightUpdate);
}
async function render(): Promise<void> {
  const sequence = ++renderSequence;
  const route = getCurrentRoute();
  const markup = applyImageLoadingHints(createAppMarkup(route, activeFilter, videosState));

  if (sequence !== renderSequence || route !== getCurrentRoute()) {
    return;
  }

  const complexTransitionOrigin = pendingComplexTransitionOrigin;
  pendingComplexTransitionOrigin = null;
  const routeChanged = lastRenderedRoute !== null && lastRenderedRoute !== route;
  const direction = pendingTransitionDirection ?? getRouteTransitionDirection(lastRenderedRoute, route);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const savedScrollTop = routeChanged ? getSavedPageScrollTop(route) : getCurrentScrollTop();
  const isComplexTransition =
    routeChanged &&
    ((lastRenderedRoute === 'home' && route === 'complex') ||
      (lastRenderedRoute === 'complex' && route === 'home'));
  const isComplexLevelsTransition =
    routeChanged && lastRenderedRoute === 'complex' && route.startsWith('complex-levels:');

  rememberCurrentScrollPosition(routeChanged);
  destroyLessonVideoPlayer?.();
  destroyLessonVideoPlayer = null;

  const finishMarkupUpdate = (): void => {
    document.body.style.overflow = '';
    restoreScrollPosition(savedScrollTop);
    schedulePlayerHeaderTitleFit();
    setupLiquidGlassCards();
    destroyLessonVideoPlayer = setupLessonVideoPlayer();
    const navInner = document.querySelector<HTMLElement>('.bottom-nav__inner');

    if (navInner) {
      navInner.style.setProperty('--active-indicator-left', lastBottomNavIndicatorLeft);
    }

    updateBottomNavIndicatorPosition();
    lastRenderedRoute = route;
  };

  pendingTransitionDirection = null;

  if (isComplexTransition && !reducedMotion) {
    animateComplexRouteTransition(markup, route === 'complex', finishMarkupUpdate);
    return;
  }

  if (isComplexLevelsTransition && !reducedMotion) {
    animateComplexRevealTransition(
      root,
      markup,
      route === 'complex-levels:timed',
      complexTransitionOrigin,
      updatePageMarkup,
      finishMarkupUpdate,
    );
    return;
  }

  updatePageMarkup(markup);
  finishMarkupUpdate();

  if (!routeChanged || reducedMotion) {
    return;
  }

  const pageContent = root.querySelector<HTMLElement>('.screen-content');

  if (pageContent) {
    pageContent.classList.add('app-shell--page-enter', `app-shell--page-enter-${direction}`);
    pageContent.addEventListener(
      'animationend',
      () => {
        pageContent.classList.remove('app-shell--page-enter', `app-shell--page-enter-${direction}`);
      },
      { once: true },
    );
  }
}

function animateComplexRouteTransition(
  markup: string,
  isEnteringComplex: boolean,
  onComplete: () => void,
): void {
  const currentShell = root.querySelector<HTMLElement>(':scope > .app-shell');
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const nextShell = template.content.querySelector<HTMLElement>('.app-shell');

  if (!currentShell || !nextShell) {
    updatePageMarkup(markup);
    onComplete();
    return;
  }

  let completed = false;
  const completeTransition = (): void => {
    if (completed) {
      return;
    }

    completed = true;
    currentShell.remove();
    nextShell.classList.remove(
      'app-shell--complex-transition-enter',
      'app-shell--complex-transition-base',
    );
    nextShell.querySelector('.bottom-nav')?.classList.remove('bottom-nav--complex-transition-enter');
    onComplete();
  };

  if (isEnteringComplex) {
    currentShell.classList.add('app-shell--complex-transition-underlay-exit');
    currentShell
      .querySelector('.bottom-nav')
      ?.classList.add('bottom-nav--complex-transition-exit');
    nextShell.classList.add('app-shell--complex-transition-enter');
    root.append(nextShell);
    nextShell.addEventListener('animationend', (event) => {
      if (event.target === nextShell) {
        completeTransition();
      }
    });
  } else {
    nextShell.classList.add('app-shell--complex-transition-base');
    nextShell
      .querySelector('.bottom-nav')
      ?.classList.add('bottom-nav--complex-transition-enter');
    root.insertBefore(nextShell, currentShell);
    currentShell.classList.add('app-shell--complex-transition-exit');
    currentShell.addEventListener('animationend', (event) => {
      if (event.target === currentShell) {
        completeTransition();
      }
    });
  }

  window.setTimeout(completeTransition, 1200);
}

function rememberCurrentScrollPosition(routeChanged: boolean): void {
  if (!routeChanged || !lastRenderedRoute) {
    return;
  }

  const currentContent = root.querySelector<HTMLElement>(':scope > .app-shell > .screen-content');

  if (currentContent) {
    pageScrollPositions.set(lastRenderedRoute, currentContent.scrollTop);
  }
}

function getCurrentScrollTop(): number {
  const currentContent = root.querySelector<HTMLElement>(':scope > .app-shell > .screen-content');

  return currentContent?.scrollTop ?? 0;
}

function getSavedPageScrollTop(route: AppRoute): number {
  return pageScrollPositions.get(route) ?? 0;
}

function restoreScrollPosition(scrollTop: number): void {
  const nextContent = root.querySelector<HTMLElement>(':scope > .app-shell > .screen-content');

  if (nextContent) {
    nextContent.scrollTop = scrollTop;
  }
}

function schedulePlayerHeaderTitleFit(): void {
  if (playerTitleFitFrame !== null) {
    window.cancelAnimationFrame(playerTitleFitFrame);
  }

  playerTitleFitFrame = window.requestAnimationFrame(() => {
    playerTitleFitFrame = null;
    fitPlayerHeaderTitle();
  });
}

function fitPlayerHeaderTitle(): void {
  const title = root.querySelector<HTMLElement>('.subpage-title--player');

  if (!title || title.clientWidth === 0) {
    return;
  }

  title.style.removeProperty('font-size');

  const maximumFontSize = Number.parseFloat(window.getComputedStyle(title).fontSize);
  const minimumFontSize = 17;
  const lineHeightRatio = 1.14;
  const maxLines = 2;
  let fontSize = maximumFontSize;

  while (fontSize > minimumFontSize) {
    title.style.fontSize = `${fontSize}px`;

    const maximumHeight = fontSize * lineHeightRatio * maxLines + 1;
    const fitsVertically = title.scrollHeight <= maximumHeight;
    const fitsHorizontally = title.scrollWidth <= title.clientWidth + 1;

    if (fitsVertically && fitsHorizontally) {
      return;
    }

    fontSize -= 0.5;
  }

  title.style.fontSize = `${minimumFontSize}px`;
}

function updatePageMarkup(markup: string): void {
  const currentShell = root.querySelector<HTMLElement>(':scope > .app-shell');

  if (!currentShell) {
    root.innerHTML = markup;
    return;
  }

  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const nextShell = template.content.querySelector<HTMLElement>('.app-shell');
  const currentHeader = currentShell.querySelector<HTMLElement>(':scope > header');
  const currentContent = currentShell.querySelector<HTMLElement>(':scope > .screen-content');
  const currentNav = currentShell.querySelector<HTMLElement>(':scope > .bottom-nav');
  const nextHeader = nextShell?.querySelector<HTMLElement>(':scope > header');
  const nextContent = nextShell?.querySelector<HTMLElement>(':scope > .screen-content');
  const nextNav = nextShell?.querySelector<HTMLElement>(':scope > .bottom-nav');

  if (!nextShell || !currentHeader || !currentContent || !currentNav || !nextHeader || !nextContent || !nextNav) {
    root.innerHTML = markup;
    return;
  }

  currentHeader.replaceWith(nextHeader);
  currentContent.replaceWith(nextContent);

  const currentTabs = currentNav.querySelectorAll<HTMLElement>('.bottom-nav__tab');
  const nextTabs = nextNav.querySelectorAll<HTMLElement>('.bottom-nav__tab');

  currentTabs.forEach((tab, index) => {
    tab.classList.toggle(
      'bottom-nav__tab--active',
      nextTabs[index]?.classList.contains('bottom-nav__tab--active') ?? false,
    );
  });
}

function getRouteTransitionDirection(from: AppRoute | null, to: AppRoute): PageTransitionDirection {
  if (!from) {
    return 'fade';
  }

  const getDepth = (route: AppRoute): number => {
    if (route === 'home') {
      return 0;
    }

    if (
      route === 'complex' ||
      route === 'fitness' ||
      route === 'puppies' ||
      route === 'adult-large'
    ) {
      return 1;
    }

    if (route === 'puppy-fitness' || route === 'adult-fitness') {
      return 2;
    }

    if (route.startsWith('complex-levels:')) {
      return 2;
    }

    if (route.includes('-situation:')) {
      return 2;
    }

    if (route.includes('-topic:') || route.startsWith('puppy-topic:')) {
      return 3;
    }

    if (route.startsWith('lesson-video:')) {
      return 4;
    }

    return 1;
  };

  const fromDepth = getDepth(from);
  const toDepth = getDepth(to);

  if (toDepth === fromDepth) {
    return 'fade';
  }

  return toDepth < fromDepth ? 'back' : 'forward';
}

function setupLiquidGlassCards(): void {
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !window.matchMedia('(hover: hover) and (pointer: fine)').matches
  ) {
    return;
  }

  document.querySelectorAll<HTMLElement>('.situation-card, .topic-card').forEach((card) => {
    if (card.classList.contains('situation-card')) {
      applyCategoryGlassVariation(card);
    }

    const updateGlassFlow = (event: PointerEvent): void => {
      const rect = card.getBoundingClientRect();
      const x = Math.min(1, Math.max(-1, (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)));
      const y = Math.min(1, Math.max(-1, (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)));

      card.style.setProperty('--glass-shift-x', `${(x * 12).toFixed(2)}px`);
      card.style.setProperty('--glass-shift-y', `${(y * 9).toFixed(2)}px`);
    };

    const resetGlassFlow = (): void => {
      card.style.removeProperty('--glass-shift-x');
      card.style.removeProperty('--glass-shift-y');
    };

    card.addEventListener('pointermove', updateGlassFlow);
    card.addEventListener('pointerdown', updateGlassFlow);
    card.addEventListener('pointerleave', resetGlassFlow);
    card.addEventListener('pointercancel', resetGlassFlow);
    card.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') {
        resetGlassFlow();
      }
    });
  });
}

function applyImageLoadingHints(markup: string): string {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const images = Array.from(template.content.querySelectorAll<HTMLImageElement>('img[src]'));

  images.forEach((image) => {
    image.loading = 'lazy';
    image.decoding = 'async';
  });

  template.content.querySelectorAll<HTMLImageElement>('header img').forEach((image) => {
    image.loading = 'eager';
  });

  const firstContentImage = template.content.querySelector<HTMLImageElement>('.screen-content img[src]');

  if (firstContentImage) {
    firstContentImage.loading = 'eager';
    firstContentImage.fetchPriority = 'high';
  }

  return template.innerHTML;
}

async function preloadAllAssets(paths: string[], concurrency = 6): Promise<void> {
  const uniquePaths = [...new Set(paths)];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), uniquePaths.length);

  const preloadNext = async (): Promise<void> => {
    while (nextIndex < uniquePaths.length) {
      const path = uniquePaths[nextIndex];
      nextIndex += 1;
      await preloadAsset(path);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => preloadNext()));
}

async function preloadAsset(path: string): Promise<void> {
  const existingPromise = assetPreloadPromises.get(path);

  if (existingPromise) {
    return existingPromise;
  }

  const image = new Image();
  image.decoding = 'async';
  preloadedImages.set(path, image);

  const preloadPromise = new Promise<void>((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      preloadedImages.delete(path);
      finish();
    }, ASSET_PRELOAD_TIMEOUT_MS);

    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    image.onload = () => {
      const decode = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decode.catch(() => undefined).then(finish);
    };
    image.onerror = () => {
      preloadedImages.delete(path);
      finish();
    };
    image.src = path;
  });

  assetPreloadPromises.set(path, preloadPromise);
  return preloadPromise;
}

function applyCategoryGlassVariation(card: HTMLElement): void {
  const title = card.querySelector<HTMLElement>('.situation-card__title')?.textContent ?? '';
  let hash = 2166136261;

  for (const character of title) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  const focusX = 4 + (hash & 0xff) * (92 / 255);
  const focusY = 4 + ((hash >>> 8) & 0xff) * (92 / 255);
  const angle = 58 + ((hash >>> 16) & 0xff) * (244 / 255);
  const colorFocus = 32 + ((hash >>> 20) & 0xff) * (36 / 255);
  const reliefX = -14 + ((hash >>> 4) & 0xff) * (28 / 255);
  const reliefY = -10 + ((hash >>> 12) & 0xff) * (20 / 255);

  card.style.setProperty('--glass-color-angle', `${angle.toFixed(1)}deg`);
  card.style.setProperty('--glass-focus-x', `${focusX.toFixed(1)}%`);
  card.style.setProperty('--glass-focus-y', `${focusY.toFixed(1)}%`);
  card.style.setProperty('--glass-color-focus', `${colorFocus.toFixed(1)}%`);
  card.style.setProperty('--glass-relief-x', `${reliefX.toFixed(1)}px`);
  card.style.setProperty('--glass-relief-y', `${reliefY.toFixed(1)}px`);
}

function getCurrentRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#/, '');

  if (hash === 'complex') {
    return 'complex';
  }

  if (hash === 'fitness') {
    return 'fitness';
  }

  if (hash === 'puppy-fitness') {
    return 'puppy-fitness';
  }

  if (hash === 'adult-fitness') {
    return 'adult-fitness';
  }

  if (hash === 'complex-levels:timed' || hash === 'complex-levels:self-check') {
    return hash;
  }


  if (hash === 'adult-large') {
    return 'adult-large';
  }

  if (hash === 'puppies') {
    return 'puppies';
  }

  if (hash.startsWith('adult-large-situation:')) {
    return hash as AppRoute;
  }

  if (hash.startsWith('adult-large-topic:')) {
    return hash as AppRoute;
  }



  if (hash.startsWith('puppy-situation:')) {
    return hash as AppRoute;
  }

  if (hash.startsWith('puppy-topic:')) {
    return hash as AppRoute;
  }

  if (hash.startsWith('lesson-video:')) {
    return hash as AppRoute;
  }

  return 'home';
}

async function syncRouteState(): Promise<void> {
  const sequence = ++routeSyncSequence;
  videoCatalogAbortController?.abort();
  videoCatalogAbortController = null;
  const route = getCurrentRoute();
  const videoSourceSlug = getVideoSourceSlugForRoute(route);

  if (route !== 'puppies') {
    activeFilter = 'all';
  }

  if (videoSourceSlug) {
    const controller = new AbortController();
    videoCatalogAbortController = controller;
    videosState = { status: 'loading' };
    await render();

    try {
      const videos = await fetchSituationVideos(videoSourceSlug, { signal: controller.signal });

      if (sequence !== routeSyncSequence) {
        return;
      }

      videosState = { status: 'ready', videos };
    } catch {
      if (controller.signal.aborted || sequence !== routeSyncSequence) {
        return;
      }

      videosState = {
        status: 'error',
        message: 'Попробуйте открыть этот экран чуть позже',
      };
    }

    videoCatalogAbortController = null;
    await render();
    return;
  }

  videosState = { status: 'idle' };
  await render();
}

function navigateTo(route: AppRoute): void {
  const nextHash = route === 'home' ? '' : `#${route}`;

  if (window.location.hash === nextHash) {
    return;
  }

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  const nextState = createForwardHistoryState(getHistoryState(), getCurrentRoute(), route);
  window.history.pushState(nextState, '', nextUrl);
  void syncRouteState();
}

function navigateBack(fallbackRoute: AppRoute): void {
  const currentRoute = getCurrentRoute();
  const historyState = getHistoryState();
  const allowedParentRoutes = getAllowedParentRoutes(currentRoute, fallbackRoute);

  if (canUseBrowserBack(historyState, currentRoute, allowedParentRoutes)) {
    window.history.back();
    return;
  }

  replaceRouteWithFallback(fallbackRoute);
}

function getAllowedParentRoutes(
  currentRoute: AppRoute,
  fallbackRoute: AppRoute,
): readonly AppRoute[] {
  if (currentRoute === 'puppy-fitness') {
    return ['puppies', 'fitness'];
  }

  if (currentRoute === 'adult-fitness') {
    return ['adult-large', 'fitness'];
  }

  if (currentRoute.startsWith('puppy-topic:') && fallbackRoute === 'puppy-fitness') {
    return ['puppy-fitness', 'puppy-situation:fitness'];
  }

  if (currentRoute.startsWith('adult-large-topic:') && fallbackRoute === 'adult-fitness') {
    return ['adult-fitness', 'adult-large-situation:adult-large-fitness'];
  }

  return [fallbackRoute];
}

function replaceRouteWithFallback(route: AppRoute): void {
  const nextHash = route === 'home' ? '' : `#${route}`;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  const nextState = createFallbackHistoryState(getHistoryState(), route);

  window.history.replaceState(nextState, '', nextUrl);
  void syncRouteState();
}

function initializeRouteHistory(): void {
  const currentRoute = getCurrentRoute();
  const historyState = getHistoryState();
  const normalizedState = normalizeInitialHistoryState(historyState, currentRoute);

  if (normalizedState === historyState) {
    return;
  }

  window.history.replaceState(normalizedState, '', window.location.href);
}

function getHistoryState(): Record<string, unknown> {
  const state = window.history.state;
  return state && typeof state === 'object' ? { ...state } : {};
}

function activateBackControl(backButton: HTMLButtonElement): void {
  backButton.click();
}

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
function showFeedback(message: string): void {
  webApp?.HapticFeedback?.impactOccurred('light');

  if (webApp?.showAlert) {
    webApp.showAlert(message);
    return;
  }

  window.alert(message);
}

function openExternalUrl(rawUrl: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return;
  }

  if (parsedUrl.protocol !== 'https:') {
    return;
  }

  const url = parsedUrl.toString();

  if (parsedUrl.hostname === 't.me') {
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url);
      return;
    }
  } else if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }

  window.location.href = url;
}

function updateBottomNavIndicatorPosition(): void {
  window.requestAnimationFrame(() => {
    const navInner = document.querySelector<HTMLElement>('.bottom-nav__inner');
    const activeContent = document.querySelector<HTMLElement>('.bottom-nav__tab--active .bottom-nav__content');

    if (!navInner || !activeContent) {
      return;
    }

    const navRect = navInner.getBoundingClientRect();
    const contentRect = activeContent.getBoundingClientRect();
    const indicatorLeft = contentRect.left - navRect.left + contentRect.width / 2;

    const nextIndicatorLeft = `${indicatorLeft}px`;

    void navInner.offsetWidth;

    window.requestAnimationFrame(() => {
      lastBottomNavIndicatorLeft = nextIndicatorLeft;
      navInner.style.setProperty('--active-indicator-left', nextIndicatorLeft);
    });
  });
}
