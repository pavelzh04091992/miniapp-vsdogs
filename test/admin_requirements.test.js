import test from 'node:test';
import assert from 'node:assert';
import app from '../src/admin/server.js';
import db from '../src/db/database.js';
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/admin/auth.js';
import { renderTemplate, getAutoMessages, updateAutoMessage } from '../src/admin/services/notificationService.js';

test('Комплексная проверка всех 10 пунктов требований по админ-панели', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => server.close());

  const daria = db.prepare("SELECT * FROM admin_users WHERE login = 'daria'").get();
  const elenaMulti = db.prepare("SELECT * FROM admin_users WHERE login = 'elena_all'").get();
  const ownerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(daria.id)}`;
  const managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(elenaMulti.id)}`;

  // 1. Убрать маску у логина и пароля на странице входа
  await t.test('1) Логин и пароль не содержат масок/плейсхолдеров daria на странице входа', async () => {
    const res = await fetch(`${baseUrl}/admin/login`);
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(!html.includes('placeholder="daria"'), 'Не должно быть placeholder="daria"');
    assert.ok(!html.includes('placeholder="••••••••"'), 'Не должно быть placeholder="••••••••"');
    assert.ok(html.includes('name="login"'), 'Поле login должно присутствовать');
    assert.ok(html.includes('name="password"'), 'Поле password должно присутствовать');
  });

  // 2. Сотрудник с ролью "Менеджер" видит только "Клиенты" и "Оплаты"
  await t.test('2) Роль Менеджер видит только Клиенты и Оплаты', async () => {
    // Доступ разрешен
    const usersRes = await fetch(`${baseUrl}/admin/users`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(usersRes.status, 200);
    const usersHtml = await usersRes.text();
    assert.ok(usersHtml.includes('Клиенты'));
    assert.ok(usersHtml.includes('Оплаты'));
    // Сайдбар менеджера не содержит запрещенных разделов
    assert.ok(!usersHtml.includes('<span>💬</span> Вопросы к кинологу'), 'В сайдбаре менеджера не должно быть Вопросов к кинологу');
    assert.ok(!usersHtml.includes('<span>📊</span> Дашборд'), 'В сайдбаре менеджера не должно быть Дашборда');
    assert.ok(!usersHtml.includes('<span>📋</span> Тарифы'), 'В сайдбаре менеджера не должно быть Тарифов');
    assert.ok(!usersHtml.includes('<span>📢</span> Рассылки'), 'В сайдбаре менеджера не должно быть Рассылок');

    const paymentsRes = await fetch(`${baseUrl}/admin/payments`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(paymentsRes.status, 200);

    // Доступ к Дашборду редиректит менеджера на /admin/users
    const dashRes = await fetch(`${baseUrl}/admin`, { headers: { Cookie: managerCookie }, redirect: 'manual' });
    assert.strictEqual(dashRes.status, 302);
    assert.strictEqual(dashRes.headers.get('location'), '/admin/users');

    // Доступ к остальным разделам запрещен (403)
    const tariffsRes = await fetch(`${baseUrl}/admin/tariffs`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(tariffsRes.status, 403);

    const broadcastsRes = await fetch(`${baseUrl}/admin/broadcasts`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(broadcastsRes.status, 403);

    const teamRes = await fetch(`${baseUrl}/admin/team`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(teamRes.status, 403);

    const systemRes = await fetch(`${baseUrl}/admin/system`, { headers: { Cookie: managerCookie } });
    assert.strictEqual(systemRes.status, 403);
  });

  // 3. Из Дашборда убрать раздел "Лицензии, истекающие в ближайшие 2 дня"
  await t.test('3) В Дашборде отсутствует блок Лицензии, истекающие в ближайшие 2 дня', async () => {
    const res = await fetch(`${baseUrl}/admin`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(!html.includes('Лицензии, истекающие в ближайшие 2 дня'), 'Блок истекающих лицензий должен быть удален');
    assert.ok(html.includes('Общая выручка'));
    assert.ok(html.includes('Активные лицензии'));
  });

  // 4. В разделе "Оплата" убрать "Запросы на подписку". В "Журнал оплат" убрать раздел "Источник"
  await t.test('4) В Оплатах нет Запросов на подписку и Источника в таблице', async () => {
    const res = await fetch(`${baseUrl}/admin/payments`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(!html.includes('Запросы на подписку'), 'Не должно быть вкладки/раздела Запросы на подписку');
    assert.ok(!html.includes('<th>Источник</th>'), 'В заголовке таблицы журнала оплат не должно быть колонки Источник');
    assert.ok(html.includes('Журнал зафиксированных оплат'));
  });

  // 5. В разделе "Тарифы" создание тарифа без ручного ID, ID создается автоматически
  await t.test('5) Создание тарифа с автоматической генерацией ID', async () => {
    const res = await fetch(`${baseUrl}/admin/tariffs`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(!html.includes('Уникальный ID тарифа (латиницей)'), 'В форме создания тарифа не должно быть поля ID');

    // Создаем тестовый тариф
    const testName = 'АвтоТест Тариф ' + Date.now();
    const createRes = await fetch(`${baseUrl}/admin/tariffs/create`, {
      method: 'POST',
      headers: {
        Cookie: ownerCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        name: testName,
        price: '3500',
        period_months: '2',
        duration_days: '60',
        description: 'Описание тестового тарифа',
        order_index: '99'
      }).toString(),
      redirect: 'manual'
    });
    assert.strictEqual(createRes.status, 302);

    const created = db.prepare('SELECT * FROM tariffs WHERE name = ?').get(testName);
    assert.ok(created, 'Тариф должен быть создан в базе');
    assert.ok(created.id.startsWith('tariff_'), `ID тарифа (${created.id}) должен начинаться с tariff_`);
    assert.strictEqual(created.price, 3500);

    // Удаляем тестовую запись
    db.prepare('DELETE FROM tariffs WHERE id = ?').run(created.id);
  });

  // 6. Рассылки и автонапоминания
  await t.test('6) Рассылки, удаление рассылок и автонапоминания с подстановками', async () => {
    const res = await fetch(`${baseUrl}/admin/broadcasts`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(!html.includes('expiring_48h'), 'Не должно быть опции expiring_48h');
    assert.ok(html.includes('Автоматические напоминания о сроке лицензии'));
    assert.ok(html.includes('{name}'));
    assert.ok(html.includes('{expiry_date}'));

    // Проверка автоподстановок
    const tpl = 'Привет, {name}! Подписка кончается {expiry_date}.';
    const rendered = renderTemplate(tpl, { name: 'Алексей', expiry_date: '05.11.2026' });
    assert.strictEqual(rendered, 'Привет, Алексей! Подписка кончается 05.11.2026.');

    // Проверка обновления автосообщения
    const updated = updateAutoMessage('sub_warning_3d', '⏳ Внимание, {name}! Ваша подписка завершается {expiry_date}.');
    assert.strictEqual(updated, true);
    const msgs = getAutoMessages();
    const w = msgs.find(m => m.id === 'sub_warning_3d');
    assert.ok(w.message_template.includes('Внимание, {name}!'));

    // Проверка удаления записи о проведенной рассылке
    db.prepare(`
      INSERT INTO broadcast_logs (admin_id, admin_name, target_segment, message_text, sent_count, failed_count)
      VALUES (?, 'Дарья', 'all', 'Тестовое сообщение для удаления', 1, 0)
    `).run(daria.id);
    const lastBroadcast = db.prepare('SELECT id FROM broadcast_logs ORDER BY id DESC LIMIT 1').get();

    const delRes = await fetch(`${baseUrl}/admin/broadcasts/delete/${lastBroadcast.id}`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      redirect: 'manual'
    });
    assert.strictEqual(delRes.status, 302);
    const checkDeleted = db.prepare('SELECT * FROM broadcast_logs WHERE id = ?').get(lastBroadcast.id);
    assert.strictEqual(checkDeleted, undefined);
  });

  // 7. Раздел "Сотрудники": кнопка добавления, поп-ап модалки, отсутствие правой колонки
  await t.test('7) Раздел Сотрудники: поп-ап модалки создания и редактирования', async () => {
    const res = await fetch(`${baseUrl}/admin/team`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(html.includes('+ Добавить сотрудника'), 'Кнопка добавления сотрудника должна присутствовать');
    assert.ok(html.includes('id="createEmployeeModal"'), 'Модальное окно создания должно присутствовать');
    assert.ok(html.includes('id="editEmployeeModal"'), 'Модальное окно редактирования должно присутствовать');
    assert.ok(!html.includes('<!-- Форма создания / редактирования -->'), 'Не должно быть правой колонки формы');
  });

  // 8. Убираем IP адрес во всех местах
  await t.test('8) Отсутствие отображения IP адреса в админке', async () => {
    const sysRes = await fetch(`${baseUrl}/admin/system`, { headers: { Cookie: ownerCookie } });
    const sysHtml = await sysRes.text();
    assert.ok(!sysHtml.includes('<th>IP адрес</th>'), 'В системном логе не должно быть колонки IP адрес');

    // Проверяем страницу пользователя
    const userRes = await fetch(`${baseUrl}/admin/users/1`, { headers: { Cookie: ownerCookie } });
    if (userRes.status === 200) {
      const userHtml = await userRes.text();
      assert.ok(!userHtml.includes('<th>IP</th>'), 'В карточке пользователя не должно быть колонки IP');
    }
  });

  // 9. Автообновление в реальном времени (SSE endpoint)
  await t.test('9) Наличие SSE-эндпоинта автообновления /admin/api/events', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const sseRes = await fetch(`${baseUrl}/admin/api/events`, {
        headers: { Cookie: ownerCookie },
        signal: controller.signal
      });
      clearTimeout(timeout);
      assert.strictEqual(sseRes.status, 200);
      assert.strictEqual(sseRes.headers.get('content-type'), 'text/event-stream');
      controller.abort(); // закрываем SSE соединение
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  });

  // 10. Мобильная адаптация
  await t.test('10) Мобильная адаптация интерфейса', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, { headers: { Cookie: ownerCookie } });
    const html = await res.text();
    assert.ok(html.includes('name="viewport"'), 'Метатег viewport должен присутствовать');
    assert.ok(html.includes('id="menuToggleBtn"'), 'Мобильная кнопка меню (гамбургер) должна присутствовать');
    assert.ok(html.includes('id="sidebarBackdrop"'), 'Подложка мобильного меню должна присутствовать');
    assert.ok(html.includes('@media (max-width: 768px)'), 'Медиа-запросы для мобильных устройств должны присутствовать');
  });
});