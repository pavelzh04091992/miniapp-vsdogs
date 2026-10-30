import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('admin license deletion and audit logging', async () => {
  const tempDbPath = path.join(process.cwd(), 'data', 'test-license-audit.sqlite');
  if (fs.existsSync(tempDbPath)) {
    try { fs.unlinkSync(tempDbPath); } catch {}
  }

  process.env.DB_PATH = tempDbPath;

  const { initDatabase, db } = await import('../src/db/database.js');
  initDatabase();

  const { deleteLicense, grantOrExtendLicense } = await import('../src/admin/services/licenseService.js');

  // 1. Создаем тестового администратора
  const adminResult = db.prepare(`
    INSERT INTO admin_users (login, hashed_password, salt, full_name, is_owner, roles, is_active)
    VALUES ('test_admin', 'hash', 'salt', 'Тестовый Менеджер', 1, '["MANAGER"]', 1)
  `).run();
  const adminId = adminResult.lastInsertRowid;

  // 2. Создаем тестового клиента
  const userResult = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, phone, is_blocked)
    VALUES (999001, 'pup_user', 'Анна', 'Смирнова', '+79991234567', 0)
  `).run();
  const userId = userResult.lastInsertRowid;

  // 3. Выдаем клиенту платную лицензию
  const grantResult = grantOrExtendLicense({
    userId,
    tariffId: 'paid_1m',
    amount: 2900,
    notes: 'Первая покупка',
    adminId,
    ip: '127.0.0.1'
  });

  assert.ok(grantResult.licenseId, 'Лицензия должна быть создана');

  // Проверяем, что лицензия активна
  const activeLic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
  assert.ok(activeLic, 'Активная лицензия должна существовать');
  assert.equal(activeLic.tariff_id, 'paid_1m');

  // Проверяем, что платеж связан
  const payment = db.prepare('SELECT * FROM payments WHERE license_id = ?').get(activeLic.id);
  assert.ok(payment, 'Связанный платеж должен существовать');

  // Проверяем, что клиент получил доступ
  const userBefore = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.ok(userBefore.access_expires_at > 0, 'Пользователь должен иметь access_expires_at > 0');

  // 4. Удаляем активную лицензию с причиной
  const delResult = deleteLicense({
    licenseId: activeLic.id,
    userId,
    adminId,
    reason: 'Ошибочное оформление',
    ip: '192.168.1.100'
  });

  assert.equal(delResult.success, true, 'deleteLicense должен вернуть success: true');

  // 5. Проверяем физическое удаление из таблицы licenses
  const checkLic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(activeLic.id);
  assert.equal(checkLic, undefined, 'Лицензия должна быть удалена из базы');

  // 6. Проверяем, что платеж не удален, а его license_id обнулен (сохранение фин. отчетности)
  const checkPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
  assert.equal(checkPayment.license_id, null, 'license_id платежа должен быть обнулен');
  assert.equal(checkPayment.amount, 2900, 'Сумма платежа должна сохраниться');

  // 7. Проверяем отзыв доступа у пользователя в users (access_expires_at = 0)
  const userAfter = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(userAfter.access_expires_at, 0, 'access_expires_at должен стать 0');

  // 8. Проверяем запись в журнале аудита admin_audit_logs
  const auditLogs = db.prepare(`
    SELECT * FROM admin_audit_logs 
    WHERE target_user_id = ? AND action = 'DELETE_LICENSE'
    ORDER BY id DESC
  `).all(userId);

  assert.equal(auditLogs.length, 1, 'Должна появиться ровно одна запись DELETE_LICENSE');
  const log = auditLogs[0];
  assert.equal(log.admin_id, adminId);
  assert.equal(log.admin_name, 'Тестовый Менеджер');
  assert.equal(log.action, 'DELETE_LICENSE');
  assert.equal(log.ip_address, '192.168.1.100');
  assert.ok(log.details.includes('Ошибочное оформление'), 'Лог должен содержать указанную причину');
  assert.ok(log.details.includes('Удалена лицензия #' + activeLic.id), 'Лог должен содержать номер лицензии');
  assert.ok(log.details.includes('paid_1m') || log.details.includes('1 месяц'), 'Лог должен содержать название тарифа');
  assert.ok(log.details.includes('Анна Смирнова'), 'Лог должен содержать имя клиента');

  // 9. Проверка удаления по userId (по умолчанию удаляет активную)
  grantOrExtendLicense({
    userId,
    tariffId: 'lifetime',
    amount: 14900,
    notes: 'VIP доступ',
    adminId,
    ip: '127.0.0.1'
  });

  const activeVip = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(userId);
  assert.equal(activeVip.tariff_id, 'lifetime');

  const delVipResult = deleteLicense({
    userId,
    adminId,
    reason: 'Возврат средств за VIP',
    ip: '127.0.0.1'
  });
  assert.equal(delVipResult.success, true);

  const vipAfter = db.prepare('SELECT * FROM licenses WHERE id = ?').get(activeVip.id);
  assert.equal(vipAfter, undefined, 'VIP лицензия должна быть удалена');

  const auditVip = db.prepare(`
    SELECT * FROM admin_audit_logs 
    WHERE target_user_id = ? AND details LIKE '%VIP%'
    ORDER BY id DESC LIMIT 1
  `).get(userId);
  assert.ok(auditVip, 'Аудит удаления VIP лицензии должен существовать');
  assert.ok(auditVip.details.includes('Возврат средств за VIP'));

  // 10. Проверка валидации (несуществующая лицензия или чужой userId)
  const failResult = deleteLicense({
    licenseId: 999999,
    userId,
    adminId
  });
  assert.equal(failResult.success, false);
  assert.equal(failResult.error, 'Лицензия не найдена');

  const otherUserResult = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (999002, 'other_user', 'Иван')
  `).run();
  const otherUserId = otherUserResult.lastInsertRowid;

  const licOther = db.prepare(`
    INSERT INTO licenses (user_id, tariff_id, status)
    VALUES (?, 'paid_1m', 'active')
  `).run(otherUserId);

  const mismatchResult = deleteLicense({
    licenseId: licOther.lastInsertRowid,
    userId: userId, // Передаем ID другого пользователя
    adminId
  });
  assert.equal(mismatchResult.success, false);
  assert.equal(mismatchResult.error, 'Лицензия не принадлежит данному пользователю');

  // Очистка
  try {
    fs.unlinkSync(tempDbPath);
  } catch {}
});
