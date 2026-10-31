import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';

// Безопасная загрузка переменных окружения из .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

import { initDatabase } from '../db/database.js';
import { authMiddleware, requireAuth } from './auth.js';
import { startTicketBotPoller } from './services/ticketBotService.js';
import { handleAdminSseConnection, startRealtimeWatcher } from './services/realtimeService.js';
import { startLicenseReminderJob } from './services/notificationService.js';

// Роуты
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import usersRoutes from './routes/users.js';
import ticketsRoutes from './routes/tickets.js';
import paymentsRoutes from './routes/payments.js';
import tariffsRoutes from './routes/tariffs.js';
import teamRoutes from './routes/team.js';
import broadcastsRoutes from './routes/broadcasts.js';
import systemRoutes from './routes/system.js';

// Инициализация БД
initDatabase();

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(path.dirname(process.env.DB_PATH || path.join(process.cwd(), 'data', 'auth.sqlite')), 'uploads');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Раздача загруженных фото/видео из вопросов учеников
app.use('/admin/uploads', express.static(UPLOADS_DIR));

// Проверка сессии на всех маршрутах
app.use(authMiddleware);

// SSE-эндпоинт автообновления в реальном времени
app.get('/admin/api/events', requireAuth, handleAdminSseConnection);

// Подключение роутов
app.use('/admin', authRoutes);
app.use('/admin', dashboardRoutes);
app.use('/admin/users', usersRoutes);
app.use('/admin/tickets', ticketsRoutes);
app.use('/admin/payments', paymentsRoutes);
app.use('/admin/tariffs', tariffsRoutes);
app.use('/admin/team', teamRoutes);
app.use('/admin/broadcasts', broadcastsRoutes);
app.use('/admin/system', systemRoutes);

// Редирект с корня на /admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Запуск сервера
if (process.argv[1]?.endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 VS Dogs Backoffice запущен на http://localhost:${PORT}/admin`);
    console.log(`Вход по умолчанию: daria / daria2026! (Владелец)`);
    console.log(`======================================================\n`);

    // Запуск фоновых сервисов
    startRealtimeWatcher();
    startLicenseReminderJob();

    if (process.env.TICKET_BOT_TOKEN || process.env.BOT_TOKEN) {
      startTicketBotPoller();
    }
  });
}

export default app;