import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createTelegramBot } from '../src/bot/telegram-bot.mjs';

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      is_blocked INTEGER DEFAULT 0,
      created_by TEXT DEFAULT 'bot',
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0,
      last_seen_at INTEGER DEFAULT 0,
      last_active_at TEXT DEFAULT (datetime('now')),
      access_expires_at INTEGER
    );

    CREATE TABLE tariffs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      period_months INTEGER DEFAULT 1,
      duration_days INTEGER DEFAULT 30
    );

    INSERT INTO tariffs (id, name, price, period_months, duration_days) VALUES
      ('free', 'Базовый (Free)', 0, 0, 0),
      ('paid_1m', '1 месяц', 2900, 1, 30),
      ('lifetime', 'VIP Бессрочный', 14900, 999, 9999);

    CREATE TABLE licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      tariff_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL DEFAULT (date('now')),
      expires_at TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT
    );
  `);

  return db;
}

function createMockApi() {
  const sentMessages = [];
  const answeredCallbacks = [];

  return {
    sentMessages,
    answeredCallbacks,
    api: {
      async sendMessage(chatId, text, extra = {}) {
        const msg = { message_id: sentMessages.length + 1, chat: { id: chatId }, text, ...extra };
        sentMessages.push(msg);
        return msg;
      },
      async answerCallbackQuery(id, extra = {}) {
        answeredCallbacks.push({ id, ...extra });
        return { ok: true };
      },
      async deleteMessage() {
        return { ok: true };
      },
    },
  };
}

test('Telegram Bot: Полный клиентский сценарий онбординга и подписки', async (t) => {
  const db = createTestDatabase();
  const { api, sentMessages } = createMockApi();

  const magicLinkTokens = [];
  const mockDatabase = {
    rawDb: db,
    prepareMagicLinkDelivery(telegramId, ttl) {
      const token = 'mock-token-xyz-12345';
      magicLinkTokens.push({ telegramId, token, ttl });
      return { token };
    },
    finalizeMagicLinkDelivery() {
      return true;
    },
    abortMagicLinkDelivery() {},
    consumeInvite() { return { ok: true }; },
  };

  const bot = createTelegramBot({
    botToken: '123456:fake-token',
    botUsername: 'testpuppybot',
    miniAppUrl: 'https://miniapp-vsdogs.ru',
    publicBaseUrl: 'https://miniapp-vsdogs.ru',
    database: mockDatabase,
    api,
  });

  await t.test('1. Новый пользователь без телефона получает запрос контакта', async () => {
    sentMessages.length = 0;

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга', username: 'olga_dog' },
        text: '/start',
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /подтвердите свой номер телефона/i);
    assert.ok(sentMessages[0].reply_markup.keyboard[0][0].request_contact);
  });

  await t.test('2. Пользователь делится номером телефона: сохранение в БД и показ главного меню', async () => {
    sentMessages.length = 0;

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга', username: 'olga_dog' },
        contact: {
          phone_number: '+79991234567',
          user_id: 1001,
          first_name: 'Ольга',
        },
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Номер телефона подтверждён/i);

    // Проверяем кнопки в меню
    const keyboard = sentMessages[0].reply_markup.keyboard;
    assert.equal(keyboard[0][0].text, '🐶 Открыть видеоплатформу');
    assert.equal(keyboard[0][0].web_app.url, 'https://miniapp-vsdogs.ru');
    assert.equal(keyboard[1][0].text, '🌐 Смотреть с компьютера');
    assert.equal(keyboard[1][1].text, '💳 Моя подписка');

    // Проверяем запись в БД
    const userInDb = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get('1001');
    assert.ok(userInDb);
    assert.equal(userInDb.phone, '+79991234567');
    assert.equal(userInDb.username, 'olga_dog');

    // Проверяем автоматическую выдачу базовой лицензии
    const license = db.prepare('SELECT * FROM licenses WHERE user_id = ?').get(userInDb.id);
    assert.ok(license);
    assert.equal(license.tariff_id, 'free');
  });

  await t.test('3. Проверка подписки для тарифа Free (инструкция написать менеджеру)', async () => {
    sentMessages.length = 0;

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга' },
        text: '💳 Моя подписка',
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Базовый \(Free\)/i);
    assert.match(sentMessages[0].text, /напишите вашему менеджеру школы/i);
    // Проверяем, что в боте НЕТ информации о ценах и кнопок оплаты
    assert.doesNotMatch(sentMessages[0].text, /руб/i);
    assert.doesNotMatch(sentMessages[0].text, /купить/i);
    assert.equal(sentMessages[0].reply_markup, undefined);
  });

  await t.test('4. Проверка подписки после активации платного тарифа менеджером', async () => {
    sentMessages.length = 0;

    // Менеджер через админку активировал тариф 1 месяц (добавил лицензию с датой через 25 дней)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 25);
    const expDateStr = futureDate.toISOString().slice(0, 10);

    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get('1001');
    db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source)
      VALUES (?, 'paid_1m', 'active', date('now'), ?, 'admin')
    `).run(user.id, expDateStr);

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга' },
        text: '💳 Моя подписка',
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /1 месяц/i);
    assert.match(sentMessages[0].text, /осталось 25 дней/i);
    assert.match(sentMessages[0].text, /Активен ✅/i);
  });

  await t.test('5. Генерация ссылки для входа с компьютера (Magic Link)', async () => {
    sentMessages.length = 0;

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга' },
        text: '🌐 Смотреть с компьютера',
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Вход с компьютера без пароля/i);
    const inlineBtn = sentMessages[0].reply_markup.inline_keyboard[0][0];
    assert.match(inlineBtn.url, /https:\/\/miniapp-vsdogs\.ru\/auth\/login\?token=mock-token/);
  });

  await t.test('6. Заблокированный пользователь получает уведомление о блокировке', async () => {
    sentMessages.length = 0;

    db.prepare('UPDATE users SET is_blocked = 1 WHERE telegram_id = ?').run('1001');

    await bot.handleUpdate({
      message: {
        chat: { id: 1001, type: 'private' },
        from: { id: 1001, first_name: 'Ольга' },
        text: '💳 Моя подписка',
      },
    });

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Доступ заблокирован/i);
  });
});
