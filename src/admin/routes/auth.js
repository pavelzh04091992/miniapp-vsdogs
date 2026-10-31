import express from 'express';
import db from '../../db/database.js';
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, logAudit } from '../auth.js';

const router = express.Router();

// Страница входа в админку
router.get('/login', (req, res) => {
  if (req.admin) {
    return res.redirect('/admin');
  }

  const error = req.query.error;

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Вход в панель управления | VS Dogs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: #ffffff;
      width: 100%;
      max-width: 400px;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    }
    .brand {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-icon {
      font-size: 36px;
      margin-bottom: 8px;
    }
    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .brand p {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #0f172a;
    }
    input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .btn {
      width: 100%;
      padding: 11px;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.15s;
    }
    .btn:hover { background: #1d4ed8; }
    .error-msg {
      background: #fee2e2;
      color: #991b1b;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 18px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="brand">
      <div class="brand-icon">🐶</div>
      <h1>VS Dogs Backoffice</h1>
      <p>Вход для сотрудников и кураторов</p>
    </div>

    ${error ? `<div class="error-msg">Неверный логин или пароль</div>` : ''}

    <form method="POST" action="/admin/login">
      <div class="form-group">
        <label>Логин или Email</label>
        <input type="text" name="login" required autocomplete="username">
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" name="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn">Войти в панель</button>
    </form>
  </div>
</body>
</html>`);
});

// Обработка отправки формы логина
router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.redirect('/admin/login?error=1');
  }

  const admin = db.prepare(`
    SELECT * FROM admin_users 
    WHERE (login = ? OR email = ?) AND is_active = 1
  `).get(login.trim(), login.trim());

  if (!admin || !verifyPassword(password, admin.hashed_password, admin.salt)) {
    return res.redirect('/admin/login?error=1');
  }

  // Обновляем last_login_at
  db.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`).run(admin.id);

  // Фиксируем в аудит лог
  logAudit(admin.id, admin.full_name, 'LOGIN', null, 'Успешная авторизация в панели', req.ip);

  // Создаем токен и сохраняем в куку
  const token = createSessionToken(admin.id);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
  });

  res.redirect('/admin');
});

// Выход
router.get('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.redirect('/admin/login');
});

export default router;
