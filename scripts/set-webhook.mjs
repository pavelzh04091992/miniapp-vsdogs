import { getRequiredEnv, loadDotEnv } from './env.mjs';
import { createTelegramApi } from './telegram-api.mjs';
import { createTelegramTransportFromEnv } from './telegram-transport.mjs';

loadDotEnv();

const botToken = getRequiredEnv('BOT_TOKEN');
const publicBaseUrl = getRequiredEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');
const miniAppUrl = normalizeMiniAppUrl(process.env.MINI_APP_URL || publicBaseUrl);
const webhookPublicBaseUrl = normalizeWebhookBaseUrl(
  process.env.TELEGRAM_WEBHOOK_PUBLIC_BASE_URL || publicBaseUrl,
);
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const webhookUrl = new URL(webhookPath, `${webhookPublicBaseUrl}/`).toString();

const payload = {
  url: webhookUrl,
  allowed_updates: ['message', 'callback_query', 'channel_post', 'edited_channel_post'],
};

if (webhookSecret) {
  payload.secret_token = webhookSecret;
}

const telegramTransport = createTelegramTransportFromEnv();
const api = createTelegramApi(botToken, { fetchImpl: telegramTransport.fetch });
const result = await api.request('setWebhook', payload);
const menuButton = await api.setChatMenuButton({
  type: 'web_app',
  text: 'PuppyApp 🐶',
  web_app: { url: miniAppUrl },
});

console.log(`Webhook configured: ${webhookUrl}`);
console.log(JSON.stringify(result, null, 2));
console.log(`Telegram Web App menu configured: ${miniAppUrl}`);
console.log(JSON.stringify(menuButton, null, 2));
await telegramTransport.close();

function normalizeMiniAppUrl(value) {
  const parsed = new URL(value);

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
    throw new Error('MINI_APP_URL must be an HTTPS URL without credentials or a fragment');
  }

  return parsed.toString();
}

function normalizeWebhookBaseUrl(value) {
  const parsed = new URL(value);

  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('TELEGRAM_WEBHOOK_PUBLIC_BASE_URL must be an HTTPS origin');
  }

  return parsed.origin;
}
