import express from 'express';
import db from '../../db/database.js';
import { requireAuth } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { getTariffName } from '../services/licenseService.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const isOwner = req.admin.is_owner;
  const roles = req.admin.roles || [];

  if (!isOwner) {
    if (roles.includes('MANAGER')) {
      return res.redirect('/admin/users');
    }
    if (roles.includes('TRAINER')) {
      return res.redirect('/admin/tickets');
    }
    return res.redirect('/admin/login');
  }

  // 1. Статистика по лицензиям и клиентам
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
  `).get().total;

  const activePaid = db.prepare(`
    SELECT COUNT(*) as count FROM licenses 
    WHERE status = 'active' AND tariff_id != 'free'
  `).get().count;

  const freeUsers = db.prepare(`
    SELECT COUNT(*) as count FROM licenses 
    WHERE status = 'active' AND tariff_id = 'free'
  `).get().count;

  const openTickets = db.prepare(`
    SELECT COUNT(*) as count FROM trainer_tickets 
    WHERE status IN ('new', 'in_progress')
  `).get().count;

  // 2. Последние тикеты
  const recentTickets = db.prepare(`
    SELECT t.*, u.first_name, u.last_name, u.phone, u.username
    FROM trainer_tickets t
    JOIN users u ON u.id = t.user_id
    ORDER BY t.created_at DESC
    LIMIT 5
  `).all();

  // 3. Последние транзакции
  const recentPayments = db.prepare(`
    SELECT p.*, u.first_name, u.last_name, u.phone, a.full_name as admin_name,
           t.name as tariff_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN admin_users a ON a.id = p.admin_id
    LEFT JOIN tariffs t ON t.id = p.tariff_id
    ORDER BY p.created_at DESC
    LIMIT 5
  `).all();

  const content = `
    <!-- Карточки показателей -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 28px;">
      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Общая выручка</div>
        <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin-top: 8px;">
          ${totalRevenue.toLocaleString('ru-RU')} ₽
        </div>
        <div style="font-size: 12px; color: #166534; margin-top: 4px; font-weight: 500;">
          Выписано лицензий
        </div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Активные лицензии</div>
        <div style="font-size: 26px; font-weight: 700; color: #166534; margin-top: 8px;">
          ${activePaid}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          Клиентов с платным доступом
        </div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Тариф Free (Базовый)</div>
        <div style="font-size: 26px; font-weight: 700; color: #0284c7; margin-top: 8px;">
          ${freeUsers}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          База для предложений
        </div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Открытые вопросы</div>
        <div style="font-size: 26px; font-weight: 700; color: ${openTickets > 0 ? '#ea580c' : '#166534'}; margin-top: 8px;">
          ${openTickets}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          Ожидают ответа кинолога
        </div>
      </div>
    </div>

    <!-- Сетка: Свежие вопросы кинологам и последние оплаты -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
      
      <!-- Последние тикеты -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Свежие вопросы кинологам</h3>
          <a href="/admin/tickets" class="btn btn-secondary btn-sm">Все вопросы →</a>
        </div>
        <div class="table-container">
          <table>
            <tbody>
              ${recentTickets.length === 0 ? `
                <tr><td style="text-align: center; color: var(--text-muted); padding: 20px;">Нет новых вопросов</td></tr>
              ` : recentTickets.map(t => `
                <tr>
                  <td>
                    <div style="font-weight: 600; font-size: 13px;">${t.first_name || 'Ученик'} (${t.phone || 'нет тел.'})</div>
                    <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${t.question_text}
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <span class="badge ${t.status === 'answered' ? 'badge-paid' : 'badge-expiring'}">
                      ${t.status === 'new' ? 'Новый' : (t.status === 'in_progress' ? 'В работе' : 'Отвечен')}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Последние зачисления -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Недавние транзакции</h3>
          <a href="/admin/payments" class="btn btn-secondary btn-sm">Все оплаты →</a>
        </div>
        <div class="table-container">
          <table>
            <tbody>
              ${recentPayments.length === 0 ? `
                <tr><td style="text-align: center; color: var(--text-muted); padding: 20px;">Оплат пока нет</td></tr>
              ` : recentPayments.map(p => `
                <tr>
                  <td>
                    <div style="font-weight: 600; font-size: 13px;">${p.first_name || 'Клиент'} ${p.last_name || ''}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${p.phone || ''}</div>
                  </td>
                  <td>
                    <span class="badge badge-paid">${p.tariff_name || getTariffName(p.tariff_id)}</span>
                  </td>
                  <td style="text-align: right; font-weight: 700; color: #166534;">
                    +${p.amount} ₽
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  res.send(renderLayout({
    title: 'Дашборд',
    activeNav: 'dashboard',
    admin: req.admin,
    content
  }));
});

export default router;