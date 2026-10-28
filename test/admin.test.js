import test from 'node:test';
import assert from 'node:assert';
import app from '../src/admin/server.js';
import db from '../src/db/database.js';
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/admin/auth.js';

test('Проверка доступности разделов по ролям (RBAC)', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => server.close());

  const daria = db.prepare("SELECT id FROM admin_users WHERE login = 'daria'").get();
  const alexTrainer = db.prepare("SELECT id FROM admin_users WHERE login = 'trainer_alex'").get();
  const elenaMulti = db.prepare("SELECT id FROM admin_users WHERE login = 'elena_all'").get();

  // 1. Неавторизованный запрос должен редиректить на /admin/login
  await t.test('Редирект неавторизованного на логин', async () => {
    const res = await fetch(`${baseUrl}/admin`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.get('location').includes('/admin/login'));
  });

  // 2. Дарья (Владелец) имеет доступ ко всем разделам
  await t.test('Владелец (Дарья) имеет доступ ко всем разделам', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken(daria.id)}`;
    
    for (const path of ['/admin', '/admin/users', '/admin/tickets', '/admin/payments', '/admin/tariffs', '/admin/team', '/admin/system']) {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Cookie: cookie }
      });
      assert.strictEqual(res.status, 200, `Ошибка на пути ${path} для Владельца`);
    }
  });

  // 3. Кинолог Алексей видит тикеты, но закрыт доступ к команде и финансам
  await t.test('Кинолог имеет доступ к тикетам, но закрыт к команде', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken(alexTrainer.id)}`;

    const ticketRes = await fetch(`${baseUrl}/admin/tickets`, { headers: { Cookie: cookie } });
    assert.strictEqual(ticketRes.status, 200);

    const teamRes = await fetch(`${baseUrl}/admin/team`, { headers: { Cookie: cookie } });
    assert.strictEqual(teamRes.status, 403);
  });

  // 4. Мультироль Елена (Менеджер + Кинолог) видит и клиентов, и тикеты, и тарифы
  await t.test('Мультироль имеет доступ к разделам менеджера и кинолога', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken(elenaMulti.id)}`;

    const usersRes = await fetch(`${baseUrl}/admin/users`, { headers: { Cookie: cookie } });
    assert.strictEqual(usersRes.status, 200);

    const ticketsRes = await fetch(`${baseUrl}/admin/tickets`, { headers: { Cookie: cookie } });
    assert.strictEqual(ticketsRes.status, 200);

    const tariffsRes = await fetch(`${baseUrl}/admin/tariffs`, { headers: { Cookie: cookie } });
    assert.strictEqual(tariffsRes.status, 200);

    const teamRes = await fetch(`${baseUrl}/admin/team`, { headers: { Cookie: cookie } });
    assert.strictEqual(teamRes.status, 403);
  });
});
