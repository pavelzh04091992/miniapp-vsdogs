import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/admin/server.js';
import db from '../src/db/database.js';
import { createApiToken, verifyApiToken, revokeApiToken, deleteApiToken, listApiTokens } from '../src/admin/services/apiTokenService.js';
import { createSessionToken } from '../src/admin/auth.js';

let server;
let baseUrl;
let ownerCookie;
let managerCookie;
let testToken;

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const owner = db.prepare("SELECT id FROM admin_users WHERE login = 'daria'").get();
  ownerCookie = `vsdogs_admin_session=${createSessionToken(owner.id)}`;

  // Создаем менеджера для проверки RBAC к разделу токенов
  let manager = db.prepare("SELECT id FROM admin_users WHERE login = 'test_mgr_api'").get();
  if (!manager) {
    const res = db.prepare(`
      INSERT INTO admin_users (login, hashed_password, salt, full_name, is_owner, roles, is_active)
      VALUES ('test_mgr_api', 'hash', 'salt', 'Менеджер Тест', 0, '["MANAGER"]', 1)
    `).run();
    manager = { id: res.lastInsertRowid };
  }
  managerCookie = `vsdogs_admin_session=${createSessionToken(manager.id)}`;

  // Создаем тестовый API токен
  const created = createApiToken({ name: 'Тестовое приложение', adminId: owner.id });
  testToken = created.token;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  // Очистка тестового менеджера
  db.prepare("DELETE FROM admin_users WHERE login = 'test_mgr_api'").run();
});

test('Open API & Токены доступа', async (t) => {

  await t.test('1) Health check /api/v1/health доступен без токена', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.service, 'VS Dogs External API');
  });

  await t.test('2) Запрос без токена к /api/v1/clients возвращает 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clients`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('API токен'));
  });

  await t.test('3) Запрос с неверным токеном возвращает 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clients`, {
      headers: { Authorization: 'Bearer vsd_live_invalid_token_123' }
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await t.test('4) Успешный запрос к /api/v1/clients по заголовку Authorization Bearer', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clients?limit=5`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.pagination);
    assert.strictEqual(json.pagination.limit, 5);
  });

  await t.test('5) Успешный запрос к /api/v1/clients по заголовку X-API-Key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clients?limit=2`, {
      headers: { 'X-API-Key': testToken }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
  });

  await t.test('6) Запрос к /api/v1/clients/:id', async () => {
    const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get();
    if (firstUser) {
      const res = await fetch(`${baseUrl}/api/v1/clients/${firstUser.id}`, {
        headers: { Authorization: `Bearer ${testToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, firstUser.id);
      assert.ok(Array.isArray(json.data.licenses));
      assert.ok(Array.isArray(json.data.payments));
    }
  });

  await t.test('7) Запрос к /api/v1/payments возвращает оплаты и блок summary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.summary);
    assert.strictEqual(typeof json.summary.total_amount, 'number');
  });

  await t.test('8) Запрос к /api/v1/tariffs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tariffs`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
  });

  await t.test('9) Запрос к /api/v1/stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stats`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.clients);
    assert.ok(json.data.finance);
    assert.strictEqual(typeof json.data.finance.total_revenue, 'number');
  });

  await t.test('10) OpenAPI спецификация /api/v1/openapi.json', async () => {
    const res = await fetch(`${baseUrl}/api/v1/openapi.json`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.openapi, '3.0.3');
    assert.ok(json.paths['/clients']);
    assert.ok(json.paths['/payments']);
  });

  await t.test('11) Документация /api/docs отдает красивый HTML', async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('VS Dogs External API'));
    assert.ok(html.includes('GET'));
    assert.ok(html.includes('/clients'));
    assert.ok(html.includes('/payments'));
  });

  await t.test('12) RBAC: Доступ к разделу /admin/api-tokens только у Владельца', async () => {
    // Неавторизованный -> 302 на логин
    const anonRes = await fetch(`${baseUrl}/admin/api-tokens`, { redirect: 'manual' });
    assert.strictEqual(anonRes.status, 302);

    // Менеджер -> 403 запрещено
    const mgrRes = await fetch(`${baseUrl}/admin/api-tokens`, {
      headers: { Cookie: managerCookie }
    });
    assert.strictEqual(mgrRes.status, 403);

    // Владелец -> 200 OK
    const ownerRes = await fetch(`${baseUrl}/admin/api-tokens`, {
      headers: { Cookie: ownerCookie }
    });
    assert.strictEqual(ownerRes.status, 200);
    const html = await ownerRes.text();
    assert.ok(html.includes('Выпущенные API-токены'));
    assert.ok(html.includes('Тестовое приложение'));
  });

  await t.test('13) Создание, отзыв и удаление API-токена через админку', async () => {
    // Создаем токен через форму
    const createRes = await fetch(`${baseUrl}/admin/api-tokens/create`, {
      method: 'POST',
      headers: {
        Cookie: ownerCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        name: 'CRM Дарьи 2026',
        permissions: 'all'
      }).toString(),
      redirect: 'manual'
    });
    assert.strictEqual(createRes.status, 302);
    const loc = createRes.headers.get('location');
    assert.ok(loc.includes('new_token=vsd_live_'));

    const createdTokenRow = db.prepare("SELECT * FROM api_tokens WHERE name = 'CRM Дарьи 2026'").get();
    assert.ok(createdTokenRow);
    assert.strictEqual(createdTokenRow.is_active, 1);

    // Отзываем токен
    const toggleRes = await fetch(`${baseUrl}/admin/api-tokens/${createdTokenRow.id}/toggle`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      redirect: 'manual'
    });
    assert.strictEqual(toggleRes.status, 302);
    const revoked = db.prepare('SELECT is_active FROM api_tokens WHERE id = ?').get(createdTokenRow.id);
    assert.strictEqual(revoked.is_active, 0);

    // Отозванный токен не может делать запросы
    const deniedRes = await fetch(`${baseUrl}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${createdTokenRow.token}` }
    });
    assert.strictEqual(deniedRes.status, 401);

    // Удаляем токен
    const delRes = await fetch(`${baseUrl}/admin/api-tokens/${createdTokenRow.id}/delete`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      redirect: 'manual'
    });
    assert.strictEqual(delRes.status, 302);
    const deleted = db.prepare('SELECT id FROM api_tokens WHERE id = ?').get(createdTokenRow.id);
    assert.strictEqual(deleted, undefined);
  });

});
