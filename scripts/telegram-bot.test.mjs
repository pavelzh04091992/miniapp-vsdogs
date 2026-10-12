import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAuthDatabase } from './auth-database.mjs';
import { createTelegramBot, formatTtl } from './telegram-bot.mjs';

test('formats the browser-link lifetime with correct Russian plural forms', () => {
  assert.equal(formatTtl(60), '1 минута');
  assert.equal(formatTtl(120), '2 минуты');
  assert.equal(formatTtl(300), '5 минут');
  assert.equal(formatTtl(600), '10 минут');
  assert.equal(formatTtl(660), '11 минут');
  assert.equal(formatTtl(1_260), '21 минута');
});

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

    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: requests.length } : true,
    });
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
    const method = url.split('/').at(-1);
    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: requests.length } : true,
    });
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
      { text: 'Браузер 🌐' },
    ]);

    await bot.handleUpdate(privateMessage('20002', 'Браузер 🌐', 'User'));
    const browserLogin = requests.findLast(({ method, payload }) =>
      method === 'sendMessage' && payload.reply_markup?.inline_keyboard)?.payload;
    assert.ok(browserLogin.reply_markup.inline_keyboard.flat().some(
      (button) => button.text === 'Открыть в браузере 🔗' &&
        button.url?.startsWith('https://example.com/auth/magic?token='),
    ));
    assert.equal(
      browserLogin.text,
      'Одноразовая ссылка для входа в браузере действует 10 минут.',
    );
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
    const method = url.split('/').at(-1);
    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: requests.length } : true,
    });
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
    const method = url.split('/').at(-1);
    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: requests.length } : true,
    });
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
    const method = url.split('/').at(-1);
    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: requests.length } : true,
    });
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
    const firstPage = requests.findLast(({ method }) => method === 'sendMessage').payload;
    assert.match(firstPage.text, /страница 1/);
    assert.ok(firstPage.reply_markup.inline_keyboard.flat().some(
      (button) => button.callback_data === 'admin:list:8',
    ));

    await bot.handleUpdate(callback('10001', 'admin:list:8'));
    const secondPage = requests.findLast(({ method }) => method === 'sendMessage').payload;
    assert.match(secondPage.text, /страница 2/);
    assert.ok(secondPage.reply_markup.inline_keyboard.flat().some(
      (button) => button.callback_data === 'admin:list:0',
    ));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('replacing a browser link deletes the previous link and tracked browser requests', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-cleanup-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  let nextBotMessageId = 1;
  let failNextDelete = true;
  const fetchImpl = async (url, options) => {
    const method = url.split('/').at(-1);
    const payload = JSON.parse(options.body);
    const result = method === 'sendMessage' ? { message_id: nextBotMessageId++ } : true;
    requests.push({ method, payload, result });

    if (method === 'deleteMessage' && failNextDelete) {
      failNextDelete = false;
      return fakeResponse(false, 400, { ok: false, description: 'retry cleanup later' });
    }

    return fakeResponse(true, 200, {
      ok: true,
      result,
    });
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
    await bot.handleUpdate(privateMessage('20002', '/start', 'User'));
    const firstRequest = privateMessage('20002', 'Браузер 🌐', 'User');
    await bot.handleUpdate(firstRequest);
    const firstLinkRequest = requests.findLast(({ method, payload }) =>
      method === 'sendMessage' && payload.reply_markup?.inline_keyboard);
    const firstToken = new URL(
      firstLinkRequest.payload.reply_markup.inline_keyboard[0][0].url,
    ).searchParams.get('token');
    assert.equal(database.isMagicLinkUsable(firstToken), true);

    const secondRequest = privateMessage('20002', 'Браузер 🌐', 'User');
    await bot.handleUpdate(secondRequest);
    const linkRequests = requests.filter(({ method, payload }) =>
      method === 'sendMessage' && payload.reply_markup?.inline_keyboard);
    const secondToken = new URL(
      linkRequests[1].payload.reply_markup.inline_keyboard[0][0].url,
    ).searchParams.get('token');
    assert.equal(database.isMagicLinkUsable(firstToken), false);
    assert.equal(database.isMagicLinkUsable(secondToken), true);

    const deletedMessageIds = requests
      .filter(({ method }) => method === 'deleteMessage')
      .map(({ payload }) => payload.message_id);
    assert.ok(deletedMessageIds.includes(firstRequest.message.message_id));
    assert.ok(deletedMessageIds.includes(secondRequest.message.message_id));
    assert.ok(deletedMessageIds.includes(firstLinkRequest.result.message_id));
    assert.deepEqual(database.listBotMessagesForCleanup('20002'), []);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a failed browser-link delivery keeps the previous link usable', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-delivery-fail-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  database.ensureAdmin('10001');
  database.grantUser('20002', '10001');
  const existing = database.createMagicLink('20002', '20002', 600);
  const fetchImpl = async (url) => {
    const method = url.split('/').at(-1);

    if (method === 'sendMessage') {
      return fakeResponse(false, 500, { ok: false, description: 'temporary failure' });
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
    await assert.rejects(
      bot.handleUpdate(privateMessage('20002', 'Браузер 🌐', 'User')),
      /temporary failure/,
    );
    assert.equal(database.isMagicLinkUsable(existing.token), true);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a failed browser-link database commit removes the new message and keeps the old link', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-bot-commit-fail-'));
  const database = createAuthDatabase(join(directory, 'auth.sqlite'));
  const requests = [];
  database.ensureAdmin('10001');
  database.grantUser('20002', '10001');
  const existing = database.createMagicLink('20002', '20002', 600);
  const databaseWithFailedCommit = {
    ...database,
    finalizeMagicLinkDelivery() {
      throw new Error('simulated commit failure');
    },
  };
  const fetchImpl = async (url, options) => {
    const method = url.split('/').at(-1);
    const payload = JSON.parse(options.body);
    requests.push({ method, payload });
    return fakeResponse(true, 200, {
      ok: true,
      result: method === 'sendMessage' ? { message_id: 701 } : true,
    });
  };
  const bot = createTelegramBot({
    botToken: 'test-token',
    botUsername: 'access_bot',
    miniAppUrl: 'https://example.com',
    publicBaseUrl: 'https://example.com',
    adminTelegramId: '10001',
    database: databaseWithFailedCommit,
    fetchImpl,
  });

  try {
    await assert.rejects(
      bot.handleUpdate(callback('20002', 'user:browser', 'User')),
      /simulated commit failure/,
    );
    assert.equal(database.isMagicLinkUsable(existing.token), true);
    assert.ok(requests.some(({ method, payload }) =>
      method === 'deleteMessage' && payload.message_id === 701));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

let incomingMessageId = 1_000;

function privateMessage(userId, text, firstName) {
  return {
    message: {
      message_id: incomingMessageId++,
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
