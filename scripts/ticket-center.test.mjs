import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createAuthDatabase } from './auth-database.mjs';
import { createFeedbackHandler } from './feedback-handler.mjs';
import { deliverFeedback, formatFeedbackMessage } from './feedback.mjs';
import { createTelegramBot } from './telegram-bot.mjs';
import { getTicketMediaList, formatMoscowDateTime } from '../src/admin/routes/tickets.js';
import { isTrainerAuthorizedForBot, handleTicketBotUpdate, normalizePhone, findAdminUserByPhone } from '../src/admin/services/ticketBotService.js';

function createTestHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'puppy-ticket-test-'));
  const dbPath = join(tempDir, 'auth.sqlite');

  // Pre-create tables using raw DatabaseSync
  const rawDb = new DatabaseSync(dbPath);
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS trainer_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      media_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_trainer_id INTEGER,
      assigned_trainer_name TEXT,
      tg_message_id INTEGER,
      tg_chat_id TEXT,
      answer_text TEXT,
      answered_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT
    );
  `);
  rawDb.close();

  const database = createAuthDatabase(dbPath);
  return { tempDir, dbPath, database };
}

test('getTicketMediaList properly parses single string, null, and JSON array of attachments', () => {
  assert.deepEqual(getTicketMediaList(null), []);
  assert.deepEqual(getTicketMediaList(''), []);
  assert.deepEqual(getTicketMediaList('/admin/uploads/dog.jpg'), ['/admin/uploads/dog.jpg']);
  assert.deepEqual(
    getTicketMediaList('["/admin/uploads/dog1.jpg", "/admin/uploads/dog2.mp4"]'),
    ['/admin/uploads/dog1.jpg', '/admin/uploads/dog2.mp4']
  );
  assert.deepEqual(
    getTicketMediaList({ media_url: '["/admin/uploads/photo1.webp", "/admin/uploads/photo2.webp"]' }),
    ['/admin/uploads/photo1.webp', '/admin/uploads/photo2.webp']
  );
});

test('feedback handler saves multiple attachments to uploads and creates ticket in database', async () => {
  const { tempDir, dbPath, database } = createTestHarness();

  try {
    database.ensureAdmin('10001');
    database.grantUser('12345', '10001', 2000000000);
    database.touchTelegramUser({ id: '12345', firstName: 'Тест', username: 'testuser' });

    // Create 2 dummy attachment files
    const file1 = join(tempDir, 'photo.jpg');
    const file2 = join(tempDir, 'video.mp4');
    writeFileSync(file1, 'fake photo bytes');
    writeFileSync(file2, 'fake video bytes');

    const submission = {
      question: 'Как приучить собаку к поводку?',
      entryPoint: 'player',
      lessonTitle: 'Прогулки на поводке',
      lessonId: 'walk-leash',
      temporaryDirectory: tempDir,
      attachments: [
        { path: file1, originalName: 'photo.jpg', kind: 'photo', telegramMethod: 'photo' },
        { path: file2, originalName: 'video.mp4', kind: 'video', telegramMethod: 'video' },
      ],
    };

    let deliveredArgs = null;
    const deliverMock = async (args) => {
      deliveredArgs = args;
      return { submissionId: 'sub-1', rootMessageId: 777 };
    };

    const handler = createFeedbackHandler({
      authDatabasePath: dbPath,
      adminTelegramId: '99999',
      allowedOrigins: new Set(['https://app.example.com']),
      api: {},
      getSessionUser: () => ({ telegramId: 12345, firstName: 'Тест', role: 'user' }),
      authDatabase: database,
      rateLimiter: { consume: () => ({ allowed: true }) },
      parseForm: async () => submission,
      deliver: deliverMock,
      removeFiles: async () => {},
    });

    const mockReq = {
      method: 'POST',
      headers: { origin: 'https://app.example.com' },
      resume: () => {},
    };

    let responseStatus = null;
    let responseBody = null;
    const mockRes = {
      writeHead: (status) => { responseStatus = status; },
      end: (data) => { responseBody = JSON.parse(data); },
    };

    await handler(mockReq, mockRes);

    assert.equal(responseStatus, 200);
    assert.deepEqual(responseBody, { ok: true });
    assert.ok(deliveredArgs);
    assert.ok(deliveredArgs.ticketId);

    // Verify ticket in DB
    const ticket = database.getTrainerTicketById(deliveredArgs.ticketId);
    assert.ok(ticket);
    assert.equal(ticket.status, 'new');
    assert.equal(ticket.tg_message_id, 777);
    assert.equal(ticket.tg_chat_id, '99999');
    assert.ok(ticket.question_text.includes('[Урок: Прогулки на поводке]'));

    // Check multiple attachments saved
    const mediaList = getTicketMediaList(ticket);
    assert.equal(mediaList.length, 2);
    assert.ok(mediaList[0].endsWith('.jpg'));
    assert.ok(mediaList[1].endsWith('.mp4'));
  } finally {
    try { database?.close(); } catch {}
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('deliverFeedback attaches take-ticket inline keyboard when ticketId is provided', async () => {
  const sentCalls = [];
  const fakeApi = {
    sendMessage: async (chatId, text, options) => {
      sentCalls.push({ chatId, text, options });
      return { message_id: 101 };
    },
    sendPhotoFile: async () => ({ message_id: 102 }),
    sendVideoFile: async () => ({ message_id: 103 }),
    sendDocumentFile: async () => ({ message_id: 104 }),
  };

  const submission = {
    question: 'Вопрос по уроку',
    entryPoint: 'home',
    attachments: [],
  };
  const user = { telegramId: '12345', firstName: 'Анна', username: 'anna_dog' };

  const result = await deliverFeedback({
    api: fakeApi,
    adminTelegramId: '-100987654321',
    submission,
    user,
    ticketId: 42,
  });

  assert.equal(result.rootMessageId, 101);
  assert.equal(result.ticketId, 42);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].chatId, '-100987654321');
  assert.ok(sentCalls[0].text.includes('[#42]'));
  assert.ok(sentCalls[0].options.reply_markup);
  assert.equal(
    sentCalls[0].options.reply_markup.inline_keyboard[0][0].callback_data,
    'ticket_take:42'
  );
});

test('telegram bot handles ticket_take callback and replies with student answer', async () => {
  const { tempDir, dbPath, database } = createTestHarness();

  try {
    database.ensureAdmin('10001');
    database.grantUser('55555', '10001', 2000000000);
    database.touchTelegramUser({ id: '55555', firstName: 'Мария', username: 'maria_pup' });
    const userRow = database.getUser('55555');

    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec(`
      INSERT INTO trainer_tickets (id, user_id, question_text, status, tg_message_id, tg_chat_id)
      VALUES (50, '${userRow.telegramId}', 'Щенок грызет тапки', 'new', 888, '-100111222333');
    `);
    rawDb.close();

    const apiCalls = [];
    const fakeApi = {
      answerCallbackQuery: async (id, extra) => {
        apiCalls.push({ method: 'answerCallbackQuery', id, extra });
      },
      editMessageReplyMarkup: async (chatId, msgId, markup) => {
        apiCalls.push({ method: 'editMessageReplyMarkup', chatId, msgId, markup });
      },
      sendMessage: async (chatId, text, options) => {
        apiCalls.push({ method: 'sendMessage', chatId, text, options });
        return { message_id: 999 };
      },
    };

    const bot = createTelegramBot({
      botToken: 'fake-token',
      botUsername: 'testpuppybot',
      api: fakeApi,
      database,
    });

    // 1. Trainer clicks "Взять в работу"
    await bot.handleUpdate({
      callback_query: {
        id: 'cb-1',
        from: { id: 70001, first_name: 'Дарья', last_name: 'Сахарова', username: 'daria_trainer' },
        data: 'ticket_take:50',
        message: { message_id: 888, chat: { id: -100111222333 } },
      },
    });

    // Check DB updated
    let ticket = database.getTrainerTicketById(50);
    assert.equal(ticket.status, 'in_progress');
    assert.equal(ticket.assigned_trainer_name, 'Дарья Сахарова');

    // Check callback answered & markup changed
    assert.ok(apiCalls.some(c => c.method === 'answerCallbackQuery'));
    assert.ok(apiCalls.some(c => c.method === 'editMessageReplyMarkup'));

    // 2. Another trainer tries to take the same ticket -> gets warning alert
    apiCalls.length = 0;
    await bot.handleUpdate({
      callback_query: {
        id: 'cb-2',
        from: { id: 70002, first_name: 'Алексей', username: 'alex_trainer' },
        data: 'ticket_take:50',
        message: { message_id: 888, chat: { id: -100111222333 } },
      },
    });

    const alertCall = apiCalls.find(c => c.method === 'answerCallbackQuery');
    assert.ok(alertCall);
    assert.ok(alertCall.extra?.text.includes('уже взят в работу'));

    // 3. Trainer replies in telegram chat to answer the question
    apiCalls.length = 0;
    await bot.handleUpdate({
      message: {
        message_id: 900,
        chat: { id: -100111222333, type: 'supergroup' },
        from: { id: 70001, first_name: 'Дарья', last_name: 'Сахарова' },
        reply_to_message: { message_id: 888 },
        text: 'Переключите внимание щенка на жевательную игрушку из оленьих рогов.',
      },
    });

    // Check DB updated to answered
    ticket = database.getTrainerTicketById(50);
    assert.equal(ticket.status, 'answered');
    assert.ok(ticket.answer_text.includes('жевательную игрушку'));
    assert.equal(ticket.answered_by_name, 'Дарья Сахарова');

    // Check answer sent to student 55555
    const studentMessage = apiCalls.find(c => c.method === 'sendMessage' && String(c.chatId) === '55555');
    assert.ok(studentMessage);
    assert.ok(studentMessage.text.includes('Ответ кинолога'));
    assert.ok(studentMessage.text.includes('жевательную игрушку'));
  } finally {
    try { database?.close(); } catch {}
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('isTrainerAuthorizedForBot verifies permissions based on can_answer_tickets_bot, username, id and owner status', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'puppy-trainer-auth-'));
  const dbPath = join(tempDir, 'auth.sqlite');
  const rawDb = new DatabaseSync(dbPath);

  rawDb.exec(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      can_answer_tickets_bot INTEGER DEFAULT 0,
      telegram_id TEXT,
      telegram_username TEXT
    );

    INSERT INTO admin_users (login, full_name, is_owner, is_active, can_answer_tickets_bot, telegram_id, telegram_username)
    VALUES
      ('owner', 'Дарья Сахарова', 1, 1, 0, '11111', 'daria_owner'),
      ('trainer_active', 'Кинолог Анна', 0, 1, 1, '22222', 'anna_trainer'),
      ('trainer_inactive', 'Кинолог Иван', 0, 0, 1, '33333', 'ivan_trainer'),
      ('trainer_no_perm', 'Куратор Петр', 0, 1, 0, '44444', 'petr_curator');
  `);

  try {
    // 1. Owner has access by ID or username even if can_answer_tickets_bot = 0
    assert.ok(isTrainerAuthorizedForBot({ id: 11111 }, rawDb));
    assert.ok(isTrainerAuthorizedForBot({ id: 999999, username: 'daria_owner' }, rawDb));
    assert.ok(isTrainerAuthorizedForBot({ id: 999999, username: '@daria_owner' }, rawDb));

    // 2. Active trainer with can_answer_tickets_bot = 1 has access
    assert.ok(isTrainerAuthorizedForBot({ id: 22222 }, rawDb));
    assert.ok(isTrainerAuthorizedForBot({ id: 999999, username: 'anna_trainer' }, rawDb));
    assert.ok(isTrainerAuthorizedForBot({ id: 999999, username: '@ANNA_TRAINER' }, rawDb));

    // 3. Inactive trainer has NO access even with can_answer_tickets_bot = 1
    assert.equal(isTrainerAuthorizedForBot({ id: 33333 }, rawDb), null);
    assert.equal(isTrainerAuthorizedForBot({ id: 999999, username: 'ivan_trainer' }, rawDb), null);

    // 4. Active trainer without can_answer_tickets_bot has NO access
    assert.equal(isTrainerAuthorizedForBot({ id: 44444 }, rawDb), null);
    assert.equal(isTrainerAuthorizedForBot({ id: 999999, username: 'petr_curator' }, rawDb), null);

    // 5. Unknown user or null has NO access
    assert.equal(isTrainerAuthorizedForBot({ id: 55555 }, rawDb), null);
    assert.equal(isTrainerAuthorizedForBot(null, rawDb), null);
  } finally {
    rawDb.close();
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('handleTicketBotUpdate enforces trainer permissions for taking tickets and replying', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'puppy-ticket-bot-test-'));
  const dbPath = join(tempDir, 'auth.sqlite');
  const rawDb = new DatabaseSync(dbPath);

  rawDb.exec(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      can_answer_tickets_bot INTEGER DEFAULT 0,
      telegram_id TEXT,
      telegram_username TEXT
    );

    CREATE TABLE users (
      telegram_id INTEGER PRIMARY KEY,
      id INTEGER,
      first_name TEXT,
      last_name TEXT,
      username TEXT
    );

    CREATE TABLE trainer_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      media_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_trainer_id INTEGER,
      assigned_trainer_name TEXT,
      tg_message_id INTEGER,
      tg_chat_id TEXT,
      answer_text TEXT,
      answered_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT
    );

    INSERT INTO admin_users (login, full_name, is_owner, is_active, can_answer_tickets_bot, telegram_id, telegram_username)
    VALUES ('trainer_elena', 'Елена Кинолог', 0, 1, 1, '88888', 'elena_dog');

    INSERT INTO users (telegram_id, id, first_name, username)
    VALUES (123456, 1, 'Ольга Студент', 'olga_pup');

    INSERT INTO trainer_tickets (id, user_id, question_text, status, tg_message_id, tg_chat_id)
    VALUES (10, 123456, 'Как отучить щенка кусать руки?', 'new', 6001, '-100222333');
  `);

  const apiCalls = [];
  const fakeCallApi = async (token, method, payload) => {
    apiCalls.push({ token, method, payload });
    return { ok: true, message_id: 9901 };
  };

  try {
    // 1. Unauthorized user tries to take ticket #10
    await handleTicketBotUpdate({
      callback_query: {
        id: 'cb-unauth-1',
        from: { id: 77777, username: 'random_stranger' },
        data: 'ticket_take:10',
        message: { message_id: 6001, chat: { id: -100222333 } },
      },
    }, rawDb, fakeCallApi);

    // Should receive alert with access denied
    const unauthAlert = apiCalls.find(c => c.method === 'answerCallbackQuery' && c.payload.callback_query_id === 'cb-unauth-1');
    assert.ok(unauthAlert);
    assert.ok(unauthAlert.payload.text.includes('нет доступа к ответам'));

    // Status in DB remains 'new'
    let ticket = rawDb.prepare('SELECT * FROM trainer_tickets WHERE id = 10').get();
    assert.equal(ticket.status, 'new');

    // 2. Authorized trainer (ID 88888) takes ticket #10
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      callback_query: {
        id: 'cb-auth-1',
        from: { id: 88888, username: 'elena_dog' },
        data: 'ticket_take:10',
        message: { message_id: 6001, chat: { id: -100222333 } },
      },
    }, rawDb, fakeCallApi);

    // Verify DB updated
    ticket = rawDb.prepare('SELECT * FROM trainer_tickets WHERE id = 10').get();
    assert.equal(ticket.status, 'in_progress');
    assert.equal(ticket.assigned_trainer_name, 'Елена Кинолог');
    assert.equal(ticket.assigned_trainer_id, 1);

    // Verify success callback and keyboard updated
    assert.ok(apiCalls.some(c => c.method === 'answerCallbackQuery' && c.payload.text.includes('Вопрос взят в работу')));
    assert.ok(apiCalls.some(c => c.method === 'editMessageReplyMarkup'));
    assert.ok(apiCalls.some(c => c.method === 'sendMessage' && c.payload.text.includes('взят в работу кинологом: Елена Кинолог')));

    // 3. Unauthorized user tries to answer by replying to message 6001
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      message: {
        message_id: 7001,
        chat: { id: -100222333 },
        from: { id: 77777, username: 'random_stranger' },
        reply_to_message: { message_id: 6001 },
        text: 'Псевдо-совет от неавторизованного пользователя',
      },
    }, rawDb, fakeCallApi);

    // Verify access denied message sent
    const denyReply = apiCalls.find(c => c.method === 'sendMessage' && c.payload.text.includes('Отказано в доступе'));
    assert.ok(denyReply);

    // Ticket remains in_progress
    ticket = rawDb.prepare('SELECT * FROM trainer_tickets WHERE id = 10').get();
    assert.equal(ticket.status, 'in_progress');

    // 4. Authorized trainer replies with advice for the student
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      message: {
        message_id: 7002,
        chat: { id: -100222333 },
        from: { id: 88888, username: 'elena_dog' },
        reply_to_message: { message_id: 6001 },
        text: 'Используйте команду "Нельзя" и сразу предлагайте канатик для перетягивания.',
      },
    }, rawDb, fakeCallApi);

    // Verify ticket in DB is answered
    ticket = rawDb.prepare('SELECT * FROM trainer_tickets WHERE id = 10').get();
    assert.equal(ticket.status, 'answered');
    assert.equal(ticket.answered_by_name, 'Елена Кинолог');
    assert.ok(ticket.answer_text.includes('канатик для перетягивания'));

    // Verify student 123456 received the answer
    const studentDelivery = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 123456);
    assert.ok(studentDelivery);
    assert.ok(studentDelivery.payload.text.includes('Ответ кинолога'));
    assert.ok(studentDelivery.payload.text.includes('канатик для перетягивания'));

    // Verify confirmation posted in trainer chat
    const chatConfirmation = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === -100222333);
    assert.ok(chatConfirmation);
    assert.ok(chatConfirmation.payload.text.includes('успешно доставлен ученику'));
  } finally {
    rawDb.close();
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('formatMoscowDateTime converts UTC timestamps to Europe/Moscow time with MSK label', () => {
  // 2026-10-29 22:05:03 UTC -> 2026-10-30 01:05:03 MSK (UTC+3)
  const formatted = formatMoscowDateTime('2026-10-29 22:05:03');
  assert.ok(formatted.includes('30.10.2026'));
  assert.ok(formatted.includes('01:05:03'));
  assert.ok(formatted.includes('МСК'));

  assert.equal(formatMoscowDateTime(null), '—');
  assert.equal(formatMoscowDateTime(''), '—');
});

test('normalizePhone and findAdminUserByPhone match phones across multiple formats', () => {
  assert.equal(normalizePhone('+7 (996) 341-76-67'), '79963417667');
  assert.equal(normalizePhone('8-996-341-76-67'), '79963417667');
  assert.equal(normalizePhone('79963417667'), '79963417667');
  assert.equal(normalizePhone(''), '');

  const tempDir = mkdtempSync(join(tmpdir(), 'puppy-phone-test-'));
  const dbPath = join(tempDir, 'auth.sqlite');
  const rawDb = new DatabaseSync(dbPath);

  rawDb.exec(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1
    );

    INSERT INTO admin_users (login, full_name, phone, is_active)
    VALUES ('pavel_trainer', 'Павел Журавлев', '+7 (996) 341-76-67', 1);
  `);

  try {
    const user = findAdminUserByPhone('89963417667', rawDb);
    assert.ok(user);
    assert.equal(user.login, 'pavel_trainer');
    assert.equal(user.full_name, 'Павел Журавлев');

    const notFound = findAdminUserByPhone('79990000000', rawDb);
    assert.equal(notFound, null);
  } finally {
    rawDb.close();
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('ticket bot handles /start and contact sharing for authorization', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'puppy-contact-bot-test-'));
  const dbPath = join(tempDir, 'auth.sqlite');
  const rawDb = new DatabaseSync(dbPath);

  rawDb.exec(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      is_owner INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      can_answer_tickets_bot INTEGER DEFAULT 0,
      telegram_id TEXT,
      telegram_username TEXT
    );

    INSERT INTO admin_users (login, full_name, phone, is_owner, is_active, can_answer_tickets_bot)
    VALUES 
      ('trainer_authorized', 'Мария Кинолог', '+79991112233', 0, 1, 1),
      ('trainer_forbidden', 'Иван Стажер', '+79992223344', 0, 1, 0);
  `);

  const apiCalls = [];
  const fakeCallApi = async (token, method, payload) => {
    apiCalls.push({ token, method, payload });
    return { ok: true, message_id: 8801 };
  };

  try {
    // 1. Unknown user sends /start -> gets contact request button
    await handleTicketBotUpdate({
      message: {
        message_id: 1001,
        chat: { id: 50001 },
        from: { id: 50001, first_name: 'Незнакомец' },
        text: '/start',
      },
    }, rawDb, fakeCallApi);

    const startMsg = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 50001);
    assert.ok(startMsg);
    assert.ok(startMsg.payload.reply_markup?.keyboard);
    assert.equal(startMsg.payload.reply_markup.keyboard[0][0].request_contact, true);

    // 2. User shares contact with unlisted phone -> gets rejected
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      message: {
        message_id: 1002,
        chat: { id: 50001 },
        from: { id: 50001, first_name: 'Незнакомец' },
        contact: {
          phone_number: '+79998887766',
          user_id: 50001,
        },
      },
    }, rawDb, fakeCallApi);

    const rejectMsg = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 50001);
    assert.ok(rejectMsg);
    assert.ok(rejectMsg.payload.text.includes('Сотрудник не найден'));
    assert.equal(rejectMsg.payload.reply_markup?.remove_keyboard, true);

    // 3. User shares contact for Ivan (can_answer_tickets_bot = 0) -> gets restricted message
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      message: {
        message_id: 1003,
        chat: { id: 50002 },
        from: { id: 50002, first_name: 'Иван', username: 'ivan_intern' },
        contact: {
          phone_number: '8 (999) 222-33-44',
          user_id: 50002,
        },
      },
    }, rawDb, fakeCallApi);

    const restrictedMsg = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 50002);
    assert.ok(restrictedMsg);
    assert.ok(restrictedMsg.payload.text.includes('Доступ ограничен'));

    // Check telegram_id is bound in DB
    let ivan = rawDb.prepare("SELECT * FROM admin_users WHERE login = 'trainer_forbidden'").get();
    assert.equal(ivan.telegram_id, '50002');
    assert.equal(ivan.telegram_username, 'ivan_intern');

    // 4. User shares contact for Maria (can_answer_tickets_bot = 1) -> successfully authorized
    apiCalls.length = 0;
    await handleTicketBotUpdate({
      message: {
        message_id: 1004,
        chat: { id: 50003 },
        from: { id: 50003, first_name: 'Мария', username: 'maria_dog_pro' },
        contact: {
          phone_number: '+7 999 111-22-33',
          user_id: 50003,
        },
      },
    }, rawDb, fakeCallApi);

    const authSuccessMsg = apiCalls.find(c => c.method === 'sendMessage' && c.payload.chat_id === 50003);
    assert.ok(authSuccessMsg);
    assert.ok(authSuccessMsg.payload.text.includes('Авторизация успешна'));
    assert.ok(authSuccessMsg.payload.text.includes('Мария Кинолог'));

    // Check DB updated with Maria's TG info
    let maria = rawDb.prepare("SELECT * FROM admin_users WHERE login = 'trainer_authorized'").get();
    assert.equal(maria.telegram_id, '50003');
    assert.equal(maria.telegram_username, 'maria_dog_pro');
  } finally {
    rawDb.close();
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});

test('deliverFeedback with ticketId adds direct admin attachment link and does not upload files to Telegram', async () => {
  const sentCalls = [];
  const fakeApi = {
    sendMessage: async (chatId, text, options) => {
      sentCalls.push({ method: 'sendMessage', chatId, text, options });
      return { message_id: 201 };
    },
    sendPhotoFile: async () => { throw new Error('sendPhotoFile should not be called when ticketId is present'); },
    sendVideoFile: async () => { throw new Error('sendVideoFile should not be called when ticketId is present'); },
    sendDocumentFile: async () => { throw new Error('sendDocumentFile should not be called when ticketId is present'); },
  };

  const submission = {
    question: 'Вопрос с четырьмя фото',
    entryPoint: 'home',
    attachments: [
      { originalName: 'dog1.jpg', kind: 'photo', telegramMethod: 'photo' },
      { originalName: 'dog2.jpg', kind: 'photo', telegramMethod: 'photo' },
      { originalName: 'dog3.jpg', kind: 'photo', telegramMethod: 'photo' },
      { originalName: 'dog4.jpg', kind: 'photo', telegramMethod: 'photo' },
    ],
  };

  const result = await deliverFeedback({
    api: fakeApi,
    adminTelegramId: '-100555',
    submission,
    user: { telegramId: '999', firstName: 'Павел' },
    ticketId: 77,
  });

  assert.equal(result.ticketId, 77);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].method, 'sendMessage');
  assert.ok(sentCalls[0].text.includes('Прикреплены материалы:'));
  assert.ok(sentCalls[0].text.includes('4 файла(ов)'));
  assert.ok(sentCalls[0].text.includes('МСК'));

  const buttons = sentCalls[0].options.reply_markup.inline_keyboard;
  assert.equal(buttons[0][0].callback_data, 'ticket_take:77');
  assert.equal(buttons[1][0].text, '📎 Посмотреть вложения в админке (4)');
  assert.equal(buttons[1][0].url, 'https://admin.miniapp-vsdogs.ru/admin/tickets?tab=new#ticket-77');
});

test('feedback handler delivers to authorized bot trainers and handles individual recipient failure gracefully', async () => {
  const { tempDir, dbPath, database: authDb } = createTestHarness();
  const rawDb = new DatabaseSync(dbPath);

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL,
      full_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      can_answer_tickets_bot INTEGER DEFAULT 0,
      telegram_id TEXT
    );
    CREATE TABLE IF NOT EXISTS trainer_ticket_messages (
      ticket_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (chat_id, message_id)
    );

    INSERT INTO admin_users (login, full_name, is_owner, can_answer_tickets_bot, telegram_id)
    VALUES
      ('daria', 'Дарья', 1, 1, '1358189044'),
      ('pavel', 'Павел', 1, 1, '308085078');
  `);

  authDb.ensureAdmin('10001');
  authDb.grantUser('12345', '10001', 2000000000);
  authDb.touchTelegramUser({ id: 12345, firstName: 'Тест', username: 'testuser' });

  try {
    const deliveredChats = [];
    const errorsLogged = [];

    const fakeDeliver = async ({ adminTelegramId, ticketId }) => {
      // Simulate Daria not having started the bot
      if (adminTelegramId === '1358189044') {
        throw new Error('Bad Request: chat not found');
      }
      deliveredChats.push(adminTelegramId);
      return { rootMessageId: 888 };
    };

    const handler = createFeedbackHandler({
      adminTelegramId: '1358189044',
      allowedOrigins: new Set(['https://example.com']),
      api: {},
      getSessionUser: () => ({ telegramId: '12345' }),
      authDatabase: authDb,
      authDatabasePath: dbPath,
      rateLimiter: { consume: () => ({ allowed: true }) },
      parseForm: async () => ({ question: 'Вопрос resilience test', attachments: [] }),
      deliver: fakeDeliver,
      removeFiles: async () => {},
      logError: (msg) => errorsLogged.push(msg),
    });

    const mockReq = {
      method: 'POST',
      headers: { origin: 'https://example.com' },
      resume: () => {},
    };

    let statusCode = null;
    let responseBody = null;
    const mockRes = {
      writeHead(code) { statusCode = code; },
      end(body) { responseBody = JSON.parse(body); },
    };

    await handler(mockReq, mockRes);

    // Response must be 200 OK because ticket is safely saved in DB
    assert.equal(statusCode, 200);
    assert.deepStrictEqual(responseBody, { ok: true });

    // Pavel must have received the ticket notification
    assert.ok(deliveredChats.includes('308085078'));

    // Daria's failure was logged but did not crash the submission
    assert.ok(errorsLogged.some(e => e.includes('1358189044') && e.includes('chat not found')));

    // Message association was recorded in trainer_ticket_messages
    const savedMsg = rawDb.prepare("SELECT * FROM trainer_ticket_messages WHERE ticket_id = 1").get();
    assert.ok(savedMsg);
    assert.equal(savedMsg.chat_id, '308085078');
    assert.equal(savedMsg.message_id, 888);
  } finally {
    rawDb.close();
    try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
});
