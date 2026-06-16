import { SituationSlug, SituationVideo } from './lib/videos';

export type AppRoute = 'home' | 'puppies' | 'puppy-toilet-home';
export type PuppyFilter = 'all' | 'home' | 'walk' | 'behavior' | 'commands';
export type SituationVideosState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; videos: SituationVideo[] }
  | { status: 'error'; message: string };

interface SituationCard {
  id: string;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  category: Exclude<PuppyFilter, 'all'>;
  route?: AppRoute;
}

const puppySituations: SituationCard[] = [
  {
    id: 'puppyBites',
    title: 'Щенок кусается',
    description: 'Что делать, если щенок кусает руки во время игры',
    meta: '5 минут · легко',
    imagePath: '/assets/images/situations/puppy-bites.webp',
    cardClass: 'situation-card--blue',
    category: 'behavior',
  },
  {
    id: 'puppyToiletHome',
    title: 'Писает дома',
    description: 'Как приучать к туалету без крика и наказаний',
    meta: '7 минут · база',
    imagePath: '/assets/images/situations/puppy-toilet-home.webp',
    cardClass: 'situation-card--rose',
    category: 'home',
    route: 'puppy-toilet-home',
  },
  {
    id: 'puppyWhinesAtNight',
    title: 'Скулит ночью',
    description: 'Как помочь щенку спокойно привыкнуть к новому дому',
    meta: '6 минут · важно',
    imagePath: '/assets/images/situations/puppy-whines-night.webp',
    cardClass: 'situation-card--blue',
    category: 'commands',
  },
  {
    id: 'puppyChewsThings',
    title: 'Грызёт вещи',
    description: 'Почему щенок портит мебель и как переключить его',
    meta: '5 минут · поведение',
    imagePath: '/assets/images/situations/puppy-chews-things.webp',
    cardClass: 'situation-card--rose',
    category: 'walk',
  },
];

export function createAppMarkup(
  route: AppRoute,
  activeFilter: PuppyFilter,
  videosState: SituationVideosState,
): string {
  if (route === 'puppies') {
    return createPuppiesMarkup(activeFilter);
  }

  if (route === 'puppy-toilet-home') {
    return createSituationDetailMarkup('puppy-toilet-home', videosState);
  }

  return createHomeMarkup();
}

export function createUnsupportedEnvironmentMarkup(): string {
  const miniAppLink = getMiniAppLink();

  return `
    <main class="unsupported-shell">
      <section class="unsupported-card">
        <h1>Пожалуйста, откройте MiniApp</h1>
        <a class="unsupported-link" href="${miniAppLink}" rel="noreferrer">
          Открыть MiniApp
        </a>
      </section>
    </main>
  `;
}

function createHomeMarkup(): string {
  return `
    <div class="app-shell">
      <header class="home-header">
        <div class="content-frame content-frame--header">
          <button
            class="brand-mark js-feedback"
            type="button"
            aria-label="Высшая школа собак"
            data-feedback="Логотип школы собак"
          >
            <img src="/assets/logo-dog.svg" alt="" />
          </button>

          <h1 class="brand-title">Высшая школа собак</h1>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="hero-card" aria-labelledby="hero-title">
            <div class="hero-card__content">
              <h2 id="hero-title">Добро пожаловать!</h2>
              <p class="hero-card__description">
                Мы помогаем вам и вашей собаке понимать друг друга и быть одной командой
              </p>

              <button
                class="hero-card__cta js-feedback"
                type="button"
                data-feedback="Видео будет доступно позже"
              >
                <span class="hero-card__cta-icon" aria-hidden="true"></span>
                <span>Смотреть видео</span>
              </button>
            </div>

            <div class="hero-card__media">
              <img class="hero-card__dog" src="/assets/hero-dog.webp" alt="" />
            </div>
          </section>

          <section class="section-block" aria-labelledby="useful-title">
            <div class="section-heading">
              <h2 id="useful-title">Полезное</h2>
              <button
                class="section-link js-feedback"
                type="button"
                data-feedback="Раздел со всеми материалами пока в разработке"
              >
                <span>Смотреть всё</span>
                <span class="section-link__arrow" aria-hidden="true"></span>
              </button>
            </div>

            <div class="useful-grid" role="list" aria-label="Полезные материалы">
              ${createUsefulCard('Первый день дома', '/assets/useful-home.svg', 'useful-card--blue')}
              ${createUsefulCard('Ошибки воспитания', '/assets/useful-warning.svg', 'useful-card--rose')}
              ${createUsefulCard('Поводок', '/assets/useful-leash.svg', 'useful-card--blue')}
              ${createUsefulCard('Адаптация', '/assets/useful-heart.svg', 'useful-card--rose')}
              ${createUsefulCard('ТЕСТ', '', 'useful-card--gray')}
            </div>
          </section>

          <section class="section-block" aria-labelledby="programs-title">
            <div class="section-heading">
              <h2 id="programs-title">Программы</h2>
            </div>

            <div class="program-grid">
              ${createProgramCard(
                'Щенки',
                'Щенки',
                'Первые шаги к послушной и уверенной собаке',
                '/assets/images/programs/puppy.webp',
                'program-card--blue',
                { route: 'puppies' },
              )}
              ${createProgramCard(
                'Подростки',
                'Подростки',
                'Курс для собак подросткового возраста',
                '/assets/images/programs/teen_dog.webp',
                'program-card--rose',
                { feedback: 'Раздел "Подростки" пока в разработке' },
              )}
              ${createProgramCard(
                'Взрослые',
                'Взрослые',
                'Дрессировка и коррекция поведения',
                '/assets/images/programs/adult_dog.webp',
                'program-card--blue',
                { feedback: 'Раздел "Взрослые" пока в разработке' },
              )}
              ${createProgramCard(
                'Собаки из приюта',
                'Собаки<br />из приюта',
                'Помогаем начать новую жизнь вместе',
                '/assets/images/programs/shelter_dog.webp',
                'program-card--rose',
                { feedback: 'Раздел "Собаки из приюта" пока в разработке' },
              )}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('home')}
    </div>
  `;
}

function createPuppiesMarkup(activeFilter: PuppyFilter): string {
  const visibleSituations =
    activeFilter === 'all'
      ? puppySituations
      : puppySituations.filter((card) => card.category === activeFilter);

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="home" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">Щенки</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero" aria-labelledby="puppy-hero-title">
            <div class="puppy-hero__content">
              <h2 id="puppy-hero-title">Программа<br />для щенков</h2>
              <p class="puppy-hero__description">
                Первые шаги к спокойной, уверенной и послушной собаке
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img class="puppy-hero__image" src="/assets/images/programs/puppy-hero.webp" alt="" />
            </div>
          </section>

          <section class="section-block section-block--tight" aria-labelledby="situations-title">
            <div class="section-heading section-heading--solo">
              <h2 id="situations-title">Частые ситуации</h2>
            </div>

            <div class="filter-row" role="tablist" aria-label="Фильтры ситуаций">
              ${createFilterPill('Все', 'all', activeFilter)}
              ${createFilterPill('Дома', 'home', activeFilter)}
              ${createFilterPill('Прогулка', 'walk', activeFilter)}
              ${createFilterPill('Поведение', 'behavior', activeFilter)}
              ${createFilterPill('Команды', 'commands', activeFilter)}
            </div>

            <div class="situation-list">
              ${visibleSituations.map((card) => createSituationCard(card)).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createSituationDetailMarkup(slug: SituationSlug, videosState: SituationVideosState): string {
  const pageTitle = slug === 'puppy-toilet-home' ? 'Писает дома' : 'Ситуация';

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="puppies" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${pageTitle}</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Видео-разборы</h2>
            </div>

            ${createSituationVideoContent(videosState)}
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createSituationVideoContent(videosState: SituationVideosState): string {
  if (videosState.status === 'loading' || videosState.status === 'idle') {
    return `
      <section class="video-empty-card video-empty-card--loading" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--play" aria-hidden="true"></span>
        <h3>Загружаем видео</h3>
        <p>Подтягиваем актуальные видео из Telegram</p>
      </section>
    `;
  }

  if (videosState.status === 'error') {
    return `
      <section class="video-empty-card" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--alert" aria-hidden="true"></span>
        <h3>Не удалось загрузить видео</h3>
        <p>${videosState.message}</p>
      </section>
    `;
  }

  const videos = videosState.status === 'ready' ? videosState.videos : [];

  if (videos.length === 0) {
    return `
      <section class="video-empty-card" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--play" aria-hidden="true"></span>
        <h3>Видео пока нет</h3>
        <p>Когда в Telegram появятся видео по этой ситуации, они автоматически отобразятся здесь</p>
      </section>
    `;
  }

  return `
    <div class="video-card-list">
      ${videos.map((video) => createVideoCard(video)).join('')}
    </div>
  `;
}

function createVideoCard(video: SituationVideo): string {
  const feedback = `Открываем ${video.label.toLowerCase()} в Telegram`;

  return `
    <button
      class="video-card js-feedback"
      type="button"
      data-feedback="${feedback}"
      data-external-url="${video.telegramUrl}"
    >
      <span class="video-card__preview">
        <img src="${video.thumbnailUrl}" alt="" />
        <span class="video-card__play" aria-hidden="true">
          <span class="video-card__play-icon"></span>
        </span>
      </span>

      <span class="video-card__body">
        <span class="video-card__label">${video.label}</span>
        <span class="video-card__title">${video.title}</span>
        <span class="video-card__description">${video.description}</span>
        <span class="video-card__meta">${video.durationLabel} · ${video.sourceLabel}</span>
      </span>

      <span class="video-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createUsefulCard(title: string, iconPath: string, modifierClass: string): string {
  const iconMarkup =
    modifierClass === 'useful-card--gray'
      ? '<span class="useful-card__test-icon" aria-hidden="true"></span>'
      : `<img src="${iconPath}" alt="" />`;

  return `
    <button
      class="useful-card ${modifierClass} js-feedback"
      type="button"
      data-feedback="Материал &quot;${title}&quot; пока в разработке"
    >
      <span class="useful-card__icon">
        ${iconMarkup}
      </span>
      <span class="useful-card__title">${title}</span>
    </button>
  `;
}

function createProgramCard(
  _title: string,
  titleMarkup: string,
  description: string,
  imagePath: string,
  cardClass: string,
  action: { route?: AppRoute; feedback?: string },
): string {
  const cardClassAttr = action.route
    ? `class="program-card ${cardClass}"`
    : `class="program-card ${cardClass} js-feedback"`;
  const extraAttrs = action.route
    ? `data-route="${action.route}"`
    : `data-feedback="${action.feedback}"`;

  return `
    <button
      ${cardClassAttr}
      type="button"
      ${extraAttrs}
    >
      <span class="program-card__media">
        <img src="${imagePath}" alt="" />
      </span>
      <span class="program-card__body">
        <span class="program-card__title">${titleMarkup}</span>
        <span class="program-card__description">${description}</span>
        <span class="program-card__arrow" aria-hidden="true">
          <span class="program-card__arrow-icon"></span>
        </span>
      </span>
    </button>
  `;
}

function createFilterPill(label: string, value: PuppyFilter, activeFilter: PuppyFilter): string {
  const activeClass = value === activeFilter ? ' filter-pill--active' : '';

  return `
    <button
      class="filter-pill${activeClass}"
      type="button"
      role="tab"
      aria-selected="${value === activeFilter}"
      data-filter="${value}"
    >
      ${label}
    </button>
  `;
}

function createSituationCard(card: SituationCard): string {
  const routeAttrs = card.route ? `data-route="${card.route}"` : '';
  const feedbackClass = card.route ? '' : ' js-feedback';
  const feedbackAttrs = card.route
    ? ''
    : `data-feedback="Экран &quot;${card.title}&quot; пока в разработке"`;

  return `
    <button
      class="situation-card ${card.cardClass}${feedbackClass}"
      type="button"
      ${routeAttrs}
      ${feedbackAttrs}
    >
      <span class="situation-card__media">
        <img src="${card.imagePath}" alt="" />
      </span>

      <span class="situation-card__body">
        <span class="situation-card__title">${card.title}</span>
        <span class="situation-card__description">${card.description}</span>
        <span class="situation-card__meta">${card.meta}</span>
      </span>

      <span class="situation-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createBottomNav(activeTab: 'home' | 'lessons' | 'chat'): string {
  return `
    <nav class="bottom-nav" aria-label="Основная навигация">
      <div class="bottom-nav__inner">
        <span class="bottom-nav__indicator" aria-hidden="true"></span>
        ${createNavTab('Главная', 'home', activeTab === 'home', 'home')}
        ${createNavTab('Уроки', 'lessons', activeTab === 'lessons', 'puppies')}
        ${createNavTab(
          'Чат с кинологом',
          'chat',
          activeTab === 'chat',
          undefined,
          'Раздел "Чат с кинологом" пока в разработке',
        )}
      </div>
    </nav>
  `;
}

function createNavTab(
  label: string,
  iconName: 'home' | 'lessons' | 'chat',
  isActive = false,
  route?: AppRoute,
  feedback?: string,
): string {
  const activeClass = isActive ? ' bottom-nav__tab--active' : '';
  const attrs = route
    ? `data-route="${route}"`
    : `data-feedback="${feedback ?? `Раздел "${label}" пока в разработке`}"`;
  const feedbackClass = route ? '' : ' js-feedback';

  return `
    <button class="bottom-nav__tab${feedbackClass}${activeClass}" type="button" ${attrs}>
      <span class="bottom-nav__content">
        <span class="bottom-nav__icon bottom-nav__icon--${iconName}" aria-hidden="true"></span>
        <span class="bottom-nav__label">${label}</span>
      </span>
    </button>
  `;
}

function getMiniAppLink(): string {
  const configuredLink = import.meta.env.VITE_MINI_APP_LINK;

  if (!configuredLink) {
    return 'https://t.me/testpuppybot/navigation';
  }

  if (configuredLink.startsWith('https://t.me/')) {
    return configuredLink;
  }

  return `https://t.me/${configuredLink.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^\/+/, '')}`;
}
