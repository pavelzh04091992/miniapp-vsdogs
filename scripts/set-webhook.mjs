import { getRequiredEnv, loadDotEnv } from './env.mjs';
import { createTelegramApi } from './telegram-api.mjs';

loadDotEnv();

const botToken = getRequiredEnv('BOT_TOKEN');
const publicBaseUrl = getRequiredEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const webhookUrl = `${publicBaseUrl}${webhookPath}`;

const payload = {
  url: webhookUrl,
  allowed_updates: ['message', 'callback_query', 'channel_post', 'edited_channel_post'],
};

if (webhookSecret) {
  payload.secret_token = webhookSecret;
}

const result = await createTelegramApi(botToken).request('setWebhook', payload);

console.log(`Webhook configured: ${webhookUrl}`);
console.log(JSON.stringify(result, null, 2));
