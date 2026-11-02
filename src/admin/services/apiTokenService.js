import crypto from 'node:crypto';
import db from '../../db/database.js';

/**
 * Сервис управления API-токенами для внешних интеграций
 */

/**
 * Создание нового API-токена
 */
export function createApiToken({ name, adminId = null, permissions = 'all' }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Укажите название токена');
  }

  // Префикс vsd_live_ для безопасной идентификации
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const token = `vsd_live_${randomPart}`;

  const info = db.prepare(`
    INSERT INTO api_tokens (token, name, permissions, is_active, created_by_admin_id)
    VALUES (?, ?, ?, 1, ?)
  `).run(token, name.trim(), permissions || 'all', adminId);

  return {
    id: info.lastInsertRowid,
    token,
    name: name.trim(),
    permissions: permissions || 'all',
    is_active: 1
  };
}

/**
 * Валидация токена для входящих API-запросов
 * Возвращает запись токена или null
 */
export function verifyApiToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') return null;
  const cleanToken = tokenString.trim();

  try {
    const row = db.prepare(`
      SELECT * FROM api_tokens 
      WHERE token = ? AND is_active = 1
    `).get(cleanToken);

    if (row) {
      // Асинхронно обновляем время последнего использования
      try {
        db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
      } catch (e) {
        // не блокируем запрос из-за записи таймстампа
      }
      return row;
    }
  } catch (err) {
    console.error('Ошибка проверки API-токена:', err);
  }

  return null;
}

/**
 * Получение всех токенов для админ-панели
 */
export function listApiTokens() {
  return db.prepare(`
    SELECT t.*, a.full_name as created_by_name
    FROM api_tokens t
    LEFT JOIN admin_users a ON a.id = t.created_by_admin_id
    ORDER BY t.created_at DESC
  `).all();
}

/**
 * Отзыв (деактивация) токена
 */
export function revokeApiToken(id) {
  db.prepare('UPDATE api_tokens SET is_active = 0 WHERE id = ?').run(id);
}

/**
 * Активация токена
 */
export function activateApiToken(id) {
  db.prepare('UPDATE api_tokens SET is_active = 1 WHERE id = ?').run(id);
}

/**
 * Безвозвратное удаление токена
 */
export function deleteApiToken(id) {
  db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id);
}
