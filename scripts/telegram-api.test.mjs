import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramApiError, createTelegramApi } from './telegram-api.mjs';

test('Telegram API wrapper sends JSON and returns successful results', async () => {
  const requests = [];
  const api = createTelegramApi('secret-token', {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return fakeResponse(200, { ok: true, result: { message_id: 7 } });
    },
  });

  assert.deepEqual(await api.sendMessage('123', 'hello'), { message_id: 7 });
  assert.deepEqual(await api.deleteMessage('123', 7), { message_id: 7 });
  assert.equal(JSON.parse(requests[0].options.body).chat_id, '123');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    chat_id: '123',
    message_id: 7,
  });
});

test('Telegram API wrapper never exposes the bot token in network errors', async () => {
  const api = createTelegramApi('top-secret-token', {
    fetchImpl: async (url) => {
      throw new Error(`could not fetch ${url}`);
    },
  });

  await assert.rejects(
    api.sendMessage('123', 'hello'),
    (error) =>
      error instanceof TelegramApiError &&
      !error.message.includes('top-secret-token') &&
      error.message.includes('network request failed'),
  );
});

function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  };
}
