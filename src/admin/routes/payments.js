import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireRole } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { getTariffName } from '../services/licenseService.js';

const router = express.Router();

// Главная страница Оплат (Журнал оплат)
router.get('/', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  const totalCount = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const totalSum = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments').get().total;

  const payments = db.prepare(`
    SELECT p.*, u.first_name, u.last_name, u.phone, u.username, a.full_name as admin_name,
           t.name as tariff_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN admin_users a ON a.id = p.admin_id
    LEFT JOIN tariffs t ON t.id = p.tariff_id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const paginationLinks = [];
  if (page > 1) {
    paginationLinks.push(`<a href="/admin/payments?page=${page - 1}" class="page-btn">← Назад</a>`);
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      paginationLinks.push(`
        <a href="/admin/payments?page=${i}" class="page-btn ${i === page ? 'active' : ''}">${i}</a>
      `);
    } else if (i === page - 3 || i === page + 3) {
      paginationLinks.push(`<span style="padding: 6px 8px; color: var(--text-muted);">...</span>`);
    }
  }
  if (page < totalPages) {
    paginationLinks.push(`<a href="/admin/payments?page=${page + 1}" class="page-btn">Вперед →</a>`);
  }

  const content = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Журнал зафиксированных оплат</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            История выданных лицензий и оплат. Всего зафиксировано: <strong>${totalSum.toLocaleString('ru-RU')} ₽</strong> (записей: ${totalCount})
          </p>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Дата</th>
              <th>Клиент / Телефон</th>
              <th>Тариф</th>
              <th>Срок</th>
              <th>Сумма</th>
              <th>Примечание</th>
              <th>Менеджер</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Транзакций пока нет</td></tr>
            ` : payments.map(p => `
              <tr>
                <td style="color: var(--text-muted); font-size: 12px;">#${p.id}</td>
                <td style="font-size: 12.5px;">${p.created_at}</td>
                <td>
                  <strong>${p.first_name || ''} ${p.last_name || ''}</strong><br>
                  <span style="font-size: 12px; color: var(--text-muted);">${p.phone || 'нет тел.'}</span>
                </td>
                <td>
                  <span class="badge badge-paid">${p.tariff_name || getTariffName(p.tariff_id)}</span>
                </td>
                <td>
                  ${p.period_months === 999 ? 'Бессрочно' : `${p.period_months} мес.`}
                </td>
                <td style="font-weight: 700; color: #166534;">
                  ${p.amount.toLocaleString('ru-RU')} ₽
                </td>
                <td style="font-size: 12.5px; color: var(--text-muted);">
                  ${p.comment || '—'}
                </td>
                <td style="font-size: 12.5px;">
                  ${p.admin_name || 'Система'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${totalPages > 1 ? `
        <div class="pagination">
          <div>Показаны записи ${offset + 1}–${Math.min(offset + limit, totalCount)} из ${totalCount}</div>
          <div class="pagination-links">
            ${paginationLinks.join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  res.send(renderLayout({
    title: 'Оплаты',
    activeNav: 'payments',
    admin: req.admin,
    content
  }));
});

export default router;