import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireOwner, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { callTelegramApi } from '../services/ticketBotService.js';
import { getAutoMessages, updateAutoMessage } from '../services/notificationService.js';

const router = express.Router();

router.get('/', requireAuth, requireOwner, (req, res) => {
  const broadcasts = db.prepare('SELECT * FROM broadcast_logs ORDER BY created_at DESC LIMIT 30').all();

  const counts = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN l.tariff_id = 'free' OR l.tariff_id IS NULL THEN 1 ELSE 0 END) as free_users,
      SUM(CASE WHEN l.status = 'active' AND l.tariff_id != 'free' THEN 1 ELSE 0 END) as paid_users
    FROM users u
    LEFT JOIN licenses l ON l.user_id = u.id AND l.status = 'active'
    WHERE u.is_blocked = 0 AND u.telegram_id IS NOT NULL
  `).get() || { total: 0, free_users: 0, paid_users: 0 };

  const autoMessages = getAutoMessages();
  const editAutoId = req.query.edit_auto;
  const editingAuto = editAutoId ? autoMessages.find(m => m.id === editAutoId) : null;

  const alertParam = req.query.alert;
  let alert = null;
  if (alertParam === 'sent') {
    alert = { type: 'success', message: '🚀 Рассылка успешно отправлена пользователям бота!' };
  } else if (alertParam === 'deleted') {
    alert = { type: 'success', message: '🗑️ Запись о рассылке удалена.' };
  } else if (alertParam === 'auto_saved') {
    alert = { type: 'success', message: '💾 Текст автосообщения успешно сохранен!' };
  }

  const content = `
    <!-- Автоматические напоминания о лицензиях -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">🤖 Автоматические напоминания о сроке лицензии</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Отправляются ботом в Telegram автоматически: за 3 дня до окончания подписки и в момент её завершения
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
        ${autoMessages.map(am => `
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <h4 style="font-size: 14.5px; font-weight: 700; color: #0f172a;">${am.title}</h4>
                <a href="/admin/broadcasts?edit_auto=${am.id}" class="btn btn-secondary btn-sm" style="flex-shrink: 0;">Редактировать</a>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">${am.description || ''}</p>
              
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; font-family: inherit; color: #1e293b;">${am.message_template}</div>
            </div>

            <div style="margin-top: 12px; font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
              <span>Доступные подстановки: <code>{name}</code>, <code>{expiry_date}</code></span>
              <span>Обновлено: ${am.updated_at || 'по умолчанию'}</span>
            </div>
          </div>
        `).join('')}
      </div>

      ${editingAuto ? `
        <!-- Модальное окно редактирования автосообщения -->
        <div id="editAutoModal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px;">
          <div style="background: white; border-radius: 14px; max-width: 600px; width: 100%; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 16px; font-weight: 700;">Редактирование: ${editingAuto.title}</h3>
              <a href="/admin/broadcasts" style="text-decoration: none; font-size: 20px; color: var(--text-muted);">✕</a>
            </div>

            <form method="POST" action="/admin/broadcasts/auto-messages/${editingAuto.id}">
              <div class="form-group">
                <label class="form-label">Текст сообщения в Telegram</label>
                <textarea name="message_template" rows="7" class="form-control" required style="font-family: inherit;">${editingAuto.message_template}</textarea>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
                  💡 Используйте автоподстановки:<br>
                  • <code>{name}</code> — имя ученика (или «ученик»)<br>
                  • <code>{expiry_date}</code> — дата окончания подписки (например, 15.11.2026)<br>
                  Поддерживается HTML-форматирование: <code>&lt;b&gt;жирный&lt;/b&gt;</code>, <code>&lt;i&gt;курсив&lt;/i&gt;</code>.
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <a href="/admin/broadcasts" class="btn btn-secondary">Отмена</a>
                <button type="submit" class="btn btn-primary">Сохранить автосообщение</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Основной блок ручных рассылок -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;" class="grid-two-cols">
      
      <!-- Форма отправки сообщения -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📢 Отправить ручную рассылку в Telegram</h3>
        </div>

        <form method="POST" action="/admin/broadcasts/send">
          <div class="form-group">
            <label class="form-label">Сегмент получателей</label>
            <select name="target_segment" class="form-control" required>
              <option value="all">Всем пользователям бота (${counts.total || 0} чел.)</option>
              <option value="free_only">Только тарифа Free — для акций и предложений (${counts.free_users || 0} чел.)</option>
              <option value="paid_only">Только ученикам с активной платной подпиской (${counts.paid_users || 0} чел.)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Текст рассылки</label>
            <textarea name="message_text" rows="6" class="form-control" required placeholder="Здравствуйте! Напоминаем, что в эти выходные..."></textarea>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              Поддерживаются эмодзи и HTML-теги Telegram: <code>&lt;b&gt;текст&lt;/b&gt;</code>, <code>&lt;i&gt;текст&lt;/i&gt;</code>.
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px;">
            🚀 Запустить рассылку в Telegram
          </button>
        </form>
      </div>

      <!-- История ранее отправленных сообщений -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">История проведенных рассылок</h3>
        </div>

        ${broadcasts.length === 0 ? `
          <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px;">Рассылок еще не производилось</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px; max-height: 520px; overflow-y: auto;">
            ${broadcasts.map(b => `
              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                  <span>Отправил: <strong>${b.admin_name}</strong> (${b.target_segment})</span>
                  <span>${b.created_at}</span>
                </div>
                <div style="font-size: 13px; margin-bottom: 10px; line-height: 1.4; white-space: pre-wrap;">${b.message_text}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                  <div style="font-size: 12px; font-weight: 600;">
                    <span style="color: #166534;">✓ Доставлено: ${b.sent_count || 0}</span>
                    ${b.failed_count > 0 ? `<span style="color: #dc2626; margin-left: 8px;">✕ Ошибок: ${b.failed_count}</span>` : ''}
                  </div>
                  <form method="POST" action="/admin/broadcasts/delete/${b.id}" onsubmit="return confirm('Удалить запись об этой рассылке?');" style="margin: 0;">
                    <button type="submit" class="btn btn-danger btn-sm" title="Удалить информацию о проведенной рассылке">Удалить</button>
                  </form>
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
    alert,
    content
  }));
});

// Запуск рассылки
router.post('/send', requireAuth, requireOwner, express.urlencoded({ extended: false }), async (req, res) => {
  const { target_segment, message_text } = req.body;
  const botToken = process.env.BOT_TOKEN;

  if (!message_text || !message_text.trim()) {
    return res.redirect('/admin/broadcasts');
  }

  const cleanText = message_text.trim();

  // Выборка получателей в зависимости от сегмента
  let recipients = [];
  try {
    if (target_segment === 'free_only') {
      recipients = db.prepare(`
        SELECT u.id, u.telegram_id, u.first_name, u.last_name
        FROM users u
        LEFT JOIN licenses l ON l.user_id = u.id AND l.status = 'active' AND l.tariff_id != 'free'
        WHERE u.is_blocked = 0 AND u.telegram_id IS NOT NULL AND l.id IS NULL
      `).all();
    } else if (target_segment === 'paid_only') {
      recipients = db.prepare(`
        SELECT DISTINCT u.id, u.telegram_id, u.first_name, u.last_name
        FROM users u
        JOIN licenses l ON l.user_id = u.id AND l.status = 'active' AND l.tariff_id != 'free'
        WHERE u.is_blocked = 0 AND u.telegram_id IS NOT NULL
      `).all();
    } else {
      // 'all'
      recipients = db.prepare(`
        SELECT id, telegram_id, first_name, last_name
        FROM users
        WHERE is_blocked = 0 AND telegram_id IS NOT NULL
      `).all();
    }
  } catch (err) {
    console.error('Ошибка выборки получателей рассылки:', err);
    return res.redirect('/admin/broadcasts');
  }

  let sentCount = 0;
  let failedCount = 0;

  if (botToken && recipients.length > 0) {
    for (const r of recipients) {
      try {
        await callTelegramApi(botToken, 'sendMessage', {
          chat_id: r.telegram_id,
          text: cleanText,
          parse_mode: 'HTML'
        });
        sentCount++;
      } catch (err) {
        // Попытка отправить без разметки HTML, если возникла ошибка парсинга
        try {
          await callTelegramApi(botToken, 'sendMessage', {
            chat_id: r.telegram_id,
            text: cleanText
          });
          sentCount++;
        } catch {
          failedCount++;
        }
      }
      // Небольшая задержка между отправками для соблюдения лимитов Telegram (30 сообщений/сек)
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  } else if (!botToken) {
    console.warn('[broadcasts] BOT_TOKEN не задан, рассылка не отправлена в Telegram');
  }

  db.prepare(`
    INSERT INTO broadcast_logs (admin_id, admin_name, target_segment, message_text, sent_count, failed_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.admin.id, req.admin.full_name, target_segment, cleanText, sentCount, failedCount);

  logAudit(req.admin.id, req.admin.full_name, 'SEND_BROADCAST', null, `Рассылка "${target_segment}": успешно ${sentCount}, ошибок ${failedCount}`);

  res.redirect('/admin/broadcasts?alert=sent');
});

// Удаление записи о проведенной рассылке (только Владелец)
router.post('/delete/:id', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;

  try {
    db.prepare('DELETE FROM broadcast_logs WHERE id = ?').run(id);
    logAudit(req.admin.id, req.admin.full_name, 'DELETE_BROADCAST_LOG', null, `Удалена запись о рассылке #${id}`);
  } catch (err) {
    console.error('Ошибка удаления записи о рассылке:', err);
  }

  res.redirect('/admin/broadcasts?alert=deleted');
});

// Сохранение текста шаблона автосообщения (только Владелец)
router.post('/auto-messages/:id', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const id = req.params.id;
  const { message_template } = req.body;

  if (message_template && message_template.trim()) {
    updateAutoMessage(id, message_template);
    logAudit(req.admin.id, req.admin.full_name, 'UPDATE_AUTO_MESSAGE', null, `Обновлен шаблон автосообщения ${id}`);
  }

  res.redirect('/admin/broadcasts?alert=auto_saved');
});

export default router;