declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export interface TelegramThemeParams {
  bg_color?: string;
  button_color?: string;
  button_text_color?: string;
  hint_color?: string;
  link_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
}

export interface TelegramWebApp {
  colorScheme?: 'light' | 'dark';
  initData?: string;
  initDataUnsafe?: Record<string, unknown>;
  isExpanded?: boolean;
  platform?: string;
  viewportHeight?: number;
  viewportStableHeight?: number;
  themeParams: TelegramThemeParams;
  ready: () => void;
  close?: () => void;
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  onEvent?: (eventType: string, callback: (event: unknown) => void) => void;
  offEvent?: (eventType: string, callback: (event: unknown) => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  };
  showAlert?: (message: string) => void;
}

const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
let telegramSdkPromise: Promise<TelegramWebApp | null> | null = null;

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniAppLaunch(): boolean {
  const webApp = getTelegramWebApp();

  return Boolean(webApp?.initData);
}

export function hasTelegramLaunchParameters(locationValue: Pick<Location, 'search' | 'hash'> = window.location): boolean {
  const serialized = `${locationValue.search.replace(/^\?/, '')}&${locationValue.hash.replace(/^#/, '')}`;
  const params = new URLSearchParams(serialized);

  return params.has('tgWebAppData') || params.has('tgWebAppVersion');
}

export function loadTelegramWebAppSdk(timeoutMs = 8_000): Promise<TelegramWebApp | null> {
  const existing = getTelegramWebApp();

  if (existing) {
    return Promise.resolve(existing);
  }

  if (!hasTelegramLaunchParameters()) {
    return Promise.resolve(null);
  }

  if (telegramSdkPromise) {
    return telegramSdkPromise;
  }

  telegramSdkPromise = new Promise<TelegramWebApp | null>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      script.remove();
      telegramSdkPromise = null;
      reject(new Error('Telegram WebApp SDK loading timed out'));
    }, timeoutMs);

    script.src = TELEGRAM_SDK_URL;
    script.async = true;
    script.addEventListener('load', () => {
      window.clearTimeout(timeout);
      resolve(getTelegramWebApp());
    }, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      telegramSdkPromise = null;
      reject(new Error('Telegram WebApp SDK could not be loaded'));
    }, { once: true });
    document.head.append(script);
  });

  return telegramSdkPromise;
}

export function initTelegramWebApp(): TelegramWebApp | null {
  const webApp = getTelegramWebApp();

  if (!webApp || !isTelegramMiniAppLaunch()) {
    return null;
  }

  webApp.ready();
  webApp.expand?.();
  webApp.enableClosingConfirmation?.();

  applyTelegramTheme(webApp);

  return webApp;
}

function applyTelegramTheme(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  const { themeParams } = webApp;

  setCssVar(root, '--tg-surface', themeParams.secondary_bg_color);
  setCssVar(root, '--tg-hint', themeParams.hint_color);
  setCssVar(root, '--tg-button', themeParams.button_color);
  setCssVar(root, '--tg-button-text', themeParams.button_text_color);
  setCssVar(root, '--tg-link', themeParams.link_color);
}

function setCssVar(root: HTMLElement, name: string, value?: string): void {
  if (!value) {
    return;
  }

  root.style.setProperty(name, value);
}
