import express from 'express';
import db from '../../db/database.js';
import { requireAuth, requireOwner, logAudit } from '../auth.js';
import { renderLayout } from '../views/layout.js';

const router = express.Router();

// Список тарифов и форма редактирования (только Владелец)
router.get('/', requireAuth, requireOwner, (req, res) => {
  const tariffs = db.prepare('SELECT * FROM tariffs ORDER BY order_index ASC, price ASC').all();
  const editId = req.query.edit;
  let editingTariff = null;

  if (editId) {
    editingTariff = db.prepare('SELECT * FROM tariffs WHERE id = ?').get(editId);
  }

  const content = `
    <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px;" class="grid-two-cols">
      
      <!-- Список существующих тарифов -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Тарифные планы</h3>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
              Управление стоимостью, сроками действия и описанием тарифов
            </p>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Идентификатор / Название</th>
                <th>Стоимость</th>
                <th>Срок</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${tariffs.map(t => `
                <tr ${editingTariff?.id === t.id ? 'style="background: #eff6ff;"' : ''}>
                  <td>
                    <strong>${t.name}</strong><br>
                    <code style="font-size: 11px; color: var(--text-muted);">${t.id}</code>
                    ${t.description ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${t.description}</div>` : ''}
                  </td>
                  <td style="font-weight: 700; color: #166534; font-size: 14px;">
                    ${t.price > 0 ? `${t.price.toLocaleString('ru-RU')} ₽` : 'Бесплатно'}
                  </td>
                  <td>
                    ${t.period_months === 0 ? 'Без ограничений' : (t.period_months === 999 ? 'Бессрочно' : `${t.period_months} мес. (${t.duration_days} дн.)`)}
                  </td>
                  <td>
                    <span class="badge ${t.is_active ? 'badge-paid' : 'badge-expired'}">
                      ${t.is_active ? 'Активен' : 'Отключен'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <a href="/admin/tariffs?edit=${t.id}" class="btn btn-secondary btn-sm">Изменить</a>
                      <form method="POST" action="/admin/tariffs/${t.id}/toggle" style="display: inline;">
                        <button type="submit" class="btn btn-sm ${t.is_active ? 'btn-danger' : 'btn-secondary'}">
                          ${t.is_active ? 'Выкл' : 'Вкл'}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Форма создания / редактирования -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${editingTariff ? `Редактирование: ${editingTariff.name}` : 'Добавить новый тариф'}</h3>
          ${editingTariff ? '<a href="/admin/tariffs" class="btn btn-secondary btn-sm">Отмена</a>' : ''}
        </div>

        <form method="POST" action="${editingTariff ? `/admin/tariffs/${editingTariff.id}/update` : '/admin/tariffs/create'}">
          <div class="form-group">
            <label class="form-label">Название тарифа</label>
            <input type="text" name="name" class="form-control" required value="${editingTariff?.name || ''}" placeholder="например: 1 год обучения">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Стоимость (₽)</label>
              <input type="number" name="price" class="form-control" required value="${editingTariff?.price ?? 2900}" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Период (месяцев)</label>
              <input type="number" name="period_months" class="form-control" required value="${editingTariff?.period_months ?? 1}" min="0">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Длительность в днях</label>
            <input type="number" name="duration_days" class="form-control" required value="${editingTariff?.duration_days ?? 30}" min="0">
          </div>

          <div class="form-group">
            <label class="form-label">Описание тарифа</label>
            <textarea name="description" rows="3" class="form-control" placeholder="Что входит в тариф...">${editingTariff?.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Порядок отображения</label>
            <input type="number" name="order_index" class="form-control" value="${editingTariff?.order_index ?? 10}">
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%;">
            ${editingTariff ? 'Сохранить изменения' : 'Создать тариф'}
          </button>
        </form>
      </div>

    </div>
  `;

  res.send(renderLayout({
    title: 'Тарифные планы',
    activeNav: 'tariffs',
    admin: req.admin,
    content
  }));
});

// Создание тарифа (ID генерируется автоматически)
router.post('/create', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const { name, price, period_months, duration_days, description, order_index } = req.body;

  if (name && name.trim()) {
    try {
      const id = `tariff_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      db.prepare(`
        INSERT INTO tariffs (id, name, price, period_months, duration_days, description, is_active, order_index)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        id,
        name.trim(),
        Number(price) || 0,
        Number(period_months) || 1,
        Number(duration_days) || 30,
        description ? description.trim() : null,
        Number(order_index) || 0
      );

      logAudit(req.admin.id, req.admin.full_name, 'CREATE_TARIFF', null, `Создан тариф ${id} (${name.trim()}): ${price} руб`);
    } catch (err) {
      console.error('Ошибка создания тарифа:', err);
    }
  }

  res.redirect('/admin/tariffs');
});

// Обновление существующего тарифа
router.post('/:id/update', requireAuth, requireOwner, express.urlencoded({ extended: false }), (req, res) => {
  const id = req.params.id;
  const { name, price, period_months, duration_days, description, order_index } = req.body;

  if (name) {
    db.prepare(`
      UPDATE tariffs 
      SET name = ?, price = ?, period_months = ?, duration_days = ?, description = ?, order_index = ?
      WHERE id = ?
    `).run(
      name.trim(),
      Number(price) || 0,
      Number(period_months) || 1,
      Number(duration_days) || 30,
      description ? description.trim() : null,
      Number(order_index) || 0,
      id
    );

    logAudit(req.admin.id, req.admin.full_name, 'UPDATE_TARIFF', null, `Обновлен тариф ${id}: ${price} руб`);
  }

  res.redirect('/admin/tariffs');
});

// Переключение активности тарифа
router.post('/:id/toggle', requireAuth, requireOwner, (req, res) => {
  const id = req.params.id;
  const t = db.prepare('SELECT is_active FROM tariffs WHERE id = ?').get(id);
  if (t) {
    const newStatus = t.is_active ? 0 : 1;
    db.prepare('UPDATE tariffs SET is_active = ? WHERE id = ?').run(newStatus, id);
    logAudit(req.admin.id, req.admin.full_name, 'TOGGLE_TARIFF', null, `Тариф ${id} статус: ${newStatus}`);
  }
  res.redirect('/admin/tariffs');
});

export default router;