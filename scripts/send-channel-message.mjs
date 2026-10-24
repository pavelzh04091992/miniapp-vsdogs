import { getRequiredEnv, loadDotEnv, parseEnvBoolean } from './env.mjs';
import { createTelegramApi } from './telegram-api.mjs';
import { createTelegramTransportFromEnv } from './telegram-transport.mjs';

loadDotEnv();

const botToken = getRequiredEnv('BOT_TOKEN');
const channelId = getRequiredEnv('CHANNEL_ID');
const miniAppLink = getRequiredEnv('MINI_APP_LINK');
const messageText = process.env.MESSAGE_TEXT || 'Откройте mini-app через кнопку ниже.';
const buttonText = process.env.BUTTON_TEXT || 'Открыть приложение';
const shouldPinMessage = parseEnvBoolean(process.env.PIN_MESSAGE);
const disablePinNotification = parseEnvBoolean(process.env.DISABLE_PIN_NOTIFICATION, true);
const telegramTransport = createTelegramTransportFromEnv();
const telegramApi = createTelegramApi(botToken, { fetchImpl: telegramTransport.fetch });

validateMiniAppLink(miniAppLink);

const sentMessage = await telegramApi.request('sendMessage', {
  chat_id: channelId,
  text: messageText,
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: buttonText,
          url: miniAppLink,
        },
      ],
    ],
  },
});

console.log(`Message sent to ${channelId}. message_id=${sentMessage.message_id}`);

if (shouldPinMessage) {
  await telegramApi.request('pinChatMessage', {
    chat_id: channelId,
    message_id: sentMessage.message_id,
    disable_notification: disablePinNotification,
  });

  console.log(`Message pinned in ${channelId}.`);
}

await telegramTransport.close();

function validateMiniAppLink(value) {
  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error('MINI_APP_LINK must use HTTPS.');
  }

  if (url.hostname !== 't.me') {
    throw new Error('MINI_APP_LINK must be a Telegram direct Mini App link, for example https://t.me/botusername/appname.');
  }
}
