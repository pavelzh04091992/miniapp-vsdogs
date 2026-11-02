import express from 'express';
import db from '../../db/database.js';
import { verifyApiToken } from '../services/apiTokenService.js';
import { getTariffName } from '../services/licenseService.js';

const router = express.Router();

/**
 * CORS и Preflight для всех API-запросов
 */
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

/**
 * Middleware авторизации по API-токену
 */
export function requireApiToken(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-api-key']) {
    token = String(req.headers['x-api-key']).trim();
  } else if (req.query.api_token) {
    token = String(req.query.api_token).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'API токен не передан. Используйте заголовок Authorization: Bearer <TOKEN> или X-API-Key: <TOKEN>'
    });
  }

  const tokenRecord = verifyApiToken(token);
  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      error: 'Недействительный или отозванный API токен'
    });
  }

  req.apiToken = tokenRecord;
  next();
}

/**
 * 0. Проверка работоспособности (Health check)
 * Не требует токена
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'VS Dogs External API',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

/**
 * 1. Получение списка клиентов
 * GET /api/v1/clients
 * Фильтры: page, limit, search, status, tariff_id
 */
router.get('/clients', requireApiToken, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const search = req.query.search || req.query.q || '';
    const status = req.query.status || 'all'; // all, active, expired, blocked, free
    const tariffId = req.query.tariff_id || 'all';

    let whereClauses = ['1=1'];
    const params = [];

    if (search.trim()) {
      whereClauses.push('(u.phone LIKE ? OR u.username LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CAST(u.telegram_id AS TEXT) LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }

    if (status === 'blocked') {
      whereClauses.push('u.is_blocked = 1');
    } else if (status === 'active') {
      whereClauses.push("u.is_blocked = 0 AND l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > datetime('now'))");
    } else if (status === 'expired') {
      whereClauses.push("u.is_blocked = 0 AND (l.expires_at <= datetime('now') OR l.status = 'expired')");
    } else if (status === 'free') {
      whereClauses.push("u.is_blocked = 0 AND (l.tariff_id = 'free' OR l.tariff_id IS NULL)");
    }

    if (tariffId !== 'all') {
      whereClauses.push('l.tariff_id = ?');
      params.push(tariffId);
    }

    const whereStr = whereClauses.join(' AND ');

    // Общее количество
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN licenses l ON l.user_id = u.id AND l.id = (
        SELECT id FROM licenses WHERE user_id = u.id AND status = 'active' ORDER BY id DESC LIMIT 1
      )
      WHERE ${whereStr}
    `;
    const total = db.prepare(countQuery).get(...params)?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Список клиентов
    const listQuery = `
      SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name, u.phone, 
             u.is_blocked, u.access_expires_at, u.created_at, u.last_active_at,
             l.id as license_id, l.tariff_id, l.status as license_status, l.starts_at as license_starts_at, l.expires_at as license_expires_at,
             t.name as tariff_name, t.price as tariff_price,
             (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.user_id = u.id) as total_payments_sum,
             (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id) as payments_count,
             (SELECT COUNT(*) FROM user_notes n WHERE n.user_id = u.id) as notes_count
      FROM users u
      LEFT JOIN licenses l ON l.user_id = u.id AND l.id = (
        SELECT id FROM licenses WHERE user_id = u.id AND status = 'active' ORDER BY id DESC LIMIT 1
      )
      LEFT JOIN tariffs t ON t.id = l.tariff_id
      WHERE ${whereStr}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(listQuery).all(...params, limit, offset);

    const now = new Date();
    const clients = rows.map(r => {
      let clientStatus = 'free';
      let daysRemaining = null;

      if (r.is_blocked === 1) {
        clientStatus = 'blocked';
      } else if (r.license_id && r.license_status === 'active') {
        if (!r.license_expires_at) {
          clientStatus = 'active';
          daysRemaining = 9999;
        } else {
          const expDate = new Date(r.license_expires_at);
          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            clientStatus = 'active';
            daysRemaining = diffDays;
          } else {
            clientStatus = 'expired';
            daysRemaining = 0;
          }
        }
      }

      const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ') || (r.username ? `@${r.username}` : `Клиент #${r.id}`);

      return {
        id: r.id,
        telegram_id: r.telegram_id,
        username: r.username || null,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        full_name: fullName,
        phone: r.phone || null,
        is_blocked: Boolean(r.is_blocked),
        status: clientStatus,
        tariff: {
          id: r.tariff_id || 'free',
          name: r.tariff_name || getTariffName(r.tariff_id)
        },
        license: r.license_id ? {
          id: r.license_id,
          status: r.license_status,
          starts_at: r.license_starts_at,
          expires_at: r.license_expires_at,
          days_remaining: daysRemaining
        } : null,
        total_payments_amount: Number(r.total_payments_sum) || 0,
        payments_count: Number(r.payments_count) || 0,
        notes_count: Number(r.notes_count) || 0,
        created_at: r.created_at,
        last_active_at: r.last_active_at
      };
    });

    res.json({
      success: true,
      data: clients,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages
      }
    });
  } catch (err) {
    console.error('API /clients error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении клиентов' });
  }
});

/**
 * 2. Получение детальной информации по клиенту
 * GET /api/v1/clients/:id
 */
router.get('/clients/:id', requireApiToken, (req, res) => {
  try {
    const id = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ? OR telegram_id = ?').get(id, id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Клиент не найден' });
    }

    // Все лицензии клиента
    const licenses = db.prepare(`
      SELECT l.*, t.name as tariff_name
      FROM licenses l
      LEFT JOIN tariffs t ON t.id = l.tariff_id
      WHERE l.user_id = ?
      ORDER BY l.id DESC
    `).all(user.id);

    // Все платежи клиента
    const payments = db.prepare(`
      SELECT p.*, t.name as tariff_name, a.full_name as admin_name
      FROM payments p
      LEFT JOIN tariffs t ON t.id = p.tariff_id
      LEFT JOIN admin_users a ON a.id = p.admin_id
      WHERE p.user_id = ?
      ORDER BY p.id DESC
    `).all(user.id);

    // Заметки
    const notes = db.prepare(`
      SELECT id, author_name, note_text, created_at
      FROM user_notes
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(user.id);

    // Вопросы кинологу (тикеты)
    const tickets = db.prepare(`
      SELECT id, status, question_text, created_at, answered_at, assigned_trainer_name
      FROM trainer_tickets
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(user.id);

    const activeLicense = licenses.find(l => l.status === 'active') || null;
    const totalPaymentsAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || (user.username ? `@${user.username}` : `Клиент #${user.id}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: fullName,
        phone: user.phone,
        is_blocked: Boolean(user.is_blocked),
        access_expires_at: user.access_expires_at,
        created_at: user.created_at,
        last_active_at: user.last_active_at,
        active_license: activeLicense ? {
          id: activeLicense.id,
          tariff_id: activeLicense.tariff_id,
          tariff_name: activeLicense.tariff_name || getTariffName(activeLicense.tariff_id),
          status: activeLicense.status,
          starts_at: activeLicense.starts_at,
          expires_at: activeLicense.expires_at,
          source: activeLicense.source,
          notes: activeLicense.notes
        } : null,
        total_payments_amount: totalPaymentsAmount,
        licenses: licenses.map(l => ({
          id: l.id,
          tariff_id: l.tariff_id,
          tariff_name: l.tariff_name || getTariffName(l.tariff_id),
          status: l.status,
          starts_at: l.starts_at,
          expires_at: l.expires_at,
          source: l.source,
          created_at: l.created_at
        })),
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency || 'RUB',
          tariff_id: p.tariff_id,
          tariff_name: p.tariff_name || getTariffName(p.tariff_id),
          period_months: p.period_months,
          source: p.source,
          comment: p.comment,
          admin_name: p.admin_name,
          created_at: p.created_at
        })),
        notes,
        tickets
      }
    });
  } catch (err) {
    console.error('API /clients/:id error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении данных клиента' });
  }
});

/**
 * 3. Получение списка оплат
 * GET /api/v1/payments
 * Фильтры: page, limit, user_id, tariff_id, from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/payments', requireApiToken, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const userId = req.query.user_id;
    const tariffId = req.query.tariff_id;
    const dateFrom = req.query.from || req.query.date_from;
    const dateTo = req.query.to || req.query.date_to;

    let whereClauses = ['1=1'];
    const params = [];

    if (userId) {
      whereClauses.push('p.user_id = ?');
      params.push(userId);
    }

    if (tariffId) {
      whereClauses.push('p.tariff_id = ?');
      params.push(tariffId);
    }

    if (dateFrom) {
      whereClauses.push('p.created_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      whereClauses.push('p.created_at <= ?');
      params.push(`${dateTo} 23:59:59`);
    }

    const whereStr = whereClauses.join(' AND ');

    // Агрегация
    const statsQuery = `
      SELECT COUNT(*) as total_count, COALESCE(SUM(p.amount), 0) as total_amount
      FROM payments p
      WHERE ${whereStr}
    `;
    const stats = db.prepare(statsQuery).get(...params) || { total_count: 0, total_amount: 0 };
    const total = stats.total_count;
    const totalPages = Math.ceil(total / limit) || 1;

    // Выборка строк
    const paymentsQuery = `
      SELECT p.*, 
             u.id as user_id, u.first_name, u.last_name, u.phone, u.username, u.telegram_id,
             t.name as tariff_name,
             a.full_name as admin_name
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN tariffs t ON t.id = p.tariff_id
      LEFT JOIN admin_users a ON a.id = p.admin_id
      WHERE ${whereStr}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(paymentsQuery).all(...params, limit, offset);

    const data = rows.map(r => {
      const clientName = [r.first_name, r.last_name].filter(Boolean).join(' ') || (r.username ? `@${r.username}` : `Клиент #${r.user_id}`);
      return {
        id: r.id,
        user_id: r.user_id,
        client: {
          id: r.user_id,
          name: clientName,
          phone: r.phone || null,
          username: r.username || null,
          telegram_id: r.telegram_id || null
        },
        amount: Number(r.amount) || 0,
        currency: r.currency || 'RUB',
        tariff_id: r.tariff_id,
        tariff_name: r.tariff_name || getTariffName(r.tariff_id),
        period_months: r.period_months,
        source: r.source,
        external_tx_id: r.external_tx_id || null,
        comment: r.comment || null,
        admin_name: r.admin_name || null,
        created_at: r.created_at
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        total_amount: Number(stats.total_amount) || 0,
        total_count: total
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages
      }
    });
  } catch (err) {
    console.error('API /payments error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении оплат' });
  }
});

/**
 * 4. Получение списка тарифов
 * GET /api/v1/tariffs
 */
router.get('/tariffs', requireApiToken, (req, res) => {
  try {
    const tariffs = db.prepare('SELECT * FROM tariffs ORDER BY order_index ASC, price ASC').all();
    res.json({
      success: true,
      data: tariffs.map(t => ({
        id: t.id,
        name: t.name,
        price: t.price,
        period_months: t.period_months,
        duration_days: t.duration_days,
        description: t.description || null,
        is_active: Boolean(t.is_active),
        order_index: t.order_index
      }))
    });
  } catch (err) {
    console.error('API /tariffs error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении тарифов' });
  }
});

/**
 * 5. Сводная статистика (Stats)
 * GET /api/v1/stats
 */
router.get('/stats', requireApiToken, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
    const blockedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_blocked = 1').get()?.c || 0;
    
    const activeLicenses = db.prepare(`
      SELECT COUNT(*) as c FROM licenses 
      WHERE status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get()?.c || 0;

    const expiredLicenses = db.prepare(`
      SELECT COUNT(*) as c FROM licenses 
      WHERE status = 'expired' OR (status = 'active' AND expires_at <= datetime('now'))
    `).get()?.c || 0;

    const paymentsStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_sum 
      FROM payments
    `).get() || { count: 0, total_sum: 0 };

    const monthRevenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as month_sum 
      FROM payments 
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get()?.month_sum || 0;

    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as today_sum 
      FROM payments 
      WHERE date(created_at) = date('now')
    `).get()?.today_sum || 0;

    const openTickets = db.prepare(`
      SELECT COUNT(*) as c FROM trainer_tickets 
      WHERE status IN ('new', 'in_progress')
    `).get()?.c || 0;

    res.json({
      success: true,
      data: {
        clients: {
          total: totalUsers,
          active_licenses: activeLicenses,
          expired_licenses: expiredLicenses,
          blocked: blockedUsers
        },
        finance: {
          total_revenue: Number(paymentsStats.total_sum) || 0,
          payments_count: Number(paymentsStats.count) || 0,
          revenue_this_month: Number(monthRevenue) || 0,
          revenue_today: Number(todayRevenue) || 0,
          currency: 'RUB'
        },
        tickets: {
          open: openTickets
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('API /stats error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении статистики' });
  }
});

/**
 * 6. OpenAPI спецификация (JSON)
 * GET /api/v1/openapi.json
 */
router.get('/openapi.json', (req, res) => {
  const host = req.get('host') || 'admin.miniapp-vsdogs.ru';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}/api/v1`;

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'VS Dogs Admin & CRM API',
      description: 'Открытый REST API для интеграции приложений Дарьи Сахаровой и сотрудников с платформой «Высшая школа собак». Позволяет получать данные по ученикам, тарифам и журналу оплат.',
      version: '1.0.0',
      contact: {
        name: 'VS Dogs Support'
      }
    },
    servers: [
      { url: baseUrl, description: 'Текущий сервер API' },
      { url: 'https://admin.miniapp-vsdogs.ru/api/v1', description: 'Production API' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Передавайте API-токен в заголовке: `Authorization: Bearer <vsd_live_...>`'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Альтернативный способ: передача токена в заголовке `X-API-Key: <vsd_live_...>`'
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Проверка статуса сервиса',
          security: [],
          responses: {
            '200': { description: 'Сервис работает штатно' }
          }
        }
      },
      '/clients': {
        get: {
          summary: 'Получение списка клиентов с пагинацией и поиском',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Номер страницы' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 }, description: 'Записей на страницу (макс 100)' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Поиск по номеру телефона, имени или нику Telegram' },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'active', 'expired', 'blocked', 'free'] }, description: 'Фильтр по статусу подписки' },
            { name: 'tariff_id', in: 'query', schema: { type: 'string' }, description: 'Фильтр по ID тарифа' }
          ],
          responses: {
            '200': { description: 'Успешный ответ со списком клиентов' },
            '401': { description: 'Неавторизован: отсутствует или недействителен API-токен' }
          }
        }
      },
      '/clients/{id}': {
        get: {
          summary: 'Детальные данные клиента по ID или Telegram ID',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Внутренний ID клиента или telegram_id' }
          ],
          responses: {
            '200': { description: 'Полный профиль клиента с историей лицензий, оплат и заметок' },
            '404': { description: 'Клиент не найден' }
          }
        }
      },
      '/payments': {
        get: {
          summary: 'Журнал оплат с фильтрами по датам и клиентам',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'ID клиента' },
            { name: 'tariff_id', in: 'query', schema: { type: 'string' }, description: 'ID тарифа' },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Начальная дата (YYYY-MM-DD)' },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Конечная дата (YYYY-MM-DD)' }
          ],
          responses: {
            '200': { description: 'Список платежей с суммами и данными учеников' }
          }
        }
      },
      '/tariffs': {
        get: {
          summary: 'Список тарифов и их стоимости',
          responses: {
            '200': { description: 'Список активных тарифных планов' }
          }
        }
      },
      '/stats': {
        get: {
          summary: 'Сводная статистика по ученикам, выручке и обращениям',
          responses: {
            '200': { description: 'Общая статистика системы' }
          }
        }
      }
    }
  };

  res.json(spec);
});

export default router;
