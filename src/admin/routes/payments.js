import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireRole, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { getTariffName, grantOrExtendLicense, formatDateOnly, getRemainingTimeText } from '../services/licenseService.js';

const router = express.Router();

// 1. Главная страница Оплат (с вкладками "Журнал оплат" и "Запросы на подписку")
router.get('/', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const activeTab = req.query.tab === 'requests' ? 'requests' : 'history';
  const alertParam = req.query.alert;

  let alert = null;
  if (alertParam === 'activated') {
    alert = { type: 'success', message: '✅ Подписка успешно активирована клиенту!' };
  } else if (alertParam === 'deleted') {
    alert = { type: 'success', message: '🗑️ Запрос на подписку удален.' };
  }

  // Считаем количество ожидающих запросов для бейджа
  let pendingCount = 0;
  try {
    pendingCount = db.prepare(`SELECT COUNT(*) as c FROM subscription_requests WHERE status = 'pending'`).get()?.c || 0;
  } catch (err) {
    pendingCount = 0;
  }

  // Доступные тарифы для модалки активации
  const tariffs = db.prepare('SELECT * FROM tariffs WHERE is_active = 1 ORDER BY order_index ASC').all();

  // HTML переключателя вкладок
  const tabsNav = `
    <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 24px;">
      <a href="/admin/payments" style="padding: 10px 20px; font-size: 14px; font-weight: 600; text-decoration: none; border-bottom: 2px solid ${activeTab === 'history' ? 'var(--primary)' : 'transparent'}; margin-bottom: -2px; color: ${activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 8px;">
        💳 Журнал оплат
      </a>
      <a href="/admin/payments?tab=requests" style="padding: 10px 20px; font-size: 14px; font-weight: 600; text-decoration: none; border-bottom: 2px solid ${activeTab === 'requests' ? 'var(--primary)' : 'transparent'}; margin-bottom: -2px; color: ${activeTab === 'requests' ? 'var(--primary)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 8px;">
        📩 Запросы на подписку
        ${pendingCount > 0 ? `<span class="badge badge-expired" style="font-size: 11px; padding: 2px 7px;">${pendingCount}</span>` : ''}
      </a>
    </div>
  `;

  let tabContent = '';

  if (activeTab === 'history') {
    // ==========================================
    // ВКЛАДКА 1: ЖУРНАЛ ОПЛАТ (по умолчанию)
    // ==========================================
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

    tabContent = `
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
                <th>Источник</th>
                <th>Примечание</th>
                <th>Менеджер</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0 ? `
                <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">Транзакций пока нет</td></tr>
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
                  <td>
                    <span class="badge badge-free" style="font-size: 11px;">${p.source.toUpperCase()}</span>
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

  } else {
    // ==========================================
    // ВКЛАДКА 2: ЗАПРОСЫ НА ПОДПИСКУ
    // ==========================================
    const requests = db.prepare(`
      SELECT sr.*, 
             u.first_name, u.last_name, u.phone, u.username, u.telegram_id,
             t.name as requested_tariff_name, t.price as requested_tariff_price,
             l.tariff_id as current_tariff_id, l.expires_at as current_expires_at,
             a.full_name as processed_by_name
      FROM subscription_requests sr
      JOIN users u ON u.id = sr.user_id
      LEFT JOIN tariffs t ON t.id = sr.tariff_id
      LEFT JOIN licenses l ON l.user_id = sr.user_id AND l.id = (
        SELECT id FROM licenses WHERE user_id = sr.user_id AND status = 'active' ORDER BY id DESC LIMIT 1
      )
      LEFT JOIN admin_users a ON a.id = sr.processed_by_admin_id
      ORDER BY CASE WHEN sr.status = 'pending' THEN 0 ELSE 1 END, sr.created_at DESC
    `).all();

    tabContent = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Запросы на оформление и продление подписки</h3>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
              Заявки от учеников из Telegram бота / Mini App. Ожидают подтверждения: <strong>${pendingCount}</strong>
            </p>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата запроса</th>
                <th>Клиент</th>
                <th>Запрошенный тариф</th>
                <th>Текущий доступ</th>
                <th>Комментарий / Чек</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${requests.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Запросов на подписку пока нет</td></tr>
              ` : requests.map(r => {
                const isPending = r.status === 'pending';
                const currentAccess = getRemainingTimeText({ tariff_id: r.current_tariff_id, expires_at: r.current_expires_at });
                const tariffName = r.requested_tariff_name || getTariffName(r.tariff_id);

                return `
                  <tr style="${isPending ? 'background-color: #f0fdf4;' : ''}">
                    <td style="color: var(--text-muted); font-size: 12px;">#${r.id}</td>
                    <td style="font-size: 12.5px;">${formatDateOnly(r.created_at)}</td>
                    <td>
                      <strong>${r.first_name || ''} ${r.last_name || ''}</strong><br>
                      <span style="font-size: 12px; color: var(--text-muted);">${r.phone || 'нет тел.'}</span>
                      ${r.username ? `<br><a href="https://t.me/${r.username}" target="_blank" style="font-size: 11.5px; color: var(--primary); text-decoration: none;">@${r.username}</a>` : ''}
                      <div style="margin-top: 4px;">
                        <a href="/admin/users/${r.user_id}" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 2px 6px;">Карточка клиента</a>
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-paid">${tariffName}</span>
                    </td>
                    <td style="font-size: 12.5px;">
                      <span style="color: var(--text-muted);">${currentAccess}</span>
                    </td>
                    <td style="font-size: 12.5px; max-width: 200px;">
                      ${r.comment || '<span style="color: var(--text-muted);">Без комментария</span>'}
                    </td>
                    <td>
                      ${isPending ? `
                        <span class="badge badge-expiring">Ожидает активации</span>
                      ` : `
                        <span class="badge badge-free">Активирован (${r.processed_by_name || 'Менеджер'})</span>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${formatDateOnly(r.processed_at)}</div>
                      `}
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        ${isPending ? `
                          <button 
                            type="button" 
                            class="btn btn-primary btn-sm" 
                            onclick="openActivationModal(${r.id}, ${r.user_id}, '${r.first_name || ''} ${r.last_name || ''}', '${r.tariff_id || 'paid_1m'}', ${r.requested_tariff_price || 2900})"
                            title="Активировать подписку клиенту"
                          >
                            ⚡ Активировать
                          </button>
                        ` : ''}

                        <form method="POST" action="/admin/payments/requests/${r.id}/delete" style="display: inline; margin: 0;" onsubmit="return confirm('Удалить запрос на подписку #${r.id}?');">
                          <button type="submit" class="btn btn-danger btn-sm" style="padding: 4px 8px;" title="Удалить запрос">🗑️</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Модальное окно быстрой активации подписки -->
      <div id="activationModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 1000; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #ffffff; border-radius: 12px; max-width: 440px; width: 100%; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main);" id="modalTitle">Активация подписки</h4>
            <button type="button" onclick="closeActivationModal()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>

          <form id="activationForm" method="POST" action="">
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Клиент</label>
              <input type="text" id="modalClientName" class="form-control" readonly style="background: #f8fafc; font-weight: 600;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Тарифный план</label>
              <select name="tariff_id" id="modalTariffSelect" class="form-control" required onchange="onModalTariffChange(this)">
                ${tariffs.map(t => `
                  <option value="${t.id}" data-price="${t.price}">${t.name} (${t.price > 0 ? `${t.price.toLocaleString('ru-RU')} ₽` : '0 ₽'})</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Сумма оплаты (₽)</label>
              <input type="number" name="amount" id="modalAmount" class="form-control" required value="2900">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Примечание к оплате</label>
              <input type="text" name="notes" id="modalNotes" class="form-control" placeholder="Оплата по запросу клиента">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="closeActivationModal()">Отмена</button>
              <button type="submit" class="btn btn-primary">Подтвердить активацию</button>
            </div>
          </form>
        </div>
      </div>

      <script>
        function openActivationModal(requestId, userId, clientName, defaultTariffId, defaultPrice) {
          const modal = document.getElementById('activationModal');
          const form = document.getElementById('activationForm');
          form.action = '/admin/payments/requests/' + requestId + '/activate';

          document.getElementById('modalClientName').value = clientName || 'Клиент #' + userId;
          document.getElementById('modalNotes').value = 'Активация по запросу #' + requestId;

          const select = document.getElementById('modalTariffSelect');
          if (defaultTariffId) {
            select.value = defaultTariffId;
          }
          document.getElementById('modalAmount').value = defaultPrice || 2900;

          modal.style.display = 'flex';
        }

        function closeActivationModal() {
          document.getElementById('activationModal').style.display = 'none';
        }

        function onModalTariffChange(select) {
          const opt = select.options[select.selectedIndex];
          const price = opt.getAttribute('data-price');
          document.getElementById('modalAmount').value = price || 0;
        }

        // Закрытие по клику вне окна
        window.onclick = function(e) {
          const modal = document.getElementById('activationModal');
          if (e.target === modal) {
            closeActivationModal();
          }
        }
      </script>
    `;
  }

  const content = `
    ${tabsNav}
    ${tabContent}
  `;

  res.send(renderLayout({
    title: 'Оплаты',
    activeNav: 'payments',
    admin: req.admin,
    alert,
    content
  }));
});

// 2. Активация подписки по запросу клиента
router.post('/requests/:id/activate', requireAuth, requireRole(['MANAGER']), express.urlencoded({ extended: false }), (req, res) => {
  const requestId = req.params.id;
  const { tariff_id, amount, notes } = req.body;

  const request = db.prepare('SELECT * FROM subscription_requests WHERE id = ?').get(requestId);
  if (!request) {
    return res.redirect('/admin/payments?tab=requests');
  }

  // Выдаем или продлеваем лицензию
  grantOrExtendLicense({
    userId: request.user_id,
    tariffId: tariff_id || request.tariff_id || 'paid_1m',
    amount: Number(amount) || 0,
    notes: notes || `Активация по запросу #${requestId}`,
    adminId: req.admin.id,
    ip: req.ip
  });

  // Отмечаем запрос как исполненный
  db.prepare(`
    UPDATE subscription_requests
    SET status = 'approved',
        processed_at = datetime('now'),
        processed_by_admin_id = ?
    WHERE id = ?
  `).run(req.admin.id, requestId);

  logAudit(req.admin.id, req.admin.full_name, 'APPROVE_SUBSCRIPTION_REQUEST', request.user_id, `Активирован запрос #${requestId} (тариф: ${tariff_id}, сумма: ${amount} руб)`, req.ip);

  res.redirect('/admin/payments?tab=requests&alert=activated');
});

// 3. Удаление запроса на подписку
router.post('/requests/:id/delete', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const requestId = req.params.id;

  const request = db.prepare('SELECT * FROM subscription_requests WHERE id = ?').get(requestId);
  if (request) {
    db.prepare('DELETE FROM subscription_requests WHERE id = ?').run(requestId);
    logAudit(req.admin.id, req.admin.full_name, 'DELETE_SUBSCRIPTION_REQUEST', request.user_id, `Удален запрос на подписку #${requestId}`, req.ip);
  }

  res.redirect('/admin/payments?tab=requests&alert=deleted');
});

export default router;
