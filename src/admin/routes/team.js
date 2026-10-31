import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireOwner, hashPassword, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';

const router = express.Router();

router.get('/', requireAuth, requireOwner, (req, res) => {
  const team = db.prepare(`
    SELECT id, login, email, phone, full_name, is_owner, roles, can_answer_tickets_bot, telegram_id, telegram_username, is_active, last_login_at, created_at
    FROM admin_users 
    ORDER BY is_owner DESC, id ASC
  `).all();

  const content = `
    <!-- Список сотрудников (полная ширина) -->
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 class="card-title">Команда и уровни доступа</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
            Управление учетными записями сотрудников школы (доступно только Владельцу)
          </p>
        </div>
        <button type="button" class="btn btn-primary" onclick="openCreateModal()">
          + Добавить сотрудника
        </button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Логин</th>
              <th>Роли</th>
              <th>Бот кинологов</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${team.map(m => {
              let parsedRoles = [];
              try { parsedRoles = JSON.parse(m.roles || '[]'); } catch {}

              const memberPayload = JSON.stringify({
                id: m.id,
                full_name: m.full_name || '',
                login: m.login || '',
                email: m.email || '',
                phone: m.phone || '',
                is_owner: Boolean(m.is_owner),
                roles: parsedRoles,
                can_answer_tickets_bot: Boolean(m.can_answer_tickets_bot),
                telegram_user: m.telegram_username ? `@${m.telegram_username}` : (m.telegram_id || '')
              }).replace(/"/g, '&quot;');

              return `
                <tr>
                  <td>
                    <strong>${m.full_name}</strong><br>
                    <span style="font-size: 12px; color: var(--text-muted);">${m.email || 'нет email'}</span>
                    ${m.phone ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;">📞 ${m.phone}</div>` : ''}
                  </td>
                  <td><code>${m.login}</code></td>
                  <td>
                    ${m.is_owner ? '<span class="role-badge role-owner">Владелец</span>' : ''}
                    ${parsedRoles.includes('MANAGER') ? '<span class="role-badge role-manager">Менеджер</span>' : ''}
                    ${parsedRoles.includes('TRAINER') ? '<span class="role-badge role-trainer">Кинолог</span>' : ''}
                  </td>
                  <td>
                    ${(m.can_answer_tickets_bot || m.is_owner) ? `
                      <span class="badge badge-paid" style="font-size: 11px;">✓ Разрешен</span>
                      ${m.telegram_username ? `<div style="font-size: 12px; color: var(--primary); margin-top: 4px; font-weight: 500;">@${m.telegram_username}</div>` : ''}
                      ${m.telegram_id ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">ID: ${m.telegram_id}</div>` : ''}
                    ` : `
                      <span class="badge badge-expired" style="font-size: 11px;">✗ Нет доступа</span>
                      ${m.telegram_username ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">@${m.telegram_username}</div>` : ''}
                    `}
                  </td>
                  <td>
                    <span class="badge ${m.is_active ? 'badge-paid' : 'badge-expired'}">
                      ${m.is_active ? 'Активен' : 'Отключен'}
                    </span>
                  </td>
                  <td>
                    ${m.is_owner ? `
                      <div style="display: flex; gap: 6px; align-items: center;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModal(${memberPayload})">Изменить</button>
                        <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">Главный аккаунт</span>
                      </div>
                    ` : `
                      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModal(${memberPayload})">Изменить</button>
                        <form method="POST" action="/admin/team/${m.id}/toggle" style="display: inline; margin: 0;">
                          <button type="submit" class="btn btn-sm ${m.is_active ? 'btn-danger' : 'btn-secondary'}">
                            ${m.is_active ? 'Откл' : 'Вкл'}
                          </button>
                        </form>
                        <form method="POST" action="/admin/team/${m.id}/delete" onsubmit="return confirm('Вы действительно хотите удалить сотрудника ${m.full_name}?');" style="display: inline; margin: 0;">
                          <button type="submit" class="btn btn-sm btn-danger">Удалить</button>
                        </form>
                      </div>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Модальное окно: Добавить сотрудника -->
    <div id="createEmployeeModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 1000; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: white; border-radius: 14px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="font-size: 17px; font-weight: 700;">Добавить сотрудника</h3>
          <button type="button" onclick="closeCreateModal()" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted); line-height: 1;">✕</button>
        </div>

        <form method="POST" action="/admin/team/create">
          <div class="form-group">
            <label class="form-label">ФИО сотрудника</label>
            <input type="text" name="full_name" class="form-control" required placeholder="Мария Иванова">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Логин для входа</label>
              <input type="text" name="login" class="form-control" required placeholder="maria_trainer">
            </div>
            <div class="form-group">
              <label class="form-label">Пароль</label>
              <input type="password" name="password" class="form-control" required placeholder="Минимум 6 символов">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" name="email" class="form-control" placeholder="maria@vsdogs.ru">
            </div>
            <div class="form-group">
              <label class="form-label">Номер телефона</label>
              <input type="text" name="phone" class="form-control" placeholder="+7 999 123-45-67">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Telegram (@username или числовой ID)</label>
            <input type="text" name="telegram_user" class="form-control" placeholder="@maria_trainer или 123456789">
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
              Необходим боту кинологов для распознавания сотрудника
            </p>
          </div>

          <div class="form-group" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <label class="form-label" style="margin-bottom: 8px;">Назначение ролей (можно выбрать обе):</label>
            
            <div style="margin-bottom: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" name="role_manager" value="1">
                <span><strong>Менеджер</strong> — только клиенты и оплаты</span>
              </label>
            </div>

            <div style="margin-bottom: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" name="role_trainer" value="1" checked>
                <span><strong>Кинолог</strong> — ответы на вопросы учеников (тикеты)</span>
              </label>
            </div>

            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" name="can_answer_tickets_bot" value="1" checked>
                <span><strong>Доступ к боту для ответов</strong> — разрешить отвечать на тикеты в Telegram</span>
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-secondary" onclick="closeCreateModal()">Отмена</button>
            <button type="submit" class="btn btn-primary">Создать сотрудника</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Модальное окно: Редактировать сотрудника -->
    <div id="editEmployeeModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 1000; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: white; border-radius: 14px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 id="editModalTitle" style="font-size: 17px; font-weight: 700;">Редактирование сотрудника</h3>
          <button type="button" onclick="closeEditModal()" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted); line-height: 1;">✕</button>
        </div>

        <form id="editEmployeeForm" method="POST" action="">
          <div class="form-group">
            <label class="form-label">ФИО сотрудника</label>
            <input type="text" id="edit_full_name" name="full_name" class="form-control" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Логин для входа</label>
              <input type="text" id="edit_login" name="login" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Новый пароль</label>
              <input type="password" name="password" class="form-control" placeholder="Оставьте пустым, если не меняется">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="edit_email" name="email" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Номер телефона</label>
              <input type="text" id="edit_phone" name="phone" class="form-control">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Telegram (@username или числовой ID)</label>
            <input type="text" id="edit_telegram_user" name="telegram_user" class="form-control">
          </div>

          <div id="editRolesBlock" class="form-group" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <label class="form-label" style="margin-bottom: 8px;">Назначение ролей:</label>
            
            <div style="margin-bottom: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" id="edit_role_manager" name="role_manager" value="1">
                <span><strong>Менеджер</strong> — только клиенты и оплаты</span>
              </label>
            </div>

            <div style="margin-bottom: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" id="edit_role_trainer" name="role_trainer" value="1">
                <span><strong>Кинолог</strong> — ответы на вопросы учеников (тикеты)</span>
              </label>
            </div>

            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                <input type="checkbox" id="edit_can_answer_tickets_bot" name="can_answer_tickets_bot" value="1">
                <span><strong>Доступ к боту для ответов</strong> — разрешить отвечать на тикеты в Telegram</span>
              </label>
            </div>
          </div>

          <div id="editOwnerNotice" style="display: none; font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
            Роль Владельца не подлежит изменению. Доступ к Telegram-боту кинологов включен всегда.
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Отмена</button>
            <button type="submit" class="btn btn-primary">Сохранить изменения</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      function openCreateModal() {
        document.getElementById('createEmployeeModal').style.display = 'flex';
      }
      function closeCreateModal() {
        document.getElementById('createEmployeeModal').style.display = 'none';
      }

      function openEditModal(m) {
        document.getElementById('editModalTitle').textContent = 'Редактирование: ' + m.full_name;
        document.getElementById('editEmployeeForm').action = '/admin/team/' + m.id + '/update';
        document.getElementById('edit_full_name').value = m.full_name || '';
        document.getElementById('edit_login').value = m.login || '';
        document.getElementById('edit_email').value = m.email || '';
        document.getElementById('edit_phone').value = m.phone || '';
        document.getElementById('edit_telegram_user').value = m.telegram_user || '';

        const roles = m.roles || [];
        document.getElementById('edit_role_manager').checked = roles.includes('MANAGER');
        document.getElementById('edit_role_trainer').checked = roles.includes('TRAINER');
        document.getElementById('edit_can_answer_tickets_bot').checked = Boolean(m.can_answer_tickets_bot);

        if (m.is_owner) {
          document.getElementById('editRolesBlock').style.display = 'none';
          document.getElementById('editOwnerNotice').style.display = 'block';
        } else {
          document.getElementById('editRolesBlock').style.display = 'block';
          document.getElementById('editOwnerNotice').style.display = 'none';
        }

        document.getElementById('editEmployeeModal').style.display = 'flex';
      }

      function closeEditModal() {
        document.getElementById('editEmployeeModal').style.display = 'none';
      }

      window.addEventListener('click', function(e) {
        const createM = document.getElementById('createEmployeeModal');
        const editM = document.getElementById('editEmployeeModal');
        if (e.target === createM) closeCreateModal();
        if (e.target === editM) closeEditModal();
      });

      window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeCreateModal();
          closeEditModal();
        }
      });
    </script>
  `;

  res.send(renderLayout({
    title: 'Управление доступом',
    activeNav: 'team',
    admin: req.admin,
    content
  }));
});

// Вспомогательная функция извлечения Telegram ID / username
function parseTelegramUser(input) {
  let telegram_id = null;
  let telegram_username = null;
  if (input && typeof input === 'string' && input.trim()) {
    const clean = input.trim();
    if (/^\d+$/.test(clean)) {
      telegram_id = clean;
    } else {
      telegram_username = clean.replace(/^@/, '').trim();
    }
  }
  return { telegram_id, telegram_username };
}

// Создание сотрудника
router.post('/create', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const { full_name, login, email, phone, password, role_manager, role_trainer, can_answer_tickets_bot, telegram_user } = req.body;

  if (full_name && login && password) {
    const roles = [];
    if (role_manager) roles.push('MANAGER');
    if (role_trainer) roles.push('TRAINER');

    const { telegram_id, telegram_username } = parseTelegramUser(telegram_user);
    const botAccess = can_answer_tickets_bot ? 1 : 0;
    const cleanPhone = phone ? String(phone).trim() : null;
    const { hash, salt } = hashPassword(password);

    try {
      db.prepare(`
        INSERT INTO admin_users (login, email, phone, hashed_password, salt, full_name, is_owner, roles, can_answer_tickets_bot, telegram_id, telegram_username, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)
      `).run(login.trim(), email ? email.trim() : null, cleanPhone, hash, salt, full_name.trim(), JSON.stringify(roles), botAccess, telegram_id, telegram_username);

      logAudit(req.admin.id, req.admin.full_name, 'CREATE_ADMIN_USER', null, `Создан сотрудник ${login} (Бот: ${botAccess ? 'да' : 'нет'})`);
    } catch (err) {
      console.error('Ошибка создания сотрудника:', err);
    }
  }

  res.redirect('/admin/team');
});

// Редактирование сотрудника
router.post('/:id/update', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const id = req.params.id;
  const { full_name, login, email, phone, password, role_manager, role_trainer, can_answer_tickets_bot, telegram_user } = req.body;

  const target = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
  if (!target) return res.redirect('/admin/team');

  if (full_name && login) {
    const roles = [];
    if (role_manager) roles.push('MANAGER');
    if (role_trainer) roles.push('TRAINER');

    const { telegram_id, telegram_username } = parseTelegramUser(telegram_user);
    const botAccess = (can_answer_tickets_bot || target.is_owner) ? 1 : 0;
    const cleanPhone = phone ? String(phone).trim() : null;

    try {
      if (password && password.trim()) {
        const { hash, salt } = hashPassword(password.trim());
        if (target.is_owner) {
          db.prepare(`
            SET full_name = ?, login = ?, email = ?, phone = ?, hashed_password = ?, salt = ?, telegram_id = ?, telegram_username = ?
            WHERE id = ?
          `);
          db.prepare(`
            UPDATE admin_users 
            SET full_name = ?, login = ?, email = ?, phone = ?, hashed_password = ?, salt = ?, telegram_id = ?, telegram_username = ?
            WHERE id = ?
          `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, hash, salt, telegram_id, telegram_username, id);
        } else {
          db.prepare(`
            UPDATE admin_users 
            SET full_name = ?, login = ?, email = ?, phone = ?, hashed_password = ?, salt = ?, roles = ?, can_answer_tickets_bot = ?, telegram_id = ?, telegram_username = ?
            WHERE id = ?
          `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, hash, salt, JSON.stringify(roles), botAccess, telegram_id, telegram_username, id);
        }
      } else {
        if (target.is_owner) {
          db.prepare(`
            UPDATE admin_users 
            SET full_name = ?, login = ?, email = ?, phone = ?, telegram_id = ?, telegram_username = ?
            WHERE id = ?
          `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, telegram_id, telegram_username, id);
        } else {
          db.prepare(`
            UPDATE admin_users 
            SET full_name = ?, login = ?, email = ?, phone = ?, roles = ?, can_answer_tickets_bot = ?, telegram_id = ?, telegram_username = ?
            WHERE id = ?
          `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, JSON.stringify(roles), botAccess, telegram_id, telegram_username, id);
        }
      }

      logAudit(req.admin.id, req.admin.full_name, 'UPDATE_ADMIN_USER', null, `Обновлен сотрудник ID ${id}`);
    } catch (err) {
      console.error('Ошибка обновления сотрудника:', err);
    }
  }

  res.redirect('/admin/team');
});

// Включение / выключение сотрудника
router.post('/:id/toggle', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;
  const target = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);

  if (target && !target.is_owner) {
    const newStatus = target.is_active ? 0 : 1;
    db.prepare('UPDATE admin_users SET is_active = ? WHERE id = ?').run(newStatus, id);
    logAudit(req.admin.id, req.admin.full_name, newStatus ? 'ENABLE_ADMIN' : 'DISABLE_ADMIN', null, `Сотрудник ID ${id}`);
  }

  res.redirect('/admin/team');
});

// Удаление сотрудника
router.post('/:id/delete', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;
  const target = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);

  if (target && !target.is_owner) {
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
    logAudit(req.admin.id, req.admin.full_name, 'DELETE_ADMIN_USER', null, `Удален сотрудник ${target.full_name} (ID ${id})`);
  }

  res.redirect('/admin/team');
});

export default router;