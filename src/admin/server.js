import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { initDatabase } from '../db/database.js';
import { authMiddleware } from './auth.js';
import { startTicketBotPoller } from './services/ticketBotService.js';

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

    if (process.env.TICKET_BOT_TOKEN || process.env.BOT_TOKEN) {
      startTicketBotPoller();
    }
  });
}

export default app;
