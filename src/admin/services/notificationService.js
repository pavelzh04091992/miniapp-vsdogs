import db from '../../db/database.js';
import { callTelegramApi } from './ticketBotService.js';
import { formatDateOnly } from './licenseService.js';

let reminderInterval = null;

/**
 * Получение списка шаблонов автосообщений
 */
export function getAutoMessages() {
  try {
    return db.prepare('SELECT * FROM auto_messages ORDER BY id ASC').all();
  } catch (err) {
    console.error('[notificationService] Ошибка чтения auto_messages:', err);
    return [];
  }
}

/**
 * Обновление текста шаблона автосообщения
 */
export function updateAutoMessage(id, messageTemplate) {
  try {
    db.prepare(`
      UPDATE auto_messages 
      SET message_template = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(messageTemplate.trim(), id);
    return true;
  } catch (err) {
    console.error('[notificationService] Ошибка обновления auto_messages:', err);
    return false;
  }
}

/**
 * Рендеринг шаблона с автоподстановками
 */
export function renderTemplate(template, vars = {}) {
  let result = template || '';
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, val ?? '');
  }
  return result;
}

/**
 * Проверка и отправка автоматических напоминаний о сроке действия лицензии в Telegram
 */
export async function checkAndSendLicenseReminders() {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return;
  }

  try {
    const templates = getAutoMessages();
    const warningTpl = templates.find(t => t.id === 'sub_warning_3d')?.message_template ||
      '⏳ Напоминаем, что ваша подписка завершается {expiry_date}.';
    const expiredTpl = templates.find(t => t.id === 'sub_expired')?.message_template ||
      '⏳ Срок действия вашей подписки завершился {expiry_date}.';

    // 1. Напоминания за 3 дня до окончания (expires_at между сегодня и +3 днями)
    const warningCandidates = db.prepare(`
      SELECT l.id as license_id, l.expires_at, u.id as user_id, u.telegram_id, u.first_name, u.last_name
      FROM licenses l
      JOIN users u ON u.id = l.user_id
      WHERE l.status = 'active'
        AND l.tariff_id != 'free'
        AND l.expires_at IS NOT NULL
        AND l.expires_at <= date('now', '+3 days')
        AND l.expires_at > date('now')
        AND u.telegram_id IS NOT NULL
        AND u.is_blocked = 0
    `).all();

    for (const item of warningCandidates) {
      const expDateKey = String(item.expires_at).slice(0, 10);
      const alreadySent = db.prepare(`
        SELECT 1 FROM subscription_notifications
        WHERE telegram_id = ? AND access_expires_at = ? AND kind = 'warning'
      `).get(String(item.telegram_id), expDateKey);

      if (alreadySent) continue;

      const formattedDate = formatDateOnly(item.expires_at);
      const name = item.first_name || 'ученик';
      const text = renderTemplate(warningTpl, {
        name,
        first_name: name,
        expiry_date: formattedDate,
        date: formattedDate
      });

      try {
        await callTelegramApi(botToken, 'sendMessage', {
          chat_id: item.telegram_id,
          text,
          parse_mode: 'HTML'
        });

        db.prepare(`
          INSERT OR REPLACE INTO subscription_notifications (telegram_id, access_expires_at, kind, delivered_at)
          VALUES (?, ?, 'warning', datetime('now'))
        `).run(String(item.telegram_id), expDateKey);

        console.log(`[notificationService] Отправлено 3-дневное предупреждение пользователю TG:${item.telegram_id}`);
      } catch (err) {
        console.warn(`[notificationService] Ошибка отправки предупреждения TG:${item.telegram_id}:`, err.message);
      }
    }

    // 2. Уведомления в момент окончания подписки (expires_at <= date('now'))
    const expiredCandidates = db.prepare(`
      SELECT l.id as license_id, l.expires_at, u.id as user_id, u.telegram_id, u.first_name, u.last_name
      FROM licenses l
      JOIN users u ON u.id = l.user_id
      WHERE l.status = 'active'
        AND l.tariff_id != 'free'
        AND l.expires_at IS NOT NULL
        AND l.expires_at <= date('now')
        AND u.telegram_id IS NOT NULL
        AND u.is_blocked = 0
    `).all();

    for (const item of expiredCandidates) {
      const expDateKey = String(item.expires_at).slice(0, 10);
      const alreadySent = db.prepare(`
        SELECT 1 FROM subscription_notifications
        WHERE telegram_id = ? AND access_expires_at = ? AND kind = 'expired'
      `).get(String(item.telegram_id), expDateKey);

      if (alreadySent) continue;

      const formattedDate = formatDateOnly(item.expires_at);
      const name = item.first_name || 'ученик';
      const text = renderTemplate(expiredTpl, {
        name,
        first_name: name,
        expiry_date: formattedDate,
        date: formattedDate
      });

      try {
        await callTelegramApi(botToken, 'sendMessage', {
          chat_id: item.telegram_id,
          text,
          parse_mode: 'HTML'
        });

        db.prepare(`
          INSERT OR REPLACE INTO subscription_notifications (telegram_id, access_expires_at, kind, delivered_at)
          VALUES (?, ?, 'expired', datetime('now'))
        `).run(String(item.telegram_id), expDateKey);

        console.log(`[notificationService] Отправлено уведомление об истечении подписки пользователю TG:${item.telegram_id}`);
      } catch (err) {
        console.warn(`[notificationService] Ошибка отправки уведомления об истечении TG:${item.telegram_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[notificationService] Ошибка в checkAndSendLicenseReminders:', err);
  }
}

/**
 * Запуск фонового планировщика проверки лицензий
 */
export function startLicenseReminderJob(intervalMs = 5 * 60 * 1000) {
  if (reminderInterval) return;

  // Первый запуск через 5 секунд после старта сервера
  setTimeout(() => {
    checkAndSendLicenseReminders().catch(() => {});
  }, 5000);

  // Регулярная проверка
  reminderInterval = setInterval(() => {
    checkAndSendLicenseReminders().catch(() => {});
  }, intervalMs);
}
