import db from '../../db/database.js';
import { logAudit } from '../auth.js';

/**
 * Получение человекочитаемого названия тарифа
 */
export function getTariffName(tariffId) {
  if (!tariffId) return 'Базовый (Free)';
  
  try {
    const tariff = db.prepare('SELECT name FROM tariffs WHERE id = ?').get(tariffId);
    if (tariff) return tariff.name;
  } catch (err) {
    console.error('Ошибка получения тарифа:', err);
  }

  const fallback = {
    'free': 'Базовый (Free)',
    'paid_1m': '1 месяц',
    'paid_3m': '3 месяца',
    'paid_6m': '6 месяцев',
    'lifetime': 'VIP Бессрочный'
  };

  return fallback[tariffId] || tariffId.toUpperCase();
}

/**
 * Форматирование даты в формат ДД.ММ.ГГГГ (без времени)
 */
export function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  
  // Если передан Unix-timestamp в секундах (9-11 цифр)
  if (typeof dateStr === 'number' || /^\d{9,11}$/.test(String(dateStr).trim())) {
    const d = new Date(Number(dateStr) * 1000);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    }
  }

  // Если дата уже в формате YYYY-MM-DD
  const cleanStr = String(dateStr).trim().split(' ')[0].split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day}.${month}.${year}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return cleanStr || '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Расчет оставшегося времени действия лицензии СТРОГО В СУТКАХ (днях)
 */
export function getRemainingTimeText(license) {
  if (!license || license.tariff_id === 'free') {
    return 'Бесплатный базовый доступ';
  }

  if (license.tariff_id === 'lifetime' || !license.expires_at) {
    return 'Бессрочно';
  }

  // Парсим дату окончания (приводим к полуночи дня окончания)
  const cleanDateStr = String(license.expires_at).trim().split(' ')[0].split('T')[0];
  const expParts = cleanDateStr.split('-');
  
  if (expParts.length !== 3) {
    return '—';
  }

  const expYear = parseInt(expParts[0], 10);
  const expMonth = parseInt(expParts[1], 10) - 1;
  const expDay = parseInt(expParts[2], 10);

  const expDate = new Date(expYear, expMonth, expDay);
  if (isNaN(expDate.getTime())) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Разница в миллисекундах и перевод в полные сутки
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const pastDays = Math.abs(diffDays);
    return pastDays === 0 ? 'Истекает сегодня' : `Истекла ${pastDays} дн. назад`;
  } else if (diffDays === 0) {
    return 'Истекает сегодня';
  } else {
    return `Осталось ${diffDays} дн.`;
  }
}

/**
 * Безопасная выдача или продление лицензии в сутках
 */
export function grantOrExtendLicense({ userId, tariffId, amount = 0, notes = '', adminId, ip = '' }) {
  const admin = db.prepare('SELECT full_name FROM admin_users WHERE id = ?').get(adminId);
  const adminName = admin ? admin.full_name : 'Администратор';

  const tariff = db.prepare('SELECT * FROM tariffs WHERE id = ?').get(tariffId) || {
    id: tariffId,
    name: getTariffName(tariffId),
    period_months: tariffId === 'lifetime' ? 999 : (tariffId === 'free' ? 0 : 1),
    duration_days: tariffId === 'paid_3m' ? 90 : (tariffId === 'paid_6m' ? 180 : 30)
  };

  const currentLicense = db.prepare(`
    SELECT * FROM licenses 
    WHERE user_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).get(userId);

  // СЛУЧАЙ 1: Сброс на тариф Free
  if (tariffId === 'free' || tariff.period_months === 0) {
    if (currentLicense) {
      db.prepare(`UPDATE licenses SET status = 'canceled', updated_at = date('now') WHERE id = ?`).run(currentLicense.id);
    }

    const insertResult = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
      VALUES (?, 'free', 'active', date('now'), NULL, 'manual', ?, ?)
    `).run(userId, notes || 'Сброс доступа на базовый Free', adminId);

    const auditMessage = `Сброс доступа на тариф Free. Предыдущая лицензия #${currentLicense?.id || '—'} аннулирована`;
    logAudit(adminId, adminName, 'REVOKE_LICENSE', userId, auditMessage, ip);

    syncUserAccess(userId);
    return { licenseId: insertResult.lastInsertRowid, action: 'revoked' };
  }

  // СЛУЧАЙ 2: Апгрейд на VIP Бессрочный (Lifetime)
  if (tariffId === 'lifetime' || tariff.period_months === 999) {
    if (currentLicense) {
      db.prepare(`UPDATE licenses SET status = 'upgraded', updated_at = date('now') WHERE id = ?`).run(currentLicense.id);
    }

    const insertResult = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
      VALUES (?, 'lifetime', 'active', date('now'), NULL, 'manual', ?, ?)
    `).run(userId, notes || 'VIP Бессрочный доступ', adminId);

    const licenseId = insertResult.lastInsertRowid;

    if (Number(amount) > 0) {
      db.prepare(`
        INSERT INTO payments (user_id, license_id, amount, tariff_id, period_months, source, comment, admin_id)
        VALUES (?, ?, ?, 'lifetime', 999, 'manual', ?, ?)
      `).run(userId, licenseId, Number(amount), notes || 'Покупка VIP бессрочной лицензии', adminId);
    }

    logAudit(adminId, adminName, 'UPGRADE_LIFETIME', userId, `Активирован VIP бессрочный доступ (сумма: ${amount} руб)`, ip);

    syncUserAccess(userId);
    return { licenseId, action: 'upgraded' };
  }

  // СЛУЧАЙ 3: Платный срочный тариф в сутках
  const durationDays = tariff.duration_days || (tariff.period_months * 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentExpiresDate = null;
  if (currentLicense?.expires_at) {
    const parts = String(currentLicense.expires_at).trim().split(' ')[0].split('-');
    if (parts.length === 3) {
      currentExpiresDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  }

  const hasActiveUnexpired = currentLicense && 
                             currentLicense.tariff_id !== 'free' && 
                             currentLicense.tariff_id !== 'lifetime' && 
                             currentExpiresDate && 
                             currentExpiresDate >= today;

  if (hasActiveUnexpired) {
    // УМНОЕ ПРОДЛЕНИЕ: прибавляем сутки к текущей дате окончания (в формате YYYY-MM-DD)
    db.prepare(`UPDATE licenses SET status = 'extended', updated_at = date('now') WHERE id = ?`).run(currentLicense.id);

    const insertResult = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
      VALUES (?, ?, 'active', date('now'), date(?, '+${durationDays} days'), 'manual', ?, ?)
    `).run(userId, tariffId, currentLicense.expires_at, notes || `Продление к лицензии #${currentLicense.id}`, adminId);

    const licenseId = insertResult.lastInsertRowid;

    if (Number(amount) > 0) {
      db.prepare(`
        INSERT INTO payments (user_id, license_id, amount, tariff_id, period_months, source, comment, admin_id)
        VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)
      `).run(userId, licenseId, Number(amount), tariffId, tariff.period_months, notes || 'Продление лицензии', adminId);
    }

    logAudit(adminId, adminName, 'EXTEND_LICENSE', userId, `Продлена подписка ${tariff.name}: +${durationDays} дней к текущему сроку (${amount} руб)`, ip);

    syncUserAccess(userId);
    return { licenseId, action: 'extended' };

  } else {
    // НОВАЯ ПОДПИСКА (отсчет суток от сегодня)
    if (currentLicense) {
      db.prepare(`UPDATE licenses SET status = 'expired', updated_at = date('now') WHERE id = ?`).run(currentLicense.id);
    }

    const insertResult = db.prepare(`
      INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes, created_by_admin_id)
      VALUES (?, ?, 'active', date('now'), date('now', '+${durationDays} days'), 'manual', ?, ?)
    `).run(userId, tariffId, notes || 'Новая лицензия', adminId);

    const licenseId = insertResult.lastInsertRowid;

    if (Number(amount) > 0) {
      db.prepare(`
        INSERT INTO payments (user_id, license_id, amount, tariff_id, period_months, source, comment, admin_id)
        VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)
      `).run(userId, licenseId, Number(amount), tariffId, tariff.period_months, notes || 'Оплата тарифа', adminId);
    }

    logAudit(adminId, adminName, 'GRANT_LICENSE', userId, `Выписана лицензия ${tariff.name} на ${durationDays} дней (${amount} руб)`, ip);

    syncUserAccess(userId);
    return { licenseId, action: 'created' };
  }
}

/**
 * Синхронизация access_expires_at для MiniApp в таблице users
 */
function syncUserAccess(userId) {
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!columns.includes('access_expires_at')) return;

    const activeLic = db.prepare(`
      SELECT * FROM licenses 
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    let expiryTimestamp = 0;
    if (activeLic) {
      if (activeLic.tariff_id === 'lifetime') {
        expiryTimestamp = null;
      } else if (activeLic.tariff_id === 'free') {
        expiryTimestamp = 0;
      } else if (activeLic.expires_at) {
        expiryTimestamp = Math.floor(new Date(activeLic.expires_at).getTime() / 1000);
      }
    }

    db.prepare(`
      UPDATE users 
      SET access_expires_at = ?,
          status = CASE WHEN is_blocked = 1 THEN 'blocked' ELSE 'active' END
      WHERE id = ?
    `).run(expiryTimestamp, userId);
  } catch (err) {
    console.error('Ошибка синхронизации access_expires_at:', err);
  }
}
