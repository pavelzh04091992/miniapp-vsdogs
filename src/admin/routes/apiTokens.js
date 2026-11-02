import express from 'express';
import { requireAuth, requireOwner, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';
import { 
  createApiToken, 
  listApiTokens, 
  revokeApiToken, 
  activateApiToken, 
  deleteApiToken 
} from '../services/apiTokenService.js';

const router = express.Router();

/**
 * Страница управления API-токенами
 */
router.get('/', requireAuth, requireOwner, (req, res) => {
  const tokens = listApiTokens();
  const newToken = req.query.new_token || null;
  const newTokenName = req.query.name || '';

  const content = `
    ${newToken ? `
      <div class="card" style="background: #f0fdf4; border: 1.5px solid #86efac; margin-bottom: 24px; padding: 20px;">
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <div style="font-size: 24px;">🔑</div>
          <div style="flex: 1;">
            <h4 style="color: #166534; font-size: 15px; font-weight: 700; margin-bottom: 4px;">
              Новый API-токен успешно создан (${newTokenName || 'без названия'})!
            </h4>
            <p style="font-size: 13px; color: #15803d; margin-bottom: 12px;">
              Скопируйте токен прямо сейчас. В целях безопасности он больше не будет показываться целиком.
            </p>
            <div style="display: flex; gap: 10px; align-items: center; max-width: 650px;">
              <input type="text" id="newTokenInput" value="${newToken}" readonly class="form-control" 
                style="font-family: monospace; font-size: 13px; background: #fff; font-weight: 600; color: #0f172a; border-color: #86efac;">
              <button type="button" class="btn btn-primary" onclick="navigator.clipboard.writeText('${newToken}'); this.innerText = 'Скопировано!'; setTimeout(() => this.innerText = 'Скопировать', 2000);">
                Скопировать
              </button>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px;" class="grid-two-cols">
      
      <!-- Список токенов -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 class="card-title">Выпущенные API-токены</h3>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
              Токены для интеграции мобильного приложения, CRM и сервисов сотрудников
            </p>
          </div>
          <div>
            <a href="/api/docs" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              <span>📘</span> Документация API ↗
            </a>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Название / Токен</th>
                <th>Создатель</th>
                <th>Посл. активность</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${tokens.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Активных API-токенов пока нет. Создайте первый токен в форме справа.
                  </td>
                </tr>
              ` : tokens.map(t => {
                const maskedToken = t.token.length > 18 
                  ? `${t.token.substring(0, 10)}...${t.token.substring(t.token.length - 6)}`
                  : t.token;

                return `
                  <tr>
                    <td>
                      <strong>${t.name}</strong><br>
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                        <code style="font-size: 11.5px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #0284c7;">${maskedToken}</code>
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 10px;" 
                          onclick="navigator.clipboard.writeText('${t.token}'); this.innerText = '✓'; setTimeout(() => this.innerText = 'копия', 1500);" title="Скопировать токен">
                          копия
                        </button>
                      </div>
                    </td>
                    <td style="font-size: 12.5px;">
                      ${t.created_by_name || 'Владелец'}<br>
                      <span style="font-size: 11px; color: var(--text-muted);">${t.created_at || '—'}</span>
                    </td>
                    <td style="font-size: 12px; color: var(--text-muted);">
                      ${t.last_used_at ? t.last_used_at : 'Никогда'}
                    </td>
                    <td>
                      <span class="badge ${t.is_active ? 'badge-paid' : 'badge-expired'}">
                        ${t.is_active ? 'Активен' : 'Отозван'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <form method="POST" action="/admin/api-tokens/${t.id}/toggle" style="display: inline;">
                          <button type="submit" class="btn btn-secondary btn-sm" title="${t.is_active ? 'Отозвать токен' : 'Активировать токен'}">
                            ${t.is_active ? 'Отозвать' : 'Вкл'}
                          </button>
                        </form>
                        <form method="POST" action="/admin/api-tokens/${t.id}/delete" style="display: inline;" 
                          onsubmit="return confirm('Вы действительно хотите удалить этот API-токен? Приложения, использующие его, потеряют доступ к API.');">
                          <button type="submit" class="btn btn-danger btn-sm">Удалить</button>
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

      <!-- Форма создания нового токена -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Выпустить токен доступа</h3>
        </div>

        <form method="POST" action="/admin/api-tokens/create">
          <div class="form-group">
            <label class="form-label">Название / Назначение токена</label>
            <input type="text" name="name" class="form-control" required placeholder="например: Приложение Дарьи Сахаровой">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              Понятное имя для идентификации приложения или сотрудника
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Уровень прав доступа</label>
            <select name="permissions" class="form-control">
              <option value="all">Полный доступ (Чтение учеников и оплат)</option>
              <option value="read_only">Только чтение клиентов</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 10px;">
            🔑 Сгенерировать API-токен
          </button>
        </form>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text-main);">Быстрый запрос</h4>
          <pre style="font-size: 11px; background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace;">curl https://admin.miniapp-vsdogs.ru/api/v1/clients \\
  -H "Authorization: Bearer YOUR_TOKEN"</pre>
          <a href="/api/docs" target="_blank" style="display: block; font-size: 12px; color: var(--primary); text-decoration: none; margin-top: 8px; font-weight: 600;">
            Открыть интерактивное руководство по API →
          </a>
        </div>
      </div>

    </div>
  `;

  res.send(renderLayout({
    title: 'API & Токены доступа',
    activeNav: 'api_tokens',
    admin: req.admin,
    content
  }));
});

/**
 * Создание токена
 */
router.post('/create', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const { name, permissions } = req.body;
  if (name && name.trim()) {
    try {
      const created = createApiToken({
        name: name.trim(),
        adminId: req.admin.id,
        permissions: permissions || 'all'
      });

      logAudit(req.admin.id, req.admin.full_name, 'CREATE_API_TOKEN', null, `Создан API-токен: ${created.name}`);

      return res.redirect(`/admin/api-tokens?new_token=${encodeURIComponent(created.token)}&name=${encodeURIComponent(created.name)}`);
    } catch (err) {
      console.error('Ошибка создания токена:', err);
    }
  }

  res.redirect('/admin/api-tokens');
});

/**
 * Переключение статуса токена (активен / отозван)
 */
router.post('/:id/toggle', requireAuth, requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const tokens = listApiTokens();
    const token = tokens.find(t => t.id === id);
    if (token) {
      if (token.is_active) {
        revokeApiToken(id);
        logAudit(req.admin.id, req.admin.full_name, 'REVOKE_API_TOKEN', null, `Отозван API-токен: ${token.name}`);
      } else {
        activateApiToken(id);
        logAudit(req.admin.id, req.admin.full_name, 'ACTIVATE_API_TOKEN', null, `Активирован API-токен: ${token.name}`);
      }
    }
  } catch (err) {
    console.error('Ошибка переключения статуса токена:', err);
  }

  res.redirect('/admin/api-tokens');
});

/**
 * Удаление токена
 */
router.post('/:id/delete', requireAuth, requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const tokens = listApiTokens();
    const token = tokens.find(t => t.id === id);
    if (token) {
      deleteApiToken(id);
      logAudit(req.admin.id, req.admin.full_name, 'DELETE_API_TOKEN', null, `Удален API-токен: ${token.name}`);
    }
  } catch (err) {
    console.error('Ошибка удаления токена:', err);
  }

  res.redirect('/admin/api-tokens');
});

export default router;
