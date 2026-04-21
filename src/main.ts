import { createAppMarkup, createUnsupportedEnvironmentMarkup } from './app';
import { getTelegramWebApp, initTelegramWebApp, isTelegramMiniAppLaunch } from './lib/telegram';
import './styles.css';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root element was not found.');
}

const webApp = isTelegramMiniAppLaunch() ? initTelegramWebApp() : null;

if (!webApp) {
  appRoot.innerHTML = createUnsupportedEnvironmentMarkup();
  document.documentElement.dataset.launchContext = 'unsupported';
} else {
  appRoot.innerHTML = createAppMarkup();
  document.documentElement.dataset.launchContext = 'telegram';
}

const closeButton = document.querySelector<HTMLButtonElement>('#close-button');
const testButton = document.querySelector<HTMLButtonElement>('#test-button');

if (webApp && (!closeButton || !testButton)) {
  throw new Error('Required UI elements were not found.');
}

closeButton?.addEventListener('click', () => {
  const activeWebApp = webApp ?? getTelegramWebApp();

  activeWebApp?.HapticFeedback?.impactOccurred('light');

  if (activeWebApp?.close) {
    activeWebApp.close();
    return;
  }

  window.history.back();
});

testButton?.addEventListener('click', () => {
  const activeWebApp = webApp ?? getTelegramWebApp();

  activeWebApp?.HapticFeedback?.impactOccurred('light');

  if (activeWebApp?.showAlert) {
    activeWebApp.showAlert('Тестовая карточка нажата.');
    return;
  }

  window.alert('Тестовая карточка нажата.');
});
