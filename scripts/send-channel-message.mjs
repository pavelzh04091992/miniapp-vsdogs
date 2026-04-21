import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv();

const botToken = getRequiredEnv('BOT_TOKEN');
const channelId = getRequiredEnv('CHANNEL_ID');
const miniAppLink = getRequiredEnv('MINI_APP_LINK');
const messageText = process.env.MESSAGE_TEXT || 'Откройте mini-app через кнопку ниже.';
const buttonText = process.env.BUTTON_TEXT || 'Открыть приложение';
const shouldPinMessage = parseBoolean(process.env.PIN_MESSAGE);
const disablePinNotification = parseBoolean(process.env.DISABLE_PIN_NOTIFICATION, true);

validateMiniAppLink(miniAppLink);

const sentMessage = await telegramRequest('sendMessage', {
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
  await telegramRequest('pinChatMessage', {
    chat_id: channelId,
    message_id: sentMessage.message_id,
    disable_notification: disablePinNotification,
  });

  console.log(`Message pinned in ${channelId}.`);
}

async function telegramRequest(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (!response.ok || !body.ok) {
    const description = body.description || response.statusText;
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }

  return body.result;
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  try {
    const content = readFileSync(envPath, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function validateMiniAppLink(value) {
  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error('MINI_APP_LINK must use HTTPS.');
  }

  if (url.hostname !== 't.me') {
    throw new Error('MINI_APP_LINK must be a Telegram direct Mini App link, for example https://t.me/botusername/appname.');
  }
}
