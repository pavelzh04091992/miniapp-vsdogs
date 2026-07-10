import {
  AppRoute,
  PuppyFilter,
  SituationVideosState,
  createAppMarkup,
  createUnsupportedEnvironmentMarkup,
  getVideoSourceSlugForRoute,
} from './app';
import { fetchSituationVideos } from './lib/videos';
import { getTelegramWebApp, initTelegramWebApp, isTelegramMiniAppLaunch } from './lib/telegram';
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

if (!webApp) {
  root.innerHTML = createUnsupportedEnvironmentMarkup();
  document.documentElement.dataset.launchContext = 'unsupported';
} else {
  document.documentElement.dataset.launchContext = 'telegram';
  document.documentElement.dataset.tgPlatform = webApp.platform || 'unknown';
  void syncRouteState();
  window.addEventListener('hashchange', () => {
    void syncRouteState();
  });
  window.addEventListener('resize', () => {
    updateBottomNavIndicatorPosition();
  });
}

document.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const adultMenu = document.querySelector<HTMLElement>('.adult-program-menu');
  const adultProgramCard = target.closest<HTMLElement>('.program-grid > .program-card:nth-child(3)');
  const clickedInsideAdultMenu = Boolean(target.closest('.adult-program-menu'));

  if (adultProgramCard) {
    toggleAdultProgramMenu(adultProgramCard);
    return;
  }

  if (adultMenu && !clickedInsideAdultMenu) {
    closeAdultProgramMenu();
  }

  const rutubeExpandButton = target.closest<HTMLElement>('[data-rutube-expand]');

  if (rutubeExpandButton) {
    const shouldExpand = rutubeExpandButton.dataset.rutubeExpand === 'true';
    setRutubeExpanded(shouldExpand);
    return;
  }

  const routeButton = target.closest<HTMLElement>('[data-route]');

  if (routeButton) {
    const route = routeButton.dataset.route as AppRoute | undefined;

    if (!route) {
      return;
    }

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

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (document.documentElement.dataset.rutubeExpanded === 'true') {
    setRutubeExpanded(false);
  }
});

function render(): void {
  if (!webApp) {
    return;
  }

  root.innerHTML = createAppMarkup(getCurrentRoute(), activeFilter, videosState);
  document.documentElement.dataset.rutubeExpanded = 'false';
  setupAdultProgramMenu();
  const navInner = document.querySelector<HTMLElement>('.bottom-nav__inner');

  if (navInner) {
    navInner.style.setProperty('--active-indicator-left', lastBottomNavIndicatorLeft);
  }

  updateBottomNavIndicatorPosition();
}

function getCurrentRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#/, '');

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

  if (hash === 'puppy-toilet-home-player') {
    return 'puppy-toilet-home-player';
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
        message: 'Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р в„–РЎвЂљР Вµ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ РЎРЊР С”РЎР‚Р В°Р Р… РЎвЂЎРЎС“РЎвЂљРЎРЉ Р С—Р С•Р В·Р В¶Р Вµ',
      };
    }

    render();
    return;
  }

  if (route === 'puppy-toilet-home-player') {
    videosState = { status: 'idle' };
    render();
    return;
  }

  videosState = { status: 'idle' };
  render();
}

function navigateTo(route: AppRoute): void {
  if (route === 'home') {
    window.location.hash = '';
    void syncRouteState();
    return;
  }

  window.location.hash = `#${route}`;
}

function showFeedback(message: string): void {
  const activeWebApp = webApp ?? getTelegramWebApp();

  activeWebApp?.HapticFeedback?.impactOccurred('light');

  if (activeWebApp?.showAlert) {
    activeWebApp.showAlert(message);
    return;
  }

  window.alert(message);
}

function openExternalUrl(url: string): void {
  const activeWebApp = webApp ?? getTelegramWebApp();

  if (url.startsWith('https://t.me/') || url.startsWith('http://t.me/')) {
    if (activeWebApp?.openTelegramLink) {
      activeWebApp.openTelegramLink(url);
      return;
    }
  } else if (activeWebApp?.openLink) {
    activeWebApp.openLink(url);
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

function setRutubeExpanded(expanded: boolean): void {
  const playerCard = document.querySelector<HTMLElement>('.rutube-player-card');

  if (!playerCard) {
    return;
  }

  playerCard.classList.toggle('rutube-player-card--expanded', expanded);
  document.documentElement.dataset.rutubeExpanded = expanded ? 'true' : 'false';
  document.body.style.overflow = expanded ? 'hidden' : '';
}

function setupAdultProgramMenu(): void {
  const programGrid = document.querySelector<HTMLElement>('.program-grid');
  const adultCard = document.querySelector<HTMLElement>('.program-grid > .program-card:nth-child(3)');

  if (!programGrid || !adultCard) {
    return;
  }

  adultCard.classList.add('program-card--adult-menu-anchor');

  let menu = programGrid.querySelector<HTMLElement>('.adult-program-menu');

  if (menu) {
    return;
  }

  menu = document.createElement('div');
  menu.className = 'adult-program-menu';
  menu.innerHTML = `
    <button
      class="adult-program-menu__button"
      type="button"
      data-adult-option="large"
      data-route="adult-large"
    >
      Большие собаки
    </button>
    <button
      class="adult-program-menu__button"
      type="button"
      data-adult-option="small"
      data-route="adult-small"
    >
      Маленькие собаки
    </button>
  `;

  programGrid.append(menu);
}

function toggleAdultProgramMenu(adultCard: HTMLElement): void {
  const menu = document.querySelector<HTMLElement>('.adult-program-menu');

  if (!menu) {
    return;
  }

  const isOpen = menu.classList.contains('adult-program-menu--open');

  if (isOpen) {
    closeAdultProgramMenu();
    return;
  }

  const programGrid = adultCard.closest<HTMLElement>('.program-grid');

  if (!programGrid) {
    return;
  }

  adultCard.classList.add('program-card--menu-open');
  menu.classList.add('adult-program-menu--measuring');
  menu.classList.add('adult-program-menu--open');

  const gridRect = programGrid.getBoundingClientRect();
  const cardRect = adultCard.getBoundingClientRect();
  const menuTop = cardRect.top - gridRect.top + cardRect.height / 2;
  const menuLeft = cardRect.left - gridRect.left + cardRect.width / 2;

  menu.style.width = `${Math.min(168, cardRect.width)}px`;
  menu.style.left = `${menuLeft}px`;
  menu.style.top = `${menuTop}px`;
  menu.classList.remove('adult-program-menu--measuring');
}

function closeAdultProgramMenu(): void {
  const menu = document.querySelector<HTMLElement>('.adult-program-menu');
  const adultCard = document.querySelector<HTMLElement>('.program-grid > .program-card:nth-child(3)');

  menu?.classList.remove('adult-program-menu--open');
  menu?.classList.remove('adult-program-menu--measuring');
  adultCard?.classList.remove('program-card--menu-open');
}
