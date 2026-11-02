import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  const host = req.get('host') || 'admin.miniapp-vsdogs.ru';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}/api/v1`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VS Dogs External API — Документация разработчика</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --accent: #10b981;
      --method-get: #059669;
      --code-bg: #0b1120;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 0 0 60px 0;
    }

    header {
      background: #0b1120;
      border-bottom: 1px solid var(--card-border);
      padding: 28px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-icon {
      font-size: 28px;
    }

    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand p {
      font-size: 13px;
      color: var(--text-muted);
    }

    .header-links {
      display: flex;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    .btn-outline {
      background: transparent;
      border-color: var(--card-border);
      color: #cbd5e1;
    }
    .btn-outline:hover { background: var(--card-bg); color: #fff; }

    .container {
      max-width: 1040px;
      margin: 40px auto 0 auto;
      padding: 0 24px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 28px;
    }

    .card h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card p {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 14px;
    }

    .endpoint-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .endpoint-header {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      background: #182234;
      border-bottom: 1px solid var(--card-border);
    }

    .method {
      background: var(--method-get);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }

    .path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .desc {
      margin-left: auto;
      font-size: 13px;
      color: var(--text-muted);
    }

    .endpoint-body {
      padding: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin: 12px 0 20px 0;
    }

    th, td {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid var(--card-border);
    }

    th {
      color: #94a3b8;
      font-weight: 600;
      background: #141d2e;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      color: #38bdf8;
    }

    pre {
      background: var(--code-bg);
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      color: #cbd5e1;
      margin: 10px 0;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-top: 14px;
      margin-bottom: 6px;
    }

    .badge-auth {
      background: #7c3aed;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .copy-btn {
      background: #334155;
      border: none;
      color: #cbd5e1;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      float: right;
    }
    .copy-btn:hover { background: #475569; color: #fff; }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-icon">🐶</div>
      <div>
        <h1>Высшая школа собак — Документация Open API</h1>
        <p>Интеграционный шлюз для приложений Дарьи Сахаровой и сотрудников</p>
      </div>
    </div>
    <div class="header-links">
      <a href="/api/v1/openapi.json" target="_blank" class="btn btn-outline">📄 OpenAPI JSON</a>
      <a href="/admin/api-tokens" class="btn btn-primary">🔑 Управление токенами</a>
    </div>
  </header>

  <div class="container">
    
    <!-- Авторизация и базовый URL -->
    <div class="card">
      <h2>🔐 Авторизация и подключение</h2>
      <p>
        Базовый URL для всех запросов: <code>${baseUrl}</code>
      </p>
      <p>
        Все запросы к закрытым эндпоинтам требуют передачи выданного токена доступа. 
        Токен можно создать в разделе админ-панели <b>«API & Токены»</b>.
      </p>
      
      <div class="section-title">Способ 1: Заголовок Authorization (Рекомендуется)</div>
      <pre>Authorization: Bearer vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</pre>

      <div class="section-title">Способ 2: Заголовок X-API-Key</div>
      <pre>X-API-Key: vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</pre>

      <div class="section-title">CORS & Preflight</div>
      <p style="margin-top: 6px; font-size: 13px;">
        API поддерживает кросс-доменные запросы (CORS). Вы можете безопасно вызывать методы из браузерных Single Page Apps, Mini Apps Telegram, мобильных приложений на Flutter/React Native, или серверного бэкенда.
      </p>
    </div>

    <!-- Список эндпоинтов -->

    <!-- 1. GET /clients -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/clients</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Список клиентов (учеников)</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Возвращает список клиентов школы с данными профиля Telegram, телефонами, текущей активной лицензией и общей суммой оплат.
        </p>

        <div class="section-title">Параметры запроса (Query)</div>
        <table>
          <thead>
            <tr><th>Параметр</th><th>Тип</th><th>По умолчанию</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><code>page</code></td><td>integer</td><td>1</td><td>Номер страницы для пагинации</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>25</td><td>Количество записей (максимум 100)</td></tr>
            <tr><td><code>search</code> / <code>q</code></td><td>string</td><td>—</td><td>Поиск по телефону (+7...), имени, фамилии, @username или telegram_id</td></tr>
            <tr><td><code>status</code></td><td>string</td><td>all</td><td>Фильтр: <code>all</code>, <code>active</code> (активная подписка), <code>expired</code> (истекла), <code>blocked</code> (заблокирован), <code>free</code> (базовый)</td></tr>
            <tr><td><code>tariff_id</code></td><td>string</td><td>all</td><td>Фильтр по конкретному тарифу (например: <code>paid_1m</code>)</td></tr>
          </tbody>
        </table>

        <div class="section-title">Пример cURL</div>
        <pre>curl -X GET "${baseUrl}/clients?status=active&limit=10" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>

        <div class="section-title">Пример ответа (JSON)</div>
        <pre>{
  "success": true,
  "data": [
    {
      "id": 12,
      "telegram_id": 483920194,
      "username": "olga_puppy",
      "first_name": "Ольга",
      "last_name": "Кузнецова",
      "full_name": "Ольга Кузнецова",
      "phone": "+79991234567",
      "is_blocked": false,
      "status": "active",
      "tariff": {
        "id": "paid_1m",
        "name": "1 месяц"
      },
      "license": {
        "id": 8,
        "status": "active",
        "starts_at": "2026-11-01 12:00:00",
        "expires_at": "2026-12-01 12:00:00",
        "days_remaining": 29
      },
      "total_payments_amount": 2900,
      "payments_count": 1,
      "notes_count": 2,
      "created_at": "2026-11-01 11:30:00",
      "last_active_at": "2026-11-02 10:15:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "total_pages": 5
  }
}</pre>
      </div>
    </div>

    <!-- 2. GET /clients/:id -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/clients/:id</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Детальный профиль клиента</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Возвращает полную карточку ученика: история всех выданных лицензий, вся история транзакций/оплат, внутренние заметки кинологов и вопросы.
          В качестве <code>:id</code> можно передавать как внутренний ID базы данных, так и <code>telegram_id</code>.
        </p>

        <div class="section-title">Пример cURL</div>
        <pre>curl -X GET "${baseUrl}/clients/12" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>
      </div>
    </div>

    <!-- 3. GET /payments -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/payments</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Журнал оплат и транзакций</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Возвращает историю платежей учеников с именами, телефонами, суммами, тарифами и датами. В ответе также содержится блок <code>summary</code> с суммой и количеством найденных оплат.
        </p>

        <div class="section-title">Параметры запроса (Query)</div>
        <table>
          <thead>
            <tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><code>page</code></td><td>integer</td><td>Номер страницы (по умолч. 1)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>Количество на страницу (по умолч. 25)</td></tr>
            <tr><td><code>user_id</code></td><td>integer</td><td>Фильтр по ID клиента</td></tr>
            <tr><td><code>tariff_id</code></td><td>string</td><td>Фильтр по ID тарифа</td></tr>
            <tr><td><code>from</code></td><td>date</td><td>Начальная дата (YYYY-MM-DD)</td></tr>
            <tr><td><code>to</code></td><td>date</td><td>Конечная дата (YYYY-MM-DD)</td></tr>
          </tbody>
        </table>

        <div class="section-title">Пример cURL</div>
        <pre>curl -X GET "${baseUrl}/payments?from=2026-11-01" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>

        <div class="section-title">Пример ответа (JSON)</div>
        <pre>{
  "success": true,
  "data": [
    {
      "id": 34,
      "user_id": 12,
      "client": {
        "id": 12,
        "name": "Ольга Кузнецова",
        "phone": "+79991234567",
        "username": "olga_puppy",
        "telegram_id": 483920194
      },
      "amount": 2900,
      "currency": "RUB",
      "tariff_id": "paid_1m",
      "tariff_name": "1 месяц",
      "period_months": 1,
      "source": "manual",
      "comment": "Оплата через СБП",
      "admin_name": "Дарья Сахарова",
      "created_at": "2026-11-01 12:05:00"
    }
  ],
  "summary": {
    "total_amount": 2900,
    "total_count": 1
  },
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "total_pages": 1
  }
}</pre>
      </div>
    </div>

    <!-- 4. GET /tariffs -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/tariffs</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Тарифные планы</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Возвращает перечень доступных тарифов, их стоимость, длительность в днях и описание.
        </p>
        <pre>curl -X GET "${baseUrl}/tariffs" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>
      </div>
    </div>

    <!-- 4.1. GET /tickets -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/tickets</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Вопросы кинологу (тикеты)</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Возвращает список вопросов от учеников с фильтрацией по статусу. Чтобы получить только неотвеченные вопросы, передайте <code>?status=unanswered</code> (или <code>?status=new</code>).
        </p>

        <div class="section-title">Параметры запроса (Query)</div>
        <table>
          <thead>
            <tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><code>status</code></td><td>string</td><td>Фильтр статуса: <code>unanswered</code> (неотвеченные), <code>new</code> (новые), <code>in_progress</code> (в работе), <code>answered</code> (отвеченные), <code>all</code></td></tr>
            <tr><td><code>page</code></td><td>integer</td><td>Номер страницы (по умолч. 1)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>Количество на страницу (по умолч. 25, макс 100)</td></tr>
          </tbody>
        </table>

        <div class="section-title">Пример cURL</div>
        <pre>curl -X GET "${baseUrl}/tickets?status=unanswered" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>
      </div>
    </div>

    <!-- 4.2. GET /events (Real-Time SSE) -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/events</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Real-time поток событий (SSE)</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Постоянное соединение Server-Sent Events (SSE) для получения мгновенных push-уведомлений при изменении данных (новый вопрос, ответ кинолога, оплата, регистрация ученика). Альтернатива периодическому опросу (polling).
        </p>
        <pre>curl -N -H "Authorization: Bearer YOUR_API_TOKEN" "${baseUrl}/events"</pre>
      </div>
    </div>

    <!-- 5. GET /stats -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/stats</span>
        <span class="badge-auth">Bearer Auth</span>
        <span class="desc">Общая сводная статистика</span>
      </div>
      <div class="endpoint-body">
        <p style="color: var(--text-muted); font-size: 13.5px;">
          Показатели для дашборда приложения: количество учеников, активные/истекшие подписки, выручка за сегодня, за текущий месяц и за все время.
        </p>
        <pre>curl -X GET "${baseUrl}/stats" \
  -H "Authorization: Bearer YOUR_API_TOKEN"</pre>
      </div>
    </div>

  </div>

</body>
</html>`;

  res.send(html);
});

export default router;
