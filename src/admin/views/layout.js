import db from '../../db/database.js';

/**
 * Базовый мастер-шаблон админ-панели VS Dogs
 */
export function renderLayout({ title, activeNav, admin, content, alert = null }) {
  const isOwner = Boolean(admin?.is_owner);
  const roles = admin?.roles || [];
  
  // Роль Менеджер видит ТОЛЬКО Клиенты и Оплаты (если не Владелец)
  const isManagerOnly = !isOwner && roles.includes('MANAGER');
  const hasTrainer = isOwner || (!isManagerOnly && roles.includes('TRAINER'));

  // Двухуровневый счетчик тикетов: закрепленные неотвеченные за сотрудником / новые ничейные
  let ticketBadgeText = '';
  if (hasTrainer && admin?.id) {
    try {
      const myCount = db.prepare(`
        SELECT COUNT(*) as c FROM trainer_tickets 
        WHERE assigned_trainer_id = ? AND status = 'in_progress'
      `).get(admin.id)?.c || 0;

      const newCount = db.prepare(`
        SELECT COUNT(*) as c FROM trainer_tickets 
        WHERE (assigned_trainer_id IS NULL OR status = 'new') AND status != 'answered' AND status != 'closed'
      `).get()?.c || 0;

      ticketBadgeText = `${myCount}/${newCount}`;
    } catch (err) {
      ticketBadgeText = '0/0';
    }
  }

  // Ролевые бейджи
  const roleBadges = [];
  if (isOwner) {
    roleBadges.push('<span class="role-badge role-owner">Владелец</span>');
  }
  if (roles.includes('MANAGER')) {
    roleBadges.push('<span class="role-badge role-manager">Менеджер</span>');
  }
  if (roles.includes('TRAINER')) {
    roleBadges.push('<span class="role-badge role-trainer">Кинолог</span>');
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} | VS Dogs Backoffice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #f8fafc;
      --sidebar-bg: #0f172a;
      --sidebar-hover: #1e293b;
      --sidebar-active: #2563eb;
      --card-bg: #ffffff;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success-bg: #dcfce7;
      --success-text: #166534;
      --warning-bg: #fef3c7;
      --warning-text: #92400e;
      --danger-bg: #fee2e2;
      --danger-text: #991b1b;
      --purple-bg: #f3e8ff;
      --purple-text: #6b21a8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      display: flex;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* Сайдбар */
    .sidebar {
      width: 260px;
      background-color: var(--sidebar-bg);
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      border-right: 1px solid #1e293b;
      transition: transform 0.25s ease-in-out;
    }

    .brand {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #1e293b;
    }

    .brand-icon {
      font-size: 24px;
      background: #1e293b;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      border: 1px solid #334155;
    }

    .brand-info h1 {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .brand-info p {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }

    .nav-section {
      padding: 16px 12px;
      flex: 1;
      overflow-y: auto;
    }

    .nav-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
      padding: 8px 12px 6px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      color: #cbd5e1;
      text-decoration: none;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 500;
      margin-bottom: 3px;
      transition: all 0.15s ease;
    }

    .nav-link:hover {
      background-color: var(--sidebar-hover);
      color: #ffffff;
    }

    .nav-link.active {
      background-color: var(--sidebar-active);
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }

    .nav-badge {
      margin-left: auto;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      background: #dc2626;
      color: #ffffff;
      letter-spacing: 0.03em;
      transition: transform 0.2s, background-color 0.2s;
    }

    .badge-pulse {
      animation: badgePulseAnim 1.2s ease-in-out infinite;
    }

    @keyframes badgePulseAnim {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
      50% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
    }

    /* Профиль внизу сайдбара */
    .user-footer {
      padding: 16px;
      border-top: 1px solid #1e293b;
      background-color: #0b1120;
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #3b82f6;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }

    .user-meta {
      overflow: hidden;
      flex: 1;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .role-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }

    .role-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .role-owner { background: #7c3aed; color: #ffffff; }
    .role-manager { background: #0284c7; color: #ffffff; }
    .role-trainer { background: #059669; color: #ffffff; }

    .logout-btn {
      color: #64748b;
      text-decoration: none;
      font-size: 18px;
      padding: 6px;
      transition: color 0.15s;
    }
    .logout-btn:hover { color: #ef4444; }

    /* Основная область */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      min-width: 0;
    }

    .top-header {
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .mobile-menu-btn {
      display: none;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 20px;
      cursor: pointer;
      color: var(--text-main);
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }

    .content-container {
      padding: 32px;
      flex: 1;
    }

    /* Карточки */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border-color);
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }

    /* Таблицы */
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13.5px;
      min-width: 500px;
    }

    th {
      background: #f8fafc;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
      vertical-align: middle;
    }

    tr:hover td {
      background-color: #f8fafc;
    }

    /* Статусы и бейджи */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-paid { background: var(--success-bg); color: var(--success-text); }
    .badge-free { background: #f1f5f9; color: #475569; }
    .badge-lifetime { background: var(--purple-bg); color: var(--purple-text); }
    .badge-expiring { background: var(--warning-bg); color: var(--warning-text); }
    .badge-expired { background: var(--danger-bg); color: var(--danger-text); }

    /* Кнопки */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      text-decoration: none;
      transition: all 0.15s ease;
      min-height: 38px;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    .btn-secondary {
      background: #ffffff;
      color: var(--text-main);
      border-color: var(--border-color);
    }
    .btn-secondary:hover { background: #f1f5f9; }

    .btn-danger {
      background: #fee2e2;
      color: #991b1b;
    }
    .btn-danger:hover { background: #fecaca; }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
      min-height: 32px;
      border-radius: 6px;
    }

    /* Поля ввода */
    .form-group {
      margin-bottom: 16px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text-main);
    }
    .form-control {
      width: 100%;
      padding: 10px 13px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: var(--text-main);
      background: #ffffff;
      transition: border-color 0.15s;
    }
    .form-control:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    /* Пагинация */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
      font-size: 13px;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 12px;
    }
    .pagination-links {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .page-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      background: #ffffff;
      color: var(--text-main);
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12.5px;
    }
    .page-btn.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }
    .page-btn:hover:not(.active) {
      background: #f1f5f9;
    }

    /* Алерты */
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13.5px;
      font-weight: 500;
    }
    .alert-success { background: var(--success-bg); color: var(--success-text); border: 1px solid #bbf7d0; }
    .alert-danger { background: var(--danger-bg); color: var(--danger-text); border: 1px solid #fecaca; }

    /* Тосты (уведомления в реальном времени) */
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .toast {
      background: #0f172a;
      color: #ffffff;
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      max-width: 320px;
      pointer-events: auto;
      transition: opacity 0.3s, transform 0.3s;
      border-left: 4px solid var(--primary);
      animation: toastSlideIn 0.3s ease forwards;
    }
    .toast-success { border-left-color: #22c55e; }
    .toast-info { border-left-color: #3b82f6; }
    .toast.hide { opacity: 0; transform: translateY(10px); }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Подложка мобильного сайдбара */
    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      z-index: 998;
      opacity: 0;
      transition: opacity 0.25s ease;
    }

    /* Адаптивность для мобильных устройств */
    @media (max-width: 768px) {
      body {
        position: relative;
      }

      .mobile-menu-btn {
        display: flex;
      }

      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 280px;
        z-index: 1000;
        transform: translateX(-100%);
        box-shadow: 5px 0 25px rgba(0, 0, 0, 0.3);
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .sidebar-backdrop.active {
        display: block;
        opacity: 1;
      }

      .top-header {
        padding: 12px 16px;
      }

      .page-title {
        font-size: 18px;
      }

      .content-container {
        padding: 16px;
      }

      .card {
        padding: 16px;
        border-radius: 10px;
        margin-bottom: 16px;
      }

      /* Сетка в одну колонку на мобильных */
      .grid-two-cols,
      [style*="grid-template-columns: 1fr 380px"],
      [style*="grid-template-columns: 1fr 1fr"] {
        grid-template-columns: 1fr !important;
        gap: 16px !important;
      }

      .toast-container {
        left: 16px;
        right: 16px;
        bottom: 16px;
      }
      .toast {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <!-- Затемнение для мобильного сайдбара -->
  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

  <!-- Сайдбар -->
  <aside class="sidebar" id="adminSidebar">
    <div class="brand">
      <div class="brand-icon">🐶</div>
      <div class="brand-info">
        <h1>VS Dogs</h1>
        <p>Панель управления</p>
      </div>
    </div>

    <nav class="nav-section">
      ${isOwner ? `
        <div class="nav-title">Основное</div>
        <a href="/admin" class="nav-link ${activeNav === 'dashboard' ? 'active' : ''}">
          <span>📊</span> Дашборд
        </a>
        <a href="/admin/users" class="nav-link ${activeNav === 'users' ? 'active' : ''}">
          <span>👥</span> Клиенты
        </a>
        <a href="/admin/payments" class="nav-link ${activeNav === 'payments' ? 'active' : ''}">
          <span>💳</span> Оплаты
        </a>

        <div class="nav-title">Обучение & Поддержка</div>
        <a href="/admin/tickets" class="nav-link ${activeNav === 'tickets' ? 'active' : ''}">
          <span>💬</span> Вопросы к кинологу
          <span class="nav-badge" id="ticketsBadge" title="Закреплено за вами / Новые ничейные">${ticketBadgeText}</span>
        </a>

        <div class="nav-title">Тарифы & Маркетинг</div>
        <a href="/admin/tariffs" class="nav-link ${activeNav === 'tariffs' ? 'active' : ''}">
          <span>📋</span> Тарифы
        </a>
        <a href="/admin/broadcasts" class="nav-link ${activeNav === 'broadcasts' ? 'active' : ''}">
          <span>📢</span> Рассылки в Telegram
        </a>

        <div class="nav-title">Система</div>
        <a href="/admin/team" class="nav-link ${activeNav === 'team' ? 'active' : ''}">
          <span>🛡️</span> Команда & Доступы
        </a>
        <a href="/admin/system" class="nav-link ${activeNav === 'system' ? 'active' : ''}">
          <span>📜</span> Логи & Копия базы
        </a>
      ` : (isManagerOnly ? `
        <!-- Сотрудник с ролью "Менеджер" видит только "Клиенты" и "Оплаты" -->
        <div class="nav-title">Менеджер</div>
        <a href="/admin/users" class="nav-link ${activeNav === 'users' ? 'active' : ''}">
          <span>👥</span> Клиенты
        </a>
        <a href="/admin/payments" class="nav-link ${activeNav === 'payments' ? 'active' : ''}">
          <span>💳</span> Оплаты
        </a>
      ` : `
        <!-- Кинолог -->
        <div class="nav-title">Обучение & Поддержка</div>
        <a href="/admin/tickets" class="nav-link ${activeNav === 'tickets' ? 'active' : ''}">
          <span>💬</span> Вопросы к кинологу
          <span class="nav-badge" id="ticketsBadge" title="Закреплено за вами / Новые ничейные">${ticketBadgeText}</span>
        </a>
      `)}
    </nav>

    <!-- Подвал пользователя -->
    <div class="user-footer">
      <div class="user-card">
        <div class="avatar">${admin?.full_name ? admin.full_name[0] : 'U'}</div>
        <div class="user-meta">
          <div class="user-name">${admin?.full_name || 'Сотрудник'}</div>
          <div class="role-badges">
            ${roleBadges.join('')}
          </div>
        </div>
        <a href="/admin/logout" class="logout-btn" title="Выйти из системы">↪</a>
      </div>
    </div>
  </aside>

  <!-- Рабочая зона -->
  <div class="main-wrapper">
    <header class="top-header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <button type="button" class="mobile-menu-btn" id="menuToggleBtn" title="Меню">☰</button>
        <h2 class="page-title">${title}</h2>
      </div>
      <div style="font-size: 13px; color: var(--text-muted);">
        Школа дрессировки Дарьи Сахаровой
      </div>
    </header>

    <main class="content-container">
      ${alert ? `<div class="alert alert-${alert.type}">${alert.message}</div>` : ''}
      ${content}
    </main>
  </div>

  <!-- Контейнер для real-time уведомлений -->
  <div id="adminToastContainer" class="toast-container"></div>

  <!-- Глобальный скрипт: Мобильное меню + Realtime SSE Автообновление -->
  <script>
    (function() {
      // 1. Управление мобильным сайдбаром
      const toggleBtn = document.getElementById('menuToggleBtn');
      const sidebar = document.getElementById('adminSidebar');
      const backdrop = document.getElementById('sidebarBackdrop');

      if (toggleBtn && sidebar && backdrop) {
        function openSidebar() {
          sidebar.classList.add('open');
          backdrop.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
        function closeSidebar() {
          sidebar.classList.remove('open');
          backdrop.classList.remove('active');
          document.body.style.overflow = '';
        }
        toggleBtn.addEventListener('click', openSidebar);
        backdrop.addEventListener('click', closeSidebar);
      }

      // 2. Всплывающие уведомления (Toasts)
      function showToast(message, type) {
        const container = document.getElementById('adminToastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');
        toast.innerHTML = message;
        container.appendChild(toast);
        setTimeout(function() {
          toast.classList.add('hide');
          setTimeout(function() { toast.remove(); }, 350);
        }, 4000);
      }

      // 3. Автообновление в реальном времени (Server-Sent Events)
      if (window.EventSource) {
        try {
          var evtSource = new EventSource('/admin/api/events');

          evtSource.onmessage = function(e) {
            try {
              var data = JSON.parse(e.data);

              if (data.type === 'connected') {
                var badge = document.getElementById('ticketsBadge');
                if (badge && data.payload && data.payload.ticketBadgeText) {
                  badge.textContent = data.payload.ticketBadgeText;
                }
              } else if (data.type === 'update') {
                var p = data.payload || {};
                var badge = document.getElementById('ticketsBadge');
                if (badge && p.badges && p.badges.ticketBadgeText) {
                  if (badge.textContent !== p.badges.ticketBadgeText) {
                    badge.textContent = p.badges.ticketBadgeText;
                    badge.classList.remove('badge-pulse');
                    void badge.offsetWidth; // reflow
                    badge.classList.add('badge-pulse');
                  }
                }

                if (p.ticketsChanged) {
                  showToast('💬 <b>Вопросы к кинологу</b><br>Поступил новый вопрос или изменился статус!', 'info');
                }
                if (p.usersChanged) {
                  showToast('👤 <b>Клиенты</b><br>Зарегистрирован новый пользователь или обновлен профиль!', 'success');
                }
                if (p.paymentsChanged) {
                  showToast('💳 <b>Оплаты</b><br>Зафиксирована новая оплата!', 'success');
                }

                // Интеллектуальное бесшовное обновление текущей страницы
                var path = window.location.pathname;
                var activeElem = document.activeElement;
                var isTyping = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'SELECT');

                var shouldRefresh = (
                  (p.ticketsChanged && path.indexOf('/tickets') !== -1) ||
                  (p.usersChanged && (path === '/admin/users' || path === '/admin/users/')) ||
                  (p.paymentsChanged && path.indexOf('/payments') !== -1) ||
                  ((p.ticketsChanged || p.paymentsChanged || p.usersChanged) && (path === '/admin' || path === '/admin/'))
                );

                if (shouldRefresh && !isTyping) {
                  fetch(window.location.href, { headers: { 'X-Requested-With': 'LiveUpdate' } })
                    .then(function(res) { return res.text(); })
                    .then(function(html) {
                      var parser = new DOMParser();
                      var doc = parser.parseFromString(html, 'text/html');
                      var newContent = doc.querySelector('.content-container');
                      var curContent = document.querySelector('.content-container');
                      if (newContent && curContent) {
                        curContent.innerHTML = newContent.innerHTML;
                      }
                    })
                    .catch(function() {});
                }
              }
            } catch (err) {}
          };
        } catch (err) {}
      }
    })();
  </script>

</body>
</html>
`;
}
