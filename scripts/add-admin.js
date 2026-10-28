import { hashPassword } from '../src/admin/auth.js';
import { db } from '../src/db/database.js';

const { hash, salt } = hashPassword('pavel2026!');
const existing = db.prepare('SELECT id FROM admin_users WHERE login = ?').get('pavel');

if (!existing) {
  db.prepare(`
    INSERT INTO admin_users (login, email, hashed_password, salt, full_name, is_owner, roles, is_active)
    VALUES (?, ?, ?, ?, ?, 1, '["ADMIN", "MANAGER", "TRAINER"]', 1)
  `).run('pavel', 'pavel@vsdogs.ru', hash, salt, 'Павел Журавлев');
  console.log('Created admin_user pavel');
} else {
  db.prepare(`
    UPDATE admin_users SET is_owner = 1, roles = '["ADMIN", "MANAGER", "TRAINER"]', is_active = 1 WHERE login = 'pavel'
  `).run();
  console.log('Updated admin_user pavel');
}

const existingUser = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(308085078);
let userId;
if (!existingUser) {
  const res = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, phone, is_blocked)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(308085078, 'Pavel_Zhuravlev', 'Павел', 'Журавлев', '+7 (999) 000-00-00');
  userId = res.lastInsertRowid;
  console.log('Created user 308085078');
} else {
  userId = existingUser.id;
  console.log('User 308085078 already exists');
}

const existingLic = db.prepare('SELECT id FROM licenses WHERE user_id = ?').get(userId);
if (!existingLic) {
  db.prepare(`
    INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
    VALUES (?, 'lifetime', 'active', datetime('now'), NULL, 'manual', 'Администратор платформы', 1)
  `).run(userId);
  console.log('Added lifetime license for Pavel');
}

console.log('Admin users:', db.prepare('SELECT id, login, full_name, is_owner, roles FROM admin_users').all());
console.log('User:', db.prepare('SELECT * FROM users WHERE telegram_id = 308085078').get());
