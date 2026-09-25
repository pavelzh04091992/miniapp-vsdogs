import {
  AppRoute,
  PuppyFilter,
  SituationVideosState,
  createAppMarkup,
  getVideoSourceSlugForRoute,
} from './app';
import { fetchSituationVideos } from './lib/videos';
import { initTelegramWebApp, isTelegramMiniAppLaunch } from './lib/telegram';
import {
  ComplexRevealOrigin,
  animateComplexRevealTransition,
  getComplexRevealOrigin,
} from './complex-reveal';
import { setupLessonVideoPlayer } from './video-player';
import './styles.css';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root element was not found.');
}

const root = appRoot;
const webApp = isTelegramMiniAppLaunch() ? initTelegramWebApp() : null;

let activeFilter: PuppyFilter = 'all';
let videosState: SituationVideosState = { status: 'idle' };
let lastBottomNavIndicatorLeft = '50%';
let lastRenderedRoute: AppRoute | null = null;
let pendingTransitionDirection: PageTransitionDirection | null = null;
let previousPageScroll: { route: AppRoute; scrollTop: number } | null = null;
let pendingComplexTransitionOrigin: ComplexRevealOrigin | null = null;
let destroyLessonVideoPlayer: (() => void) | null = null;

type PageTransitionDirection = 'forward' | 'back' | 'fade';

if (webApp) {
  document.documentElement.dataset.launchContext = 'telegram';
  document.documentElement.dataset.tgPlatform = webApp.platform || 'unknown';
} else {
  document.documentElement.dataset.launchContext = 'standalone';
}

void syncRouteState();
window.addEventListener('hashchange', () => {
  void syncRouteState();
});
window.addEventListener('popstate', () => {
  void syncRouteState();
});
window.addEventListener('resize', () => {
  updateBottomNavIndicatorPosition();
});

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

    pendingTransitionDirection = routeButton.classList.contains('back-button')
      ? 'back'
      : getRouteTransitionDirection(currentRoute, route);
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
    render();
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

function render(): void {
  const route = getCurrentRoute();
  const complexTransitionOrigin = pendingComplexTransitionOrigin;
  pendingComplexTransitionOrigin = null;
  const routeChanged = lastRenderedRoute !== null && lastRenderedRoute !== route;
  const direction = pendingTransitionDirection ?? getRouteTransitionDirection(lastRenderedRoute, route);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const savedScrollTop = routeChanged ? getPreviousPageScrollTop(route) : getCurrentScrollTop();
  const markup = createAppMarkup(route, activeFilter, videosState);
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
    restoreScrollPosition(savedScrollTop);
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
    previousPageScroll = {
      route: lastRenderedRoute,
      scrollTop: currentContent.scrollTop,
    };
  }
}

function getCurrentScrollTop(): number {
  const currentContent = root.querySelector<HTMLElement>(':scope > .app-shell > .screen-content');

  return currentContent?.scrollTop ?? 0;
}

function getPreviousPageScrollTop(route: AppRoute): number {
  return previousPageScroll?.route === route ? previousPageScroll.scrollTop : 0;
}

function restoreScrollPosition(scrollTop: number): void {
  const nextContent = root.querySelector<HTMLElement>(':scope > .app-shell > .screen-content');

  if (nextContent) {
    nextContent.scrollTop = scrollTop;
  }
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
      route === 'puppies' ||
      route === 'adult-large' ||
      route === 'adult-small'
    ) {
      return 1;
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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  if (hash === 'complex-levels:timed' || hash === 'complex-levels:self-check') {
    return hash;
  }

  if (hash === 'adult-small') {
    return 'adult-small';
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

  if (hash.startsWith('adult-small-situation:')) {
    return hash as AppRoute;
  }

  if (hash.startsWith('adult-small-topic:')) {
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
  const route = getCurrentRoute();
  const videoSourceSlug = getVideoSourceSlugForRoute(route);

  if (route !== 'puppies') {
    activeFilter = 'all';
  }

  if (videoSourceSlug) {
    videosState = { status: 'loading' };
    render();

    try {
      const videos = await fetchSituationVideos(videoSourceSlug);
      videosState = { status: 'ready', videos };
    } catch {
      videosState = {
        status: 'error',
        message: 'Попробуйте открыть этот экран чуть позже',
      };
    }

    render();
    return;
  }

  videosState = { status: 'idle' };
  render();
}

function navigateTo(route: AppRoute): void {
  const nextHash = route === 'home' ? '' : `#${route}`;

  if (window.location.hash === nextHash) {
    return;
  }

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.pushState(null, '', nextUrl);
  void syncRouteState();
}

function showFeedback(message: string): void {
  webApp?.HapticFeedback?.impactOccurred('light');

  if (webApp?.showAlert) {
    webApp.showAlert(message);
    return;
  }

  window.alert(message);
}

function openExternalUrl(url: string): void {
  if (url.startsWith('https://t.me/') || url.startsWith('http://t.me/')) {
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
