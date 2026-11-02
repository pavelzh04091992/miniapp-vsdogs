# 🐶 VS Dogs Open API — Документация для интеграции

Открытый REST API бэкофиса «Высшая школа собак» для интеграции внешних приложений Дарьи Сахаровой, CRM-систем и сервисов для сотрудников.

API позволяет в реальном времени получать актуальные данные по:
- **Ученикам (клиентам)**: профили, Telegram ID, телефоны, статус и срок действия подписки, привязанные тарифы;
- **Оплатам и транзакциям**: история платежей, суммы, даты, комментарии, тарифы и общая статистика выручки;
- **Тарифам**: список доступных тарифов, стоимость и сроки действия;
- **Сводной статистике**: общее число клиентов, активных подписок, выручка за день / месяц / все время.

---

## 🚀 Быстрый старт

### 1. Базовый адрес API
- **Production (Боевой сервер):** `https://admin.miniapp-vsdogs.ru/api/v1`
- **Локальная разработка:** `http://localhost:3000/api/v1`

### 2. Интерактивная документация
В систему встроена веб-документация с примерами и подсветкой:
- `https://admin.miniapp-vsdogs.ru/api/docs`
- OpenAPI 3.0 JSON: `https://admin.miniapp-vsdogs.ru/api/v1/openapi.json`

---

## 🔐 Авторизация и токены доступа

Все запросы к API (кроме `/health` и `/openapi.json`) защищены авторизационными токенами.

### Получение токена:
1. Войдите в панель управления под учетной записью Владельца (Дарья Сахарова).
2. Перейдите в раздел **«API & Токены»** (`/admin/api-tokens`).
3. Введите название токена (например: *«Мобильное приложение Дарьи»*) и нажмите **«Сгенерировать API-токен»**.
4. Скопируйте сгенерированный токен (формат: `vsd_live_...`).

### Передача токена в запросах:
Поддерживаются два стандартных способа передачи токена:

#### Способ 1: Заголовок `Authorization: Bearer` (Рекомендуется)
```http
GET /api/v1/clients HTTP/1.1
Host: admin.miniapp-vsdogs.ru
Authorization: Bearer vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Способ 2: Заголовок `X-API-Key`
```http
GET /api/v1/clients HTTP/1.1
Host: admin.miniapp-vsdogs.ru
X-API-Key: vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### CORS:
API поддерживает Cross-Origin Resource Sharing (`Access-Control-Allow-Origin: *`). Запросы можно отправлять напрямую из браузера, Telegram Mini App или мобильных приложений.

---

## 📡 Эндпоинты API

---

### 1. Список клиентов
`GET /api/v1/clients`

Возвращает постраничный список клиентов школы с фильтрацией по статусу подписки и поиском.

#### Query-параметры:
| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `page` | integer | `1` | Номер страницы |
| `limit` | integer | `25` | Количество записей на страницу (макс. 100) |
| `search` / `q` | string | — | Поиск по телефону (+7...), имени, фамилии, @username или telegram_id |
| `status` | string | `all` | Фильтр статуса: `all`, `active` (активная лицензия), `expired` (истекла), `blocked` (заблокирован), `free` (базовый без подписки) |
| `tariff_id` | string | `all` | Фильтр по ID тарифа (например, `paid_1m`) |

#### Пример ответа:
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "telegram_id": 987654321,
      "username": "anna_poodle",
      "first_name": "Анна",
      "last_name": "Смирнова",
      "full_name": "Анна Смирнова",
      "phone": "+79161234567",
      "is_blocked": false,
      "status": "active",
      "tariff": {
        "id": "paid_1m",
        "name": "1 месяц"
      },
      "license": {
        "id": 22,
        "status": "active",
        "starts_at": "2026-11-01 10:00:00",
        "expires_at": "2026-12-01 10:00:00",
        "days_remaining": 29
      },
      "total_payments_amount": 2900,
      "payments_count": 1,
      "notes_count": 0,
      "created_at": "2026-11-01 09:40:15",
      "last_active_at": "2026-11-02 11:20:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 2. Детальная информация по клиенту
`GET /api/v1/clients/:id`

Возвращает полную карточку ученика: историю лицензий, платежей, заметок и вопросов кинологам.
В качестве `:id` можно передавать внутренний ID или `telegram_id`.

#### Пример ответа:
```json
{
  "success": true,
  "data": {
    "id": 15,
    "telegram_id": 987654321,
    "username": "anna_poodle",
    "first_name": "Анна",
    "last_name": "Смирнова",
    "full_name": "Анна Смирнова",
    "phone": "+79161234567",
    "is_blocked": false,
    "access_expires_at": 1796120000,
    "created_at": "2026-11-01 09:40:15",
    "last_active_at": "2026-11-02 11:20:00",
    "active_license": {
      "id": 22,
      "tariff_id": "paid_1m",
      "tariff_name": "1 месяц",
      "status": "active",
      "starts_at": "2026-11-01 10:00:00",
      "expires_at": "2026-12-01 10:00:00",
      "source": "manual",
      "notes": "Оплата через СБП"
    },
    "total_payments_amount": 2900,
    "licenses": [ ... ],
    "payments": [ ... ],
    "notes": [ ... ],
    "tickets": [ ... ]
  }
}
```

---

### 3. Журнал оплат
`GET /api/v1/payments`

Возвращает историю платежей с данными учеников, суммами, тарифами и фильтрацией по периодам.

#### Query-параметры:
| Параметр | Тип | Описание |
|---|---|---|
| `page` | integer | Номер страницы (по умолч. 1) |
| `limit` | integer | Количество на страницу (по умолч. 25, макс 100) |
| `user_id` | integer | Фильтр по ID клиента |
| `tariff_id` | string | Фильтр по ID тарифа |
| `from` | string | Дата от в формате `YYYY-MM-DD` |
| `to` | string | Дата до в формате `YYYY-MM-DD` |

#### Пример ответа:
```json
{
  "success": true,
  "data": [
    {
      "id": 41,
      "user_id": 15,
      "client": {
        "id": 15,
        "name": "Анна Смирнова",
        "phone": "+79161234567",
        "username": "anna_poodle",
        "telegram_id": 987654321
      },
      "amount": 2900,
      "currency": "RUB",
      "tariff_id": "paid_1m",
      "tariff_name": "1 месяц",
      "period_months": 1,
      "source": "manual",
      "external_tx_id": null,
      "comment": "Оплата СБП",
      "admin_name": "Дарья Сахарова",
      "created_at": "2026-11-01 10:00:00"
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
}
```

---

### 4. Список тарифов
`GET /api/v1/tariffs`

Возвращает справочник тарифов школы.

#### Пример ответа:
```json
{
  "success": true,
  "data": [
    {
      "id": "paid_1m",
      "name": "1 месяц",
      "price": 2900,
      "period_months": 1,
      "duration_days": 30,
      "description": "Полный доступ ко всем видеоматериалам и вопросам кинологу на 30 дней",
      "is_active": true,
      "order_index": 1
    },
    {
      "id": "free",
      "name": "Базовый (Free)",
      "price": 0,
      "period_months": 0,
      "duration_days": 0,
      "description": "Ознакомительный доступ",
      "is_active": true,
      "order_index": 5
    }
  ]
}
```

---

### 5. Список вопросов кинологу (Тикеты)
`GET /api/v1/tickets`

Возвращает список вопросов от учеников с текстом вопроса, прикрепленными медиа, ответом и статусом.

#### Query-параметры:
| Параметр | Тип | Описание |
|---|---|---|
| `status` | string | `unanswered` (неотвеченные новые и в работе), `new` (новые), `in_progress` (в работе), `answered` (отвеченные), `closed` (закрытые), `all` (все) |
| `page` | integer | Номер страницы (по умолч. 1) |
| `limit` | integer | Записей на страницу (по умолч. 25, макс 100) |

#### Пример ответа:
```json
{
  "success": true,
  "data": [
    {
      "id": 14,
      "user_id": 15,
      "client": {
        "id": 15,
        "name": "Анна Смирнова",
        "phone": "+79161234567",
        "username": "anna_poodle",
        "telegram_id": 987654321
      },
      "question_text": "Щенок не хочет ходить в туалет на пеленку, что делать?",
      "media_url": null,
      "status": "new",
      "is_answered": false,
      "assigned_trainer_name": null,
      "answer_text": null,
      "created_at": "2026-11-02 12:10:00",
      "answered_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 6. Real-time поток событий (SSE)
`GET /api/v1/events`

Позволяет серверу подключаться по протоколу Server-Sent Events (SSE) и в режиме реального времени получать push-уведомления без необходимости постоянного polling-опроса:
- `TICKETS_UPDATED`: появление нового вопроса или ответ кинолога;
- `PAYMENTS_UPDATED`: регистрация новой оплаты;
- `USERS_UPDATED`: регистрация нового ученика или изменение профиля.

Пример подключения (Node.js / Python):
```http
GET /api/v1/events HTTP/1.1
Host: admin.miniapp-vsdogs.ru
Authorization: Bearer vsd_live_...
Accept: text/event-stream
```

---

### 7. Сводная статистика (Дашборд)
`GET /api/v1/stats`

Возвращает агрегированные финансовые и клиентские показатели для главного экрана приложения.

#### Пример ответа:
```json
{
  "success": true,
  "data": {
    "clients": {
      "total": 150,
      "active_licenses": 95,
      "expired_licenses": 50,
      "blocked": 5
    },
    "finance": {
      "total_revenue": 275500,
      "payments_count": 95,
      "revenue_this_month": 43500,
      "revenue_today": 5800,
      "currency": "RUB"
    },
    "tickets": {
      "open": 2
    },
    "timestamp": "2026-11-02T12:00:00.000Z"
  }
}
```

---

### 6. Health Check
`GET /api/v1/health`

Не требует авторизации. Проверяет доступность сервера API.

```json
{
  "success": true,
  "status": "ok",
  "service": "VS Dogs External API",
  "version": "1.0.0",
  "time": "2026-11-02T12:00:00.000Z"
}
```

---

## 💻 Примеры интеграции

### JavaScript / TypeScript (fetch)
```javascript
const API_TOKEN = 'vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const API_BASE = 'https://admin.miniapp-vsdogs.ru/api/v1';

async function fetchActiveClients() {
  const response = await fetch(`${API_BASE}/clients?status=active`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Accept': 'application/json'
    }
  });

  const result = await response.json();
  if (result.success) {
    console.log('Найдено активных учеников:', result.data.length);
    return result.data;
  } else {
    throw new Error(result.error);
  }
}
```

### Python (requests)
```python
import requests

API_TOKEN = 'vsd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'
API_BASE = 'https://admin.miniapp-vsdogs.ru/api/v1'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Accept': 'application/json'
}

response = requests.get(f'{API_BASE}/payments', headers=headers, params={'limit': 50})
data = response.json()

if data.get('success'):
    print(f"Всего платежей на сумму: {data['summary']['total_amount']} руб.")
    for payment in data['data']:
        print(f"[{payment['created_at']}] {payment['client']['name']} — {payment['amount']} руб ({payment['tariff_name']})")
```

---

## ⚠️ Коды ошибок HTTP
| HTTP Код | Описание |
|---|---|
| `200 OK` | Запрос выполнен успешно |
| `401 Unauthorized` | Отсутствует заголовок авторизации или API-токен недействителен / отозван |
| `404 Not Found` | Клиент или ресурс с указанным идентификатором не найден |
| `500 Server Error` | Ошибка базы данных или внутренняя ошибка сервера |
