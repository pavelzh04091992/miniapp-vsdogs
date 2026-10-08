import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAuthDatabase } from './auth-database.mjs';
import { createTelegramBot } from './telegram-bot.mjs';

test('admin grants and revokes access through the bot interface', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  let failFirstUserNotification = true;
  const fetchImpl = async (url, options) => {
    const payload = JSON.parse(options.body);
    const method = url.split('/').at(-1);
    requests.push({ method, payload });

    if (method === 'sendMessage' && String(payload.chat_id) === '20002' && failFirstUserNotification) {
      failFirstUserNotification = false;
      return fakeResponse(false, 403, { ok: false, description: 'bot was blocked by the user' });
    }

    return fakeResponse(true, 200, { ok: true, result: true });
  };
  const bot = createTelegramBot({
    botToken: 'test-token',
    botUsername: 'access_bot',
    miniAppUrl: 'https://example.com',
    publicBaseUrl: 'https://example.com',
    adminTelegramId: '10001',
    database,
    fetchImpl,
  });

  try {
    await bot.handleUpdate(privateMessage('10001', '/start', 'Admin'));
    await bot.handleUpdate(callback('10001', 'admin:add'));
    await bot.handleUpdate(privateMessage('10001', '20002', 'Admin'));

    assert.equal(database.getUser('20002').status, 'active');
    assert.ok(requests.some(({ payload }) =>
      typeof payload.text === 'string' && payload.text.includes('t.me/access_bot?start=invite_')));

    await bot.handleUpdate(privateMessage('20002', '/start', 'User'));
    assert.equal(database.getUser('20002').firstName, 'User');

    await bot.handleUpdate(callback('20002', 'user:browser', 'User'));
    assert.ok(requests.some(({ payload }) =>
      typeof payload.text === 'string' &&
      payload.text.includes('https://example.com/auth/magic?token=')));
    const magicLinkMessages = requests.filter(({ payload }) =>
      typeof payload.text === 'string' && payload.text.includes('/auth/magic?token=')).length;

    await bot.handleUpdate(callback('10001', 'admin:revoke:20002'));
    assert.equal(database.getUser('20002').status, 'revoked');
    await bot.handleUpdate(callback('20002', 'user:browser', 'User'));
    assert.equal(
      requests.filter(({ payload }) =>
        typeof payload.text === 'string' && payload.text.includes('/auth/magic?token=')).length,
      magicLinkMessages,
    );
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function privateMessage(userId, text, firstName) {
  return {
    message: {
      chat: { id: Number(userId), type: 'private' },
      from: { id: Number(userId), first_name: firstName },
      text,
    },
  };
}

function callback(userId, data, firstName = 'Admin') {
  return {
    callback_query: {
      id: `callback-${data}`,
      from: { id: Number(userId), first_name: firstName },
      message: { chat: { id: Number(userId), type: 'private' } },
      data,
    },
  };
}

function fakeResponse(ok, status, body) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Forbidden',
    json: async () => body,
  };
}
