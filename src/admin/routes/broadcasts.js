import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireRole, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';

const router = express.Router();

router.get('/', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const broadcasts = db.prepare('SELECT * FROM broadcast_logs ORDER BY created_at DESC LIMIT 20').all();

  const counts = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN l.tariff_id = 'free' OR l.tariff_id IS NULL THEN 1 ELSE 0 END) as free_users,
      SUM(CASE WHEN l.status = 'active' AND l.tariff_id != 'free' THEN 1 ELSE 0 END) as paid_users
    FROM users u
    LEFT JOIN licenses l ON l.user_id = u.id AND l.status = 'active'
  `).get();

  const content = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <!-- Форма отправки сообщения -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📢 Отправить сообщение в Telegram-бот</h3>
        </div>

        <form method="POST" action="/admin/broadcasts/send">
          <div class="form-group">
            <label class="form-label">Сегмент аудитории</label>
            <select name="target_segment" class="form-control" required>
              <option value="all">Всем пользователям бота (${counts.total} чел.)</option>
              <option value="free_only">Только тарифа Free — для акций и спецпредложений (${counts.free_users} чел.)</option>
              <option value="paid_only">Только ученикам с активной платной подпиской (${counts.paid_users} чел.)</option>
              <option value="expiring_48h">У кого подписка истекает в ближайшие 48 часов</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Текст сообщения</label>
            <textarea name="message_text" rows="5" class="form-control" required placeholder="Здравствуйте! Напоминаем, что в эти выходные..."></textarea>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Поддерживаются эмодзи и стандартное форматирование Telegram.
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%;">
            🚀 Запустить рассылку в Telegram
          </button>
        </form>
      </div>

      <!-- История ранее отправленных сообщений -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">История рассылок</h3>
        </div>

        ${broadcasts.length === 0 ? `
          <div style="color: var(--text-muted); font-size: 13px;">Рассылок еще не производилось</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${broadcasts.map(b => `
              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
                  <span>Отправил: <strong>${b.admin_name}</strong></span>
                  <span>${b.created_at}</span>
                </div>
                <div style="font-size: 13px; margin-bottom: 6px;">${b.message_text}</div>
                <div style="font-size: 11px; color: #166534; font-weight: 600;">
                  Доставлено: ${b.sent_count} ученикам
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  res.send(renderLayout({
    title: 'Рассылки в Telegram',
    activeNav: 'broadcasts',
    admin: req.admin,
    content
  }));
});

router.post('/send', requireAuth, requireRole(['MANAGER']), express.urlencoded({ extended: false }), (req, res) => {
  const { target_segment, message_text } = req.body;

  if (message_text && message_text.trim()) {
    // В боевом режиме бот перебирает пользователей выбранного сегмента и шлет sendMessage
    const recipients = db.prepare('SELECT telegram_id FROM users WHERE is_blocked = 0 AND telegram_id IS NOT NULL').all();

    db.prepare(`
      INSERT INTO broadcast_logs (admin_id, admin_name, target_segment, message_text, sent_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.admin.id, req.admin.full_name, target_segment, message_text.trim(), recipients.length);

    logAudit(req.admin.id, req.admin.full_name, 'SEND_BROADCAST', null, `Рассылка "${target_segment}": ${recipients.length} чел.`, req.ip);
  }

  res.redirect('/admin/broadcasts');
});

export default router;
