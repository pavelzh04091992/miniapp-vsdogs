import { initDatabase, db } from './database.js';
import { hashPassword } from '../admin/auth.js';

export function seedDatabase() {
  initDatabase();

  // 1. Проверяем наличие Владельца (Дарьи)
  const existingOwner = db.prepare('SELECT id FROM admin_users WHERE is_owner = 1').get();
  if (!existingOwner) {
    console.log('🌱 Создаем учетную запись Владельца (Дарья Сахарова)...');
    const { hash, salt } = hashPassword('daria2026!');
    db.prepare(`
      INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES (?, ?, ?, ?, ?, 1, '[]', 1)
    `).run('daria', 'daria@vsdogs.ru', hash, salt, 'Дарья Сахарова');

    // Администратор / Разработчик
    const pPass = hashPassword('pavel2026!');
    db.prepare(`
      INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES (?, ?, ?, ?, ?, 1, '[]', 1)
    `).run('pavel', 'pavel@vsdogs.ru', pPass.hash, pPass.salt, 'Павел Журавлев');

    // Тестовый менеджер
    const mPass = hashPassword('manager123');
    db.prepare(`
      INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES (?, ?, ?, ?, ?, 0, '["MANAGER"]', 1)
    `).run('manager_anna', 'anna@vsdogs.ru', mPass.hash, mPass.salt, 'Анна (Менеджер)');

    // Тестовый кинолог
    const tPass = hashPassword('trainer123');
    db.prepare(`
      INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES (?, ?, ?, ?, ?, 0, '["TRAINER"]', 1)
    `).run('trainer_alex', 'alex@vsdogs.ru', tPass.hash, tPass.salt, 'Алексей (Кинолог)');

    // Сотрудник с мультиролями (Менеджер + Кинолог)
    const ePass = hashPassword('elena123');
    db.prepare(`
      INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES (?, ?, ?, ?, ?, 0, '["MANAGER", "TRAINER"]', 1)
    `).run('elena_all', 'elena@vsdogs.ru', ePass.hash, ePass.salt, 'Елена (Менеджер + Кинолог)');
  }

  // 2. Тестовые клиенты
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('🌱 Добавляем тестовых клиентов и лицензии...');

    const insertUser = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, phone, is_blocked)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertLicense = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
      VALUES (?, ?, ?, datetime('now'), ?, 'manual', ?, 1)
    `);

    const insertPayment = db.prepare(`
      INSERT INTO payments (user_id, license_id, amount, tariff_id, period_months, source, comment, admin_id)
      VALUES (?, ?, ?, ?, ?, 'manual', ?, 1)
    `);

    const formatDate = (daysAhead) => {
      const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10);
    };

    // Клиент 1: Активная лицензия на 1 месяц (осталось 25 дней)
    const u1 = insertUser.run(100101, 'olga_k', 'Ольга', 'Кузнецова', '+7 (999) 111-22-33', 0);
    const lic1 = insertLicense.run(u1.lastInsertRowid, 'paid_1m', 'active', formatDate(25), 'Первичная активация тарифа');
    insertPayment.run(u1.lastInsertRowid, lic1.lastInsertRowid, 2900, 'paid_1m', 1, 'Первичная оплата');

    // Клиент 2: Истекает через 2 дня
    const u2 = insertUser.run(100102, 'mikhail_t', 'Михаил', 'Тихонов', '+7 (916) 222-33-44', 0);
    const lic2 = insertLicense.run(u2.lastInsertRowid, 'paid_1m', 'active', formatDate(2), 'Истекает скоро');
    insertPayment.run(u2.lastInsertRowid, lic2.lastInsertRowid, 2900, 'paid_1m', 1, 'Тариф на 1 месяц');

    // Клиент 3: Тариф Free
    const u3 = insertUser.run(100103, 'kate_pets', 'Екатерина', 'Смирнова', '+7 (925) 333-44-55', 0);
    insertLicense.run(u3.lastInsertRowid, 'free', 'active', null, 'Базовый бесплатный доступ');

    // Клиент 4: VIP Бессрочный доступ
    const u4 = insertUser.run(100104, 'artem_dog', 'Артем', 'Белов', '+7 (903) 444-55-66', 0);
    const lic4 = insertLicense.run(u4.lastInsertRowid, 'lifetime', 'active', null, 'VIP Бессрочный доступ');
    insertPayment.run(u4.lastInsertRowid, lic4.lastInsertRowid, 14900, 'lifetime', 999, 'VIP курс "Все включено"');

    // Клиент 5: Истекшая лицензия (5 дней назад)
    const u5 = insertUser.run(100105, 'svetlana_m', 'Светлана', 'Морозова', '+7 (985) 555-66-77', 0);
    insertLicense.run(u5.lastInsertRowid, 'paid_3m', 'expired', formatDate(-5), 'Подписка истекла 5 дней назад');

    // 3. Заметки по клиентам
    db.prepare(`
      INSERT INTO user_notes (user_id, author_admin_id, author_name, note_text)
      VALUES (?, 1, 'Дарья Сахарова', 'Клиент очень внимательный. Щенок корги, 3.5 месяца, есть склонность кусать пятки.')
    `).run(u1.lastInsertRowid);

    // 4. Тикеты кинологам
    console.log('🌱 Создаем демонстрационные тикеты кинологам...');
    db.prepare(`
      INSERT INTO trainer_tickets (user_id, question_text, media_url, status, assigned_trainer_id, answer_text, answered_by_name)
      VALUES 
      (?, 'Здравствуйте! Щенку 4 месяца (лабрадор), на прогулке подбирает всё с земли и убегает, когда пытаюсь забрать. Как правильно реагировать?', NULL, 'new', NULL, NULL, NULL),
      (?, 'Щенок скулит и воет, когда мы уходим на работу. Оставляем игрушки, но не помогает. Посмотрите, пожалуйста, видео из комнаты.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'in_progress', 3, NULL, NULL),
      (?, 'Спасибо за прошлый совет! Перестала прикусывать руки. Теперь вопрос по команде "Рядом": с какого возраста начинать учить строгую выдержку?', NULL, 'answered', 3, 'Отлично, что укусы прекратились! Строгую выдержку у щенков начинаем формировать не ранее 5-6 месяцев, а сейчас достаточно фиксации на 3-5 секунд с поощрением.', 'Алексей (Кинолог)')
    `).run(u1.lastInsertRowid, u2.lastInsertRowid, u4.lastInsertRowid);

    console.log('✅ База данных успешно инициализирована тестовыми данными!');
  }
}

// Если запущен напрямую
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
