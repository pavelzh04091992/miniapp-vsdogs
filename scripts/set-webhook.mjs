import { getRequiredEnv, loadDotEnv } from './video-catalog.mjs';

loadDotEnv();

const botToken = getRequiredEnv('BOT_TOKEN');
const publicBaseUrl = getRequiredEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const webhookUrl = `${publicBaseUrl}${webhookPath}`;

const payload = {
  url: webhookUrl,
  allowed_updates: ['channel_post', 'edited_channel_post'],
};

if (webhookSecret) {
  payload.secret_token = webhookSecret;
}

const result = await telegramRequest('setWebhook', payload);

console.log(`Webhook configured: ${webhookUrl}`);
console.log(JSON.stringify(result, null, 2));

async function telegramRequest(method, requestPayload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  });

  const body = await response.json();

  if (!response.ok || !body.ok) {
    const description = body.description || response.statusText;
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }

  return body.result;
}
