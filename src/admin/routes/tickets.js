import express from 'express';
import https from 'node:https';
import db from '../../db/database.js';
import { requireAuth, requireRole, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { getTariffName } from '../services/licenseService.js';

export function getTicketMediaList(ticketOrMediaUrl) {
  const raw = typeof ticketOrMediaUrl === 'object' && ticketOrMediaUrl !== null
    ? ticketOrMediaUrl.media_url
    : ticketOrMediaUrl;
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
  }
  return [trimmed];
}

export function formatMoscowDateTime(dateStr) {
  if (!dateStr) return '—';
  let date;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    date = new Date(dateStr.replace(' ', 'T') + 'Z');
  } else {
    date = new Date(dateStr);
  }
  if (Number.isNaN(date.getTime())) return String(dateStr);

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date) + ' МСК';
}

const router = express.Router();

router.get('/', requireAuth, requireRole(['TRAINER']), (req, res) => {
  const adminId = req.admin.id;
  const tab = req.query.tab || 'my';

  const myCount = db.prepare(`
    SELECT COUNT(*) as c FROM trainer_tickets 
    WHERE assigned_trainer_id = ? AND status = 'in_progress'
  `).get(adminId)?.c || 0;

  const newCount = db.prepare(`
    SELECT COUNT(*) as c FROM trainer_tickets 
    WHERE (assigned_trainer_id IS NULL OR status = 'new') AND status != 'answered' AND status != 'closed'
  `).get()?.c || 0;

  const othersCount = db.prepare(`
    SELECT COUNT(*) as c FROM trainer_tickets 
    WHERE assigned_trainer_id IS NOT NULL AND assigned_trainer_id != ? AND status = 'in_progress'
  `).get(adminId)?.c || 0;

  const answeredCount = db.prepare(`
    SELECT COUNT(*) as c FROM trainer_tickets 
    WHERE status = 'answered'
  `).get()?.c || 0;

  let query = `
    SELECT t.*, u.first_name, u.last_name, u.phone, u.username, u.telegram_id,
           l.tariff_id,
           tr.name as tariff_name,
           a.full_name as assigned_trainer_name
    FROM trainer_tickets t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN admin_users a ON a.id = t.assigned_trainer_id
    LEFT JOIN licenses l ON l.user_id = u.id AND l.id = (
      SELECT id FROM licenses WHERE user_id = u.id AND status = 'active' ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN tariffs tr ON tr.id = l.tariff_id
    WHERE 1=1
  `;
  const params = [];

  if (tab === 'my') {
    query += ` AND t.assigned_trainer_id = ? AND t.status = 'in_progress' ORDER BY t.created_at ASC`;
    params.push(adminId);
  } else if (tab === 'new') {
    query += ` AND (t.assigned_trainer_id IS NULL OR t.status = 'new') AND t.status != 'answered' AND t.status != 'closed' ORDER BY t.created_at ASC`;
  } else if (tab === 'others') {
    query += ` AND t.assigned_trainer_id IS NOT NULL AND t.assigned_trainer_id != ? AND t.status = 'in_progress' ORDER BY t.created_at ASC`;
    params.push(adminId);
  } else if (tab === 'answered') {
    query += ` AND t.status = 'answered' ORDER BY t.answered_at DESC LIMIT 50`;
  }

  const tickets = db.prepare(query).all(...params);

  const content = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Вопросы к кинологу</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Новые вопросы поступают из бота и Mini App. Возьмите вопрос в работу, чтобы ответить ученику.
          </p>
        </div>
      </div>

      <!-- Вкладки навигации -->
      <div style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; flex-wrap: wrap;">
        <a href="/admin/tickets?tab=my" class="btn ${tab === 'my' ? 'btn-primary' : 'btn-secondary'} btn-sm">
          Мои в работе (${myCount})
        </a>
        <a href="/admin/tickets?tab=new" class="btn ${tab === 'new' ? 'btn-primary' : 'btn-secondary'} btn-sm">
          Новые нераспределенные (${newCount})
        </a>
        <a href="/admin/tickets?tab=others" class="btn ${tab === 'others' ? 'btn-primary' : 'btn-secondary'} btn-sm">
          В работе у коллег (${othersCount})
        </a>
        <a href="/admin/tickets?tab=answered" class="btn ${tab === 'answered' ? 'btn-primary' : 'btn-secondary'} btn-sm">
          Отвеченные (${answeredCount})
        </a>
      </div>

      <!-- Список вопросов -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${tickets.length === 0 ? `
          <div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 14px;">
            ${tab === 'my' ? 'У вас нет вопросов в работе. Перейдите во вкладку «Новые нераспределенные», чтобы взять тикет.' : 'В этой категории вопросов нет.'}
          </div>
        ` : tickets.map(t => {
          const tariffDisplay = t.tariff_name || getTariffName(t.tariff_id);
          const mediaList = getTicketMediaList(t);
          return `
            <div id="ticket-${t.id}" style="border: 1px solid var(--border-color); border-radius: 10px; padding: 20px; background: ${tab === 'new' ? '#fffbeb' : '#ffffff'}; scroll-margin-top: 80px;">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <strong style="font-size: 15px;">${t.first_name || 'Ученик'} ${t.last_name || ''}</strong>
                  <span style="font-size: 13px; color: var(--text-muted); margin-left: 8px;">тел: ${t.phone || 'нет'}</span>
                  ${t.username ? `<span style="font-size: 13px; color: var(--primary); margin-left: 6px;">@${t.username}</span>` : ''}
                  <span class="badge badge-paid" style="margin-left: 8px; font-size: 11px;">Тариф: ${tariffDisplay}</span>
                  ${t.assigned_trainer_name ? `<span class="badge badge-free" style="margin-left: 6px;">В работе у: ${t.assigned_trainer_name}</span>` : ''}
                  <span class="badge" style="margin-left: 6px; font-size: 11px; background: #e0f2fe; color: #0369a1;">#${t.id}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
                  Поступил: ${formatMoscowDateTime(t.created_at)}
                </div>
              </div>

              <!-- Текст вопроса -->
              <div style="font-size: 14px; line-height: 1.5; margin-bottom: 14px; color: #1e293b; background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${escapeHtml(t.question_text)}</div>

              <!-- Медиа (видео или фото) -->
              ${mediaList.length > 0 ? `
                <div style="margin-bottom: 16px;">
                  <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">
                    Вложенные материалы собаки (${mediaList.length}):
                  </div>
                  <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start;">
                    ${mediaList.map((url, idx) => {
                      const isVideo = /\.(mp4|mov|webm)$/i.test(url);
                      if (isVideo) {
                        return `
                          <div style="max-width: 320px; width: 100%; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: #000;">
                            <video controls style="width: 100%; max-height: 240px; display: block;" src="${url}"></video>
                            <div style="padding: 6px 10px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                              <span style="color: var(--text-muted); font-weight: 600;">Видео #${idx + 1}</span>
                              <a href="${url}" target="_blank" download style="color: var(--primary); text-decoration: none;">⬇ Скачать</a>
                            </div>
                          </div>
                        `;
                      }
                      return `
                        <div style="max-width: 220px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: #fff;">
                          <a href="${url}" target="_blank" rel="noopener noreferrer" title="Нажмите для просмотра в полном размере">
                            <img style="width: 100%; max-height: 180px; object-fit: cover; display: block;" src="${url}" alt="Вложение #${idx + 1}" />
                          </a>
                          <div style="padding: 6px 10px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                            <span style="color: var(--text-muted); font-weight: 600;">Фото #${idx + 1}</span>
                            <a href="${url}" target="_blank" style="color: var(--primary); text-decoration: none;">🔍 Открыть</a>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Действия -->
              ${tab === 'new' ? `
                <form method="POST" action="/admin/tickets/${t.id}/take">
                  <button type="submit" class="btn btn-primary btn-sm">
                    Взять в работу
                  </button>
                </form>
              ` : ''}

              ${tab === 'my' ? `
                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color);">
                  <form method="POST" action="/admin/tickets/${t.id}/answer">
                    <div class="form-group">
                      <label class="form-label">Ваш ответ ученику (будет доставлен в его Telegram-бот):</label>
                      <textarea name="answer_text" rows="4" class="form-control" required placeholder="Напишите ответ с четкими рекомендациями..."></textarea>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                      <button type="submit" class="btn btn-primary btn-sm">
                        Отправить ответ в Telegram
                      </button>
                      <button type="submit" formaction="/admin/tickets/${t.id}/release" class="btn btn-secondary btn-sm">
                        Вернуть в общие (отказаться)
                      </button>
                    </div>
                  </form>
                </div>
              ` : ''}

              ${tab === 'answered' ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px;">
                  <div style="display: flex; justify-content: space-between; font-size: 12px; color: #166534; font-weight: 600; margin-bottom: 6px;">
                    <span>Ответил: ${t.answered_by_name || 'Кинолог'}</span>
                    <span>${formatMoscowDateTime(t.answered_at)}</span>
                  </div>
                  <div style="font-size: 13.5px; color: #14532d; line-height: 1.5;">${t.answer_text}</div>
                </div>
              ` : ''}

            </div>
          `;
        }).join('')}
      </div>

    </div>
  `;

  res.send(renderLayout({
    title: 'Вопросы к кинологу',
    activeNav: 'tickets',
    admin: req.admin,
    content
  }));
});

// Взять тикет в работу
router.post('/:id/take', requireAuth, requireRole(['TRAINER']), (req, res) => {
  const ticketId = req.params.id;
  db.prepare(`
    UPDATE trainer_tickets 
    SET status = 'in_progress', assigned_trainer_id = ? 
    WHERE id = ?
  `).run(req.admin.id, ticketId);

  logAudit(req.admin.id, req.admin.full_name, 'TAKE_TICKET', null, `Взят в работу вопрос #${ticketId}`, req.ip);

  res.redirect('/admin/tickets?tab=my');
});

// Вернуть в общие
router.post('/:id/release', requireAuth, requireRole(['TRAINER']), (req, res) => {
  const ticketId = req.params.id;
  db.prepare(`
    UPDATE trainer_tickets 
    SET status = 'new', assigned_trainer_id = NULL 
    WHERE id = ? AND (assigned_trainer_id = ? OR ?)
  `).run(ticketId, req.admin.id, req.admin.is_owner ? 1 : 0);

  res.redirect('/admin/tickets?tab=new');
});

// Отправка ответа
router.post('/:id/answer', requireAuth, requireRole(['TRAINER']), express.urlencoded({ extended: false }), async (req, res) => {
  const ticketId = req.params.id;
  const { answer_text } = req.body;

  if (answer_text && answer_text.trim()) {
    const ticket = db.prepare(`
      SELECT t.*, u.telegram_id, u.first_name 
      FROM trainer_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(ticketId);

    if (ticket) {
      db.prepare(`
        UPDATE trainer_tickets 
        SET status = 'answered', 
            answer_text = ?, 
            answered_by_name = ?, 
            assigned_trainer_id = ?, 
            answered_at = datetime('now')
        WHERE id = ?
      `).run(answer_text.trim(), req.admin.full_name, req.admin.id, ticketId);

      console.log(`[Telegram Bot Bridge] Отправлен ответ ученику TG_ID: ${ticket.telegram_id}`);
      logAudit(req.admin.id, req.admin.full_name, 'ANSWER_TICKET', ticket.user_id, `Ответ на вопрос #${ticketId}`, req.ip);

      // Доставляем ответ ученику в клиентский Telegram-бот
      if (ticket.telegram_id) {
        await sendTelegramTicketAnswer({
          telegramId: ticket.telegram_id,
          firstName: ticket.first_name,
          questionText: ticket.question_text,
          trainerName: req.admin.full_name,
          answerText: answer_text.trim(),
        });
      }

      // Обновляем статус сообщения в группе кинологов, если тикет был туда переслан
      if (ticket.tg_chat_id && ticket.tg_message_id) {
        await sendTelegramGroupUpdate({
          chatId: ticket.tg_chat_id,
          messageId: ticket.tg_message_id,
          trainerName: req.admin.full_name,
          ticketId,
        });
      }
    }
  }

  res.redirect('/admin/tickets?tab=answered');
});

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function sendTelegramTicketAnswer({ telegramId, firstName, questionText, trainerName, answerText }) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('[sendTelegramTicketAnswer] BOT_TOKEN is not configured');
    return false;
  }
  const egressHost = process.env.TELEGRAM_EGRESS_HOST || 'telegram-egress';

  const text = `🐾 <b>Ответ кинолога на ваш вопрос</b>\n\n` +
    `Здравствуйте, ${firstName || 'ученик'}!\n\n` +
    `❓ <b>Ваш вопрос:</b>\n<i>${escapeHtml(questionText)}</i>\n\n` +
    `💬 <b>Ответ кинолога (${escapeHtml(trainerName)}):</b>\n${escapeHtml(answerText)}\n\n` +
    `Желаем продуктивных тренировок! 🐶`;

  const payload = JSON.stringify({
    chat_id: telegramId,
    text,
    parse_mode: 'HTML',
  });

  return makeTelegramPostRequest(egressHost, botToken, '/sendMessage', payload);
}

async function sendTelegramGroupUpdate({ chatId, messageId, trainerName, ticketId }) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken || !chatId || !messageId) return;

  const egressHost = process.env.TELEGRAM_EGRESS_HOST || 'telegram-egress';

  // 1. Очищаем кнопки
  const editPayload = JSON.stringify({
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
  await makeTelegramPostRequest(egressHost, botToken, '/editMessageReplyMarkup', editPayload);

  // 2. Оставляем уведомление в чате кинологов
  const noticePayload = JSON.stringify({
    chat_id: chatId,
    text: `🎉 <b>Вопрос #${ticketId} закрыт через веб-панель!</b>\nОтветил: ${escapeHtml(trainerName)}`,
    parse_mode: 'HTML',
    reply_parameters: { message_id: messageId },
  });
  await makeTelegramPostRequest(egressHost, botToken, '/sendMessage', noticePayload);
}

function makeTelegramPostRequest(egressHost, botToken, path, payload) {
  return new Promise((resolve) => {
    const req = https.request({
      host: egressHost,
      port: 443,
      path: `/bot${botToken}${path}`,
      method: 'POST',
      servername: 'api.telegram.org',
      headers: {
        'Host': 'api.telegram.org',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, () => resolve());

    req.on('error', (err) => {
      console.error(`[tickets] Telegram ${path} error:`, err.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

export default router;
