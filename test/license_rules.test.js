import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/database.js';
import { grantOrExtendLicense, getTariffName } from '../src/admin/services/licenseService.js';

test('Безопасность лицензирования: Smart Stacking и неизменяемость истории', async (t) => {
  // Создаем тестового пользователя
  const tgId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
  const user = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, phone)
    VALUES (?, 'test_safety_user', 'Иван', '+7 (999) 000-11-22')
  `).run(tgId);
  const userId = user.lastInsertRowid;

  const admin = db.prepare("SELECT id FROM admin_users WHERE login = 'daria'").get();

  await t.test('1. Первичная выдача лицензии на 1 месяц', () => {
    const res = grantOrExtendLicense({
      userId,
      tariffId: 'paid_1m',
      amount: 2900,
      notes: 'Первая покупка',
      adminId: admin.id
    });

    assert.strictEqual(res.action, 'created');

    const activeLic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
    assert.strictEqual(activeLic.tariff_id, 'paid_1m');
    assert.strictEqual(activeLic.status, 'active');
    assert.ok(activeLic.expires_at !== null);
  });

  await t.test('2. Умное продление (Smart Stacking): дни прибавляются, старая лицензия не затирается', () => {
    // Получаем текущую дату окончания
    const firstLic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
    const firstExpiresAt = firstLic.expires_at;

    // Продлеваем еще на 1 месяц (30 дней)
    const res = grantOrExtendLicense({
      userId,
      tariffId: 'paid_1m',
      amount: 2900,
      notes: 'Вторая покупка до окончания первой',
      adminId: admin.id
    });

    assert.strictEqual(res.action, 'extended');

    // Проверяем статус первой лицензии: она не удалена, а помечена как extended
    const oldLic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(firstLic.id);
    assert.strictEqual(oldLic.status, 'extended');

    // Проверяем новую активную лицензию: её дата окончания ровно на 30 дней больше, чем firstExpiresAt
    const newLic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
    assert.notStrictEqual(newLic.id, firstLic.id);
    assert.ok(new Date(newLic.expires_at) > new Date(firstExpiresAt));

    // Проверяем историю: в базе сохранены ОБЕ лицензии!
    const allLics = db.prepare('SELECT * FROM licenses WHERE user_id = ? ORDER BY id ASC').all(userId);
    assert.strictEqual(allLics.length, 2);
  });

  await t.test('3. Апгрейд до VIP Lifetime', () => {
    const res = grantOrExtendLicense({
      userId,
      tariffId: 'lifetime',
      amount: 14900,
      notes: 'Апгрейд до VIP',
      adminId: admin.id
    });

    assert.strictEqual(res.action, 'upgraded');

    const activeLic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
    assert.strictEqual(activeLic.tariff_id, 'lifetime');
    assert.strictEqual(activeLic.expires_at, null);

    // В истории теперь 3 записи
    const allLics = db.prepare('SELECT * FROM licenses WHERE user_id = ? ORDER BY id ASC').all(userId);
    assert.strictEqual(allLics.length, 3);
  });

  await t.test('4. Человекочитаемые названия тарифов', () => {
    assert.strictEqual(getTariffName('paid_1m'), '1 месяц');
    assert.strictEqual(getTariffName('paid_3m'), '3 месяца');
    assert.strictEqual(getTariffName('lifetime'), 'VIP Бессрочный');
    assert.strictEqual(getTariffName('free'), 'Базовый (Free)');
  });
});
