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
    assert.equal(database.getBotState('10001'), 'awaiting_grant_id');
    await bot.handleUpdate(callback('10001', 'user:menu'));
    assert.equal(database.getBotState('10001'), null);
    await bot.handleUpdate(privateMessage('10001', '20003', 'Admin'));
    assert.equal(database.getUser('20003'), null);

    await bot.handleUpdate(callback('10001', 'admin:add'));
    await bot.handleUpdate(privateMessage('10001', '20002', 'Admin'));

    assert.equal(database.getUser('20002').status, 'active');
    assert.ok(requests.some(({ payload }) =>
      typeof payload.text === 'string' && payload.text.includes('t.me/access_bot?start=invite_')));

    await bot.handleUpdate(privateMessage('20002', '/start', 'User'));
    assert.equal(database.getUser('20002').firstName, 'User');

    await bot.handleUpdate(callback('20002', 'user:browser', 'User'));
    assert.ok(requests.some(({ payload }) =>
      payload.reply_markup?.inline_keyboard?.some((row) =>
        row.some((button) => button.url?.startsWith('https://example.com/auth/magic?token=')))));
    const magicLinkMessages = requests.filter(({ payload }) =>
      payload.reply_markup?.inline_keyboard?.some((row) =>
        row.some((button) => button.url?.includes('/auth/magic?token=')))).length;

    await bot.handleUpdate(callback('10001', 'admin:revoke:20002'));
    assert.equal(database.getUser('20002').status, 'revoked');
    await bot.handleUpdate(callback('20002', 'user:browser', 'User'));
    assert.equal(
      requests.filter(({ payload }) =>
        payload.reply_markup?.inline_keyboard?.some((row) =>
          row.some((button) => button.url?.includes('/auth/magic?token=')))).length,
      magicLinkMessages,
    );
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('start reports access status and keeps app entry buttons visible for active users', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-start-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      method: url.split('/').at(-1),
      payload: JSON.parse(options.body),
    });
    return fakeResponse(true, 200, { ok: true, result: true });
  };
  database.ensureAdmin('10001');
  database.grantUser('20002', '10001');
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
    await bot.handleUpdate(privateMessage('30003', '/start', 'Unknown'));
    const denied = requests.at(-1).payload;
    assert.match(denied.text, /Статус доступа: не выдан/);
    assert.equal(denied.reply_markup.remove_keyboard, true);

    await bot.handleUpdate(privateMessage('20002', '/start', 'User'));
    const active = requests.at(-1).payload;
    const buttons = active.reply_markup.keyboard.flat();
    assert.match(active.text, /Статус доступа: активен/);
    assert.equal(active.reply_markup.is_persistent, true);
    assert.deepEqual(buttons, [
      { text: 'PuppyApp 🐶', web_app: { url: 'https://example.com' } },
      { text: 'Браузер ↗️' },
    ]);

    await bot.handleUpdate(privateMessage('20002', 'Браузер ↗️', 'User'));
    const browserLogin = requests.at(-1).payload;
    assert.ok(browserLogin.reply_markup.inline_keyboard.flat().some(
      (button) => button.url?.startsWith('https://example.com/auth/magic?token='),
    ));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('grant and status changes notify the user and synchronize the reply keyboard', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-notify-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      method: url.split('/').at(-1),
      payload: JSON.parse(options.body),
    });
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
    await bot.handleUpdate(privateMessage('20002', '/start', 'User'));
    await bot.handleUpdate(privateMessage('10001', '/start', 'Admin'));
    await bot.handleUpdate(callback('10001', 'admin:add'));
    await bot.handleUpdate(privateMessage('10001', '20002', 'Admin'));

    const granted = requests.find(({ method, payload }) =>
      method === 'sendMessage' &&
      String(payload.chat_id) === '20002' &&
      payload.text?.includes('Вам открыт доступ'))?.payload;
    assert.ok(granted);
    assert.equal(granted.reply_markup.is_persistent, true);
    assert.ok(granted.reply_markup.keyboard.flat().some(
      (button) => button.text === 'PuppyApp 🐶' && button.web_app?.url === 'https://example.com',
    ));

    await bot.handleUpdate(callback('10001', 'admin:revoke:20002'));
    const revoked = requests.findLast(({ method, payload }) =>
      method === 'sendMessage' &&
      String(payload.chat_id) === '20002' &&
      payload.text?.includes('отозван'))?.payload;
    assert.equal(revoked.reply_markup.remove_keyboard, true);

    await bot.handleUpdate(callback('10001', 'admin:activate:20002'));
    const restored = requests.findLast(({ method, payload }) =>
      method === 'sendMessage' &&
      String(payload.chat_id) === '20002' &&
      payload.text?.includes('восстановлен'))?.payload;
    assert.equal(restored.reply_markup.is_persistent, true);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rate limits repeated private bot commands per Telegram user', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-rate-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      method: url.split('/').at(-1),
      payload: JSON.parse(options.body),
    });
    return fakeResponse(true, 200, { ok: true, result: true });
  };
  database.ensureAdmin('10001');
  const bot = createTelegramBot({
    botToken: 'test-token',
    botUsername: 'access_bot',
    miniAppUrl: 'https://example.com',
    publicBaseUrl: 'https://example.com',
    adminTelegramId: '10001',
    database,
    fetchImpl,
    commandRateLimitMax: 1,
  });

  try {
    await bot.handleUpdate(callback('10001', 'user:menu'));
    const messagesAfterFirstCommand = requests.filter(({ method }) => method === 'sendMessage').length;

    await bot.handleUpdate(callback('10001', 'user:menu'));

    assert.equal(
      requests.filter(({ method }) => method === 'sendMessage').length,
      messagesAfterFirstCommand,
    );
    assert.ok(requests.some(({ method, payload }) =>
      method === 'answerCallbackQuery' && payload.text?.includes('Слишком много запросов')));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('admin user list is paginated so older accounts remain manageable', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-pages-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      method: url.split('/').at(-1),
      payload: JSON.parse(options.body),
    });
    return fakeResponse(true, 200, { ok: true, result: true });
  };
  database.ensureAdmin('10001');

  for (let id = 20_001; id <= 20_010; id += 1) {
    database.grantUser(String(id), '10001');
  }

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
    await bot.handleUpdate(callback('10001', 'admin:list'));
    const firstPage = requests.at(-1).payload;
    assert.match(firstPage.text, /страница 1/);
    assert.ok(firstPage.reply_markup.inline_keyboard.flat().some(
      (button) => button.callback_data === 'admin:list:8',
    ));

    await bot.handleUpdate(callback('10001', 'admin:list:8'));
    const secondPage = requests.at(-1).payload;
    assert.match(secondPage.text, /страница 2/);
    assert.ok(secondPage.reply_markup.inline_keyboard.flat().some(
      (button) => button.callback_data === 'admin:list:0',
    ));
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
