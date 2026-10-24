import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  assert.deepEqual(await api.setChatMenuButton({
    type: 'web_app',
    text: 'PuppyApp 🐶',
    web_app: { url: 'https://example.test/' },
  }), { message_id: 7 });
  assert.equal(JSON.parse(requests[0].options.body).chat_id, '123');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    chat_id: '123',
    message_id: 7,
  });
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    menu_button: {
      type: 'web_app',
      text: 'PuppyApp 🐶',
      web_app: { url: 'https://example.test/' },
    },
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

test('Telegram API wrapper streams multipart media with reply metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-api-test-'));
  const path = join(directory, 'photo.jpg');
  await writeFile(path, Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
  let request;
  const api = createTelegramApi('secret-token', {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return fakeResponse(200, { ok: true, result: { message_id: 8 } });
    },
  });

  try {
    await api.sendPhotoFile('123', {
      path,
      originalName: 'dog.jpg',
      mimeType: 'image/jpeg',
    }, { reply_parameters: { message_id: 7 } });

    assert.match(request.url, /\/sendPhoto$/);
    assert.ok(request.options.body instanceof FormData);
    assert.equal(request.options.body.get('chat_id'), '123');
    assert.equal(request.options.body.get('reply_parameters'), '{"message_id":7}');
    assert.equal(request.options.body.get('photo').name, 'dog.jpg');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  };
}
