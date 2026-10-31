import db from '../../db/database.js';

// Хранилище активных SSE подключений администраторов
const activeClients = new Set();

// Предыдущее состояние для детекции изменений
let lastState = {
  maxTicketId: 0,
  openTicketsCount: 0,
  maxUserId: 0,
  totalUsersCount: 0,
  maxPaymentId: 0,
  totalPaymentsCount: 0,
};

/**
 * Инициализация состояния при запуске
 */
export function initRealtimeState() {
  try {
    const t = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM trainer_tickets WHERE status IN ('new', 'in_progress')`).get() || { maxId: 0, c: 0 };
    const u = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM users`).get() || { maxId: 0, c: 0 };
    const p = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM payments`).get() || { maxId: 0, c: 0 };

    lastState = {
      maxTicketId: t.maxId,
      openTicketsCount: t.c,
      maxUserId: u.maxId,
      totalUsersCount: u.c,
      maxPaymentId: p.maxId,
      totalPaymentsCount: p.c,
    };
  } catch (err) {
    console.error('[realtimeService] Ошибка инициализации состояния:', err);
  }
}

/**
 * Отправка события всем подключенным администраторам
 */
export function broadcastAdminEvent(eventType, payload = {}) {
  const dataString = `data: ${JSON.stringify({ type: eventType, payload, timestamp: Date.now() })}\n\n`;
  for (const client of activeClients) {
    try {
      client.res.write(dataString);
    } catch {
      activeClients.delete(client);
    }
  }
}

/**
 * Получение текущих счетчиков для бейджей
 */
export function getBadgeData(adminId) {
  let myCount = 0;
  let newCount = 0;
  try {
    if (adminId) {
      myCount = db.prepare(`
        SELECT COUNT(*) as c FROM trainer_tickets 
        WHERE assigned_trainer_id = ? AND status = 'in_progress'
      `).get(adminId)?.c || 0;
    }
    newCount = db.prepare(`
      SELECT COUNT(*) as c FROM trainer_tickets 
      WHERE (assigned_trainer_id IS NULL OR status = 'new') AND status != 'answered' AND status != 'closed'
    `).get()?.c || 0;
  } catch {}

  return {
    ticketBadgeText: `${myCount}/${newCount}`,
    myCount,
    newCount
  };
}

/**
 * Обработчик SSE-подключения админа
 */
export function handleAdminSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const client = {
    id: Math.random().toString(36).substring(2, 9),
    admin: req.admin,
    res,
  };

  activeClients.add(client);

  // Первоначальное событие с текущими бейджами
  const initialBadges = getBadgeData(req.admin?.id);
  res.write(`data: ${JSON.stringify({ type: 'connected', payload: initialBadges })}\n\n`);

  // Keep-alive пинг каждые 20 секунд
  const pingInterval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(pingInterval);
      activeClients.delete(client);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    activeClients.delete(client);
  });
}

/**
 * Фоновая проверка изменений в БД (каждые 2.5 секунды)
 */
let watcherInterval = null;
export function startRealtimeWatcher(intervalMs = 2500) {
  if (watcherInterval) return;

  initRealtimeState();

  watcherInterval = setInterval(() => {
    if (activeClients.size === 0) return;

    try {
      const t = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM trainer_tickets WHERE status IN ('new', 'in_progress')`).get() || { maxId: 0, c: 0 };
      const u = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM users`).get() || { maxId: 0, c: 0 };
      const p = db.prepare(`SELECT COALESCE(MAX(id), 0) as maxId, COUNT(*) as c FROM payments`).get() || { maxId: 0, c: 0 };

      const ticketsChanged = t.maxId !== lastState.maxTicketId || t.c !== lastState.openTicketsCount;
      const usersChanged = u.maxId !== lastState.maxUserId || u.c !== lastState.totalUsersCount;
      const paymentsChanged = p.maxId !== lastState.maxPaymentId || p.c !== lastState.totalPaymentsCount;

      if (ticketsChanged || usersChanged || paymentsChanged) {
        lastState = {
          maxTicketId: t.maxId,
          openTicketsCount: t.c,
          maxUserId: u.maxId,
          totalUsersCount: u.c,
          maxPaymentId: p.maxId,
          totalPaymentsCount: p.c,
        };

        // Отправляем индивидуализированное событие каждому клиенту (с учетом его тикет-бейджа)
        for (const client of activeClients) {
          const badges = getBadgeData(client.admin?.id);
          const eventPayload = {
            ticketsChanged,
            usersChanged,
            paymentsChanged,
            badges,
            totalUsers: u.c,
            totalPayments: p.c,
          };
          try {
            client.res.write(`data: ${JSON.stringify({ type: 'update', payload: eventPayload })}\n\n`);
          } catch {
            activeClients.delete(client);
          }
        }
      }
    } catch (err) {
      console.error('[realtimeService] Ошибка watcher:', err);
    }
  }, intervalMs);
}
