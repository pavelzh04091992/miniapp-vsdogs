import { getRequiredEnv, loadDotEnv } from './env.mjs';
import { createTelegramApi } from './telegram-api.mjs';
import { createTelegramTransportFromEnv } from './telegram-transport.mjs';

loadDotEnv();

const transport = createTelegramTransportFromEnv();

try {
  const api = createTelegramApi(getRequiredEnv('BOT_TOKEN'), { fetchImpl: transport.fetch });
  const bot = await api.request('getMe');
  console.log(`[telegram-egress] mode=${transport.description} bot_id=${bot.id}`);
} finally {
  await transport.close();
}
