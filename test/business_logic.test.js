import test from 'node:test';
import assert from 'node:assert';
import app from '../src/admin/server.js';
import db from '../src/db/database.js';
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/admin/auth.js';

test('Проверка бизнес-логики: выдача лицензии и ответ на тикет', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => server.close());

  const daria = db.prepare("SELECT id FROM admin_users WHERE login = 'daria'").get();
  const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken(daria.id)}`;

  // 1. Проверяем выдачу лицензии на 1 месяц ученику
  await t.test('Менеджер выписывает лицензию ученику', async () => {
    // Берем первого попавшегося ученика
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();

    const formBody = new URLSearchParams({
      tariff_id: 'paid_1m',
      amount: '2900',
      notes: 'Тестовая активация через тест'
    });

    const res = await fetch(`${baseUrl}/admin/users/${user.id}/grant-license`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString(),
      redirect: 'manual'
    });

    assert.strictEqual(res.status, 302);

    // Проверяем, что в БД появилась новая активная лицензия и транзакция
    const latestLic = db.prepare('SELECT * FROM licenses WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
    assert.strictEqual(latestLic.tariff_id, 'paid_1m');
    assert.strictEqual(latestLic.status, 'active');

    const payment = db.prepare('SELECT * FROM payments WHERE license_id = ?').get(latestLic.id);
    assert.strictEqual(payment.amount, 2900);
  });

  // 2. Проверяем ответ на тикет кинолога
  await t.test('Кинолог отвечает на вопрос ученика', async () => {
    // Создаем тестовый тикет
    const ticketInsert = db.prepare(`
      INSERT INTO trainer_tickets (user_id, question_text, status)
      VALUES (1, 'Вопрос из автотеста: как научить выдержке?', 'new')
    `).run();
    const ticketId = ticketInsert.lastInsertRowid;

    const answerBody = new URLSearchParams({
      answer_text: 'Ответ кинолога: начните с 2 секунд и постепенно увеличивайте.'
    });

    const res = await fetch(`${baseUrl}/admin/tickets/${ticketId}/answer`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: answerBody.toString(),
      redirect: 'manual'
    });

    assert.strictEqual(res.status, 302);

    const updated = db.prepare('SELECT * FROM trainer_tickets WHERE id = ?').get(ticketId);
    assert.strictEqual(updated.status, 'answered');
    assert.strictEqual(updated.answer_text, 'Ответ кинолога: начните с 2 секунд и постепенно увеличивайте.');
  });

  // 3. Проверяем удаление клиента
  await t.test('Менеджер удаляет клиента и связанные данные', async () => {
    // Создаем отдельного временного пользователя с лицензией и тикетом
    const dynamicTgId3 = 800000000 + Math.floor(Math.random() * 90000000);
    const insUser = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name)
      VALUES (?, 'temp_delete_user', 'Временный')
    `).run(dynamicTgId3);
    const tempUserId = insUser.lastInsertRowid;

    const insLic = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status)
      VALUES (?, 'paid_1m', 'active')
    `).run(tempUserId);
    const tempLicId = insLic.lastInsertRowid;

    db.prepare(`
      INSERT INTO payments (user_id, license_id, amount, tariff_id)
      VALUES (?, ?, 1990, 'paid_1m')
    `).run(tempUserId, tempLicId);

    db.prepare(`
      INSERT INTO user_notes (user_id, author_admin_id, author_name, note_text)
      VALUES (?, 1, 'Дарья', 'Тестовая заметка')
    `).run(tempUserId);

    const res = await fetch(`${baseUrl}/admin/users/${tempUserId}/delete`, {
      method: 'POST',
      headers: {
        Cookie: cookie
      },
      redirect: 'manual'
    });

    assert.strictEqual(res.status, 302);

    // Проверяем, что пользователь и все связи удалены
    const deletedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(tempUserId);
    assert.strictEqual(deletedUser, undefined);

    const deletedLics = db.prepare('SELECT * FROM licenses WHERE user_id = ?').all(tempUserId);
    assert.strictEqual(deletedLics.length, 0);

    const deletedNotes = db.prepare('SELECT * FROM user_notes WHERE user_id = ?').all(tempUserId);
    assert.strictEqual(deletedNotes.length, 0);
  });

  // 4. Проверяем запросы на подписку (активация и удаление)
  await t.test('Менеджер обрабатывает и удаляет запросы на подписку', async () => {
    // 1. Создаем пользователя и запрос на подписку
    const dynamicTgId = 700000000 + Math.floor(Math.random() * 90000000);
    const insUser = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name)
      VALUES (?, 'sub_req_user', 'Иван Запрос')
    `).run(dynamicTgId);
    const reqUserId = insUser.lastInsertRowid;

    const insReq = db.prepare(`
      INSERT INTO subscription_requests (user_id, tariff_id, comment)
      VALUES (?, 'paid_3m', 'Хочу курс на 3 месяца, чек оплачен')
    `).run(reqUserId);
    const reqId = insReq.lastInsertRowid;

    // 2. Проверяем отображение во вкладке запросов
    const pageRes = await fetch(`${baseUrl}/admin/payments?tab=requests`, {
      headers: { Cookie: cookie }
    });
    const pageHtml = await pageRes.text();
    assert.ok(pageHtml.includes('Запросы на подписку'));
    assert.ok(pageHtml.includes('Хочу курс на 3 месяца'));

    // 3. Активируем подписку по запросу
    const actBody = new URLSearchParams({
      tariff_id: 'paid_3m',
      amount: '6900',
      notes: 'Одобрено в тесте'
    });

    const actRes = await fetch(`${baseUrl}/admin/payments/requests/${reqId}/activate`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: actBody.toString(),
      redirect: 'manual'
    });

    assert.strictEqual(actRes.status, 302);

    // Проверяем, что запрос стал approved
    const updatedReq = db.prepare('SELECT * FROM subscription_requests WHERE id = ?').get(reqId);
    assert.strictEqual(updatedReq.status, 'approved');

    // Проверяем, что у клиента появилась активная лицензия paid_3m
    const lic = db.prepare("SELECT * FROM licenses WHERE user_id = ? AND status = 'active'").get(reqUserId);
    assert.strictEqual(lic.tariff_id, 'paid_3m');

    // 4. Создаем второй запрос и удаляем его
    const insReq2 = db.prepare(`
      INSERT INTO subscription_requests (user_id, tariff_id, comment)
      VALUES (?, 'paid_1m', 'Ошибочный запрос')
    `).run(reqUserId);
    const reqId2 = insReq2.lastInsertRowid;

    const delRes = await fetch(`${baseUrl}/admin/payments/requests/${reqId2}/delete`, {
      method: 'POST',
      headers: { Cookie: cookie },
      redirect: 'manual'
    });
    assert.strictEqual(delRes.status, 302);

    const deletedReq = db.prepare('SELECT * FROM subscription_requests WHERE id = ?').get(reqId2);
    assert.strictEqual(deletedReq, undefined);
  });
});
