import { normalizeTelegramId } from './telegram-auth.mjs';
import { createRateLimiter } from './rate-limit.mjs';
import { createTelegramApi } from './telegram-api.mjs';
import { DatabaseSync } from 'node:sqlite';

export { createTelegramApi } from './telegram-api.mjs';

const APP_BUTTON_TEXT = '🐶 Открыть видеоплатформу';
const BROWSER_BUTTON_TEXT = '🌐 Смотреть с компьютера';
const SUBSCRIPTION_BUTTON_TEXT = '💳 Моя подписка';

export function createTelegramBot(options) {
  let directDb = null;
  const {
    botToken,
    botUsername,
    miniAppUrl,
    publicBaseUrl,
    adminTelegramId,
    database,
    fetchImpl = fetch,
    magicLinkTtlSeconds = 600,
    commandRateLimitMax = 40,
    commandRateLimitWindowMs = 60_000,
    telegramApiTimeoutMs = 10_000,
    subscriptionWarningSeconds = 3 * 86_400,
    api: providedApi,
  } = options;

  if (!botToken) {
    return {
      enabled: false,
      handleUpdate: async () => {},
      processSubscriptionNotifications: async () => {},
    };
  }

  const api = providedApi ?? createTelegramApi(botToken, {
    fetchImpl,
    timeoutMs: telegramApiTimeoutMs,
  });

  const commandRateLimiter = createRateLimiter({
    limit: commandRateLimitMax,
    windowMs: commandRateLimitWindowMs,
  });

  return {
    enabled: true,

    async handleUpdate(update) {
      const privateSender = getPrivateSender(update);

      if (privateSender && !commandRateLimiter.consume(privateSender.id).allowed) {
        if (update.callback_query?.id) {
          await api.answerCallbackQuery(update.callback_query.id, {
            text: 'Слишком много запросов. Попробуйте через минуту.',
          }).catch(() => {});
        }
        return;
      }

      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
      }

      if (update.message) {
        const handledReply = await handleTicketReply(update.message);
        if (handledReply) return;

        if (update.message.chat?.type === 'private') {
          await handlePrivateMessage(update.message);
        }
      }
    },

    async processSubscriptionNotifications() {
      if (!database || typeof database.claimDueSubscriptionNotifications !== 'function') {
        return;
      }

      const notifications = database.claimDueSubscriptionNotifications(subscriptionWarningSeconds);

      for (const notification of notifications) {
        try {
          const text = notification.kind === 'warning'
            ? '⏳ <b>Напоминание о подписке</b>\n\nСрок действия вашей подписки на видеоплатформу «Высшей школы собак» завершается через 3 дня.\n\nДля продления доступа, пожалуйста, свяжитесь с вашим менеджером школы.'
            : '⏳ <b>Срок подписки истёк</b>\n\nСрок действия вашей подписки на видеоплатформу «Высшей школы собак» подошёл к концу.\n\nДля продления доступа, пожалуйста, обратитесь к вашему менеджеру школы.';

          await api.sendMessage(notification.telegramId, text, { parse_mode: 'HTML' });
          database.markSubscriptionNotificationDelivered(
            notification.telegramId,
            notification.accessExpiresAt,
            notification.kind,
          );
        } catch (error) {
          console.warn(
            `[telegram-bot] subscription notification failed for ${notification.telegramId}: ${error.message}`,
          );
        }
      }
    },
  };

  /**
   * Обработка личных сообщений от пользователя
   */
  async function handlePrivateMessage(message) {
    const sender = toProfile(message.from);
    if (!sender) return;

    const chatId = message.chat.id;

    // 1. Получаем пользователя из базы данных
    const user = getDbUser(sender.id);

    // Проверка на блокировку
    if (user && (user.is_blocked === 1 || user.status === 'blocked')) {
      await api.sendMessage(
        chatId,
        '🚫 <b>Доступ заблокирован</b>\n\nВаш аккаунт временно отключен. Пожалуйста, обратитесь к администрации школы.',
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } },
      );
      return;
    }

    // 2. Обработка получения контакта (номер телефона)
    if (message.contact) {
      await handleContact(chatId, sender, message.contact);
      return;
    }

    // 3. Если у пользователя ещё нет подтверждённого номера телефона — просим поделиться
    if (!user || !user.phone || !user.phone.trim()) {
      await requestPhone(chatId, sender);
      return;
    }

    // Обновляем метку последней активности
    touchUserActivity(sender);

    const text = typeof message.text === 'string' ? message.text.trim() : '';
    const command = parseCommand(text);

    // 4. Команды и кнопки
    if (command?.name === 'start') {
      await handleStart(chatId, sender, command.argument);
      return;
    }

    if (command?.name === 'help') {
      await sendHelp(chatId);
      return;
    }

    if (text === BROWSER_BUTTON_TEXT || command?.name === 'browser' || command?.name === 'pc') {
      await sendBrowserLogin(chatId, sender.id);
      return;
    }

    if (text === SUBSCRIPTION_BUTTON_TEXT || command?.name === 'sub' || command?.name === 'subscription') {
      await sendSubscriptionStatus(chatId, sender.id);
      return;
    }

    if (text === APP_BUTTON_TEXT) {
      await sendAppNotice(chatId);
      return;
    }

    // На любой другой текст показываем главное меню
    await sendMainMenu(
      chatId,
      `Рады видеть вас, ${sender.firstName}! 🐶\n\nИспользуйте кнопки меню внизу для доступа к платформе:`,
    );
  }

  /**
   * Обработка Callback Query (нажатия на inline-кнопки)
   */
  async function handleCallbackQuery(query) {
    const sender = toProfile(query.from);
    if (!sender) return;

    const data = String(query.data || '');

    if (data.startsWith('ticket_take:')) {
      const ticketId = Number(data.split(':')[1]);
      if (!ticketId) return;

      const ticket = database?.getTrainerTicketById ? database.getTrainerTicketById(ticketId) : null;
      if (!ticket) {
        await api.answerCallbackQuery(query.id, { text: 'Тикет не найден', show_alert: true }).catch(() => {});
        return;
      }

      if (ticket.status === 'in_progress') {
        const who = ticket.assigned_trainer_name || 'другим кинологом';
        await api.answerCallbackQuery(query.id, { text: `⚠️ Этот вопрос уже взят в работу (${who})!`, show_alert: true }).catch(() => {});
        return;
      }

      if (ticket.status === 'answered') {
        await api.answerCallbackQuery(query.id, { text: '✅ На этот вопрос уже дан ответ.', show_alert: true }).catch(() => {});
        return;
      }

      const trainerName = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.username || 'Кинолог';
      if (database?.assignTrainerTicket) {
        database.assignTrainerTicket(ticketId, null, trainerName);
      }

      await api.answerCallbackQuery(query.id, { text: '✅ Вы взяли вопрос в работу!' }).catch(() => {});

      if (query.message?.message_id && query.message?.chat?.id) {
        const updatedMarkup = {
          inline_keyboard: [
            [{ text: '↩️ Вернуть в общие', callback_data: `ticket_release:${ticketId}` }],
            [{ text: '🌐 Открыть в админке', url: 'https://admin.miniapp-vsdogs.ru/admin/tickets?tab=my' }],
          ],
        };
        await api.editMessageReplyMarkup(query.message.chat.id, query.message.message_id, updatedMarkup).catch(() => {});
        await api.sendMessage(
          query.message.chat.id,
          `✍️ <b>Тикет #${ticketId} взят в работу</b> (${escapeHtml(trainerName)})\n\nЧтобы отправить ответ ученику, ответьте <b>Reply</b> на исходное сообщение с вопросом, либо отправьте ответ через <a href="https://admin.miniapp-vsdogs.ru/admin/tickets?tab=my">веб-панель</a>.`,
          {
            parse_mode: 'HTML',
            reply_parameters: { message_id: query.message.message_id },
          }
        ).catch(() => {});
      }
      return;
    }

    if (data.startsWith('ticket_release:')) {
      const ticketId = Number(data.split(':')[1]);
      if (!ticketId) return;

      if (database?.releaseTrainerTicket) {
        database.releaseTrainerTicket(ticketId);
      }

      await api.answerCallbackQuery(query.id, { text: 'Вопрос возвращен в общие!' }).catch(() => {});

      if (query.message?.message_id && query.message?.chat?.id) {
        const updatedMarkup = {
          inline_keyboard: [
            [{ text: '✋ Взять в работу', callback_data: `ticket_take:${ticketId}` }],
            [{ text: '🌐 Открыть в тикет-центре', url: 'https://admin.miniapp-vsdogs.ru/admin/tickets?tab=new' }],
          ],
        };
        await api.editMessageReplyMarkup(query.message.chat.id, query.message.message_id, updatedMarkup).catch(() => {});
      }
      return;
    }

    await api.answerCallbackQuery(query.id).catch(() => {});

    const chatId = query.message?.chat?.id ?? sender.id;

    if (data === 'user:browser') {
      await sendBrowserLogin(chatId, sender.id);
      return;
    }

    if (data === 'user:sub') {
      await sendSubscriptionStatus(chatId, sender.id);
      return;
    }

    if (data === 'user:menu') {
      await sendMainMenu(chatId);
      return;
    }
  }

  /**
   * Обработка ответа кинолога на тикет через Reply в Telegram
   */
  async function handleTicketReply(message) {
    if (!message.reply_to_message) return false;
    const repliedMessageId = message.reply_to_message.message_id;
    if (!repliedMessageId || !database?.getTrainerTicketByTgMessage) return false;

    const ticket = database.getTrainerTicketByTgMessage(repliedMessageId);
    if (!ticket) return false;

    if (ticket.status === 'answered') {
      await api.sendMessage(
        message.chat.id,
        `⚠️ На тикет #${ticket.id} уже был отправлен ответ ранее.`,
        {
          parse_mode: 'HTML',
          reply_parameters: { message_id: message.message_id },
        }
      ).catch(() => {});
      return true;
    }

    const answerText = String(message.text || '').trim();
    if (!answerText) return true;

    const senderProfile = toProfile(message.from);
    const trainerName = senderProfile
      ? [senderProfile.firstName, senderProfile.lastName].filter(Boolean).join(' ') || senderProfile.username || 'Кинолог'
      : (ticket.assigned_trainer_name || 'Кинолог');

    // 1. Фиксируем ответ в базе данных
    if (database.answerTrainerTicket) {
      database.answerTrainerTicket(ticket.id, answerText, trainerName);
    }

    // 2. Доставляем ответ ученику в клиентский бот
    if (ticket.telegram_id) {
      const studentText = `🐾 <b>Ответ кинолога на ваш вопрос</b>\n\n` +
        `Здравствуйте, ${escapeHtml(ticket.first_name || 'ученик')}!\n\n` +
        `❓ <b>Ваш вопрос:</b>\n<i>${escapeHtml(ticket.question_text)}</i>\n\n` +
        `💬 <b>Ответ кинолога (${escapeHtml(trainerName)}):</b>\n${escapeHtml(answerText)}\n\n` +
        `Желаем продуктивных тренировок! 🐶`;

      await api.sendMessage(ticket.telegram_id, studentText, { parse_mode: 'HTML' }).catch((err) => {
        console.error('[telegram-bot] Failed to deliver ticket answer to student:', err);
      });
    }

    // 3. Отправляем подтверждение в чат кинологов
    await api.sendMessage(
      message.chat.id,
      `🎉 <b>Ответ на тикет #${ticket.id} успешно доставлен ученику (${escapeHtml(ticket.first_name || 'Ученик')})!</b>`,
      {
        parse_mode: 'HTML',
        reply_parameters: { message_id: message.message_id },
      }
    ).catch(() => {});

    // 4. Очищаем кнопки на исходном сообщении с вопросом
    if (ticket.tg_chat_id && ticket.tg_message_id) {
      await api.editMessageReplyMarkup(ticket.tg_chat_id, ticket.tg_message_id, { inline_keyboard: [] }).catch(() => {});
    }

    return true;
  }

  /**
   * Запрос номера телефона через нативную кнопку Telegram
   */
  async function requestPhone(chatId, sender) {
    const text =
      `👋 <b>Добро пожаловать в «Высшую школу собак» Дарьи Сахаровой!</b>\n\n` +
      `Для открытия доступа к платформе и связи с вашим личным кабинетом, пожалуйста, подтвердите свой номер телефона.\n\n` +
      `👇 Нажмите кнопку <b>«📱 Поделиться номером телефона»</b> внизу экрана:`;

    await api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📱 Поделиться номером телефона', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  /**
   * Сохранение полученного номера телефона
   */
  async function handleContact(chatId, sender, contact) {
    let rawPhone = contact.phone_number || '';
    let phone = rawPhone.replace(/[^\d+]/g, '');
    if (phone && !phone.startsWith('+')) {
      phone = '+' + phone;
    }

    saveUserPhone(sender, phone);

    const text =
      `✅ <b>Номер телефона подтверждён!</b>\n\n` +
      `Добро пожаловать в обучающую видеоплатформу школы щенков Дарьи Сахаровой 🐶\n\n` +
      `Все видеоматериалы и уроки доступны по кнопкам ниже:`;

    await api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard(),
    });
  }

  /**
   * Команда /start
   */
  async function handleStart(chatId, sender, argument) {
    if (argument?.startsWith('invite_') && database?.consumeInvite) {
      database.consumeInvite(argument.slice('invite_'.length), sender.id);
    }

    const user = getDbUser(sender.id);
    if (!user || !user.phone) {
      await requestPhone(chatId, sender);
      return;
    }

    await sendMainMenu(
      chatId,
      `👋 С возвращением, <b>${sender.firstName}</b>!\n\n` +
      `Выберите нужный пункт меню для продолжения обучения:`,
    );
  }

  /**
   * Главное меню с нативной клавиатурой
   */
  async function sendMainMenu(chatId, messageText = null) {
    const text = messageText || 'Главное меню видеоплатформы 🐶:';

    await api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard(),
    });
  }

  /**
   * Структура главного Reply-меню (всегда видно под строкой ввода)
   */
  function mainReplyKeyboard() {
    return {
      keyboard: [
        [{ text: APP_BUTTON_TEXT }],
        [{ text: BROWSER_BUTTON_TEXT }, { text: SUBSCRIPTION_BUTTON_TEXT }],
      ],
      resize_keyboard: true,
    };
  }

  /**
   * Уведомление при нажатии на кнопку приложения
   */
  async function sendAppNotice(chatId) {
    if (!miniAppUrl) {
      await api.sendMessage(chatId, 'Ссылка на видеоплатформу настраивается. Пожалуйста, попробуйте чуть позже.');
      return;
    }

    await api.sendMessage(
      chatId,
      '🐶 <b>Обучающая видеоплатформа «Высшей школы собак»</b>\n\nНажмите на кнопку ниже для перехода к видеоурокам:',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Открыть видеоплатформу 🐶', web_app: { url: miniAppUrl } }],
          ],
        },
      },
    );
  }

  /**
   * Статус подписки (Read-Only: без тарифов, цен и кнопок оплаты)
   */
  async function sendSubscriptionStatus(chatId, telegramId) {
    const user = getDbUser(telegramId);
    if (!user) {
      await api.sendMessage(chatId, 'Информация о пользователе не найдена. Нажмите /start для обновления.');
      return;
    }

    const license = getDbLicense(user.id || user.rowid);

    // 1. Активная платная лицензия
    if (license && license.status === 'active' && license.tariff_id !== 'free') {
      const tariffTitle = license.tariff_name || 'Обучающий курс';

      if (license.tariff_id === 'lifetime' || !license.expires_at) {
        await api.sendMessage(
          chatId,
          `🐶 <b>Ваша подписка:</b> ${escapeHtml(tariffTitle)}\n` +
          `📅 <b>Срок действия:</b> Бессрочный доступ (VIP) ✨\n\n` +
          `Статус: <b>Активен ✅</b>\n\n` +
          `Приятного просмотра и продуктивных тренировок с хвостиком!`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      const daysLeft = calculateDaysLeft(license.expires_at);
      const formattedDate = formatDateRu(license.expires_at);

      let daysText = '';
      if (daysLeft > 0) {
        daysText = `(осталось ${daysLeft} ${pluralizeDays(daysLeft)})`;
      } else if (daysLeft === 0) {
        daysText = `(истекает сегодня)`;
      } else {
        daysText = `(срок истёк)`;
      }

      await api.sendMessage(
        chatId,
        `🐶 <b>Ваша подписка:</b> ${escapeHtml(tariffTitle)}\n` +
        `📅 <b>Срок действия:</b> до ${formattedDate} ${daysText}\n\n` +
        `Статус: <b>Активен ✅</b>\n\n` +
        `Приятного просмотра и продуктивных тренировок!`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    // 2. Базовый / Бесплатный доступ или истёкшая подписка
    const text =
      `ℹ️ <b>Статус доступа: Базовый (Free)</b>\n\n` +
      `В данный момент у вас нет активной платной подписки.\n\n` +
      `По вопросам подключения тарифа или продления доступа, пожалуйста, напишите вашему менеджеру школы.`;

    await api.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  /**
   * Генерация одноразовой ссылки (Magic Link) для входа с компьютера
   */
  async function sendBrowserLogin(chatId, telegramId) {
    if (!database || typeof database.prepareMagicLinkDelivery !== 'function') {
      await api.sendMessage(chatId, 'Вход через браузер временно недоступен.');
      return;
    }

    const magicLink = database.prepareMagicLinkDelivery(telegramId, magicLinkTtlSeconds);
    const url = magicLink ? buildMagicLink(magicLink.token) : null;

    if (!magicLink || !url) {
      if (magicLink) database.abortMagicLinkDelivery(magicLink.token);
      await api.sendMessage(chatId, 'Не удалось сформировать ссылку для входа. Обратитесь к менеджеру.');
      return;
    }

    try {
      const sentMessage = await api.sendMessage(
        chatId,
        `🌐 <b>Вход с компьютера без пароля</b>\n\n` +
        `Ссылка действует ${formatTtl(magicLinkTtlSeconds)}:\n`,
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть в браузере на ПК 🔗', url }]],
          },
        },
      );

      const messageId = getSentMessageId(sentMessage);
      if (messageId) {
        database.finalizeMagicLinkDelivery(magicLink.token, telegramId, chatId, messageId);
      }
    } catch (err) {
      database.abortMagicLinkDelivery(magicLink.token);
      throw err;
    }
  }

  /**
   * Справка /help
   */
  async function sendHelp(chatId) {
    const text =
      `🐶 <b>Онлайн-видеоплатформа «Высшей школы собак» Дарьи Сахаровой</b>\n\n` +
      `• Нажмите <b>«${APP_BUTTON_TEXT}»</b>, чтобы смотреть уроки прямо внутри Telegram.\n` +
      `• Нажмите <b>«${BROWSER_BUTTON_TEXT}»</b>, чтобы получить быструю одноразовую ссылку для просмотра на ноутбуке или компьютере.\n` +
      `• Нажмите <b>«${SUBSCRIPTION_BUTTON_TEXT}»</b>, чтобы проверить срок действия вашего доступа.\n\n` +
      `Все вопросы по оформлению, оплате и продлению подписки решаются напрямую через вашего менеджера школы.`;

    await api.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  // ==========================================
  // Вспомогательные методы работы с БД
  // ==========================================

  function getDb() {
    if (database?.rawDb && typeof database.rawDb.prepare === 'function') {
      return database.rawDb;
    }
    if (database && typeof database.prepare === 'function') {
      return database;
    }
    if (!directDb) {
      try {
        const dbPath = options.authDatabasePath || process.env.AUTH_DATABASE_PATH || '/app/data/auth.sqlite';
        directDb = new DatabaseSync(dbPath);
        directDb.exec('PRAGMA busy_timeout = 5000;');
      } catch (err) {
        console.error('[telegram-bot] Ошибка подключения к SQLite:', err.message);
      }
    }
    return directDb;
  }

  function getDbUser(telegramId) {
    const db = getDb();
    if (!db || typeof db.prepare !== 'function') {
      return database?.getUser ? database.getUser(telegramId) : null;
    }

    try {
      return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
    } catch {
      return null;
    }
  }

  function getDbLicense(userId) {
    const db = getDb();
    if (!db || typeof db.prepare !== 'function') return null;

    try {
      return db.prepare(`
        SELECT l.*, t.name as tariff_name
        FROM licenses l
        LEFT JOIN tariffs t ON t.id = l.tariff_id
        WHERE l.user_id = ? AND l.status = 'active'
        ORDER BY l.id DESC LIMIT 1
      `).get(userId);
    } catch {
      return null;
    }
  }

  function saveUserPhone(sender, phone) {
    const db = getDb();
    if (!db || typeof db.prepare !== 'function') return;

    try {
      const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(sender.id));
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const nowUnix = Math.floor(Date.now() / 1000);

      if (existing) {
        db.prepare(`
          UPDATE users 
          SET phone = ?,
              first_name = COALESCE(?, first_name),
              last_name = COALESCE(?, last_name),
              username = COALESCE(?, username),
              last_active_at = ?,
              updated_at = ?
          WHERE telegram_id = ?
        `).run(phone, sender.firstName, sender.lastName, sender.username, nowIso, nowUnix, String(sender.id));
      } else {
        db.prepare(`
          INSERT INTO users (
            telegram_id, phone, username, first_name, last_name,
            role, status, is_blocked, created_by, created_at, updated_at,
            last_seen_at, last_active_at
          ) VALUES (?, ?, ?, ?, ?, 'user', 'active', 0, 'bot', ?, ?, ?, ?)
        `).run(
          String(sender.id),
          phone,
          sender.username,
          sender.firstName,
          sender.lastName,
          nowUnix,
          nowUnix,
          nowUnix,
          nowIso,
        );
      }

      // Проверяем, есть ли уже лицензия
      const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(sender.id));
      const userId = user?.id || user?.rowid;
      if (userId) {
        const hasLicense = db.prepare('SELECT id FROM licenses WHERE user_id = ? LIMIT 1').get(userId);
        if (!hasLicense) {
          db.prepare(`
            INSERT INTO licenses (user_id, tariff_id, status, starts_at, expires_at, source, notes)
            VALUES (?, 'free', 'active', date('now'), NULL, 'bot_registration', 'Регистрация через бота')
          `).run(userId);
        }
      }
    } catch (err) {
      console.error('[telegram-bot] Ошибка сохранения пользователя/телефона:', err);
    }
  }

  function touchUserActivity(sender) {
    const db = getDb();
    if (!db || typeof db.prepare !== 'function') return;

    try {
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const nowUnix = Math.floor(Date.now() / 1000);

      db.prepare(`
        UPDATE users 
        SET last_active_at = ?,
            last_seen_at = ?,
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            username = COALESCE(?, username)
        WHERE telegram_id = ?
      `).run(nowIso, nowUnix, sender.firstName, sender.lastName, sender.username, String(sender.id));
    } catch {}
  }

  function buildMagicLink(token) {
    if (!publicBaseUrl) return null;
    const base = publicBaseUrl.replace(/\/+$/, '');
    return `${base}/auth/login?token=${encodeURIComponent(token)}`;
  }
}

// ==========================================
// Утилиты форматирования
// ==========================================

function getPrivateSender(update) {
  if (update?.callback_query?.message?.chat?.type === 'private') {
    return toProfile(update.callback_query.from);
  }
  if (update?.message?.chat?.type === 'private') {
    return toProfile(update.message.from);
  }
  return null;
}

function toProfile(user) {
  const id = normalizeTelegramId(user?.id);
  if (!id || typeof user?.first_name !== 'string' || !user.first_name.trim()) {
    return null;
  }
  return {
    id,
    firstName: user.first_name.trim().slice(0, 128),
    lastName: cleanOptional(user.last_name, 128),
    username: cleanOptional(user.username, 64),
  };
}

function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const match = /^\/([a-z_]+)(?:@[a-z\d_]+)?(?:\s+(.+))?$/i.exec(text.trim());
  return match ? { name: match[1].toLowerCase(), argument: match[2]?.trim() || '' } : null;
}

function cleanOptional(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function getSentMessageId(result) {
  const messageId = Number(result?.message_id);
  return Number.isSafeInteger(messageId) && messageId > 0 ? messageId : null;
}

export function formatTtl(ttlSeconds) {
  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  const lastTwoDigits = minutes % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${minutes} минут`;
  }
  const lastDigit = minutes % 10;
  if (lastDigit === 1) {
    return `${minutes} минута`;
  }
  return lastDigit >= 2 && lastDigit <= 4 ? `${minutes} минуты` : `${minutes} минут`;
}

function calculateDaysLeft(dateStr) {
  if (!dateStr) return 0;
  const cleanStr = String(dateStr).trim().split(' ')[0].split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length !== 3) return 0;

  const expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatDateRu(dateStr) {
  if (!dateStr) return '—';
  const cleanStr = String(dateStr).trim().split(' ')[0].split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return cleanStr;
}

function pluralizeDays(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

export function parseMoscowEndOfDay(dateString) {
  if (typeof dateString !== 'string') return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateString.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 20, 59, 59));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime() / 1000;
}

export function formatSubscriptionDate(seconds) {
  if (!seconds) return '—';
  if (typeof seconds === 'string' && seconds.includes('-')) {
    return formatDateRu(seconds);
  }
  const date = new Date((typeof seconds === 'number' ? seconds : Number(seconds)) * 1000);
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
