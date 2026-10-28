import crypto from 'node:crypto';
import db from '../db/database.js';

const SESSION_COOKIE_NAME = 'vsdogs_admin_session';
const SECRET_KEY = process.env.ADMIN_SESSION_SECRET || 'vsdogs-super-secret-admin-key-2026';

/**
 * Хэширование пароля через pbkdf2 с уникальной солью
 */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Проверка введенного пароля
 */
export function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Создание подписанного сессионного токена
 */
export function createSessionToken(adminId) {
  const payload = JSON.stringify({
    adminId,
    timestamp: Date.now()
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Валидация сессионного токена
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    // Срок действия сессии: 7 дней
    if (Date.now() - payload.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware проверки авторизации админа
 */
export function authMiddleware(req, res, next) {
  const token = req.cookies[SESSION_COOKIE_NAME];
  const session = verifySessionToken(token);

  if (!session) {
    req.admin = null;
    res.locals.admin = null;
    return next();
  }

  try {
    const stmt = db.prepare(`
      SELECT id, login, email, full_name, is_owner, roles, is_active 
      FROM admin_users 
      WHERE id = ? AND is_active = 1
    `);
    const admin = stmt.get(session.adminId);

    if (!admin) {
      req.admin = null;
      res.locals.admin = null;
      return next();
    }

    let parsedRoles = [];
    try {
      parsedRoles = JSON.parse(admin.roles || '[]');
    } catch {
      parsedRoles = [];
    }

    req.admin = {
      ...admin,
      is_owner: Boolean(admin.is_owner),
      roles: parsedRoles
    };
    res.locals.admin = req.admin;
    next();
  } catch (err) {
    console.error('Ошибка проверки сессии:', err);
    req.admin = null;
    res.locals.admin = null;
    next();
  }
}

/**
 * Защита маршрутов: требует авторизации
 */
export function requireAuth(req, res, next) {
  if (!req.admin) {
    return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

/**
 * Защита маршрутов: требует роль (Владелец всегда имеет доступ)
 * @param {string|string[]} roles - одна роль или массив ролей
 */
export function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.admin) {
      return res.redirect('/admin/login');
    }

    // Владелец (Дарья) имеет абсолютный доступ ко всем разделам
    if (req.admin.is_owner) {
      return next();
    }

    // Проверяем, есть ли у пользователя хотя бы одна из требуемых ролей
    const hasRole = allowedRoles.some(r => req.admin.roles.includes(r));
    if (!hasRole) {
      return res.status(403).send(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #dc2626;">Доступ ограничен</h2>
          <p>У вашей учетной записи нет прав для просмотра этого раздела.</p>
          <a href="/admin" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #0f172a; color: white; border-radius: 8px; text-decoration: none;">Вернуться на главную</a>
        </div>
      `);
    }

    next();
  };
}

/**
 * Защита маршрутов: строго только Владелец (Дарья)
 */
export function requireOwner(req, res, next) {
  if (!req.admin || !req.admin.is_owner) {
    return res.status(403).send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #dc2626;">Доступ запрещен</h2>
        <p>Этот раздел доступен исключительно Владельцу сервиса (Дарье Сахаровой).</p>
        <a href="/admin" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #0f172a; color: white; border-radius: 8px; text-decoration: none;">Вернуться на главную</a>
      </div>
    `);
  }
  next();
}

/**
 * Логирование действий администратора
 */
export function logAudit(adminId, adminName, action, targetUserId = null, details = null, ip = '') {
  try {
    const stmt = db.prepare(`
      INSERT INTO admin_audit_logs (admin_id, admin_name, action, target_user_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(adminId, adminName, action, targetUserId, details, ip);
  } catch (err) {
    console.error('Ошибка записи аудита:', err);
  }
}

export { SESSION_COOKIE_NAME };
