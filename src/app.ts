export function createAppMarkup(): string {
  return `
    <div class="app-shell">
      <header class="top-bar">
        <button class="close-button" id="close-button" type="button">
          Закрыть
        </button>
        <h1>Навигация</h1>
      </header>

      <main class="screen-content">
        <section class="quick-nav" aria-label="Быстрая навигация">
          <button class="quick-nav__item" type="button" aria-label="Раздел 1"></button>
          <button class="quick-nav__item" type="button" aria-label="Раздел 2"></button>
          <button class="quick-nav__item" type="button" aria-label="Раздел 3"></button>
          <button class="quick-nav__item" type="button" aria-label="Раздел 4"></button>
          <button class="quick-nav__item" type="button" aria-label="Раздел 5"></button>
          <button class="quick-nav__item" type="button" aria-label="Раздел 6"></button>
        </section>

        <section class="useful-section" aria-labelledby="useful-title">
          <h2 id="useful-title">Полезное</h2>
          <div class="chip-row" aria-label="Фильтры полезного">
            <button class="chip" type="button" aria-label="Фильтр 1"></button>
            <button class="chip" type="button" aria-label="Фильтр 2"></button>
            <button class="chip" type="button" aria-label="Фильтр 3"></button>
            <button class="chip" type="button" aria-label="Фильтр 4"></button>
          </div>
        </section>

        <section class="feed" aria-label="Полезные материалы">
          <button class="feed-card" id="test-button" type="button">
            <span class="sr-only">Тестовая кнопка</span>
          </button>
          <article class="feed-card" aria-label="Заглушка материала"></article>
        </section>
      </main>

      <nav class="bottom-tabs" aria-label="Основная навигация">
        <button class="tab tab--active" type="button">
          <span class="tab__icon"></span>
          <span>Категории</span>
        </button>
        <button class="tab" type="button">
          <span class="tab__icon"></span>
          <span>О сообществе</span>
        </button>
        <button class="tab" type="button">
          <span class="tab__icon"></span>
          <span>Чат</span>
        </button>
      </nav>
    </div>
  `;
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

function getMiniAppLink(): string {
  const configuredLink = import.meta.env.VITE_MINI_APP_LINK;

  if (!configuredLink) {
    return 'https://t.me/testpuppybot/navigation';
  }

  if (configuredLink.startsWith('https://t.me/')) {
    return configuredLink;
  }

  return `https://t.me/${configuredLink
    .replace(/^https?:\/\//, '')
    .replace(/^t\.me\//, '')
    .replace(/^\/+/, '')}`;
}
