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
  themeParams: TelegramThemeParams;
  ready: () => void;
  close?: () => void;
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  };
  showAlert?: (message: string) => void;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniAppLaunch(): boolean {
  const webApp = getTelegramWebApp();

  return Boolean(webApp?.initData);
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

  setCssVar(root, '--tg-bg', themeParams.bg_color);
  setCssVar(root, '--tg-surface', themeParams.secondary_bg_color);
  setCssVar(root, '--tg-text', themeParams.text_color);
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
