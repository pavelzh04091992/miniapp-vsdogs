import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import db from '../../db/database.js';
import { requireAuth, requireOwner } from '../auth.js';
import { renderLayout } from '../views/layout.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'auth.sqlite');

// Человекочитаемые названия действий
export const ACTION_NAMES = {
  'LOGIN': 'Вход в панель',
  'GRANT_LICENSE': 'Выдача лицензии',
  'EXTEND_LICENSE': 'Продление лицензии',
  'UPGRADE_LIFETIME': 'Апгрейд до VIP',
  'REVOKE_LICENSE': 'Сброс лицензии',
  'DELETE_LICENSE': 'Удаление лицензии',
  'DELETE_USER': 'Удаление клиента',
  'BLOCK_USER': 'Блокировка клиента',
  'UNBLOCK_USER': 'Разблокировка клиента',
  'TAKE_TICKET': 'Взятие вопроса в работу',
  'ANSWER_TICKET': 'Ответ на вопрос',
  'CREATE_ADMIN_USER': 'Создание сотрудника',
  'UPDATE_ADMIN_USER': 'Изменение сотрудника',
  'DELETE_ADMIN_USER': 'Удаление сотрудника',
  'CREATE_TARIFF': 'Создание тарифа',
  'UPDATE_TARIFF': 'Изменение тарифа',
  'TOGGLE_TARIFF': 'Переключение тарифа',
  'SEND_BROADCAST': 'Рассылка в Telegram'
};

router.get('/', requireAuth, requireOwner, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const totalLogs = db.prepare('SELECT COUNT(*) as c FROM admin_audit_logs').get().c;
  const totalPages = Math.ceil(totalLogs / limit) || 1;

  const logs = db.prepare(`
    SELECT * FROM admin_audit_logs 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  // Формируем кнопки пагинации
  const paginationLinks = [];
  if (page > 1) {
    paginationLinks.push(`<a href="/admin/system?page=${page - 1}" class="page-btn">← Назад</a>`);
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      paginationLinks.push(`
        <a href="/admin/system?page=${i}" class="page-btn ${i === page ? 'active' : ''}">${i}</a>
      `);
    } else if (i === page - 3 || i === page + 3) {
      paginationLinks.push(`<span style="padding: 6px 8px; color: var(--text-muted);">...</span>`);
    }
  }
  if (page < totalPages) {
    paginationLinks.push(`<a href="/admin/system?page=${page + 1}" class="page-btn">Вперед →</a>`);
  }

  const content = `
    <!-- Панель копии базы -->
    <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <h3 class="card-title" style="margin-bottom: 4px;">Копия базы данных</h3>
        <p style="font-size: 13px; color: var(--text-muted);">
          Актуальный файл базы данных SQLite (клиенты, лицензии, тикеты, оплаты).
        </p>
      </div>
      <div>
        <a href="/admin/system/backup" class="btn btn-primary" download>
          Скачать копию базы (.sqlite)
        </a>
      </div>
    </div>

    <!-- Журнал действий сотрудников (Аудит) -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Журнал действий сотрудников</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Полная история всех действий в панели управления (всего событий: ${totalLogs})
          </p>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Сотрудник</th>
              <th>Действие</th>
              <th>Клиент</th>
              <th>Подробности</th>
              <th>IP адрес</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Записей в журнале пока нет</td></tr>
            ` : logs.map(l => {
              const actionLabel = ACTION_NAMES[l.action] || l.action;
              let badgeClass = 'badge-free';
              if (l.action === 'DELETE_LICENSE' || l.action === 'DELETE_USER' || l.action === 'BLOCK_USER' || l.action === 'REVOKE_LICENSE') {
                badgeClass = 'badge-expired';
              } else if (l.action.startsWith('GRANT_') || l.action.startsWith('EXTEND_') || l.action.startsWith('UPGRADE_')) {
                badgeClass = 'badge-paid';
              }

              return `
                <tr>
                  <td style="font-size: 12.5px; color: var(--text-muted); white-space: nowrap;">
                    ${l.created_at}
                  </td>
                  <td>
                    <strong>${l.admin_name}</strong>
                  </td>
                  <td>
                    <span class="badge ${badgeClass}" style="font-size: 11.5px; font-weight: 600;">
                      ${actionLabel}
                    </span>
                  </td>
                  <td>
                    ${l.target_user_id ? `
                      <a href="/admin/users/${l.target_user_id}" style="color: var(--primary); text-decoration: none; font-weight: 600;">
                        Клиент #${l.target_user_id}
                      </a>
                    ` : '<span style="color: var(--text-muted);">—</span>'}
                  </td>
                  <td style="font-size: 13px; color: #1e293b; max-width: 360px;">
                    ${l.details || '—'}
                  </td>
                  <td style="font-size: 12px; color: var(--text-muted); font-family: monospace;">
                    ${l.ip_address || '—'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${totalPages > 1 ? `
        <div class="pagination">
          <div>Показаны записи ${offset + 1}–${Math.min(offset + limit, totalLogs)} из ${totalLogs}</div>
          <div class="pagination-links">
            ${paginationLinks.join('')}
          </div>
        </div>
      ` : ''}

    </div>
  `;

  res.send(renderLayout({
    title: 'Логи & Копия базы',
    activeNav: 'system',
    admin: req.admin,
    content
  }));
});

// Скачивание копии базы
router.get('/backup', requireAuth, requireOwner, (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    const timestamp = new Date().toISOString().slice(0, 10);
    res.download(DB_PATH, `vsdogs_copy_${timestamp}.sqlite`);
  } else {
    res.status(404).send('Файл базы данных не найден');
  }
});

export default router;
