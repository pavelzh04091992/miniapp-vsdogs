import { AppAccessResult, resolveAppAccess } from './lib/auth';
import {
  hasTelegramLaunchParameters,
  initTelegramWebApp,
  isTelegramMiniAppLaunch,
  loadTelegramWebAppSdk,
} from './lib/telegram';
import type { TelegramWebApp } from './lib/telegram';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root element was not found.');
}

const root = appRoot;

let webApp: TelegramWebApp | null = null;
let initializationSequence = 0;

document.addEventListener('click', (event) => {
  const target = event.target;

  if (target instanceof HTMLElement && target.closest('[data-auth-retry]')) {
    event.preventDefault();
    void initializeApp();
  }
});

void startBootstrap();

async function startBootstrap(): Promise<void> {
  try {
    if (hasTelegramLaunchParameters()) {
      renderLoading('Подключаем Telegram');
      await loadTelegramWebAppSdk();
    }

    webApp = isTelegramMiniAppLaunch() ? initTelegramWebApp() : null;
    document.documentElement.dataset.launchContext = webApp ? 'telegram' : 'browser';

    if (webApp) {
      document.documentElement.dataset.tgPlatform = webApp.platform || 'unknown';
    }

    await initializeApp();
  } catch {
    document.documentElement.dataset.launchContext = 'telegram';
    renderAccessScreen({ status: 'error' });
  }
}

async function initializeApp(): Promise<void> {
  const sequence = ++initializationSequence;
  renderLoading();

  const authSignal = new URLSearchParams(window.location.search).get('auth');
  clearAuthSignal();
  const access = await resolveAppAccess({
    initData: webApp?.initData,
    authSignal,
  });

  if (sequence !== initializationSequence) {
    return;
  }

  if (access.status !== 'authenticated') {
    renderAccessScreen(access);
    return;
  }

  document.documentElement.dataset.userRole = access.user.role;
  document.documentElement.dataset.hasSubscription = String(Boolean(access.user.hasSubscription));
  document.documentElement.dataset.tariffId = access.user.tariffId || 'free';
  document.documentElement.dataset.tariffName = access.user.tariffName || 'Базовый (Free)';

  try {
    renderLoading('Загружаем приложение');
    const { appReady } = await import('./main');
    await appReady;
  } catch {
    if (sequence === initializationSequence) {
      renderAccessScreen({ status: 'error' });
    }
  }
}

function renderLoading(label = 'Проверяем доступ'): void {
  root.innerHTML = `
    <main class="initial-loader" role="status" aria-live="polite" aria-label="${label}">
      <span class="initial-loader__spinner" aria-hidden="true"></span>
      <p class="initial-loader__label">${label}</p>
    </main>
  `;
}

function renderAccessScreen(access: Exclude<AppAccessResult, { status: 'authenticated' }>): void {
  const content = getAccessScreenContent(access);
  const botButton = 'botUrl' in access && access.botUrl
    ? `<a class="access-gate__button" href="${escapeAttribute(access.botUrl)}" target="_blank" rel="noopener noreferrer">Открыть Telegram-бота</a>`
    : '';
  const retryButton = access.status === 'error'
    ? '<button class="access-gate__button" type="button" data-auth-retry>Повторить проверку</button>'
    : '';

  root.innerHTML = `
    <main class="access-gate" aria-labelledby="access-gate-title">
      <section class="access-gate__card">
        <img class="access-gate__mark" src="/assets/logo-dog.svg" alt="Высшая школа собак" />
        <h1 id="access-gate-title">${content.title}</h1>
        <p class="access-gate__message">${content.message}</p>
        <div class="access-gate__actions">${botButton}${retryButton}</div>
      </section>
    </main>
  `;
}

function getAccessScreenContent(
  access: Exclude<AppAccessResult, { status: 'authenticated' }>,
): { title: string; message: string } {
  switch (access.status) {
    case 'denied':
      return {
        title: 'Доступ не выдан',
        message: 'Этот Telegram-аккаунт пока не добавлен администратором.',
      };
    case 'invalid-link':
      return {
        title: 'Ссылка больше не работает',
        message: 'Запросите в боте новую одноразовую ссылку для входа в браузере.',
      };
    case 'subscription-expired':
      return {
        title: 'Подписка закончилась',
        message: `Доступ завершился ${formatSubscriptionDate(access.accessExpiresAt)}. Откройте Telegram-бота, чтобы обратиться к администратору.`,
      };
    case 'unauthenticated':
      return {
        title: 'Войдите через Telegram',
        message: 'Откройте бота и нажмите «Войти в браузере» или запустите Mini App.',
      };
    case 'error':
      return {
        title: 'Не удалось загрузить приложение',
        message: 'Проверьте соединение и повторите попытку.',
      };
  }
}

function formatSubscriptionDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(new Date(timestamp * 1000));
}

function clearAuthSignal(): void {
  const url = new URL(window.location.href);

  if (!url.searchParams.has('auth')) {
    return;
  }

  url.searchParams.delete('auth');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
