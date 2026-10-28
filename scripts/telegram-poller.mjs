import { setTimeout as delay } from 'node:timers/promises';
import { getRequiredEnv } from './env.mjs';
import { createTelegramApi } from './telegram-api.mjs';
import { createTelegramTransportFromEnv } from './telegram-transport.mjs';

const botToken = getRequiredEnv('BOT_TOKEN');
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = getRequiredEnv('TELEGRAM_WEBHOOK_SECRET');
const webhookUrl = new URL(webhookPath, 'http://app-backend:8787').toString();
const transport = createTelegramTransportFromEnv();
const api = createTelegramApi(botToken, {
  fetchImpl: transport.fetch,
  timeoutMs: 40_000,
});
const allowedUpdates = ['message', 'callback_query', 'channel_post', 'edited_channel_post'];

let stopping = false;
let offset = 0;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopping = true;
  });
}

try {
  const webhook = await api.request('getWebhookInfo');

  if (webhook.url) {
    await api.request('deleteWebhook', { drop_pending_updates: false });
    console.log('[telegram-poller] public webhook disabled; queued updates preserved');
  }

  console.log(`[telegram-poller] started via ${transport.description}`);

  while (!stopping) {
    try {
      const updates = await api.request('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: allowedUpdates,
      });

      for (const update of updates) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
          },
          body: JSON.stringify(update),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          throw new Error(`internal webhook returned HTTP ${response.status}`);
        }

        offset = Number(update.update_id) + 1;
      }
    } catch (error) {
      if (stopping) break;
      console.error(`[telegram-poller] ${safeErrorMessage(error)}`);
      await delay(2_000);
    }
  }
} finally {
  await transport.close();
  console.log('[telegram-poller] stopped');
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message.slice(0, 500) : 'unknown polling error';
}
