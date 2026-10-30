import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireOwner, hashPassword, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';

const router = express.Router();

router.get('/', requireAuth, requireOwner, (req, res) => {
  const team = db.prepare(`
    SELECT id, login, email, full_name, is_owner, roles, can_answer_tickets_bot, telegram_id, telegram_username, is_active, last_login_at, created_at
    FROM admin_users 
    ORDER BY is_owner DESC, id ASC
  `).all();

  const editId = req.query.edit;
  let editingMember = null;
  if (editId) {
    editingMember = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(editId);
  }

  let editingRoles = [];
  if (editingMember) {
    try {
      editingRoles = JSON.parse(editingMember.roles || '[]');
    } catch {
      editingRoles = [];
    }
  }

  const content = `
    <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px;">
      
      <!-- Список сотрудников -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Команда и уровни доступа</h3>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
              Управление учетными записями сотрудников школы (доступно только Владельцу)
            </p>
          </div>
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

                return `
                  <tr ${editingMember?.id === m.id ? 'style="background: #eff6ff;"' : ''}>
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
                          <a href="/admin/team?edit=${m.id}" class="btn btn-secondary btn-sm">Изменить</a>
                          <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">Главный аккаунт</span>
                        </div>
                      ` : `
                        <div style="display: flex; gap: 6px; align-items: center;">
                          <a href="/admin/team?edit=${m.id}" class="btn btn-secondary btn-sm">Изменить</a>
                          <form method="POST" action="/admin/team/${m.id}/toggle" style="display: inline;">
                            <button type="submit" class="btn btn-sm ${m.is_active ? 'btn-danger' : 'btn-secondary'}">
                              ${m.is_active ? 'Откл' : 'Вкл'}
                            </button>
                          </form>
                          <form method="POST" action="/admin/team/${m.id}/delete" onsubmit="return confirm('Вы действительно хотите удалить сотрудника ${m.full_name}?');" style="display: inline;">
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

      <!-- Форма создания / редактирования -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${editingMember ? `Редактирование: ${editingMember.full_name}` : 'Добавить сотрудника'}</h3>
          ${editingMember ? '<a href="/admin/team" class="btn btn-secondary btn-sm">Отмена</a>' : ''}
        </div>

        <form method="POST" action="${editingMember ? `/admin/team/${editingMember.id}/update` : '/admin/team/create'}">
          <div class="form-group">
            <label class="form-label">ФИО сотрудника</label>
            <input type="text" name="full_name" class="form-control" required value="${editingMember?.full_name || ''}" placeholder="Мария Иванова">
          </div>

          <div class="form-group">
            <label class="form-label">Логин для входа</label>
            <input type="text" name="login" class="form-control" required value="${editingMember?.login || ''}" placeholder="maria_trainer">
          </div>

          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-control" value="${editingMember?.email || ''}" placeholder="maria@vsdogs.ru">
          </div>

          <div class="form-group">
            <label class="form-label">Номер телефона сотрудника</label>
            <input type="text" name="phone" class="form-control" value="${editingMember?.phone || ''}" placeholder="+7 999 123-45-67">
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
              Необходим для входа в бот «Тикет-центр» по кнопке «Поделиться контактом»
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">${editingMember ? 'Новый пароль (оставьте пустым, если не меняется)' : 'Пароль'}</label>
            <input type="password" name="password" class="form-control" ${editingMember ? '' : 'required'} placeholder="Минимум 6 символов">
          </div>

          <div class="form-group">
            <label class="form-label">Telegram сотрудника (@username или числовой ID)</label>
            <input type="text" name="telegram_user" class="form-control" value="${editingMember?.telegram_username ? '@' + editingMember.telegram_username : (editingMember?.telegram_id || '')}" placeholder="@maria_trainer или 123456789">
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
              Необходим боту кинологов для распознавания сотрудника
            </p>
          </div>

          ${editingMember?.is_owner ? `
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              Роль Владельца не подлежит изменению. Доступ к Telegram-боту кинологов включен всегда.
            </div>
          ` : `
            <div class="form-group" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
              <label class="form-label" style="margin-bottom: 8px;">Назначение ролей (можно выбрать обе):</label>
              
              <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                  <input type="checkbox" name="role_manager" value="1" ${editingRoles.includes('MANAGER') ? 'checked' : ''}>
                  <span><strong>Менеджер</strong> — клиенты, лицензии, тарифы и оплаты</span>
                </label>
              </div>

              <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                  <input type="checkbox" name="role_trainer" value="1" ${editingRoles.includes('TRAINER') || !editingMember ? 'checked' : ''}>
                  <span><strong>Кинолог</strong> — ответы на вопросы учеников (тикеты)</span>
                </label>
              </div>

              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                  <input type="checkbox" name="can_answer_tickets_bot" value="1" ${(editingMember?.can_answer_tickets_bot === 1 || editingMember?.is_owner || (!editingMember)) ? 'checked' : ''}>
                  <span><strong>Доступ к боту для ответов</strong> — разрешить отвечать на тикеты в Telegram</span>
                </label>
              </div>
            </div>
          `}

          <button type="submit" class="btn btn-primary" style="width: 100%;">
            ${editingMember ? 'Сохранить изменения' : 'Создать учетную запись'}
          </button>
        </form>
      </div>

    </div>
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

      logAudit(req.admin.id, req.admin.full_name, 'CREATE_ADMIN_USER', null, `Создан сотрудник ${login} (Бот: ${botAccess ? 'да' : 'нет'})`, req.ip);
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

  const roles = [];
  if (role_manager) roles.push('MANAGER');
  if (role_trainer) roles.push('TRAINER');

  const { telegram_id, telegram_username } = parseTelegramUser(telegram_user);
  const cleanPhone = phone ? String(phone).trim() : null;

  if (target.is_owner) {
    // Для владельца обновляем ФИО, логин, email, телефон, telegram-аккаунт, пароль (доступ к боту всегда 1)
    if (password && password.trim()) {
      const { hash, salt } = hashPassword(password);
      db.prepare(`
        UPDATE admin_users 
        SET full_name = ?, login = ?, email = ?, phone = ?, hashed_password = ?, salt = ?, can_answer_tickets_bot = 1, telegram_id = ?, telegram_username = ?
        WHERE id = ?
      `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, hash, salt, telegram_id, telegram_username, id);
    } else {
      db.prepare(`
        UPDATE admin_users 
        SET full_name = ?, login = ?, email = ?, phone = ?, can_answer_tickets_bot = 1, telegram_id = ?, telegram_username = ?
        WHERE id = ?
      `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, telegram_id, telegram_username, id);
    }
  } else {
    const botAccess = can_answer_tickets_bot ? 1 : 0;
    if (password && password.trim()) {
      const { hash, salt } = hashPassword(password);
      db.prepare(`
        UPDATE admin_users 
        SET full_name = ?, login = ?, email = ?, phone = ?, hashed_password = ?, salt = ?, roles = ?, can_answer_tickets_bot = ?, telegram_id = ?, telegram_username = ?
        WHERE id = ?
      `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, hash, salt, JSON.stringify(roles), botAccess, telegram_id, telegram_username, id);
    } else {
      db.prepare(`
        UPDATE admin_users 
        SET full_name = ?, login = ?, email = ?, phone = ?, roles = ?, can_answer_tickets_bot = ?, telegram_id = ?, telegram_username = ?
        WHERE id = ?
      `).run(full_name.trim(), login.trim(), email ? email.trim() : null, cleanPhone, JSON.stringify(roles), botAccess, telegram_id, telegram_username, id);
    }
  }

  logAudit(req.admin.id, req.admin.full_name, 'UPDATE_ADMIN_USER', null, `Обновлен сотрудник ID ${id}`, req.ip);
  res.redirect('/admin/team');
});

// Включение / выключение
router.post('/:id/toggle', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;
  const target = db.prepare('SELECT is_owner, is_active FROM admin_users WHERE id = ?').get(id);

  if (target && !target.is_owner) {
    const newStatus = target.is_active ? 0 : 1;
    db.prepare('UPDATE admin_users SET is_active = ? WHERE id = ?').run(newStatus, id);
    logAudit(req.admin.id, req.admin.full_name, newStatus ? 'ENABLE_ADMIN' : 'DISABLE_ADMIN', null, `Сотрудник ID ${id}`, req.ip);
  }

  res.redirect('/admin/team');
});

// Удаление сотрудника
router.post('/:id/delete', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;
  const target = db.prepare('SELECT is_owner, full_name FROM admin_users WHERE id = ?').get(id);

  if (target && !target.is_owner) {
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
    logAudit(req.admin.id, req.admin.full_name, 'DELETE_ADMIN_USER', null, `Удален сотрудник ${target.full_name} (ID ${id})`, req.ip);
  }

  res.redirect('/admin/team');
});

export default router;
