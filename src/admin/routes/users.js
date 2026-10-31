import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireRole, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { getTariffName, getRemainingTimeText, grantOrExtendLicense, deleteLicense, formatDateOnly } from '../services/licenseService.js';
import { ACTION_NAMES } from './system.js';
import { getTicketMediaList } from './tickets.js';

const router = express.Router();

// 1. Список клиентов
router.get('/', requireAuth, requireRole(['MANAGER', 'TRAINER']), (req, res) => {
  const search = (req.query.q || '').trim();
  const tariffFilter = req.query.tariff || 'all';
  const alertParam = req.query.alert;

  let alert = null;
  if (alertParam === 'license_deleted') {
    alert = { type: 'success', message: '🗑️ Лицензия успешно удалена. Действие зафиксировано в журнале аудита.' };
  } else if (alertParam === 'error') {
    alert = { type: 'danger', message: req.query.msg || 'Произошла ошибка при выполнении операции.' };
  }

  const availableTariffs = db.prepare('SELECT id, name FROM tariffs WHERE is_active = 1 ORDER BY order_index ASC').all();

  let query = `
    SELECT u.*, 
           l.tariff_id, l.status as license_status, l.starts_at, l.expires_at,
           t.name as tariff_name,
           (SELECT COUNT(*) FROM user_notes n WHERE n.user_id = u.id) as notes_count,
           (SELECT note_text FROM user_notes n WHERE n.user_id = u.id ORDER BY id DESC LIMIT 1) as last_note
    FROM users u
    LEFT JOIN licenses l ON l.user_id = u.id AND l.id = (
      SELECT id FROM licenses WHERE user_id = u.id AND status = 'active' ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN tariffs t ON t.id = l.tariff_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (u.phone LIKE ? OR u.username LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CAST(u.telegram_id AS TEXT) LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  if (tariffFilter !== 'all') {
    query += ` AND l.tariff_id = ?`;
    params.push(tariffFilter);
  }

  query += ` ORDER BY u.created_at DESC LIMIT 50`;

  const users = db.prepare(query).all(...params);
  const isManager = req.admin.is_owner || req.admin.roles.includes('MANAGER');

  const content = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Клиенты</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">База учеников школы, управление лицензиями и заметки</p>
        </div>
      </div>

      <!-- Поисковая панель -->
      <form method="GET" action="/admin/users" style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <input 
          type="text" 
          name="q" 
          value="${search}" 
          class="form-control" 
          placeholder="Поиск по телефону (+7...), @username или имени..." 
          style="max-width: 360px;"
        >
        <select name="tariff" class="form-control" style="max-width: 200px;">
          <option value="all" ${tariffFilter === 'all' ? 'selected' : ''}>Все тарифы</option>
          ${availableTariffs.map(t => `
            <option value="${t.id}" ${tariffFilter === t.id ? 'selected' : ''}>${t.name}</option>
          `).join('')}
        </select>
        <button type="submit" class="btn btn-primary">Найти</button>
        ${search || tariffFilter !== 'all' ? '<a href="/admin/users" class="btn btn-secondary">Сброс</a>' : ''}
      </form>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Клиент / Телефон</th>
              <th>Telegram</th>
              <th>Лицензия</th>
              <th>Срок действия</th>
              <th>Комментарии</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? `
              <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">Клиенты не найдены</td></tr>
            ` : users.map(u => {
              const displayName = u.tariff_name || getTariffName(u.tariff_id);
              let badgeClass = 'badge-free';
              if (u.tariff_id === 'lifetime') badgeClass = 'badge-lifetime';
              else if (u.tariff_id?.startsWith('paid')) badgeClass = u.license_status === 'expired' ? 'badge-expired' : 'badge-paid';

              const remainingText = getRemainingTimeText({ tariff_id: u.tariff_id, expires_at: u.expires_at });
              const dateDisplay = u.tariff_id === 'lifetime' ? 'Бессрочно' : (u.expires_at ? formatDateOnly(u.expires_at) : 'Без ограничений');

              return `
                <tr>
                  <td style="color: var(--text-muted); font-size: 12px;">#${u.id}</td>
                  <td>
                    <strong>${u.first_name || ''} ${u.last_name || ''}</strong>
                    ${u.is_blocked ? '<span class="badge badge-expired" style="font-size: 10px; margin-left: 6px;">ЗАБАНЕН</span>' : ''}<br>
                    <span style="font-size: 12px; color: var(--text-muted);">${u.phone || 'Телефон не указан'}</span>
                  </td>
                  <td>
                    ${u.username ? `<a href="https://t.me/${u.username}" target="_blank" style="color: var(--primary); text-decoration: none;">@${u.username}</a>` : ''}
                    <div style="font-size: 11px; color: var(--text-muted);">TG: ${u.telegram_id || '—'}</div>
                  </td>
                  <td>
                    <span class="badge ${badgeClass}">${displayName}</span>
                  </td>
                  <td style="font-size: 12.5px;">
                    <div>${dateDisplay}</div>
                    ${u.tariff_id?.startsWith('paid') ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${remainingText}</div>` : ''}
                  </td>
                  <td>
                    ${u.notes_count > 0 ? `
                      <span class="badge badge-free" title="${u.last_note ? u.last_note.replace(/"/g, '&quot;') : ''}">
                        ${u.notes_count} зам.
                      </span>
                      ${u.last_note ? `<div style="font-size: 11px; color: var(--text-muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;">${u.last_note}</div>` : ''}
                    ` : '<span style="color: var(--text-muted); font-size: 12px;">—</span>'}
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <a href="/admin/users/${u.id}" class="btn btn-secondary btn-sm">Открыть</a>
                      ${isManager ? `
                        <a href="/admin/users/${u.id}?focus=grant" class="btn btn-primary btn-sm">Лицензия</a>
                        ${u.license_status === 'active' && u.tariff_id && u.tariff_id !== 'free' ? `
                          <form method="POST" action="/admin/users/${u.id}/delete-license" style="display: inline; margin: 0;" onsubmit="const r = prompt('Вы действительно хотите удалить активную лицензию клиента #${u.id} (${u.first_name || ''} ${u.last_name || ''})?\\n\\nДействие будет записано в журнал аудита.\\nУкажите причину удаления (необязательно):'); if (r === null) return false; this.reason.value = r; return true;">
                            <input type="hidden" name="reason" value="">
                            <input type="hidden" name="redirect_to" value="/admin/users">
                            <button type="submit" class="btn btn-danger btn-sm" style="padding: 4px 8px;" title="Удалить активную лицензию">Снять лиц.</button>
                          </form>
                        ` : ''}
                        <form method="POST" action="/admin/users/${u.id}/delete" style="display: inline; margin: 0;" onsubmit="return confirm('Удалить клиента #${u.id} (${u.first_name || ''} ${u.last_name || ''})? Будет удалена вся история подписок и заметок.');">
                          <button type="submit" class="btn btn-danger btn-sm" style="padding: 4px 8px;" title="Удалить клиента">🗑️</button>
                        </form>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Клиенты',
    activeNav: 'users',
    admin: req.admin,
    alert,
    content
  }));
});

// 2. Карточка клиента
router.get('/:id', requireAuth, requireRole(['MANAGER', 'TRAINER']), (req, res) => {
  const userId = req.params.id;
  const focusGrant = req.query.focus === 'grant';
  const alertParam = req.query.alert;

  let alert = null;
  if (alertParam === 'license_deleted') {
    alert = { type: 'success', message: '🗑️ Лицензия успешно удалена. Действие зафиксировано в журнале аудита.' };
  } else if (alertParam === 'license_granted') {
    alert = { type: 'success', message: '✅ Лицензия успешно сохранена.' };
  } else if (alertParam === 'error') {
    alert = { type: 'danger', message: req.query.msg || 'Произошла ошибка при выполнении операции.' };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).send('Клиент не найден');
  }

  // Текущая активная лицензия
  const activeLicense = db.prepare(`
    SELECT l.*, t.name as tariff_name
    FROM licenses l
    LEFT JOIN tariffs t ON t.id = l.tariff_id
    WHERE l.user_id = ? AND l.status = 'active'
    ORDER BY l.id DESC LIMIT 1
  `).get(userId);

  // Вся история когда-либо выданных лицензий
  const licenseHistory = db.prepare(`
    SELECT l.*, t.name as tariff_name, a.full_name as admin_name
    FROM licenses l
    LEFT JOIN tariffs t ON t.id = l.tariff_id
    LEFT JOIN admin_users a ON a.id = l.created_by_admin_id
    WHERE l.user_id = ?
    ORDER BY l.id DESC
  `).all(userId);

  // Журнал аудита по этому клиенту
  const clientAuditLogs = db.prepare(`
    SELECT * FROM admin_audit_logs 
    WHERE target_user_id = ? 
    ORDER BY created_at DESC LIMIT 15
  `).all(userId);

  // Тарифы из БД для выпадающего списка
  const tariffs = db.prepare('SELECT * FROM tariffs WHERE is_active = 1 ORDER BY order_index ASC').all();

  // Заметки кураторов
  const notes = db.prepare(`
    SELECT * FROM user_notes 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(userId);

  // Вопросы кинологам
  const tickets = db.prepare(`
    SELECT * FROM trainer_tickets 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(userId);

  const isManager = req.admin.is_owner || req.admin.roles.includes('MANAGER');

  const currentTariffDisplayName = activeLicense ? (activeLicense.tariff_name || getTariffName(activeLicense.tariff_id)) : 'Базовый (Free)';
  const remainingText = getRemainingTimeText(activeLicense);

  const hasUnexpiredActive = activeLicense && 
                             activeLicense.tariff_id !== 'free' && 
                             activeLicense.tariff_id !== 'lifetime' && 
                             activeLicense.expires_at;

  const content = `
    <div style="margin-bottom: 20px;">
      <a href="/admin/users" style="color: var(--text-muted); text-decoration: none; font-size: 13.5px;">← Назад к списку клиентов</a>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <!-- Профиль клиента -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Профиль клиента #${user.id}</h3>
          ${user.is_blocked ? '<span class="badge badge-expired">ЗАБЛОКИРОВАН</span>' : '<span class="badge badge-paid">АКТИВЕН</span>'}
        </div>
        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; font-size: 13.5px;">
          <div style="color: var(--text-muted);">Имя / Фамилия:</div>
          <div><strong>${user.first_name || ''} ${user.last_name || ''}</strong></div>

          <div style="color: var(--text-muted);">Телефон:</div>
          <div><strong>${user.phone || 'Не указан'}</strong></div>

          <div style="color: var(--text-muted);">Telegram Ник:</div>
          <div>${user.username ? `<a href="https://t.me/${user.username}" target="_blank">@${user.username}</a>` : '—'}</div>

          <div style="color: var(--text-muted);">Telegram ID:</div>
          <div><code>${user.telegram_id || '—'}</code></div>

          <div style="color: var(--text-muted);">Дата регистрации:</div>
          <div>${formatDateOnly(user.created_at)}</div>

          <div style="color: var(--text-muted);">Последний вход:</div>
          <div>${formatDateOnly(user.last_active_at)}</div>
        </div>

        ${isManager ? `
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <form method="POST" action="/admin/users/${user.id}/toggle-block" style="display: inline;">
              <button type="submit" class="btn btn-sm ${user.is_blocked ? 'btn-primary' : 'btn-secondary'}">
                ${user.is_blocked ? 'Разблокировать доступ' : 'Заблокировать доступ'}
              </button>
            </form>

            <form method="POST" action="/admin/users/${user.id}/delete" style="display: inline;" onsubmit="return confirm('ВНИМАНИЕ! Вы действительно хотите безвозвратно удалить клиента #${user.id} (${user.first_name || ''} ${user.last_name || ''})?\\n\\nБудут удалены все связанные лицензии, платежи и комментарии.');">
              <button type="submit" class="btn btn-sm btn-danger">
                Удалить клиента
              </button>
            </form>
          </div>
        ` : ''}
      </div>

      <!-- Текущая лицензия и форма выдачи -->
      <div class="card" ${focusGrant ? 'style="border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);"' : ''}>
        <div class="card-header">
          <h3 class="card-title">Текущая лицензия</h3>
          <span class="badge ${activeLicense?.tariff_id?.startsWith('paid') ? 'badge-paid' : 'badge-free'}">
            ${currentTariffDisplayName}
          </span>
        </div>

        <div style="font-size: 13.5px; margin-bottom: 16px;">
          <div style="margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Срок окончания:</span> 
            <strong>${activeLicense?.expires_at ? formatDateOnly(activeLicense.expires_at) : (activeLicense?.tariff_id === 'lifetime' ? 'Бессрочно' : 'Бесплатный базовый доступ')}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted);">Статус доступа:</span> 
            <strong style="color: #166534;">${remainingText}</strong>
          </div>
        </div>

        ${isManager && activeLicense ? `
          <div style="margin-bottom: 18px; padding: 12px 14px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #9b2c2c;">Активная лицензия #${activeLicense.id} (${currentTariffDisplayName})</div>
              <div style="font-size: 11.5px; color: #c53030; margin-top: 2px;">Удаление аннулирует доступ ученика. Действие фиксируется в журнале.</div>
            </div>
            <form method="POST" action="/admin/users/${user.id}/delete-license" style="margin: 0;" onsubmit="const r = prompt('Вы действительно хотите удалить активную лицензию #${activeLicense.id} (${currentTariffDisplayName}) клиента #${user.id}?\\n\\nДействие будет записано в журнал аудита.\\nУкажите причину удаления (необязательно):'); if (r === null) return false; this.reason.value = r; return true;">
              <input type="hidden" name="license_id" value="${activeLicense.id}">
              <input type="hidden" name="reason" value="">
              <button type="submit" class="btn btn-danger btn-sm" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                🗑️ Удалить лицензию
              </button>
            </form>
          </div>
        ` : ''}

        ${isManager ? `
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
            
            ${hasUnexpiredActive ? `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px 12px; border-radius: 6px; font-size: 12.5px; margin-bottom: 14px;">
                У клиента действует активная лицензия до <strong>${formatDateOnly(activeLicense.expires_at)}</strong>. При покупке нового периода дни прибавятся к текущему сроку (дни не сгорят).
              </div>
            ` : ''}

            <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px;">Установить / продлить лицензию</h4>
            <form method="POST" action="/admin/users/${user.id}/grant-license">
              <div class="form-group">
                <label class="form-label">Выберите тарифный план</label>
                <select name="tariff_id" id="tariffSelect" class="form-control" required onchange="updatePrice(this)">
                  ${tariffs.map(t => `
                    <option value="${t.id}" data-price="${t.price}" ${t.id === 'paid_1m' ? 'selected' : ''}>
                      ${t.name} (${t.price > 0 ? `${t.price.toLocaleString('ru-RU')} ₽` : '0 ₽'})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Сумма платежа (₽)</label>
                  <input type="number" name="amount" id="amountInput" class="form-control" value="2900" placeholder="2900">
                </div>
                <div class="form-group">
                  <label class="form-label">Примечание</label>
                  <input type="text" name="notes" class="form-control" placeholder="Перевод Т-Банк / наличные">
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%;">
                ${hasUnexpiredActive ? 'Продлить лицензию клиенту' : 'Активировать доступ клиенту'}
              </button>
            </form>
          </div>

          <script>
            function updatePrice(select) {
              const selectedOption = select.options[select.selectedIndex];
              const price = selectedOption.getAttribute('data-price');
              document.getElementById('amountInput').value = price || 0;
            }
          </script>
        ` : `
          <div style="color: var(--text-muted); font-size: 13px; font-style: italic;">
            Управление лицензиями доступно только Менеджерам и Владельцу.
          </div>
        `}
      </div>

    </div>

    <!-- История всех выданных лицензий -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">История лицензий клиента</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Полная хронология подписок клиента. Каждое удаление фиксируется в журнале аудита.
          </p>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Тариф</th>
              <th>Дата старта</th>
              <th>Дата окончания</th>
              <th>Статус</th>
              <th>Примечание</th>
              <th>Сотрудник</th>
              ${isManager ? '<th style="text-align: right;">Действия</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${licenseHistory.length === 0 ? `
              <tr><td colspan="${isManager ? 8 : 7}" style="text-align: center; color: var(--text-muted); padding: 24px;">История лицензий пуста</td></tr>
            ` : licenseHistory.map(l => {
              const name = l.tariff_name || getTariffName(l.tariff_id);
              let statusBadge = '<span class="badge badge-paid">Активна</span>';
              if (l.status === 'extended') statusBadge = '<span class="badge badge-free">Продлена</span>';
              else if (l.status === 'upgraded') statusBadge = '<span class="badge badge-lifetime">Апгрейд до VIP</span>';
              else if (l.status === 'expired') statusBadge = '<span class="badge badge-expired">Истекла</span>';
              else if (l.status === 'canceled') statusBadge = '<span class="badge badge-expired">Аннулирована</span>';

              return `
                <tr>
                  <td style="color: var(--text-muted); font-size: 12px;">#${l.id}</td>
                  <td><strong>${name}</strong></td>
                  <td style="font-size: 12.5px;">${formatDateOnly(l.starts_at)}</td>
                  <td style="font-size: 12.5px;">${l.expires_at ? formatDateOnly(l.expires_at) : (l.tariff_id === 'lifetime' ? 'Бессрочно' : 'Без срока')}</td>
                  <td>${statusBadge}</td>
                  <td style="font-size: 12.5px; color: var(--text-muted);">${l.notes || '—'}</td>
                  <td style="font-size: 12.5px;">${l.admin_name || 'Система'}</td>
                  ${isManager ? `
                    <td style="text-align: right;">
                      <form method="POST" action="/admin/users/${user.id}/licenses/${l.id}/delete" style="display: inline; margin: 0;" onsubmit="const r = prompt('Вы действительно хотите удалить лицензию #${l.id} (${name})?\\n\\nДействие будет записано в журнал аудита.\\nУкажите причину удаления (необязательно):'); if (r === null) return false; this.reason.value = r; return true;">
                        <input type="hidden" name="reason" value="">
                        <button type="submit" class="btn btn-danger btn-sm" style="padding: 3px 8px; font-size: 12px;" title="Удалить лицензию">
                          🗑️ Удалить
                        </button>
                      </form>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Журнал действий и аудита по клиенту -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Журнал аудита по клиенту</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Фиксация всех административных действий по клиенту (выдача, продление и удаление лицензий, блокировки)
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
              <th>Подробности</th>
            </tr>
          </thead>
          <tbody>
            ${clientAuditLogs.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Записей в журнале по клиенту пока нет</td></tr>
            ` : clientAuditLogs.map(log => {
              const actionLabel = ACTION_NAMES[log.action] || log.action;
              let badgeClass = 'badge-free';
              if (log.action === 'DELETE_LICENSE' || log.action === 'BLOCK_USER' || log.action === 'REVOKE_LICENSE' || log.action === 'DELETE_USER') {
                badgeClass = 'badge-expired';
              } else if (log.action.startsWith('GRANT_') || log.action.startsWith('EXTEND_') || log.action.startsWith('UPGRADE_')) {
                badgeClass = 'badge-paid';
              }
              return `
                <tr>
                  <td style="font-size: 12px; color: var(--text-muted); white-space: nowrap;">${log.created_at}</td>
                  <td><strong>${log.admin_name}</strong></td>
                  <td><span class="badge ${badgeClass}" style="font-size: 11px;">${actionLabel}</span></td>
                  <td style="font-size: 12.5px; max-width: 400px;">${log.details || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Заметки по клиенту (CRM) -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Комментарии и заметки по клиенту</h3>
      </div>

      <form method="POST" action="/admin/users/${user.id}/add-note" style="display: flex; gap: 12px; margin-bottom: 20px;">
        <input type="text" name="note_text" class="form-control" required placeholder="Например: Щенок корги, 3.5 месяца, есть склонность кусать пятки...">
        <button type="submit" class="btn btn-secondary" style="flex-shrink: 0;">Добавить комментарий</button>
      </form>

      ${notes.length === 0 ? `
        <div style="color: var(--text-muted); font-size: 13px;">Комментариев пока нет</div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${notes.map(n => `
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
                <strong>${n.author_name}</strong>
                <span>${formatDateOnly(n.created_at)}</span>
              </div>
              <div style="font-size: 13.5px;">${n.note_text}</div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- Вопросы клиента кинологам -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Вопросы кинологам от этого клиента</h3>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Вопрос</th>
              <th>Медиа</th>
              <th>Статус</th>
              <th>Ответ</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.length === 0 ? `
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Вопросов кинологу не поступало</td></tr>
            ` : tickets.map(t => `
              <tr>
                <td style="font-size: 12px; color: var(--text-muted);">${formatDateOnly(t.created_at)}</td>
                <td style="font-weight: 500; font-size: 13px; max-width: 300px;">${t.question_text}</td>
                <td>
                  ${(() => {
                    const media = getTicketMediaList(t);
                    if (media.length === 0) return '—';
                    if (media.length === 1) {
                      const isVideo = /\.(mp4|mov|webm)$/i.test(media[0]);
                      return `<a href="${media[0]}" target="_blank" class="btn btn-secondary btn-sm">${isVideo ? '🎬 Видео' : '📷 Фото'}</a>`;
                    }
                    return `<div style="display: flex; gap: 4px; flex-wrap: wrap;">${media.map((u, i) => {
                      const isVideo = /\.(mp4|mov|webm)$/i.test(u);
                      return `<a href="${u}" target="_blank" class="btn btn-secondary btn-sm" title="Файл #${i+1}">${isVideo ? `🎬 #${i+1}` : `📷 #${i+1}`}</a>`;
                    }).join('')}</div>`;
                  })()}
                </td>
                <td>
                  <span class="badge ${t.status === 'answered' ? 'badge-paid' : 'badge-expiring'}">
                    ${t.status === 'new' ? 'Новый' : (t.status === 'in_progress' ? 'В работе' : 'Отвечен')}
                  </span>
                </td>
                <td style="font-size: 12.5px; max-width: 300px;">
                  ${t.answer_text ? `<strong>${t.answered_by_name || 'Кинолог'}:</strong> ${t.answer_text}` : '<em style="color: var(--text-muted);">Ждет ответа</em>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: `Клиент: ${user.first_name || ''} ${user.last_name || ''}`,
    activeNav: 'users',
    admin: req.admin,
    alert,
    content
  }));
});

// Установка / продление лицензии
router.post('/:id/grant-license', requireAuth, requireRole(['MANAGER']), express.urlencoded({ extended: false }), (req, res) => {
  const userId = req.params.id;
  const { tariff_id, amount, notes } = req.body;

  grantOrExtendLicense({
    userId,
    tariffId: tariff_id,
    amount,
    notes,
    adminId: req.admin.id,
    ip: req.ip
  });

  res.redirect(`/admin/users/${userId}?alert=license_granted`);
});

// Удаление активной или указанной лицензии клиента
router.post('/:id/delete-license', requireAuth, requireRole(['MANAGER']), express.urlencoded({ extended: false }), (req, res) => {
  const userId = req.params.id;
  const { license_id, reason, redirect_to } = req.body;

  const result = deleteLicense({
    licenseId: license_id ? parseInt(license_id, 10) : null,
    userId,
    adminId: req.admin.id,
    reason: reason || '',
    ip: req.ip
  });

  const baseRedirect = redirect_to || `/admin/users/${userId}`;
  if (!result.success) {
    return res.redirect(`${baseRedirect}?alert=error&msg=${encodeURIComponent(result.error || 'Ошибка удаления')}`);
  }

  res.redirect(`${baseRedirect}?alert=license_deleted`);
});

// Удаление конкретной лицензии по ID из истории
router.post('/:id/licenses/:licenseId/delete', requireAuth, requireRole(['MANAGER']), express.urlencoded({ extended: false }), (req, res) => {
  const userId = req.params.id;
  const licenseId = req.params.licenseId;
  const { reason } = req.body;

  const result = deleteLicense({
    licenseId: parseInt(licenseId, 10),
    userId,
    adminId: req.admin.id,
    reason: reason || '',
    ip: req.ip
  });

  if (!result.success) {
    return res.redirect(`/admin/users/${userId}?alert=error&msg=${encodeURIComponent(result.error || 'Ошибка удаления')}`);
  }

  res.redirect(`/admin/users/${userId}?alert=license_deleted`);
});

// Добавление комментария
router.post('/:id/add-note', requireAuth, requireRole(['MANAGER', 'TRAINER']), express.urlencoded({ extended: false }), (req, res) => {
  const userId = req.params.id;
  const { note_text } = req.body;

  if (note_text && note_text.trim()) {
    db.prepare(`
      INSERT INTO user_notes (user_id, author_admin_id, author_name, note_text)
      VALUES (?, ?, ?, ?)
    `).run(userId, req.admin.id, req.admin.full_name, note_text.trim());
  }

  res.redirect(`/admin/users/${userId}`);
});

// Блокировка/разблокировка
router.post('/:id/toggle-block', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const userId = req.params.id;
  const user = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(userId);
  if (user) {
    const newStatus = user.is_blocked ? 0 : 1;
    db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(newStatus, userId);
    logAudit(req.admin.id, req.admin.full_name, newStatus ? 'BLOCK_USER' : 'UNBLOCK_USER', userId, null, req.ip);
  }
  res.redirect(`/admin/users/${userId}`);
});

// Удаление клиента
router.post('/:id/delete', requireAuth, requireRole(['MANAGER']), (req, res) => {
  const userId = req.params.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.redirect('/admin/users');
  }

  // Каскадное удаление данных клиента
  try {
    db.exec('PRAGMA foreign_keys = OFF;');

    // 1. Платежи и подписки (payments ссылаются на licenses)
    db.prepare('DELETE FROM payments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM licenses WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM subscription_requests WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM trainer_tickets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_notes WHERE user_id = ?').run(userId);

    // 2. Удаляем связанные сессии, ссылки и состояния по telegram_id
    if (user.telegram_id) {
      const tgStr = String(user.telegram_id);
      try { db.prepare('DELETE FROM subscription_notifications WHERE telegram_id = ?').run(tgStr); } catch {}
      try { db.prepare('DELETE FROM sessions WHERE telegram_id = ?').run(tgStr); } catch {}
      try { db.prepare('DELETE FROM magic_links WHERE telegram_id = ?').run(tgStr); } catch {}
      try { db.prepare('DELETE FROM invites WHERE target_telegram_id = ?').run(tgStr); } catch {}
      try { db.prepare('DELETE FROM bot_messages WHERE chat_id = ?').run(tgStr); } catch {}
      try { db.prepare('DELETE FROM bot_states WHERE telegram_id = ?').run(tgStr); } catch {}
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    const clientDesc = `${user.first_name || ''} ${user.last_name || ''} (@${user.username || '—'}, TG: ${user.telegram_id || '—'})`;
    logAudit(req.admin.id, req.admin.full_name, 'DELETE_USER', userId, `Удален клиент: ${clientDesc.trim()}`, req.ip);
  } catch (err) {
    console.error('Ошибка при удалении клиента:', err);
  } finally {
    try {
      db.exec('PRAGMA foreign_keys = ON;');
    } catch {}
  }

  res.redirect('/admin/users');
});

export default router;
