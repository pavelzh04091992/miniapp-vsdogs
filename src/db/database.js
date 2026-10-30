import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'auth.sqlite');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Включаем WAL и ожидание при параллельном доступе
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Инициализация всех таблиц базы данных и безопасная автомиграция
 */
export function initDatabase() {
  // 1. Проверяем наличие существующей таблицы users (для совместимости с существующим MiniApp)
  const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  
  if (usersTable) {
    const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    
    // Мягкая миграция: добавляем недостающие колонки
    if (!columns.includes('id')) {
      db.exec("ALTER TABLE users ADD COLUMN id INTEGER;");
      db.exec("UPDATE users SET id = rowid WHERE id IS NULL;");
      
      // Триггер автозаполнения id при создании пользователя сторонними скриптами (MiniApp / Bot)
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS trigger_users_set_id
        AFTER INSERT ON users
        FOR EACH ROW
        WHEN NEW.id IS NULL
        BEGIN
          UPDATE users SET id = rowid WHERE rowid = NEW.rowid;
        END;
      `);
    }

    if (!columns.includes('phone')) {
      db.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
    }

    if (!columns.includes('is_blocked')) {
      db.exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0;");
      // Синхронизируем со старым статусом, если он был blocked
      db.exec("UPDATE users SET is_blocked = 1 WHERE status = 'blocked';");
    }

    if (!columns.includes('last_active_at')) {
      db.exec("ALTER TABLE users ADD COLUMN last_active_at TEXT;");
      db.exec("UPDATE users SET last_active_at = datetime('now') WHERE last_active_at IS NULL;");
    }

    if (!columns.includes('access_expires_at')) {
      db.exec("ALTER TABLE users ADD COLUMN access_expires_at INTEGER;");
    }
  } else {
    // Чистая установка таблицы пользователей
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        is_blocked INTEGER DEFAULT 0,
        access_expires_at INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        last_active_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id ON users(id);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

    -- 1. Администраторы и сотрудники
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      email TEXT,
      hashed_password TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      roles TEXT NOT NULL DEFAULT '[]',
      can_answer_tickets_bot INTEGER DEFAULT 0,
      phone TEXT,
      telegram_id TEXT,
      telegram_username TEXT,
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 3. Тарифные планы
    CREATE TABLE IF NOT EXISTS tariffs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      period_months INTEGER DEFAULT 1,
      duration_days INTEGER DEFAULT 30,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0
    );

    -- 4. Лицензии / Подписки клиентов
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tariff_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT,
      created_by_admin_id INTEGER REFERENCES admin_users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

    -- 5. Журнал транзакций / платежей
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES licenses(id),
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'RUB',
      tariff_id TEXT NOT NULL,
      period_months INTEGER DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      external_tx_id TEXT,
      comment TEXT,
      admin_id INTEGER REFERENCES admin_users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 5.1. Запросы на подписку от клиентов
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tariff_id TEXT DEFAULT 'paid_1m',
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT,
      processed_by_admin_id INTEGER REFERENCES admin_users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sub_req_status ON subscription_requests(status);
    CREATE INDEX IF NOT EXISTS idx_sub_req_user ON subscription_requests(user_id);

    -- 6. Сквозная тикет-система вопросов кинологу
    CREATE TABLE IF NOT EXISTS trainer_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      media_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_trainer_id INTEGER REFERENCES admin_users(id),
      assigned_trainer_name TEXT,
      tg_message_id INTEGER,
      tg_chat_id TEXT,
      answer_text TEXT,
      answered_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON trainer_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_trainer ON trainer_tickets(assigned_trainer_id);

    -- 7. Комментарии / заметки по клиентам (CRM)
    CREATE TABLE IF NOT EXISTS user_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_admin_id INTEGER REFERENCES admin_users(id),
      author_name TEXT NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 8. Лог рассылок через Telegram бота
    CREATE TABLE IF NOT EXISTS broadcast_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES admin_users(id),
      admin_name TEXT NOT NULL,
      target_segment TEXT NOT NULL,
      message_text TEXT NOT NULL,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 9. Аудит административных действий
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES admin_users(id),
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Миграция таблицы вопросов кинологу (trainer_tickets)
  try {
    const ticketCols = db.prepare("PRAGMA table_info(trainer_tickets)").all().map(c => c.name);
    if (!ticketCols.includes('tg_message_id')) {
      db.exec("ALTER TABLE trainer_tickets ADD COLUMN tg_message_id INTEGER;");
    }
    if (!ticketCols.includes('tg_chat_id')) {
      db.exec("ALTER TABLE trainer_tickets ADD COLUMN tg_chat_id TEXT;");
    }
    if (!ticketCols.includes('assigned_trainer_name')) {
      db.exec("ALTER TABLE trainer_tickets ADD COLUMN assigned_trainer_name TEXT;");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_tickets_tg_message ON trainer_tickets(tg_message_id);");
  } catch (err) {
    console.error('Ошибка проверки колонок trainer_tickets:', err);
  }

  // Миграция таблицы сотрудников (admin_users) для прав в Telegram-боте
  try {
    const adminCols = db.prepare("PRAGMA table_info(admin_users)").all().map(c => c.name);
    if (!adminCols.includes('can_answer_tickets_bot')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN can_answer_tickets_bot INTEGER DEFAULT 0;");
      db.exec("UPDATE admin_users SET can_answer_tickets_bot = 1 WHERE is_owner = 1;");
    }
    if (!adminCols.includes('telegram_id')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN telegram_id TEXT;");
    }
    if (!adminCols.includes('telegram_username')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN telegram_username TEXT;");
    }
    if (!adminCols.includes('phone')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN phone TEXT;");
    }
  } catch (err) {
    console.error('Ошибка проверки колонок admin_users:', err);
  }

  const tariffCount = db.prepare('SELECT COUNT(*) as count FROM tariffs').get().count;
  if (tariffCount === 0) {
    const insertTariff = db.prepare(`
      INSERT INTO tariffs (id, name, price, period_months, duration_days, description, is_active, order_index)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertTariff.run('paid_1m', '1 месяц', 2900, 1, 30, 'Полный доступ ко всем видеоматериалам и вопросам кинологу на 30 дней', 1);
    insertTariff.run('paid_3m', '3 месяца', 6900, 3, 90, 'Оптимальный курс для закрепления привычек щенка на 90 дней', 2);
    insertTariff.run('paid_6m', '6 месяцев', 11900, 6, 180, 'Полное сопровождение взросления собаки', 3);
    insertTariff.run('lifetime', 'VIP Бессрочный', 14900, 999, 9999, 'Вечный доступ к базе знаний школы', 4);
    insertTariff.run('free', 'Базовый (Free)', 0, 0, 0, 'Ознакомительный доступ без видео и без кинолога', 5);
  }
}

export default db;
