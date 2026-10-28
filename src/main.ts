import {
  AppRoute,
  PuppyFilter,
  SituationVideosState,
  createAppMarkup,
  getVideoLibraryItems,
  initialVideoLibraryState,
  getAllAppAssetPaths,
  getSeasonalListRoute,
  getVideoSourceSlugForRoute,
  isDogSkillsLessonRoute,
  isSeasonalVideoRoute,
  type VideoLibraryFilter,
  type VideoLibraryMode,
  type VideoLibraryState,
} from './app';
import { getSeasonTheme, isSeasonId, type SeasonId } from './seasonal-content';
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
const ACTIVE_SEASON_STORAGE_KEY = 'miniapp-active-season';

let activeSeason: SeasonId = readStoredSeason();
let videoLibraryState: VideoLibraryState = { ...initialVideoLibraryState };
type VideoLibraryNavigationMode = 'card' | 'jump';
type VideoLibraryNavigationRequest = { targetId: string; mode: VideoLibraryNavigationMode };
type VideoLibraryCardFrame = { transform: string; translate: string; opacity: string };
let videoLibraryDisplayedId: string | null = null;
let videoLibraryTransitionTargetId: string | null = null;
let videoLibraryTransitionRunning = false;
let pendingVideoLibraryNavigationRender = false;
let videoLibraryTransitionToken = 0;
let videoLibraryNavigationQueue: VideoLibraryNavigationRequest[] = [];
let videoLibraryCardAnimations: Animation[] = [];
let videoLibraryProgressUpdateToken = 0;
let videoLibrarySurpriseRunning = false;
let videoLibrarySurpriseToken = 0;
let videoLibrarySurpriseButton: HTMLButtonElement | null = null;
let videoLibrarySurpriseSnapshot: HTMLElement | null = null;
let videoLibrarySurpriseAnimations: Animation[] = [];
let videoLibraryPendingCategory: VideoLibraryFilter | null = null;
let videoLibraryCategoryTransitionToken = 0;
let videoLibraryCategoryTransitionRunning = false;
let videoLibraryCategoryOpacityAnimation: Animation | null = null;
let videoLibraryCategoryOpacityElement: HTMLElement | null = null;
let videoLibraryCategoryHeightAnimation: Animation | null = null;
let videoLibraryCategoryHeightElement: HTMLElement | null = null;
let videoLibraryPointerStart: {
  pointerId: number;
  x: number;
  y: number;
  startedAt: number;
  wheel: HTMLElement;
  dragging: boolean;
} | null = null;
let suppressVideoLibraryClick = false;
let pendingVideoLibraryWheelTop: number | null = null;
let videoLibraryWheelDelta = 0;
let videoLibraryWheelDirection = 0;
let pendingVideoLibraryCategoryIndicatorStart: { x: number; width: number } | null = null;
let pendingVideoLibraryCategoryScrollLeft: number | null = null;
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
let seasonTransitionSequence = 0;
let welcomeVideoModalOpen = false;
let welcomeVideoHistoryArmed = false;
let suppressNextWelcomePopState = false;
let welcomeVideoScrollTop = 0;
let welcomeVideoOpener: HTMLButtonElement | null = null;
let previousWelcomeBodyStyles: { position: string; top: string; width: string; overflow: string } | null = null;
let welcomeVideoClosePromise: Promise<void> | null = null;
const preloadedImages = new Map<string, HTMLImageElement>();
const assetPreloadPromises = new Map<string, Promise<void>>();
const videoLibraryDurationPromises = new Map<string, Promise<string | null>>();
const ASSET_PRELOAD_TIMEOUT_MS = 15_000;

type PageTransitionDirection = 'forward' | 'back' | 'fade';
type LessonProgramRoute = Extract<AppRoute, 'puppies' | 'adult-large' | 'dog-skills'>;
type LessonProgramMenuVisualSelection = 'puppy' | 'adult' | 'skills';

let lastMenuVisualSelection: LessonProgramMenuVisualSelection | null = null;
let lessonProgramMenuOpen = false;
let lessonProgramMenuClosing: Promise<void> | null = null;
let lessonProgramMenuResizeObserver: ResizeObserver | null = null;
let lessonProgramMenuInertElements: HTMLElement[] = [];

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
webApp?.BackButton?.onClick(() => {
  if (welcomeVideoModalOpen) {
    closeWelcomeVideoModal();
  } else if (lessonProgramMenuOpen) {
    closeLessonProgramMenu();
  }
});
window.addEventListener('hashchange', () => {
  void syncRouteState();
});
window.addEventListener('popstate', (event) => {
  if (suppressNextWelcomePopState) {
    suppressNextWelcomePopState = false;
    return;
  }

  if (welcomeVideoModalOpen && welcomeVideoHistoryArmed) {
    welcomeVideoHistoryArmed = false;
    closeWelcomeVideoModal({ fromPopState: true });
    event.stopImmediatePropagation();
    return;
  }

  if (lessonProgramMenuOpen) {
    closeLessonProgramMenu();
  }

  void syncRouteState();
});
window.addEventListener('resize', () => {
  updateBottomNavIndicatorPosition();
  schedulePlayerHeaderTitleFit();
  updateLessonProgramMenuPosition();
});
webApp?.onEvent?.('viewportChanged', updateLessonProgramMenuPosition);

document.addEventListener('keydown', (event) => {
  if (welcomeVideoModalOpen && event.key === 'Escape') {
    event.preventDefault();
    closeWelcomeVideoModal();
    return;
  }

  if (
    lessonProgramMenuOpen &&
    (event.key === 'Escape' || (event.key === 'Backspace' && !isEditableElement(event.target)))
  ) {
    event.preventDefault();
    closeLessonProgramMenu();
    return;
  }

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

  if (!(target instanceof Element)) {
    return;
  }

  const lessonProgramChoice = target.closest<HTMLButtonElement>('[data-lesson-program]');
  if (lessonProgramChoice) {
    event.preventDefault();
    const route = lessonProgramChoice.dataset.lessonProgram as LessonProgramRoute | undefined;
    if (lessonProgramMenuOpen && route && isLessonProgramRoute(route)) {
      chooseLessonProgram(route);
    }
    return;
  }

  const lessonsNavButton = target.closest<HTMLButtonElement>('[data-lessons-nav]');
  if (lessonsNavButton) {
    event.preventDefault();
    if (lessonProgramMenuClosing) return;
    const currentRoute = getCurrentRoute();

    if (currentRoute === 'home') {
      if (lessonProgramMenuOpen) {
        if (target.closest('.bottom-nav__lessons-paw')) chooseLessonProgram('dog-skills');
        else closeLessonProgramMenu();
      } else {
        openLessonProgramMenu(lessonsNavButton);
      }
      return;
    }

    closeLessonProgramMenu();
    const destination = lessonsNavButton.dataset.route as LessonProgramRoute | undefined;
    if (destination && isLessonProgramRoute(destination) && destination !== currentRoute) {
      pendingTransitionDirection = getRouteTransitionDirection(currentRoute, destination);
      navigateTo(destination);
    }
    return;
  }

  if (target.closest('[data-lesson-program-menu-backdrop]')) {
    event.preventDefault();
    closeLessonProgramMenu();
    return;
  }

  if (
    lessonProgramMenuOpen &&
    !target.closest('#lesson-program-menu') &&
    !target.closest('[data-lessons-nav]')
  ) {
    closeLessonProgramMenu();
  }

  const surpriseButton = target.closest<HTMLButtonElement>('[data-library-surprise]');
  if (surpriseButton) {
    if (surpriseButton.disabled || videoLibrarySurpriseRunning) return;
    void runVideoLibrarySurprise();
    return;
  }

  if (videoLibrarySurpriseRunning && target.closest('.video-library-screen')) return;

  const welcomeVideoOpenButton = target.closest<HTMLButtonElement>('[data-welcome-video-open]');

  if (welcomeVideoOpenButton) {
    openWelcomeVideoModal(welcomeVideoOpenButton);
    return;
  }

  if (target.closest('[data-welcome-video-close], [data-welcome-video-backdrop]')) {
    closeWelcomeVideoModal();
    return;
  }

  const libraryCard = target.closest<HTMLButtonElement>('[data-library-card]');
  if (libraryCard) {
    if (suppressVideoLibraryClick) {
      suppressVideoLibraryClick = false;
      event.preventDefault();
      return;
    }
    const index = Number(libraryCard.dataset.libraryIndex);
    const visibleItems = getVisibleVideoLibraryItems();
    const selected = visibleItems[index];
    if (selected) {
      const navigation = selectVideoLibraryItem(visibleItems, index);
      if (navigation === 'render') void render();
      if (navigation !== 'none') return;
    }
  }

  const libraryCategory = target.closest<HTMLButtonElement>('[data-library-category]');
  if (libraryCategory) {
    const category = libraryCategory.dataset.libraryCategory as VideoLibraryFilter | undefined;
    if (category) void transitionVideoLibraryCategory(category);
    return;
  }

  const libraryMode = target.closest<HTMLButtonElement>('[data-library-mode]');
  if (libraryMode) {
    const mode = libraryMode.dataset.libraryMode as VideoLibraryMode | undefined;
    if (mode && mode !== videoLibraryState.mode) {
      videoLibraryState = { ...videoLibraryState, mode, transitionFromId: null, transitionRetainedIds: [], transitionMode: 'none' };
      void render();
    }
    return;
  }

  if (target.closest('[data-library-search-toggle]')) {
    if (videoLibraryState.searchOpen) {
      pendingVideoLibraryWheelTop = null;
      pendingVideoLibraryCategoryIndicatorStart = null;
      const searchField = root.querySelector<HTMLElement>('.video-library__search');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (searchField && !reduceMotion) {
        if (searchField.classList.contains('video-library__search--closing')) return;

        searchField.classList.add('video-library__search--closing');
        root.querySelector('[data-library-search-toggle]')?.setAttribute('aria-expanded', 'false');
        let closed = false;
        const finishClosing = (): void => {
          if (closed) return;
          closed = true;
          videoLibraryState = {
            ...videoLibraryState,
            searchOpen: false,
            query: '',
            activeId: null,
            transitionFromId: null,
            transitionRetainedIds: [],
            transitionMode: 'none',
          };
          void render({ suppressCategoryIndicatorMotion: true });
        };

        const onSearchAnimationEnd = (event: AnimationEvent): void => {
          if (event.target === searchField && event.animationName === 'video-library-search-close') {
            finishClosing();
          }
        };
        searchField.addEventListener('animationend', onSearchAnimationEnd);
        window.setTimeout(finishClosing, 320);
        return;
      }

      videoLibraryState = {
        ...videoLibraryState,
        searchOpen: false,
        query: '',
        activeId: null,
        transitionFromId: null,
        transitionRetainedIds: [],
        transitionMode: 'none',
      };
      void render({ suppressCategoryIndicatorMotion: true });
      return;
    }

    pendingVideoLibraryCategoryIndicatorStart = null;
    pendingVideoLibraryWheelTop = root
      .querySelector<HTMLElement>('.video-library__wheel')
      ?.getBoundingClientRect().top ?? null;
    videoLibraryState = {
      ...videoLibraryState,
      searchOpen: true,
      transitionFromId: null,
      transitionRetainedIds: [],
      transitionMode: 'none',
    };
    void render({ suppressCategoryIndicatorMotion: true }).then(() => {
      if (videoLibraryState.searchOpen) root.querySelector<HTMLInputElement>('[data-library-search]')?.focus();
    });
    return;
  }

  if (target.closest('[data-library-clear-search]')) {
    videoLibraryState = { ...videoLibraryState, query: '', activeId: null, transitionFromId: null, transitionRetainedIds: [], searchOpen: true, transitionMode: 'none' };
    void render().then(() => root.querySelector<HTMLInputElement>('[data-library-search]')?.focus());
    return;
  }

  if (target.closest('[data-library-reset]')) {
    videoLibraryState = { ...initialVideoLibraryState };
    void render();
    return;
  }

  const routeButton = target.closest<HTMLElement>('[data-route]');

  if (routeButton) {
    const route = routeButton.dataset.route as AppRoute | undefined;

    if (!route) {
      return;
    }

    if (welcomeVideoModalOpen) {
      event.preventDefault();
      void closeWelcomeVideoModal({ preserveHistory: true, restoreFocus: false }).then(() => {
        navigateTo(route);
      });
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

  const seasonButton = target.closest<HTMLButtonElement>('[data-season]');

  if (seasonButton) {
    const nextSeason = seasonButton.dataset.season;

    if (!nextSeason || !isSeasonId(nextSeason) || nextSeason === activeSeason) {
      return;
    }

    void switchSeason(nextSeason);
    return;
  }

  const seasonalCta = target.closest<HTMLButtonElement>('[data-seasonal-cta]');

  if (seasonalCta) {
    const seasonalContent = root.querySelector<HTMLElement>('[data-seasonal-content]');

    seasonalContent?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
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

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches('[data-library-search]')) return;
  if (videoLibrarySurpriseRunning) return;
  const selectionStart = target.selectionStart;
  videoLibraryState = { ...videoLibraryState, query: target.value, activeId: null, transitionFromId: null, transitionRetainedIds: [], transitionMode: 'none' };
  void render({ suppressCategoryIndicatorMotion: true }).then(() => {
    const input = root.querySelector<HTMLInputElement>('[data-library-search]');
    input?.focus();
    if (input && selectionStart !== null) input.setSelectionRange(selectionStart, selectionStart);
  });
});

document.addEventListener('pointerdown', (event) => {
  if (videoLibrarySurpriseRunning) return;
  const wheel = (event.target as Element | null)?.closest<HTMLElement>('[data-library-wheel]');
  if (!wheel || event.button !== 0) return;
  suppressVideoLibraryClick = false;
  videoLibraryPointerStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startedAt: performance.now(),
    wheel,
    dragging: false,
  };
});

document.addEventListener('pointermove', (event) => {
  const start = videoLibraryPointerStart;
  if (videoLibrarySurpriseRunning || !start || start.pointerId !== event.pointerId || getCurrentRoute() !== 'video-library') return;
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  if (Math.abs(deltaX) < 5 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  start.dragging = true;
  start.wheel.classList.add('is-dragging');
  start.wheel.style.setProperty('--wheel-drag-x', `${deltaX}px`);
});

document.addEventListener('pointerup', (event) => {
  const start = videoLibraryPointerStart;
  videoLibraryPointerStart = null;
  if (videoLibrarySurpriseRunning || !start || start.pointerId !== event.pointerId || getCurrentRoute() !== 'video-library') return;
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  if (!start.dragging || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
    start.wheel.classList.remove('is-dragging');
    start.wheel.style.setProperty('--wheel-drag-x', '0px');
    return;
  }
  const elapsed = Math.max(1, performance.now() - start.startedAt);
  const distance = Math.abs(deltaX);
  const quickSwipe = distance >= 22 && distance / elapsed >= 0.55;
  const shouldAdvance = distance >= 40 || quickSwipe;
  suppressVideoLibraryClick = true;
  window.setTimeout(() => { suppressVideoLibraryClick = false; }, 500);
  if (!shouldAdvance) {
    start.wheel.classList.remove('is-dragging');
    start.wheel.style.setProperty('--wheel-drag-x', '0px');
    return;
  }
  const items = getVisibleVideoLibraryItems();
  const currentIndex = getVideoLibraryNavigationBaseIndex(items);
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)));
  if (nextIndex !== currentIndex) {
    const navigation = selectVideoLibraryItem(items, nextIndex);
    if (navigation === 'render') void render();
    else {
      start.wheel.classList.remove('is-dragging');
      start.wheel.style.setProperty('--wheel-drag-x', '0px');
    }
  } else {
    start.wheel.classList.remove('is-dragging');
    start.wheel.style.setProperty('--wheel-drag-x', '0px');
  }
});

document.addEventListener('pointercancel', (event) => {
  const start = videoLibraryPointerStart;
  videoLibraryPointerStart = null;
  if (!start || start.pointerId !== event.pointerId) return;
  start.wheel.classList.remove('is-dragging');
  start.wheel.style.setProperty('--wheel-drag-x', '0px');
});

document.addEventListener('wheel', (event) => {
  const target = event.target;
  if (videoLibrarySurpriseRunning || !(target instanceof Element) || getCurrentRoute() !== 'video-library') return;
  if (!target.closest('[data-library-wheel]') || isEditableElement(target)) return;

  const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ? event.deltaX
    : event.deltaY;
  if (primaryDelta === 0) return;

  const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? primaryDelta * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? primaryDelta * window.innerHeight
      : primaryDelta;
  const direction = Math.sign(normalizedDelta);
  const items = getVisibleVideoLibraryItems();
  const currentIndex = getVideoLibraryNavigationBaseIndex(items);
  const adjacentIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));

  if (adjacentIndex === currentIndex) {
    videoLibraryWheelDelta = 0;
    videoLibraryWheelDirection = 0;
    return;
  }

  event.preventDefault();
  if (direction !== videoLibraryWheelDirection) {
    videoLibraryWheelDelta = 0;
    videoLibraryWheelDirection = direction;
  }

  videoLibraryWheelDelta += normalizedDelta;
  const stepSize = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 48
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 100;
  const steps = Math.floor(Math.abs(videoLibraryWheelDelta) / stepSize);
  if (steps === 0) return;

  videoLibraryWheelDelta -= direction * steps * stepSize;
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction * steps));
  if (nextIndex !== currentIndex) {
    const navigation = selectVideoLibraryItem(items, nextIndex);
    if (navigation === 'render') void render();
  }
}, { passive: false });

document.addEventListener('keydown', (event) => {
  if (videoLibrarySurpriseRunning || getCurrentRoute() !== 'video-library' || isEditableElement(event.target)) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const items = getVisibleVideoLibraryItems();
  const currentIndex = getVideoLibraryNavigationBaseIndex(items);
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + (event.key === 'ArrowRight' ? 1 : -1)));
  if (nextIndex !== currentIndex) {
    const navigation = selectVideoLibraryItem(items, nextIndex);
    if (navigation === 'none') return;
    event.preventDefault();
    if (navigation === 'render') void render();
  }
});

document.addEventListener(
  'error',
  (event) => {
    const poster = event.target;

    if (!(poster instanceof HTMLImageElement)) {
      return;
    }

    if (poster.matches('[data-seasonal-backdrop]')) {
      poster.hidden = true;
      return;
    }

    if (poster.matches('.video-library-card__cover img, .video-library-list-card__cover img')) {
      poster.hidden = true;
      poster.closest('.video-library-card, .video-library-list-card')?.classList.add('has-poster-error');
      return;
    }

    if (!poster.matches('[data-seasonal-poster]')) return;

    poster.hidden = true;
    poster.closest('.seasonal-video-card')?.classList.add('seasonal-video-card--poster-error');
  },
  true,
);

async function startPrivateApp(): Promise<void> {
  void preloadAllAssets(getAllAppAssetPaths());
  await syncRouteState();
}

function setupAppViewportHeight(webApp: TelegramWebApp | null): void {
  let pendingFrame: number | null = null;

  const applyViewportSize = (): void => {
    pendingFrame = null;
    const documentHeight = document.documentElement.clientHeight || window.innerHeight;
    const documentWidth = document.documentElement.clientWidth || window.innerWidth;
    const stableTelegramHeight = webApp?.viewportStableHeight;
    const visibleHeight = typeof stableTelegramHeight === 'number' && Number.isFinite(stableTelegramHeight) && stableTelegramHeight > 0
      ? stableTelegramHeight
      : documentHeight;

    if (Number.isFinite(visibleHeight) && visibleHeight > 0) {
      document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(visibleHeight)}px`);
    }

    if (Number.isFinite(documentWidth) && documentWidth > 0) {
      document.documentElement.style.setProperty('--app-viewport-width', `${Math.round(documentWidth)}px`);
    }
  };

  const scheduleViewportUpdate = (event?: unknown): void => {
    if (
      event &&
      typeof event === 'object' &&
      'isStateStable' in event &&
      (event as { isStateStable?: boolean }).isStateStable === false
    ) {
      return;
    }

    if (pendingFrame !== null) {
      window.cancelAnimationFrame(pendingFrame);
    }

    pendingFrame = window.requestAnimationFrame(applyViewportSize);
  };

  applyViewportSize();
  window.addEventListener('resize', scheduleViewportUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportUpdate, { passive: true });
  webApp?.onEvent?.('viewportChanged', scheduleViewportUpdate);
}

function readStoredSeason(): SeasonId {
  try {
    const storedSeason = window.sessionStorage.getItem(ACTIVE_SEASON_STORAGE_KEY);
    return storedSeason && isSeasonId(storedSeason) ? storedSeason : 'autumn';
  } catch {
    return 'autumn';
  }
}

function storeActiveSeason(season: SeasonId): void {
  try {
    window.sessionStorage.setItem(ACTIVE_SEASON_STORAGE_KEY, season);
  } catch {
    // Session storage can be unavailable in restricted embedded browsers.
  }
}

async function switchSeason(nextSeason: SeasonId): Promise<void> {
  const sequence = ++seasonTransitionSequence;
  activeSeason = nextSeason;
  storeActiveSeason(nextSeason);

  if (getCurrentRoute() !== 'seasonal') {
    await render();
    return;
  }

  const theme = getSeasonTheme(nextSeason);
  await preloadAsset(theme.heroImagePath);

  if (sequence !== seasonTransitionSequence || getCurrentRoute() !== 'seasonal') {
    return;
  }

  const screen = root.querySelector<HTMLElement>('.seasonal-screen');
  const shell = root.querySelector<HTMLElement>('.app-shell--seasonal');

  if (!screen || !shell) {
    await render();
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reducedMotion) {
    screen.classList.add('seasonal-screen--season-leave');
    await waitForMilliseconds(100);

    if (sequence !== seasonTransitionSequence || getCurrentRoute() !== 'seasonal') {
      return;
    }
  }

  const template = document.createElement('template');
  template.innerHTML = applyImageLoadingHints(
    createAppMarkup('seasonal', activeFilter, videosState, nextSeason),
  ).trim();
  const nextShell = template.content.querySelector<HTMLElement>('.app-shell--seasonal');
  const currentHero = screen.querySelector<HTMLElement>('.seasonal-hero');
  const currentContent = screen.querySelector<HTMLElement>('.seasonal-content');
  const nextHero = nextShell?.querySelector<HTMLElement>('.seasonal-hero');
  const nextContent = nextShell?.querySelector<HTMLElement>('.seasonal-content');

  if (!nextShell || !currentHero || !currentContent || !nextHero || !nextContent) {
    screen.classList.remove('seasonal-screen--season-leave');
    await render();
    return;
  }

  shell.dataset.seasonTheme = nextSeason;
  shell.querySelectorAll<HTMLButtonElement>('[data-season]').forEach((button) => {
    const isActive = button.dataset.season === nextSeason;
    button.classList.toggle('season-switcher__button--active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  currentHero.replaceWith(nextHero);
  currentContent.replaceWith(nextContent);
  screen.classList.remove('seasonal-screen--season-leave');

  if (!reducedMotion) {
    screen.classList.add('seasonal-screen--season-enter');
    window.setTimeout(() => {
      screen.classList.remove('seasonal-screen--season-enter');
    }, 240);
  }
}

function waitForMilliseconds(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function isLessonProgramRoute(route: string): route is LessonProgramRoute {
  return route === 'puppies' || route === 'adult-large' || route === 'dog-skills';
}

function openLessonProgramMenu(trigger: HTMLButtonElement): void {
  if (getCurrentRoute() !== 'home' || lessonProgramMenuOpen) return;

  const nav = trigger.closest<HTMLElement>('.bottom-nav');
  if (!nav) return;

  lessonProgramMenuOpen = true;
  lessonProgramMenuInertElements = Array.from(
    root.querySelectorAll<HTMLElement>('.app-shell > .home-header, .app-shell > .screen-content'),
  ).filter((element) => !element.inert);
  lessonProgramMenuInertElements.forEach((element) => {
    element.inert = true;
  });
  trigger.classList.add('bottom-nav__tab--lesson-program-menu-open');
  trigger.classList.toggle(
    'bottom-nav__tab--lesson-program-last-selected',
    lastMenuVisualSelection === 'skills',
  );
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', 'lesson-program-menu');
  nav.classList.add('bottom-nav--lesson-program-menu-open');

  const menu = document.createElement('div');
  menu.id = 'lesson-program-menu';
  menu.className = 'lesson-program-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Выберите программу обучения');
  menu.innerHTML = `
    <button class="lesson-program-menu__choice lesson-program-menu__choice--puppies" type="button" role="menuitem" data-lesson-program="puppies" aria-label="Щенки">
      <img src="/assets/images/programs/program-menu-puppies.webp" alt="" aria-hidden="true" />
    </button>
    <button class="lesson-program-menu__choice lesson-program-menu__choice--adults" type="button" role="menuitem" data-lesson-program="adult-large" aria-label="Взрослые">
      <img src="/assets/images/programs/program-menu-adults.webp" alt="" aria-hidden="true" />
    </button>
  `;
  if (lastMenuVisualSelection === 'puppy' || lastMenuVisualSelection === 'adult') {
    const visualChoiceRoute = lastMenuVisualSelection === 'puppy' ? 'puppies' : 'adult-large';
    menu.querySelector(`[data-lesson-program="${visualChoiceRoute}"]`)
      ?.classList.add('lesson-program-menu__choice--last-selected');
  }

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'lesson-program-menu-backdrop';
  backdrop.setAttribute('aria-label', 'Закрыть выбор программы');
  backdrop.setAttribute('data-lesson-program-menu-backdrop', '');

  root.append(backdrop, menu);
  updateLessonProgramMenuPosition();

  lessonProgramMenuResizeObserver = new ResizeObserver(updateLessonProgramMenuPosition);
  lessonProgramMenuResizeObserver.observe(root);
  lessonProgramMenuResizeObserver.observe(nav);
  webApp?.BackButton?.show();
}

function chooseLessonProgram(route: LessonProgramRoute): void {
  if (!lessonProgramMenuOpen || lessonProgramMenuClosing || getCurrentRoute() !== 'home') return;

  lastMenuVisualSelection = route === 'puppies'
    ? 'puppy'
    : route === 'adult-large'
      ? 'adult'
      : 'skills';
  const selectedChoice = root.querySelector<HTMLElement>(
    `#lesson-program-menu [data-lesson-program="${route}"]`,
  );
  selectedChoice?.classList.add('lesson-program-menu__choice--selected');
  root.querySelector('[data-lessons-nav]')
    ?.classList.add('bottom-nav__tab--lesson-program-choice-selected');

  void closeLessonProgramMenu({ quick: true }).then(() => {
    if (getCurrentRoute() !== 'home') return;
    pendingTransitionDirection = getRouteTransitionDirection('home', route);
    navigateTo(route);
  });
}

function closeLessonProgramMenu(options: { quick?: boolean } = {}): Promise<void> {
  if (lessonProgramMenuClosing) return lessonProgramMenuClosing;

  const menu = root.querySelector<HTMLElement>('#lesson-program-menu');
  const backdrop = root.querySelector<HTMLButtonElement>('[data-lesson-program-menu-backdrop]');
  if (!lessonProgramMenuOpen && !menu && !backdrop) return Promise.resolve();

  if (!menu || !backdrop) {
    finishLessonProgramMenuClose(menu, backdrop);
    return Promise.resolve();
  }

  menu.classList.add(options.quick ? 'lesson-program-menu--closing-quick' : 'lesson-program-menu--closing');
  backdrop.classList.add(options.quick ? 'lesson-program-menu-backdrop--closing-quick' : 'lesson-program-menu-backdrop--closing');
  menu.querySelectorAll<HTMLButtonElement>('button').forEach((choice) => {
    choice.disabled = true;
  });

  const nav = root.querySelector<HTMLElement>('.bottom-nav');
  const trigger = nav?.querySelector<HTMLButtonElement>('[data-lessons-nav]');
  trigger?.classList.add('bottom-nav__tab--lesson-program-menu-closing');
  if (options.quick) trigger?.classList.add('bottom-nav__tab--lesson-program-menu-closing-quick');

  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 90
    : options.quick
      ? 140
      : 260;

  lessonProgramMenuClosing = new Promise((resolve) => {
    window.setTimeout(() => {
      finishLessonProgramMenuClose(menu, backdrop);
      lessonProgramMenuClosing = null;
      resolve();
    }, duration);
  });

  return lessonProgramMenuClosing;
}

function finishLessonProgramMenuClose(
  menu: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  lessonProgramMenuOpen = false;
  lessonProgramMenuResizeObserver?.disconnect();
  lessonProgramMenuResizeObserver = null;
  lessonProgramMenuInertElements.forEach((element) => {
    if (element.isConnected) element.inert = false;
  });
  lessonProgramMenuInertElements = [];
  menu?.remove();
  backdrop?.remove();

  const nav = root.querySelector<HTMLElement>('.bottom-nav');
  const trigger = nav?.querySelector<HTMLButtonElement>('[data-lessons-nav]');
  nav?.classList.remove('bottom-nav--lesson-program-menu-open');
  trigger?.classList.remove('bottom-nav__tab--lesson-program-menu-open');
  trigger?.classList.remove('bottom-nav__tab--lesson-program-menu-closing');
  trigger?.classList.remove('bottom-nav__tab--lesson-program-menu-closing-quick');
  trigger?.classList.remove('bottom-nav__tab--lesson-program-choice-selected');
  trigger?.classList.remove('bottom-nav__tab--lesson-program-last-selected');
  trigger?.removeAttribute('aria-controls');
  trigger?.setAttribute('aria-expanded', 'false');
  webApp?.BackButton?.hide();
}

function updateLessonProgramMenuPosition(): void {
  if (!lessonProgramMenuOpen) return;

  const menu = root.querySelector<HTMLElement>('#lesson-program-menu');
  const backdrop = root.querySelector<HTMLElement>('[data-lesson-program-menu-backdrop]');
  const nav = root.querySelector<HTMLElement>('.bottom-nav');
  const icon = root.querySelector<HTMLElement>('[data-lessons-nav] .bottom-nav__icon--lessons');
  if (!menu || !backdrop || !nav || !icon) return;

  const appRect = root.getBoundingClientRect();
  const iconRect = icon.getBoundingClientRect();
  const anchorX = iconRect.left + iconRect.width / 2 - appRect.left;
  const anchorY = iconRect.top + iconRect.height / 2 - appRect.top;
  const buttonSize = 52;
  const buttonGap = 12;
  const menuHeight = buttonSize * 2 + buttonGap;

  menu.style.left = `${anchorX - buttonSize / 2}px`;
  menu.style.top = `${anchorY - buttonSize / 2 - buttonGap - menuHeight}px`;
}

function openWelcomeVideoModal(opener: HTMLButtonElement): void {
  if (welcomeVideoClosePromise) {
    void welcomeVideoClosePromise.then(() => openWelcomeVideoModal(opener));
    return;
  }

  const overlay = root.querySelector<HTMLElement>('[data-welcome-video-modal]');

  if (!overlay || welcomeVideoModalOpen) {
    return;
  }

  welcomeVideoModalOpen = true;
  welcomeVideoOpener = opener;
  welcomeVideoScrollTop = window.scrollY;
  previousWelcomeBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
  };

  const currentState = window.history.state;
  const baseState = currentState && typeof currentState === 'object' ? currentState : {};
  window.history.pushState({ ...baseState, welcomeVideoModal: true }, '', window.location.href);
  welcomeVideoHistoryArmed = true;

  document.documentElement.classList.add('welcome-video-open');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${welcomeVideoScrollTop}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('welcome-video-modal--open');
  webApp?.BackButton?.show();
  overlay.querySelector<HTMLButtonElement>('[data-welcome-video-close]')?.focus();
}

function closeWelcomeVideoModal(options: { fromPopState?: boolean; preserveHistory?: boolean; restoreFocus?: boolean } = {}): Promise<void> {
  if (!welcomeVideoModalOpen) {
    return welcomeVideoClosePromise ?? Promise.resolve();
  }

  const overlay = root.querySelector<HTMLElement>('[data-welcome-video-modal]');
  welcomeVideoModalOpen = false;

  if (welcomeVideoHistoryArmed) {
    welcomeVideoHistoryArmed = false;

    if (options.preserveHistory) {
      const state = window.history.state;
      const nextState = state && typeof state === 'object' ? { ...state } : {};
      delete (nextState as Record<string, unknown>).welcomeVideoModal;
      window.history.replaceState(nextState, '', window.location.href);
    } else if (!options.fromPopState) {
      suppressNextWelcomePopState = true;
      window.history.back();
    }
  }

  const video = overlay?.querySelector<HTMLVideoElement>('video');
  video?.pause();
  if (video) {
    video.removeAttribute('src');
    video.load();
  }

  overlay?.classList.remove('welcome-video-modal--open');
  overlay?.classList.add('welcome-video-modal--closing');
  webApp?.BackButton?.hide();

  welcomeVideoClosePromise = new Promise((resolve) => {
    let finished = false;
    const finishClose = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      overlay?.classList.remove('welcome-video-modal--closing');
      overlay?.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('welcome-video-open');

      if (previousWelcomeBodyStyles) {
        document.body.style.position = previousWelcomeBodyStyles.position;
        document.body.style.top = previousWelcomeBodyStyles.top;
        document.body.style.width = previousWelcomeBodyStyles.width;
        document.body.style.overflow = previousWelcomeBodyStyles.overflow;
        previousWelcomeBodyStyles = null;
      }

      window.scrollTo(0, welcomeVideoScrollTop);
      if (options.restoreFocus !== false && welcomeVideoOpener?.isConnected) {
        welcomeVideoOpener.focus();
      }
      welcomeVideoOpener = null;
      welcomeVideoClosePromise = null;
      resolve();
    };
    const sheet = overlay?.querySelector<HTMLElement>('.welcome-video-modal__sheet');

    sheet?.addEventListener('transitionend', (event) => {
      if (event.target === sheet && event.propertyName === 'opacity') {
        finishClose();
      }
    }, { once: true });
    window.setTimeout(finishClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 320);
  });

  return welcomeVideoClosePromise;
}

async function render(options: {
  suppressCategoryIndicatorMotion?: boolean;
  categoryTransitionToken?: number;
  categoryTransitionHeight?: number;
} = {}): Promise<void> {
  const sequence = ++renderSequence;
  const route = getCurrentRoute();
  if (lessonProgramMenuOpen || root.querySelector('#lesson-program-menu')) {
    closeLessonProgramMenu();
  }
  if (videoLibrarySurpriseRunning && route !== 'video-library') {
    cancelVideoLibrarySurprise();
  }
  if (
    videoLibraryCategoryTransitionRunning &&
    (route !== 'video-library' || options.categoryTransitionToken !== videoLibraryCategoryTransitionToken)
  ) {
    cancelVideoLibraryCategoryTransition();
  }
  const isVideoLibraryNavigationRender = pendingVideoLibraryNavigationRender;
  pendingVideoLibraryNavigationRender = false;
  if (videoLibraryTransitionRunning && (!isVideoLibraryNavigationRender || route !== 'video-library')) {
    cancelVideoLibraryNavigation();
    if (videoLibraryState.transitionMode === 'card' || videoLibraryState.transitionMode === 'jump') {
      videoLibraryState = {
        ...videoLibraryState,
        transitionFromId: null,
        transitionRetainedIds: [],
        transitionMode: 'none',
      };
    }
  }
  const markup = applyImageLoadingHints(
    createAppMarkup(route, activeFilter, videosState, activeSeason, videoLibraryState),
  );

  if (sequence !== renderSequence || route !== getCurrentRoute()) {
    return;
  }

  const complexTransitionOrigin = pendingComplexTransitionOrigin;
  pendingComplexTransitionOrigin = null;
  const routeChanged = lastRenderedRoute !== null && lastRenderedRoute !== route;
  const enteringVideoLibrary = route === 'video-library' && lastRenderedRoute !== route;
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
    setupVideoLibraryDurations();
    const navInner = document.querySelector<HTMLElement>('.bottom-nav__inner');

    if (navInner) {
      navInner.style.setProperty('--active-indicator-left', lastBottomNavIndicatorLeft);
    }

    updateBottomNavIndicatorPosition();
    updateVideoLibraryCategoryIndicator(!options.suppressCategoryIndicatorMotion);
    if (route === 'video-library' && enteringVideoLibrary) {
      const categories = root.querySelector<HTMLElement>('[data-library-categories]');
      if (categories) categories.scrollLeft = 0;
      pendingVideoLibraryCategoryScrollLeft = null;
    }
    if (route === 'video-library' && pendingVideoLibraryCategoryScrollLeft !== null) {
      const categories = root.querySelector<HTMLElement>('[data-library-categories]');
      if (categories && pendingVideoLibraryCategoryScrollLeft !== null) {
        categories.scrollLeft = pendingVideoLibraryCategoryScrollLeft;
      }
      pendingVideoLibraryCategoryScrollLeft = null;
    }
    if (route === 'video-library' && !videoLibraryTransitionRunning) {
      const visibleItems = getVisibleVideoLibraryItems();
      videoLibraryDisplayedId = videoLibraryState.activeId ?? visibleItems[0]?.id ?? null;
    }
    lastRenderedRoute = route;
  };

  pendingTransitionDirection = null;

  if (
    route === 'video-library' &&
    lastRenderedRoute === route &&
    videoLibraryState.transitionMode === 'jump' &&
    typeof (document as Document & { startViewTransition?: (callback: () => void) => { finished: Promise<void> } }).startViewTransition === 'function' &&
    !reducedMotion
  ) {
    const transitionDocument = document as Document & {
      startViewTransition(callback: () => void): { finished: Promise<void> };
    };
    const transitionMode = videoLibraryState.transitionMode;
    if (videoLibraryState.transitionMode === 'jump') {
      const oldCarousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
      oldCarousel?.style.setProperty('view-transition-name', 'video-library-carousel');
      root.querySelectorAll<HTMLElement>('.video-library-card').forEach((card) => {
        card.style.setProperty('view-transition-name', 'none');
      });
    }
    const transition = transitionDocument.startViewTransition(() => {
      if (sequence !== renderSequence || route !== getCurrentRoute()) return;
      updatePageMarkup(markup);
      finishMarkupUpdate();
    });
    const transitionTargetId = videoLibraryTransitionTargetId ?? videoLibraryState.activeId;
    const transitionToken = videoLibraryTransitionToken;
    const finishVideoLibraryTransition = (): void => {
      if (sequence !== renderSequence) return;
      finishVideoLibraryCardTransition(transitionToken, transitionTargetId, 20);
      if (transitionMode === 'jump') {
        const carousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
        carousel?.style.setProperty('view-transition-name', 'none');
        root.querySelectorAll<HTMLButtonElement>('.video-library-card[data-library-id]').forEach((card) => {
          const id = card.dataset.libraryId ?? '';
          card.style.setProperty('view-transition-name', `video-library-card-${id.replace(/[^A-Za-z0-9_-]/gu, '-')}`);
        });
      }
    };
    void transition.finished.then(finishVideoLibraryTransition, finishVideoLibraryTransition);
    return;
  }

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

  const fallbackCarouselSnapshot =
    route === 'video-library' &&
    lastRenderedRoute === route &&
    videoLibraryState.transitionMode === 'jump' &&
    !reducedMotion
      ? root.querySelector<HTMLElement>('.video-library__carousel-content')?.cloneNode(true) as HTMLElement | undefined
      : undefined;

  const categoryTransitionHeight = options.categoryTransitionToken === videoLibraryCategoryTransitionToken
    ? options.categoryTransitionHeight
    : undefined;
  const preserveSearchFieldState = Boolean(root.querySelector('.video-library__search'));
  const videoLibraryCardFrames = route === 'video-library' &&
    lastRenderedRoute === route &&
    videoLibraryState.transitionMode === 'card' &&
    !reducedMotion
    ? captureVideoLibraryCardFrames()
    : null;
  updatePageMarkup(markup, categoryTransitionHeight);
  if (videoLibraryCardFrames) animateVideoLibraryCardTransition(videoLibraryCardFrames);
  if (preserveSearchFieldState) {
    root.querySelector('.video-library__search')?.classList.add('video-library__search--stable');
  }
  if (fallbackCarouselSnapshot) {
    fallbackCarouselSnapshot.classList.add('video-library__carousel-content--outgoing');
    fallbackCarouselSnapshot.style.setProperty('view-transition-name', 'none');
    fallbackCarouselSnapshot.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.setProperty('view-transition-name', 'none');
    });
    root.querySelector('.video-library__carousel-content')?.append(fallbackCarouselSnapshot);
    fallbackCarouselSnapshot.addEventListener('animationend', () => fallbackCarouselSnapshot.remove(), { once: true });
    window.setTimeout(() => fallbackCarouselSnapshot.remove(), 240);
    const incomingCarousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
    incomingCarousel?.classList.add('video-library__carousel-content--incoming');
    incomingCarousel?.addEventListener('animationend', () => {
      incomingCarousel.classList.remove('video-library__carousel-content--incoming');
    }, { once: true });
    window.setTimeout(() => incomingCarousel?.classList.remove('video-library__carousel-content--incoming'), 240);
  }
  animateVideoLibrarySearchOpen();
  finishMarkupUpdate();
  if (videoLibraryState.transitionMode !== 'none') {
    const transitionMode = videoLibraryState.transitionMode;
    const carousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
    carousel?.style.setProperty('view-transition-name', 'none');
    root.querySelectorAll<HTMLButtonElement>('.video-library-card[data-library-id]').forEach((card) => {
      const id = card.dataset.libraryId ?? '';
      card.style.setProperty('view-transition-name', `video-library-card-${id.replace(/[^A-Za-z0-9_-]/gu, '-')}`);
    });
    if (transitionMode === 'card' || transitionMode === 'jump') {
      const targetId = videoLibraryTransitionTargetId ?? videoLibraryState.activeId;
      const transitionToken = videoLibraryTransitionToken;
      window.setTimeout(() => {
        finishVideoLibraryCardTransition(transitionToken, targetId, 0);
      }, reducedMotion ? 0 : 340);
    } else {
      videoLibraryState = { ...videoLibraryState, transitionFromId: null, transitionRetainedIds: [], transitionMode: 'none' };
    }
  }

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

function clearVideoLibraryTransitionLayerClasses(): void {
  root.querySelectorAll<HTMLElement>(
    '.video-library-card.is-transition-promoting, .video-library-card.is-transition-demoting, .video-library-card.is-waapi-transitioning',
  )
    .forEach((card) => {
      card.classList.remove('is-transition-promoting', 'is-transition-demoting', 'is-waapi-transitioning');
    });
}

function captureVideoLibraryCardFrames(): Map<string, VideoLibraryCardFrame> {
  const frames = new Map<string, VideoLibraryCardFrame>();
  root.querySelectorAll<HTMLElement>('.video-library-card[data-library-id]').forEach((card) => {
    const id = card.dataset.libraryId;
    if (!id) return;
    const style = window.getComputedStyle(card);
    frames.set(id, { transform: style.transform, translate: style.translate, opacity: style.opacity });
  });
  return frames;
}

function animateVideoLibraryCardTransition(frames: Map<string, VideoLibraryCardFrame>): void {
  videoLibraryCardAnimations.forEach((animation) => animation.cancel());
  videoLibraryCardAnimations = [];
  const cards = [...root.querySelectorAll<HTMLElement>('.video-library-card[data-library-id]')];
  cards.forEach((card) => card.classList.add('is-waapi-transitioning'));

  for (const card of cards) {
    const id = card.dataset.libraryId;
    if (!id) continue;
    const targetStyle = window.getComputedStyle(card);
    const target: VideoLibraryCardFrame = {
      transform: targetStyle.transform,
      translate: targetStyle.translate,
      opacity: targetStyle.opacity,
    };
    const from = frames.get(id) ?? { ...target, opacity: '0' };
    if (
      from.transform === target.transform &&
      from.translate === target.translate &&
      from.opacity === target.opacity
    ) {
      continue;
    }

    const animation = card.animate(
      [from, target],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    videoLibraryCardAnimations.push(animation);
    void animation.finished.then(
      () => {
        animation.cancel();
        videoLibraryCardAnimations = videoLibraryCardAnimations.filter((active) => active !== animation);
      },
      () => {
        videoLibraryCardAnimations = videoLibraryCardAnimations.filter((active) => active !== animation);
      },
    );
  }
}

function cancelVideoLibraryCardAnimations(): void {
  videoLibraryCardAnimations.forEach((animation) => animation.cancel());
  videoLibraryCardAnimations = [];
  root.querySelectorAll<HTMLElement>('.video-library-card.is-waapi-transitioning')
    .forEach((card) => card.classList.remove('is-waapi-transitioning'));
}

function animateVideoLibrarySearchOpen(): void {
  const previousTop = pendingVideoLibraryWheelTop;
  pendingVideoLibraryWheelTop = null;

  if (previousTop === null || getCurrentRoute() !== 'video-library' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const wheel = root.querySelector<HTMLElement>('.video-library__wheel');
  if (!wheel) return;

  const offset = previousTop - wheel.getBoundingClientRect().top;
  if (Math.abs(offset) < 1) return;

  wheel.classList.add('video-library__wheel--search-opening');
  wheel.style.transform = `translateY(${offset}px)`;
  void wheel.offsetHeight;

  const finish = (event?: TransitionEvent): void => {
    if (event && (event.target !== wheel || event.propertyName !== 'transform')) return;
    wheel.classList.remove('video-library__wheel--search-opening');
    wheel.removeEventListener('transitionend', onTransitionEnd);
  };
  const onTransitionEnd = (event: TransitionEvent): void => finish(event);

  wheel.addEventListener('transitionend', onTransitionEnd);
  window.requestAnimationFrame(() => wheel.style.removeProperty('transform'));
  window.setTimeout(() => finish(), 450);
}

function setupVideoLibraryDurations(): void {
  if (getCurrentRoute() !== 'video-library') {
    return;
  }

  root.querySelectorAll<HTMLButtonElement>('.video-library-card[data-media-id][data-media-source]').forEach((card) => {
    const mediaId = card.dataset.mediaId;
    const sourceType = card.dataset.mediaSource;
    const duration = card.querySelector<HTMLElement>('[data-library-duration]');

    if (!mediaId || !sourceType || !duration || !duration.hidden) {
      return;
    }

    const cacheKey = `${sourceType}:${mediaId}`;
    let durationPromise = videoLibraryDurationPromises.get(cacheKey);
    if (!durationPromise) {
      durationPromise = sourceType === 'mp4'
        ? loadMp4Duration(mediaId)
        : loadHlsDuration(mediaId);
      videoLibraryDurationPromises.set(cacheKey, durationPromise);
    }

    void durationPromise.then((label) => {
      if (!label || getCurrentRoute() !== 'video-library') {
        return;
      }

      root.querySelectorAll<HTMLButtonElement>(`.video-library-card[data-media-id="${CSS.escape(mediaId)}"] [data-library-duration]`).forEach((badge) => {
        badge.textContent = label;
        badge.hidden = false;
      });
    });
  });
}

function loadMp4Duration(mediaId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), 12_000);
    const finish = (label: string | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      resolve(label);
    };

    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => {
      finish(Number.isFinite(video.duration) ? formatVideoDuration(video.duration) : null);
    }, { once: true });
    video.addEventListener('error', () => finish(null), { once: true });
    video.src = `/media/${encodeURIComponent(mediaId)}/video.mp4`;
    video.load();
  });
}

async function loadHlsDuration(mediaId: string): Promise<string | null> {
  try {
    const masterUrl = `/media/${encodeURIComponent(mediaId)}/master.m3u8`;
    const masterResponse = await fetch(masterUrl, { credentials: 'same-origin' });
    if (!masterResponse.ok) return null;
    const master = await masterResponse.text();
    const masterDuration = getHlsPlaylistDuration(master);
    if (masterDuration !== null) return formatVideoDuration(masterDuration);

    const variantPath = master.split(/\r?\n/u).map((line) => line.trim()).find((line) => line && !line.startsWith('#'));
    if (!variantPath) return null;
    const variantUrl = new URL(variantPath, new URL(masterUrl, window.location.href));
    const variantResponse = await fetch(variantUrl, { credentials: 'same-origin' });
    if (!variantResponse.ok) return null;
    const duration = getHlsPlaylistDuration(await variantResponse.text());
    return duration === null ? null : formatVideoDuration(duration);
  } catch {
    return null;
  }
}

function getHlsPlaylistDuration(playlist: string): number | null {
  const durations = [...playlist.matchAll(/^#EXTINF:([\d.]+)/gmu)]
    .map((match) => Number(match[1]))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  return durations.length > 0 ? durations.reduce((total, duration) => total + duration, 0) : null;
}

function formatVideoDuration(durationSeconds: number): string {
  const seconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
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

function updatePageMarkup(markup: string, categoryTransitionHeight?: number): void {
  const prepareCategoryIncomingCarousel = (content: ParentNode | null): void => {
    if (categoryTransitionHeight === undefined || !content) return;
    const carousel = content.querySelector<HTMLElement>('.video-library__carousel-content');
    if (!carousel) return;
    carousel.style.height = `${categoryTransitionHeight}px`;
    carousel.style.opacity = '0';
    carousel.classList.add('video-library__carousel-content--category-switching');
  };

  const currentShell = root.querySelector<HTMLElement>(':scope > .app-shell');

  if (!currentShell) {
    root.innerHTML = markup;
    prepareCategoryIncomingCarousel(root);
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
    prepareCategoryIncomingCarousel(root);
    return;
  }

  const updateReusedVideoLibraryCards =
    getCurrentRoute() === 'video-library' && videoLibraryState.transitionMode === 'card'
      ? reuseVideoLibraryCardNodes(currentContent, nextContent)
      : () => {};
  const updateReusedVideoLibraryProgressFill = getCurrentRoute() === 'video-library'
    ? reuseVideoLibraryProgressFill(currentContent, nextContent)
    : () => {};
  prepareCategoryIncomingCarousel(nextContent);
  currentShell.className = nextShell.className;
  if (nextShell.dataset.seasonTheme) {
    currentShell.dataset.seasonTheme = nextShell.dataset.seasonTheme;
  } else {
    delete currentShell.dataset.seasonTheme;
  }
  currentHeader.replaceWith(nextHeader);
  currentContent.replaceWith(nextContent);
  updateReusedVideoLibraryCards();
  updateReusedVideoLibraryProgressFill();

  const currentTabs = currentNav.querySelectorAll<HTMLElement>('.bottom-nav__tab');
  const nextTabs = nextNav.querySelectorAll<HTMLElement>('.bottom-nav__tab');

  currentTabs.forEach((tab, index) => {
    tab.classList.toggle(
      'bottom-nav__tab--active',
      nextTabs[index]?.classList.contains('bottom-nav__tab--active') ?? false,
    );
  });
}

function reuseVideoLibraryProgressFill(currentContent: HTMLElement, nextContent: HTMLElement): () => void {
  const token = ++videoLibraryProgressUpdateToken;
  const currentProgress = currentContent.querySelector<HTMLElement>('.video-library__carousel-progress');
  const nextProgress = nextContent.querySelector<HTMLElement>('.video-library__carousel-progress');
  if (!currentProgress || !nextProgress) return () => {};

  const currentFill = currentContent.querySelector<HTMLElement>('[data-library-progress-fill]');
  const nextFill = nextContent.querySelector<HTMLElement>('[data-library-progress-fill]');
  const currentPosition = currentProgress.querySelector<HTMLElement>('.video-library__position');
  const nextPosition = nextProgress.querySelector<HTMLElement>('.video-library__position');
  const currentPositionParts = currentPosition?.querySelectorAll<HTMLElement>('span');
  const nextPositionParts = nextPosition?.querySelectorAll<HTMLElement>('span');
  const currentTrack = currentProgress.querySelector<HTMLElement>('.video-library__progress-track');
  const nextTrack = nextProgress.querySelector<HTMLElement>('.video-library__progress-track');
  if (
    !currentFill || !nextFill || !currentPositionParts || !nextPositionParts ||
    currentPositionParts.length !== nextPositionParts.length || !currentTrack || !nextTrack
  ) {
    return () => {};
  }

  const targetWidth = nextFill.style.width;
  const startingWidth = window.getComputedStyle(currentFill).width;
  currentPositionParts.forEach((part, index) => {
    part.textContent = nextPositionParts[index]?.textContent ?? '';
  });
  for (const { name, value } of [...nextTrack.attributes]) {
    currentTrack.setAttribute(name, value);
  }
  currentFill.style.transition = 'none';
  currentFill.style.width = startingWidth;
  void currentFill.offsetWidth;
  nextProgress.replaceWith(currentProgress);

  return () => {
    requestAnimationFrame(() => {
      if (token !== videoLibraryProgressUpdateToken || !currentFill.isConnected) return;
      currentFill.style.transition = '';
      currentFill.style.width = targetWidth;
    });
  };
}

function reuseVideoLibraryCardNodes(currentContent: HTMLElement, nextContent: HTMLElement): () => void {
  const currentCards = new Map<string, HTMLButtonElement>();
  currentContent.querySelectorAll<HTMLButtonElement>('.video-library-card[data-library-id]').forEach((card) => {
    if (card.closest('.video-library__carousel-content--outgoing')) return;
    const id = card.dataset.libraryId;
    if (id) currentCards.set(id, card);
  });

  const cardUpdates: Array<() => void> = [];
  nextContent.querySelectorAll<HTMLButtonElement>('.video-library-card[data-library-id]').forEach((nextCard) => {
    const id = nextCard.dataset.libraryId;
    const currentCard = id ? currentCards.get(id) : undefined;
    if (!currentCard) return;

    const nextAttributes = [...nextCard.attributes].map(({ name, value }) => [name, value] as const);
    const nextPlay = nextCard.querySelector<HTMLElement>('.video-library-card__play')?.cloneNode(true);
    nextCard.replaceWith(currentCard);
    currentCards.delete(id!);
    cardUpdates.push(() => {
      [...currentCard.attributes].forEach((attribute) => currentCard.removeAttribute(attribute.name));
      nextAttributes.forEach(([name, value]) => currentCard.setAttribute(name, value));

      const currentPlay = currentCard.querySelector<HTMLElement>('.video-library-card__play');
      if (currentPlay && !nextPlay) currentPlay.remove();
      if (!currentPlay && nextPlay) {
        currentCard.querySelector('.video-library-card__cover')?.append(nextPlay.cloneNode(true));
      }
    });
  });

  return () => cardUpdates.forEach((update) => update());
}

function getRouteTransitionDirection(from: AppRoute | null, to: AppRoute): PageTransitionDirection {
  if (!from) {
    return 'fade';
  }

  const getDepth = (route: AppRoute): number => {
    if (route === 'home') {
      return 0;
    }

    if (route === 'video-library') {
      return 1;
    }

    if (
      route === 'complex' ||
      route === 'fitness' ||
      route === 'seasonal' ||
      route === 'puppies' ||
      route === 'adult-large'
    ) {
      return 1;
    }

    if (route === 'puppy-fitness') {
      return 2;
    }

    if (route.startsWith('seasonal-list:')) {
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

  if (hash === 'video-library') {
    return 'video-library';
  }

  if (hash === 'complex') {
    return 'complex';
  }

  if (hash === 'seasonal') {
    return 'seasonal';
  }

  if (hash.startsWith('seasonal-list:')) {
    const route = hash as AppRoute;

    if (getSeasonalListRoute(route)) {
      return route;
    }
  }

  if (hash === 'dog-skills') {
    return 'dog-skills';
  }

  if (hash.startsWith('dog-skills-video:')) {
    const route = hash as AppRoute;

    if (isDogSkillsLessonRoute(route)) {
      return route;
    }
  }

  if (hash === 'fitness') {
    return 'fitness';
  }

  if (hash === 'puppy-fitness') {
    return 'puppy-fitness';
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

function getVisibleVideoLibraryItems() {
  const query = videoLibraryState.query.trim().toLocaleLowerCase();
  return getVideoLibraryItems().filter((item) =>
    (videoLibraryState.category === 'all' || item.category === videoLibraryState.category) &&
    (!query || item.searchText.includes(query)),
  );
}

async function runVideoLibrarySurprise(): Promise<void> {
  if (videoLibrarySurpriseRunning || videoLibraryCategoryTransitionRunning || getCurrentRoute() !== 'video-library') return;

  const visibleItems = getVisibleVideoLibraryItems();
  const availableItems = visibleItems.filter((item) => item.available);
  if (availableItems.length === 0) return;

  const currentId = videoLibraryTransitionRunning
    ? videoLibraryTransitionTargetId
    : videoLibraryState.activeId ?? videoLibraryDisplayedId;
  const alternatives = availableItems.filter((item) => item.id !== currentId);
  const choices = alternatives.length > 0 ? alternatives : availableItems;
  const selected = choices[Math.floor(Math.random() * choices.length)];
  if (!selected) return;

  const startedAt = performance.now();
  const token = ++videoLibrarySurpriseToken;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  videoLibrarySurpriseRunning = true;
  videoLibrarySurpriseButton = root.querySelector<HTMLButtonElement>('[data-library-surprise]');
  setVideoLibrarySurpriseButtonState(videoLibrarySurpriseButton, true);
  videoLibrarySurpriseButton?.classList.add('is-pressing');

  const pressDuration = reducedMotion ? 0 : 100;

  try {
    if (pressDuration > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, pressDuration));
    if (token !== videoLibrarySurpriseToken || !videoLibrarySurpriseRunning) return;

    const outgoingCarousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
    const outgoingSnapshot = !reducedMotion && outgoingCarousel
      ? createVideoLibrarySurpriseSnapshot(outgoingCarousel)
      : null;
    if (outgoingSnapshot) {
      videoLibrarySurpriseSnapshot = outgoingSnapshot;
      document.body.append(outgoingSnapshot);
    }

    const activeWheel = root.querySelector<HTMLElement>('[data-library-wheel]');
    activeWheel?.classList.remove('is-dragging');
    activeWheel?.style.setProperty('--wheel-drag-x', '0px');
    videoLibraryPointerStart = null;

    if (videoLibraryTransitionRunning) {
      cancelVideoLibraryNavigation();
    }

    videoLibraryState = {
      ...videoLibraryState,
      mode: 'wheel',
      activeId: selected.id,
      transitionFromId: null,
      transitionRetainedIds: [],
      transitionMode: 'none',
    };
    await render({ suppressCategoryIndicatorMotion: true });
    if (token !== videoLibrarySurpriseToken || !videoLibrarySurpriseRunning) return;

    const incomingButton = root.querySelector<HTMLButtonElement>('[data-library-surprise]');
    videoLibrarySurpriseButton = incomingButton;
    setVideoLibrarySurpriseButtonState(incomingButton, true);
    incomingButton?.classList.add('is-picking');

    const incomingCarousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
    if (incomingCarousel && outgoingSnapshot) {
      const outgoingAnimation = outgoingSnapshot.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 200, easing: 'ease-in-out', fill: 'both' },
      );
      const incomingAnimation = incomingCarousel.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 200, easing: 'ease-in-out', fill: 'both' },
      );
      videoLibrarySurpriseAnimations = [outgoingAnimation, incomingAnimation];
      await Promise.all(videoLibrarySurpriseAnimations.map((animation) => animation.finished.catch(() => undefined)));
      if (token !== videoLibrarySurpriseToken || !videoLibrarySurpriseRunning) return;
      clearVideoLibrarySurpriseTransition();
    }

    const animationDuration = reducedMotion ? 0 : 700;
    const remaining = Math.max(0, animationDuration - (performance.now() - startedAt));
    if (remaining > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
  } finally {
    if (token === videoLibrarySurpriseToken) finishVideoLibrarySurprise(token);
  }
}

function createVideoLibrarySurpriseSnapshot(carousel: HTMLElement): HTMLElement | null {
  const rect = carousel.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const snapshot = carousel.cloneNode(true) as HTMLElement;
  const carouselStyle = window.getComputedStyle(carousel);
  snapshot.classList.remove(
    'video-library__carousel-content--category-switching',
    'video-library__carousel-content--incoming',
    'video-library__carousel-content--outgoing',
    'video-library__carousel-content--surprise-outgoing',
  );
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  snapshot.style.position = 'fixed';
  snapshot.style.inset = 'auto';
  snapshot.style.left = `${rect.left}px`;
  snapshot.style.top = `${rect.top}px`;
  snapshot.style.width = `${rect.width}px`;
  snapshot.style.height = `${rect.height}px`;
  snapshot.style.margin = '0';
  snapshot.style.zIndex = '1000';
  snapshot.style.pointerEvents = 'none';
  snapshot.style.overflow = 'visible';
  snapshot.style.opacity = '1';
  snapshot.style.setProperty('view-transition-name', 'none');

  for (const property of ['--video-library-card-width', '--video-library-card-height']) {
    const value = carouselStyle.getPropertyValue(property).trim();
    if (value) snapshot.style.setProperty(property, value);
  }

  const cardFrames = new Map(
    [...carousel.querySelectorAll<HTMLElement>('.video-library-card[data-library-id]')].map((card) => {
      const frame = window.getComputedStyle(card);
      return [card.dataset.libraryId ?? '', {
        transform: frame.transform,
        translate: frame.translate,
        opacity: frame.opacity,
        zIndex: frame.zIndex,
      }] as const;
    }),
  );
  snapshot.querySelectorAll<HTMLElement>('.video-library-card[data-library-id]').forEach((card) => {
    const frame = cardFrames.get(card.dataset.libraryId ?? '');
    if (!frame) return;
    card.style.transform = frame.transform;
    card.style.setProperty('translate', frame.translate);
    card.style.opacity = frame.opacity;
    card.style.zIndex = frame.zIndex;
    card.style.setProperty('view-transition-name', 'none');
  });
  snapshot.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.setProperty('view-transition-name', 'none');
  });

  return snapshot;
}

function clearVideoLibrarySurpriseTransition(): void {
  videoLibrarySurpriseAnimations.forEach((animation) => animation.cancel());
  videoLibrarySurpriseAnimations = [];
  videoLibrarySurpriseSnapshot?.remove();
  videoLibrarySurpriseSnapshot = null;
}

function setVideoLibrarySurpriseButtonState(button: HTMLButtonElement | null, locked: boolean): void {
  if (!button) return;
  const hasAvailableVideos = getVisibleVideoLibraryItems().some((item) => item.available);
  button.disabled = locked || !hasAvailableVideos;
  button.setAttribute('aria-disabled', String(button.disabled));
  if (locked) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

function finishVideoLibrarySurprise(token: number): void {
  if (token !== videoLibrarySurpriseToken) return;
  clearVideoLibrarySurpriseTransition();
  videoLibrarySurpriseRunning = false;
  videoLibrarySurpriseButton?.classList.remove('is-pressing', 'is-picking');
  const button = root.querySelector<HTMLButtonElement>('[data-library-surprise]');
  setVideoLibrarySurpriseButtonState(button, false);
  videoLibrarySurpriseButton = null;
}

function cancelVideoLibrarySurprise(): void {
  videoLibrarySurpriseToken += 1;
  clearVideoLibrarySurpriseTransition();
  videoLibrarySurpriseRunning = false;
  videoLibrarySurpriseButton?.classList.remove('is-pressing', 'is-picking');
  videoLibrarySurpriseButton = null;
}

async function transitionVideoLibraryCategory(category: VideoLibraryFilter): Promise<void> {
  if (category === videoLibraryPendingCategory) return;

  if (category === videoLibraryState.category) {
    if (videoLibraryPendingCategory !== null) cancelVideoLibraryCategoryTransition();
    return;
  }

  const token = ++videoLibraryCategoryTransitionToken;
  cancelVideoLibraryCategoryHeightAnimation();
  videoLibraryPendingCategory = category;
  videoLibraryCategoryTransitionRunning = true;
  pendingVideoLibraryCategoryScrollLeft = root
    .querySelector<HTMLElement>('[data-library-categories]')
    ?.scrollLeft ?? 0;

  const categoryButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-library-category]')];
  pendingVideoLibraryCategoryIndicatorStart = getVideoLibraryCategoryIndicatorPosition();
  categoryButtons.forEach((button) => {
    const active = button.dataset.libraryCategory === category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateVideoLibraryCategoryIndicator();
  cancelVideoLibraryNavigation();
  videoLibraryState = {
    ...videoLibraryState,
    activeId: videoLibraryDisplayedId ?? videoLibraryState.activeId,
    transitionFromId: null,
    transitionRetainedIds: [],
    transitionMode: 'none',
  };

  const outgoing = root.querySelector<HTMLElement>('.video-library__carousel-content');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const filtered = getVideoLibraryItems().filter((item) => {
    const query = videoLibraryState.query.trim().toLocaleLowerCase();
    return (category === 'all' || item.category === category) && (!query || item.searchText.includes(query));
  });
  const activeId = filtered[0]?.id ?? null;

  if (!outgoing || reducedMotion) {
    videoLibraryState = { ...videoLibraryState, category, activeId };
    videoLibraryPendingCategory = null;
    videoLibraryCategoryTransitionRunning = false;
    pendingVideoLibraryCategoryIndicatorStart = getVideoLibraryCategoryIndicatorPosition() ?? pendingVideoLibraryCategoryIndicatorStart;
    await render({ categoryTransitionToken: token });
    return;
  }

  const retainedHeight = outgoing.getBoundingClientRect().height;
  outgoing.style.height = `${retainedHeight}px`;
  outgoing.classList.add('video-library__carousel-content--category-switching');
  if (!await animateVideoLibraryCarouselOpacity(outgoing, 0, 120, token)) return;
  if (token !== videoLibraryCategoryTransitionToken) return;

  videoLibraryState = { ...videoLibraryState, category, activeId };
  pendingVideoLibraryCategoryIndicatorStart = getVideoLibraryCategoryIndicatorPosition() ?? pendingVideoLibraryCategoryIndicatorStart;
  await render({
    categoryTransitionToken: token,
    categoryTransitionHeight: retainedHeight,
  });
  if (token !== videoLibraryCategoryTransitionToken) return;

  const incoming = root.querySelector<HTMLElement>('.video-library__carousel-content');
  if (!incoming) {
    finishVideoLibraryCategoryTransition(token, activeId);
    return;
  }

  incoming.style.height = `${retainedHeight}px`;
  incoming.classList.add('video-library__carousel-content--category-switching');
  if (!await animateVideoLibraryCarouselOpacity(incoming, 1, 180, token)) return;
  if (token !== videoLibraryCategoryTransitionToken) return;

  incoming.style.height = 'auto';
  const naturalHeight = incoming.getBoundingClientRect().height;
  incoming.style.height = `${retainedHeight}px`;
  if (!await animateVideoLibraryCarouselHeight(incoming, retainedHeight, naturalHeight, token)) return;
  finishVideoLibraryCategoryTransition(token, activeId);
}

async function animateVideoLibraryCarouselOpacity(
  carousel: HTMLElement,
  targetOpacity: 0 | 1,
  duration: number,
  token: number,
): Promise<boolean> {
  const currentOpacity = Number.parseFloat(window.getComputedStyle(carousel).opacity);
  const startingOpacity = Number.isFinite(currentOpacity) ? currentOpacity : 1;

  if (videoLibraryCategoryOpacityAnimation) {
    const previousCarousel = videoLibraryCategoryOpacityElement;
    if (previousCarousel) {
      const previousOpacity = Number.parseFloat(window.getComputedStyle(previousCarousel).opacity);
      previousCarousel.style.opacity = `${Number.isFinite(previousOpacity) ? previousOpacity : 1}`;
    }
    videoLibraryCategoryOpacityAnimation.cancel();
  }

  carousel.style.opacity = `${startingOpacity}`;
  const animation = carousel.animate(
    [{ opacity: startingOpacity }, { opacity: targetOpacity }],
    { duration, easing: 'ease-in-out', fill: 'forwards' },
  );
  videoLibraryCategoryOpacityAnimation = animation;
  videoLibraryCategoryOpacityElement = carousel;

  try {
    await animation.finished;
  } catch {
    return false;
  }

  if (token !== videoLibraryCategoryTransitionToken || videoLibraryCategoryOpacityAnimation !== animation) {
    return false;
  }

  carousel.style.opacity = `${targetOpacity}`;
  animation.cancel();
  videoLibraryCategoryOpacityAnimation = null;
  videoLibraryCategoryOpacityElement = null;
  return true;
}

async function animateVideoLibraryCarouselHeight(
  carousel: HTMLElement,
  startingHeight: number,
  targetHeight: number,
  token: number,
): Promise<boolean> {
  if (Math.abs(targetHeight - startingHeight) < 1) return token === videoLibraryCategoryTransitionToken;

  const animation = carousel.animate(
    [{ height: `${startingHeight}px` }, { height: `${targetHeight}px` }],
    { duration: 180, easing: 'ease-in-out', fill: 'forwards' },
  );
  videoLibraryCategoryHeightAnimation = animation;
  videoLibraryCategoryHeightElement = carousel;

  try {
    await animation.finished;
  } catch {
    return false;
  }

  if (token !== videoLibraryCategoryTransitionToken || videoLibraryCategoryHeightAnimation !== animation) {
    return false;
  }

  carousel.style.height = `${targetHeight}px`;
  animation.cancel();
  videoLibraryCategoryHeightAnimation = null;
  videoLibraryCategoryHeightElement = null;
  return true;
}

function cancelVideoLibraryCategoryHeightAnimation(): void {
  if (!videoLibraryCategoryHeightAnimation) return;

  const carousel = videoLibraryCategoryHeightElement;
  if (carousel) carousel.style.height = `${carousel.getBoundingClientRect().height}px`;
  videoLibraryCategoryHeightAnimation.cancel();
  videoLibraryCategoryHeightAnimation = null;
  videoLibraryCategoryHeightElement = null;
}

function finishVideoLibraryCategoryTransition(token: number, activeId: string | null): void {
  if (token !== videoLibraryCategoryTransitionToken) return;

  const carousel = root.querySelector<HTMLElement>('.video-library__carousel-content');
  carousel?.classList.remove('video-library__carousel-content--category-switching');
  carousel?.style.removeProperty('height');
  carousel?.style.removeProperty('opacity');
  videoLibraryPendingCategory = null;
  videoLibraryCategoryTransitionRunning = false;
  videoLibraryDisplayedId = activeId;
}

function cancelVideoLibraryCategoryTransition(): void {
  videoLibraryCategoryTransitionToken += 1;
  cancelVideoLibraryCategoryHeightAnimation();
  videoLibraryPendingCategory = null;
  videoLibraryCategoryTransitionRunning = false;
  pendingVideoLibraryCategoryScrollLeft = null;

  if (videoLibraryCategoryOpacityAnimation) {
    const previousCarousel = videoLibraryCategoryOpacityElement;
    if (previousCarousel) {
      previousCarousel.style.opacity = '1';
      previousCarousel.classList.remove('video-library__carousel-content--category-switching');
      previousCarousel.style.removeProperty('height');
    }
    videoLibraryCategoryOpacityAnimation.cancel();
    videoLibraryCategoryOpacityAnimation = null;
    videoLibraryCategoryOpacityElement = null;
  }

  root.querySelectorAll<HTMLElement>('.video-library__carousel-content--category-switching').forEach((carousel) => {
    carousel.classList.remove('video-library__carousel-content--category-switching');
    carousel.style.removeProperty('opacity');
    carousel.style.removeProperty('height');
  });

  const categoryButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-library-category]')];
  const activeButton = categoryButtons.find((button) => button.dataset.libraryCategory === videoLibraryState.category);
  const previousButton = categoryButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
  pendingVideoLibraryCategoryIndicatorStart = previousButton
    ? { x: previousButton.offsetLeft, width: previousButton.offsetWidth }
    : null;
  categoryButtons.forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateVideoLibraryCategoryIndicator();
}

function selectVideoLibraryItem(
  items: ReturnType<typeof getVisibleVideoLibraryItems>,
  index: number,
): 'render' | 'queued' | 'none' {
  const item = items[index];
  if (!item) return 'none';
  const baseIndex = getVideoLibraryNavigationBaseIndex(items);
  if (items[baseIndex]?.id === item.id) return 'none';
  const mode: VideoLibraryNavigationMode = Math.abs(index - baseIndex) > 1 ? 'jump' : 'card';
  if (videoLibraryTransitionRunning) {
    videoLibraryNavigationQueue.push({ targetId: item.id, mode });
    return 'queued';
  }

  beginVideoLibrarySelection(items, item.id, mode);
  return 'render';
}

function getVideoLibraryNavigationBaseIndex(items: ReturnType<typeof getVisibleVideoLibraryItems>): number {
  const queuedTarget = videoLibraryNavigationQueue[videoLibraryNavigationQueue.length - 1]?.targetId;
  const baseId = queuedTarget ?? (videoLibraryTransitionRunning
    ? videoLibraryTransitionTargetId
    : videoLibraryState.activeId ?? videoLibraryDisplayedId);
  const baseIndex = baseId ? items.findIndex((item) => item.id === baseId) : -1;
  return baseIndex >= 0 ? baseIndex : 0;
}

function beginVideoLibrarySelection(
  items: ReturnType<typeof getVisibleVideoLibraryItems>,
  targetId: string,
  mode: VideoLibraryNavigationMode,
): void {
  const sourceId = videoLibraryDisplayedId ?? videoLibraryState.activeId ?? items[0]?.id ?? null;
  if (!sourceId || sourceId === targetId) return;
  const transitionRetainedIds = new Set<string>();
  if (mode === 'card') {
    root.querySelectorAll<HTMLElement>('.video-library-card[data-library-id]').forEach((card) => {
      const id = card.dataset.libraryId;
      if (id) transitionRetainedIds.add(id);
    });
    transitionRetainedIds.add(sourceId);
  }

  videoLibraryTransitionToken += 1;
  videoLibraryTransitionRunning = true;
  videoLibraryTransitionTargetId = targetId;
  pendingVideoLibraryNavigationRender = true;

  videoLibraryState = {
    ...videoLibraryState,
    activeId: targetId,
    transitionFromId: mode === 'card' ? sourceId : null,
    transitionRetainedIds: [...transitionRetainedIds],
    transitionMode: mode,
  };
}

function cancelVideoLibraryNavigation(): void {
  videoLibraryTransitionToken += 1;
  videoLibraryTransitionRunning = false;
  videoLibraryTransitionTargetId = null;
  pendingVideoLibraryNavigationRender = false;
  videoLibraryNavigationQueue = [];
  videoLibraryWheelDelta = 0;
  videoLibraryWheelDirection = 0;
  cancelVideoLibraryCardAnimations();
  clearVideoLibraryTransitionLayerClasses();
}

function finishVideoLibraryCardTransition(
  token: number,
  targetId: string | null,
  cleanupDelay: number,
): void {
  if (token !== videoLibraryTransitionToken || !videoLibraryTransitionRunning) return;
  const completedId = targetId ?? videoLibraryState.activeId;
  if (!completedId) {
    cancelVideoLibraryNavigation();
    return;
  }

  videoLibraryDisplayedId = completedId;
  videoLibraryState = {
    ...videoLibraryState,
    activeId: completedId,
    transitionFromId: null,
    transitionRetainedIds: [],
    transitionMode: 'none',
  };

  const finishCleanup = (): void => {
    if (token !== videoLibraryTransitionToken || !videoLibraryTransitionRunning) return;
    cancelVideoLibraryCardAnimations();
    clearVideoLibraryTransitionLayerClasses();
    pruneVideoLibraryTransitionCards();
    videoLibraryTransitionRunning = false;
    videoLibraryTransitionTargetId = null;
    startNextVideoLibraryNavigation();
  };

  if (cleanupDelay > 0) window.setTimeout(finishCleanup, cleanupDelay);
  else finishCleanup();
}

function startNextVideoLibraryNavigation(): void {
  if (videoLibraryTransitionRunning || getCurrentRoute() !== 'video-library') return;
  while (videoLibraryNavigationQueue.length > 0) {
    const next = videoLibraryNavigationQueue.shift()!;
    const items = getVisibleVideoLibraryItems();
    if (!items.some((item) => item.id === next.targetId) || next.targetId === videoLibraryDisplayedId) continue;
    beginVideoLibrarySelection(items, next.targetId, next.mode);
    if (videoLibraryTransitionRunning) {
      void render();
      return;
    }
  }
}

function pruneVideoLibraryTransitionCards(): void {
  if (getCurrentRoute() !== 'video-library') return;
  const items = getVisibleVideoLibraryItems();
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === videoLibraryState.activeId));
  const retainedIds = new Set(
    items
      .filter((_item, index) => Math.abs(index - activeIndex) <= 2)
      .map((item) => item.id),
  );
  root.querySelectorAll<HTMLButtonElement>('.video-library-card[data-library-id]').forEach((card) => {
    if (!retainedIds.has(card.dataset.libraryId ?? '')) card.remove();
  });
}

function getVideoLibraryCategoryIndicatorPosition(): { x: number; width: number } | null {
  const categories = root.querySelector<HTMLElement>('[data-library-categories]');
  const indicator = categories?.querySelector<HTMLElement>('[data-library-category-indicator]');
  if (!categories || !indicator) return null;
  const categoriesRect = categories.getBoundingClientRect();
  const indicatorRect = indicator.getBoundingClientRect();
  return {
    x: indicatorRect.left - categoriesRect.left + categories.scrollLeft,
    width: indicatorRect.width,
  };
}

function updateVideoLibraryCategoryIndicator(animate = true): void {
  const categories = root.querySelector<HTMLElement>('[data-library-categories]');
  const indicator = categories?.querySelector<HTMLElement>('[data-library-category-indicator]');
  const active = categories?.querySelector<HTMLElement>('[data-library-category][aria-pressed="true"]');
  if (!indicator || !active) {
    pendingVideoLibraryCategoryIndicatorStart = null;
    return;
  }

  const targetX = active.offsetLeft;
  const targetWidth = active.offsetWidth;
  const start = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? null
    : pendingVideoLibraryCategoryIndicatorStart;
  pendingVideoLibraryCategoryIndicatorStart = null;
  if (!start || !animate) {
    const previousTransition = indicator.style.transition;
    indicator.style.transition = 'none';
    indicator.style.width = `${targetWidth}px`;
    indicator.style.transform = `translateX(${targetX}px)`;
    void indicator.offsetWidth;
    indicator.style.transition = previousTransition;
    return;
  }

  indicator.style.transition = 'none';
  indicator.style.width = `${start.width}px`;
  indicator.style.transform = `translateX(${start.x}px)`;
  void indicator.offsetWidth;
  requestAnimationFrame(() => {
    if (!indicator.isConnected) return;
    indicator.style.transition = '';
    indicator.style.width = `${targetWidth}px`;
    indicator.style.transform = `translateX(${targetX}px)`;
  });
}

async function syncRouteState(): Promise<void> {
  const sequence = ++routeSyncSequence;
  videoCatalogAbortController?.abort();
  videoCatalogAbortController = null;
  const route = getCurrentRoute();
  const videoSourceSlug = getVideoSourceSlugForRoute(route);
  const seasonalListRoute = getSeasonalListRoute(route);

  if (seasonalListRoute) {
    activeSeason = seasonalListRoute.season;
    storeActiveSeason(activeSeason);
  }

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
  if (currentRoute.startsWith('lesson-video:') || currentRoute.startsWith('dog-skills-video:')) {
    return [fallbackRoute, 'video-library'];
  }

  if (isSeasonalVideoRoute(currentRoute) && fallbackRoute === 'seasonal') {
    return [
      'seasonal',
      'seasonal-list:autumn:walks',
      'seasonal-list:autumn:tips',
    ];
  }

  if (currentRoute.startsWith('puppy-topic:') && fallbackRoute === 'puppy-fitness') {
    return ['puppy-fitness', 'fitness'];
  }

  if (
    currentRoute.startsWith('adult-large-topic:')
    && fallbackRoute === 'adult-large-situation:adult-large-fitness'
  ) {
    return ['adult-large-situation:adult-large-fitness', 'fitness'];
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
