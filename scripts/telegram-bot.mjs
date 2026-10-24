import { normalizeTelegramId } from './telegram-auth.mjs';
import { createRateLimiter } from './rate-limit.mjs';
import { createTelegramApi } from './telegram-api.mjs';

export { createTelegramApi } from './telegram-api.mjs';

const USER_PAGE_SIZE = 8;
const APP_BUTTON_TEXT = 'PuppyApp 🐶';
const BROWSER_BUTTON_TEXT = 'Браузер 🌐';

export function createTelegramBot(options) {
  const {
    botToken,
    botUsername,
    miniAppUrl,
    publicBaseUrl,
    adminTelegramId,
    database,
    fetchImpl = fetch,
    inviteTtlSeconds = 86_400,
    magicLinkTtlSeconds = 600,
    botStateTtlSeconds = 600,
    commandRateLimitMax = 40,
    commandRateLimitWindowMs = 60_000,
    telegramApiTimeoutMs = 10_000,
    subscriptionWarningSeconds = 3 * 86_400,
    requestServerRestart = null,
    api: providedApi,
  } = options;

  if (!botToken || !adminTelegramId) {
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

      if (update.message?.chat?.type === 'private') {
        await handlePrivateMessage(update.message);
      }
    },

    async processSubscriptionNotifications() {
      const notifications = database.claimDueSubscriptionNotifications(subscriptionWarningSeconds);

      for (const notification of notifications) {
        try {
          await sendSubscriptionNotification(notification);
          database.markSubscriptionNotificationDelivered(
            notification.telegramId,
            notification.accessExpiresAt,
            notification.kind,
          );
        } catch (error) {
          console.warn(
            `[telegram-bot] subscription ${notification.kind} notification failed for ${notification.telegramId}: ${getErrorMessage(error)}`,
          );
        }
      }
    },
  };

  async function handlePrivateMessage(message) {
    const sender = toProfile(message.from);

    if (!sender) {
      return;
    }

    if (sender.id === adminTelegramId) {
      database.ensureAdmin(sender.id);
    }

    const command = parseCommand(message.text);

    if (command?.name === 'start') {
      await handleStart(message.chat.id, sender, command.argument);
      return;
    }

    const currentAccess = database.getUserAccess(sender.id);
    const currentUser = currentAccess.user;

    if (currentAccess.state !== 'active') {
      await sendAccessStatus(message.chat.id, sender.id, currentAccess);
      return;
    }

    database.touchTelegramUser(sender);

    if (message.text === BROWSER_BUTTON_TEXT) {
      await sendBrowserLogin(message.chat.id, sender.id, message.message_id);
      return;
    }

    if (message.text === APP_BUTTON_TEXT) {
      await showMenu(message.chat.id, database.getUser(sender.id));
      return;
    }

    if (currentUser.role === 'admin') {
      const adminState = database.getBotState(sender.id, botStateTtlSeconds);

      if (adminState === 'awaiting_grant_id') {
        await handleGrantInput(message.chat.id, sender.id, message.text);
        return;
      }

      const dateState = /^awaiting_(grant|expiry)_date:([1-9]\d{0,19})(?::(\d{1,6}))?$/.exec(adminState || '');

      if (dateState) {
        await handleSubscriptionDateInput(
          message.chat.id,
          sender.id,
          dateState[1],
          dateState[2],
          Number(dateState[3] || 0),
          message.text,
        );
        return;
      }
    }

    await showMenu(message.chat.id, database.getUser(sender.id));
  }

  async function handleStart(chatId, sender, argument) {
    let inviteAccepted = false;

    if (argument?.startsWith('invite_')) {
      const result = database.consumeInvite(argument.slice('invite_'.length), sender.id);

      if (!result.ok) {
        const text = result.reason === 'telegram_id_mismatch'
          ? 'Это приглашение предназначено для другого Telegram-аккаунта.'
          : 'Приглашение недействительно или уже истекло.';
        await api.sendMessage(chatId, text);
      } else {
        inviteAccepted = true;
      }
    }

    let access = database.getUserAccess(sender.id);
    let user = access.user;

    if (access.state !== 'active') {
      await sendAccessStatus(chatId, sender.id, access);
      return;
    }

    database.touchTelegramUser(sender);
    user = database.getUser(sender.id);
    database.clearBotState(sender.id);
    await showMenu(chatId, user, inviteAccepted ? 'Доступ подтверждён.' : 'Добро пожаловать!');
  }

  async function handleGrantInput(chatId, actorId, text) {
    const targetId = normalizeTelegramId(text);

    if (!targetId) {
      await sendTrackedMessage(chatId, actorId, 'admin_menu', 'Пришлите числовой Telegram ID или нажмите «Отмена».', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (targetId === adminTelegramId) {
      database.clearBotState(actorId);
      await sendTrackedMessage(chatId, actorId, 'admin_menu', 'Этот Telegram ID уже является администратором.', {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    database.setBotState(actorId, `awaiting_grant_term:${targetId}`);
    await sendTrackedMessage(chatId, actorId, 'admin_menu', `Выберите срок доступа для ${targetId}.`, {
      reply_markup: subscriptionTermKeyboard('grant', targetId),
    });
  }

  async function handleSubscriptionDateInput(chatId, actorId, mode, targetId, offset, text) {
    const expiresAt = parseMoscowEndOfDay(text);

    if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
      await sendTrackedMessage(
        chatId,
        actorId,
        'admin_menu',
        'Введите будущую дату в формате ДД.ММ.ГГГГ.',
        { reply_markup: cancelKeyboard() },
      );
      return;
    }

    database.clearBotState(actorId);

    if (mode === 'grant') {
      await finalizeGrant(chatId, actorId, targetId, expiresAt);
      return;
    }

    const changed = database.setUserAccessExpiry(targetId, expiresAt, actorId);
    await notifySubscriptionChanged(targetId, changed);
    await showUserCard(chatId, targetId, offset, `Срок установлен до ${formatSubscriptionDate(expiresAt)}.`);
  }

  async function finalizeGrant(chatId, actorId, targetId, accessExpiresAt) {
    const user = database.grantUser(targetId, actorId, accessExpiresAt);
    database.clearBotState(actorId);
    let userWasNotified = false;

    try {
      await sendTrackedMessage(
        targetId,
        targetId,
        'status',
        buildActiveAccessMessage(user, 'Вам открыт доступ к PuppyApp.'),
        { reply_markup: appInlineKeyboard() },
      );
      userWasNotified = true;
      markShortSubscriptionWarningDelivered(user);
    } catch (error) {
      const invite = database.createInvite(targetId, actorId, inviteTtlSeconds);
      const link = buildInviteLink(invite.token);
      const suffix = link
        ? `\n\nПользователь ещё не открыл бота. Передайте ему ссылку:\n${link}`
        : '\n\nБот не смог написать пользователю. Настройте BOT_USERNAME, чтобы получать ссылки-приглашения.';

      await sendTrackedMessage(
        chatId,
        actorId,
        'admin_menu',
        `Доступ для ${targetId} выдан ${formatAccessTerm(user)}.${suffix}`,
        { reply_markup: adminKeyboard() },
      );
      console.warn(`[telegram-bot] could not notify user ${targetId}: ${getErrorMessage(error)}`);
    }

    if (userWasNotified) {
      await sendTrackedMessage(
        chatId,
        actorId,
        'admin_menu',
        `Доступ для ${targetId} выдан ${formatAccessTerm(user)}, пользователь уведомлён.`,
        { reply_markup: adminKeyboard() },
      );
    }
  }

  async function handleCallbackQuery(query) {
    const sender = toProfile(query.from);

    if (!sender) {
      return;
    }

    await api.answerCallbackQuery(query.id).catch((error) => {
      console.warn(`[telegram-bot] answerCallbackQuery failed: ${error.message}`);
    });

    if (query.message?.chat?.type !== 'private') {
      return;
    }

    if (sender.id === adminTelegramId) {
      database.ensureAdmin(sender.id);
    }

    const access = database.getUserAccess(sender.id);
    const user = access.user;
    const chatId = query.message?.chat?.id ?? sender.id;

    if (access.state !== 'active') {
      await sendAccessStatus(chatId, sender.id, access);
      return;
    }

    database.touchTelegramUser(sender);
    const action = String(query.data || '');

    if (action === 'user:menu') {
      database.clearBotState(sender.id);
      await showMenu(chatId, database.getUser(sender.id));
      return;
    }

    if (action === 'user:browser') {
      await sendBrowserLogin(chatId, sender.id);
      return;
    }

    if (user.role !== 'admin') {
      await api.sendMessage(chatId, 'Эта команда доступна только администратору.');
      return;
    }

    if (action === 'admin:add') {
      database.setBotState(sender.id, 'awaiting_grant_id');
      await sendTrackedMessage(chatId, sender.id, 'admin_menu', 'Отправьте числовой Telegram ID пользователя.', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (action === 'admin:cancel') {
      database.clearBotState(sender.id);
      await showMenu(chatId, database.getUser(sender.id), 'Действие отменено.');
      return;
    }

    if (action === 'admin:servers:restart') {
      if (typeof requestServerRestart !== 'function') {
        await showMenu(chatId, database.getUser(sender.id), 'Перезагрузка серверов не настроена.');
        return;
      }

      database.setBotState(sender.id, 'awaiting_servers_restart');
      await sendTrackedMessage(
        chatId,
        sender.id,
        'admin_menu',
        'Перезагрузить production-сервер и Telegram proxy? Приложение будет недоступно несколько минут.',
        { reply_markup: restartConfirmationKeyboard() },
      );
      return;
    }

    if (action === 'admin:servers:restart:confirm') {
      const state = database.getBotState(sender.id, botStateTtlSeconds);

      if (state !== 'awaiting_servers_restart' || typeof requestServerRestart !== 'function') {
        await showMenu(chatId, database.getUser(sender.id), 'Подтверждение устарело.');
        return;
      }

      database.clearBotState(sender.id);

      try {
        await requestServerRestart({ requestedBy: sender.id });
        await api.sendMessage(
          chatId,
          'Команда принята. Сначала перезагрузится Telegram proxy, затем production-сервер. Обычно восстановление занимает 1–3 минуты.',
        );
      } catch (error) {
        console.error(`[telegram-bot] server restart request failed: ${getErrorMessage(error)}`);
        await showMenu(chatId, database.getUser(sender.id), 'Не удалось поставить перезагрузку в очередь.');
      }
      return;
    }

    const grantTermAction = /^admin:grant:(7|30|90|365|forever|date):([1-9]\d{0,19})$/.exec(action);

    if (grantTermAction) {
      const [, term, targetId] = grantTermAction;
      const state = database.getBotState(sender.id, botStateTtlSeconds);

      if (state !== `awaiting_grant_term:${targetId}`) {
        await showMenu(chatId, database.getUser(sender.id), 'Выбор срока устарел. Начните выдачу доступа заново.');
        return;
      }

      if (term === 'date') {
        database.setBotState(sender.id, `awaiting_grant_date:${targetId}`);
        await sendTrackedMessage(chatId, sender.id, 'admin_menu', 'Введите дату окончания в формате ДД.ММ.ГГГГ (по Москве).', {
          reply_markup: cancelKeyboard(),
        });
        return;
      }

      const expiresAt = term === 'forever'
        ? null
        : Math.floor(Date.now() / 1000) + Number(term) * 86_400;
      await finalizeGrant(chatId, sender.id, targetId, expiresAt);
      return;
    }

    const userCardAction = /^admin:user:([1-9]\d{0,19})(?::(\d{1,6}))?$/.exec(action);

    if (userCardAction) {
      await showUserCard(chatId, userCardAction[1], Number(userCardAction[2] || 0));
      return;
    }

    const extendAction = /^admin:extend:(7|30|90|365):([1-9]\d{0,19})(?::(\d{1,6}))?$/.exec(action);

    if (extendAction) {
      const [, days, targetId, offset = '0'] = extendAction;
      const changed = database.extendUserAccess(targetId, Number(days), sender.id);
      await notifySubscriptionChanged(targetId, changed);
      await showUserCard(chatId, targetId, Number(offset), `Подписка продлена на ${days} дней.`);
      return;
    }

    const expiryAction = /^admin:expiry:(forever|date):([1-9]\d{0,19})(?::(\d{1,6}))?$/.exec(action);

    if (expiryAction) {
      const [, operation, targetId, offset = '0'] = expiryAction;

      if (operation === 'date') {
        database.setBotState(sender.id, `awaiting_expiry_date:${targetId}:${offset}`);
        await sendTrackedMessage(chatId, sender.id, 'admin_menu', 'Введите новую дату окончания в формате ДД.ММ.ГГГГ (по Москве).', {
          reply_markup: cancelKeyboard(),
        });
        return;
      }

      const changed = database.setUserAccessExpiry(targetId, null, sender.id);
      await notifySubscriptionChanged(targetId, changed);
      await showUserCard(chatId, targetId, Number(offset), 'Доступ сделан бессрочным.');
      return;
    }

    const listAction = /^admin:list(?::(\d{1,6}))?$/.exec(action);

    if (listAction) {
      await showUsers(chatId, Number(listAction[1] || 0));
      return;
    }

    const statusAction = /^(admin):(revoke|activate):([1-9]\d{0,19})(?::(\d{1,6}))?$/.exec(action);

    if (statusAction) {
      const [, , operation, targetId, offset = '0'] = statusAction;
      const status = operation === 'activate' ? 'active' : 'revoked';

      try {
        const changed = database.setUserStatus(targetId, status, sender.id);
        await api.sendMessage(
          chatId,
          changed
            ? `Доступ для ${targetId}: ${status === 'active' ? 'активен' : 'отозван'}.`
            : `Пользователь ${targetId} не найден.`,
        );

        if (changed) {
          await notifyAccessStatus(targetId, status);
        }
      } catch (error) {
        await api.sendMessage(chatId, error.message);
      }

      await showUserCard(chatId, targetId, Number(offset));
      return;
    }

    await showMenu(chatId, database.getUser(sender.id));
  }

  async function showMenu(chatId, user, prefix = '') {
    const isAdmin = user.role === 'admin';
    const heading = `Статус доступа: активен ✅\n${formatAccessTerm(user)}${isAdmin ? '\nРоль: администратор.' : ''}`;
    const text = prefix ? `${prefix}\n\n${heading}` : heading;

    await sendTrackedMessage(chatId, user.telegramId, 'status', text, {
      reply_markup: { remove_keyboard: true },
    });

    if (isAdmin) {
      await sendTrackedMessage(chatId, user.telegramId, 'admin_menu', 'Управление доступами:', {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    await sendTrackedMessage(chatId, user.telegramId, 'status', 'Открыть приложение:', {
      reply_markup: appInlineKeyboard(),
    });
  }

  async function sendAccessStatus(chatId, telegramId, access) {
    const user = access.user;
    const statusText = {
      revoked: 'Статус доступа: отозван ⛔',
      blocked: 'Статус доступа: заблокирован 🚫',
      expired: `Статус доступа: подписка закончилась ⏳\nДата окончания: ${formatSubscriptionDate(user?.accessExpiresAt)}`,
    }[access.state] || 'Статус доступа: не выдан ⏳';

    await sendTrackedMessage(chatId, telegramId, 'status', `${statusText}\n\nОбратитесь к администратору.`, {
      reply_markup: { remove_keyboard: true },
    });
  }

  async function sendBrowserLogin(chatId, telegramId, requestMessageId = null) {
    if (requestMessageId) {
      database.trackBotMessage(telegramId, chatId, requestMessageId, 'browser_request');
    }

    database.queueCurrentBotMessageForCleanup(telegramId, 'browser_link');
    await cleanupTrackedMessages(telegramId, { throwOnFailure: true });

    const magicLink = database.prepareMagicLinkDelivery(telegramId, magicLinkTtlSeconds);
    const url = magicLink ? buildMagicLink(magicLink.token) : null;

    if (!magicLink || !url) {
      if (magicLink) {
        database.abortMagicLinkDelivery(magicLink.token);
      }
      await api.sendMessage(
        chatId,
        'Не удалось создать безопасную ссылку. Проверьте PUBLIC_BASE_URL или обратитесь к администратору.',
      );
      return;
    }

    let sentMessage;

    try {
      sentMessage = await api.sendMessage(
        chatId,
        `Одноразовая ссылка для входа в браузере действует ${formatTtl(magicLinkTtlSeconds)}.`,
        {
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть в браузере 🔗', url }]],
          },
        },
      );
    } catch (error) {
      database.abortMagicLinkDelivery(magicLink.token);
      throw error;
    }

    const messageId = getSentMessageId(sentMessage);

    if (!messageId) {
      database.abortMagicLinkDelivery(magicLink.token);
      throw new Error('Telegram did not return a message ID for the browser link');
    }

    try {
      const finalized = database.finalizeMagicLinkDelivery(
        magicLink.token,
        telegramId,
        chatId,
        messageId,
      );

      if (finalized === null) {
        throw new Error('Could not activate the delivered browser link');
      }
    } catch (error) {
      database.abortMagicLinkDelivery(magicLink.token);
      await api.deleteMessage(chatId, messageId).catch(() => {});
      throw error;
    }

    await cleanupTrackedMessages(telegramId);
  }

  async function notifyAccessStatus(targetId, status) {
    try {
      if (status === 'active') {
        const user = database.getUser(targetId);
        await sendTrackedMessage(targetId, targetId, 'status', buildActiveAccessMessage(user, 'Доступ к PuppyApp восстановлен.'), {
          reply_markup: appInlineKeyboard(),
        });
        return;
      }

      await sendTrackedMessage(targetId, targetId, 'status', 'Статус доступа: отозван ⛔', {
        reply_markup: { remove_keyboard: true },
      });
    } catch (error) {
      console.warn(`[telegram-bot] could not notify user ${targetId}: ${getErrorMessage(error)}`);
    }
  }

  async function showUsers(chatId, requestedOffset = 0) {
    const offset = Math.max(0, Math.trunc(requestedOffset / USER_PAGE_SIZE) * USER_PAGE_SIZE);
    const page = database.listManagedUsers(USER_PAGE_SIZE + 1, offset);
    const hasNextPage = page.length > USER_PAGE_SIZE;
    const users = page.slice(0, USER_PAGE_SIZE);

    if (users.length === 0) {
      if (offset > 0) {
        await showUsers(chatId, Math.max(0, offset - USER_PAGE_SIZE));
        return;
      }

      await sendTrackedMessage(chatId, adminTelegramId, 'admin_menu', 'Пользователей пока нет.', {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    const statusIcon = { active: '✅', revoked: '⛔', blocked: '🚫', expired: '⌛' };
    const lines = users.map((entry) => {
      const identity = entry.username ? `@${entry.username}` : entry.firstName || 'без профиля';
      const accessState = getDisplayAccessState(entry);
      return `${statusIcon[accessState]} ${entry.telegramId} — ${identity}\n${formatAccessTerm(entry)}`;
    });
    const buttons = users.map((entry) => [{
      text: `Управлять ${entry.telegramId}`,
      callback_data: `admin:user:${entry.telegramId}:${offset}`,
    }]);

    const pagination = [];

    if (offset > 0) {
      pagination.push({
        text: '← Назад',
        callback_data: `admin:list:${Math.max(0, offset - USER_PAGE_SIZE)}`,
      });
    }

    if (hasNextPage) {
      pagination.push({
        text: 'Дальше →',
        callback_data: `admin:list:${offset + USER_PAGE_SIZE}`,
      });
    }

    if (pagination.length > 0) {
      buttons.push(pagination);
    }

    buttons.push([{ text: '➕ Добавить', callback_data: 'admin:add' }]);
    buttons.push([{ text: '↩️ В меню', callback_data: 'user:menu' }]);
    const pageNumber = Math.floor(offset / USER_PAGE_SIZE) + 1;
    await sendTrackedMessage(chatId, adminTelegramId, 'admin_menu', `Пользователи · страница ${pageNumber}:\n\n${lines.join('\n')}`, {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  async function showUserCard(chatId, targetId, offset = 0, prefix = '') {
    const user = database.getUser(targetId);

    if (!user || user.role === 'admin') {
      await showUsers(chatId, offset);
      return;
    }

    const identity = user.username
      ? `@${user.username}`
      : [user.firstName, user.lastName].filter(Boolean).join(' ') || 'профиль не заполнен';
    const accessState = getDisplayAccessState(user);
    const statusLabel = {
      active: 'активен ✅',
      expired: 'подписка закончилась ⌛',
      revoked: 'отозван ⛔',
      blocked: 'заблокирован 🚫',
    }[accessState];
    const lines = [
      prefix,
      `Пользователь ${user.telegramId}`,
      identity,
      `Статус: ${statusLabel}`,
      formatAccessTerm(user),
    ].filter(Boolean);
    const buttons = [
      [
        { text: '+7 дней', callback_data: `admin:extend:7:${targetId}:${offset}` },
        { text: '+30 дней', callback_data: `admin:extend:30:${targetId}:${offset}` },
      ],
      [
        { text: '+90 дней', callback_data: `admin:extend:90:${targetId}:${offset}` },
        { text: '+365 дней', callback_data: `admin:extend:365:${targetId}:${offset}` },
      ],
      [
        { text: '📅 Указать дату', callback_data: `admin:expiry:date:${targetId}:${offset}` },
        { text: '♾ Бессрочно', callback_data: `admin:expiry:forever:${targetId}:${offset}` },
      ],
      [{
        text: user.status === 'active' ? '⛔ Отозвать доступ' : '✅ Восстановить доступ',
        callback_data: `admin:${user.status === 'active' ? 'revoke' : 'activate'}:${targetId}:${offset}`,
      }],
      [{ text: '← К списку', callback_data: `admin:list:${offset}` }],
    ];

    await sendTrackedMessage(chatId, adminTelegramId, 'admin_menu', lines.join('\n'), {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  async function notifySubscriptionChanged(targetId, user) {
    if (!user) {
      return;
    }

    try {
      const message = user.status === 'active'
        ? buildActiveAccessMessage(user, 'Срок доступа к PuppyApp обновлён. Для продолжения работы войдите заново, если предыдущая подписка уже закончилась.')
        : `Срок подписки обновлён.\n${formatAccessTerm(user)}\n\nДоступ остаётся отозванным до отдельного восстановления администратором.`;
      await sendTrackedMessage(
        targetId,
        targetId,
        'status',
        message,
        { reply_markup: user.status === 'active' ? appInlineKeyboard() : { remove_keyboard: true } },
      );
      markShortSubscriptionWarningDelivered(user);
    } catch (error) {
      console.warn(`[telegram-bot] could not notify user ${targetId}: ${getErrorMessage(error)}`);
    }
  }

  async function sendSubscriptionNotification(notification) {
    if (notification.kind === 'warning') {
      await sendTrackedMessage(
        notification.telegramId,
        notification.telegramId,
        'status',
        `Подписка на PuppyApp закончится ${formatSubscriptionDate(notification.accessExpiresAt)}.\n\nЧтобы продлить доступ, обратитесь к администратору.`,
        { reply_markup: appInlineKeyboard() },
      );
      return;
    }

    await sendTrackedMessage(
      notification.telegramId,
      notification.telegramId,
      'status',
      `Подписка на PuppyApp закончилась ${formatSubscriptionDate(notification.accessExpiresAt)}.\n\nЧтобы продлить доступ, обратитесь к администратору.`,
      { reply_markup: { remove_keyboard: true } },
    );
  }

  function markShortSubscriptionWarningDelivered(user) {
    const timestamp = Math.floor(Date.now() / 1000);

    if (
      user.accessExpiresAt !== null &&
      user.accessExpiresAt > timestamp &&
      user.accessExpiresAt - timestamp <= subscriptionWarningSeconds
    ) {
      database.markSubscriptionNotificationDelivered(user.telegramId, user.accessExpiresAt, 'warning');
    }
  }

  async function sendTrackedMessage(chatId, telegramId, kind, text, extra = {}) {
    const sentMessage = await api.sendMessage(chatId, text, extra);
    const messageId = getSentMessageId(sentMessage);

    if (!messageId) {
      throw new Error(`Telegram did not return a message ID for ${kind}`);
    }

    try {
      database.trackBotMessage(telegramId, chatId, messageId, kind, true);
    } catch (error) {
      await api.deleteMessage(chatId, messageId).catch(() => {});
      throw error;
    }

    await cleanupTrackedMessages(telegramId);
    return sentMessage;
  }

  async function cleanupTrackedMessages(telegramId, { throwOnFailure = false } = {}) {
    const messages = database.listBotMessagesForCleanup(telegramId);
    let firstFailure = null;

    for (const message of messages) {
      try {
        await api.deleteMessage(message.chatId, message.messageId);
        database.removeTrackedBotMessage(message.chatId, message.messageId);
      } catch (error) {
        if (isTerminalDeleteError(error)) {
          database.removeTrackedBotMessage(message.chatId, message.messageId);
          console.warn(
            `[telegram-bot] stopped tracking stale ${message.kind} message Telegram cannot delete: ${getErrorMessage(error)}`,
          );
          continue;
        }

        firstFailure ??= error;
        console.warn(
          `[telegram-bot] could not delete stale ${message.kind} message: ${getErrorMessage(error)}`,
        );
      }
    }

    if (throwOnFailure && firstFailure) {
      throw firstFailure;
    }
  }

  function isTerminalDeleteError(error) {
    if (error?.statusCode !== 400 || error?.method !== 'deleteMessage') {
      return false;
    }

    return /message (?:to delete not found|can't be deleted(?: for everyone)?)/i.test(
      getErrorMessage(error),
    );
  }

  function adminKeyboard() {
    const buttons = appInlineKeyboard().inline_keyboard;
    buttons.push(
      [{ text: '➕ Выдать доступ', callback_data: 'admin:add' }],
      [{ text: '👥 Пользователи', callback_data: 'admin:list' }],
    );

    if (typeof requestServerRestart === 'function') {
      buttons.push([{ text: '🔄 Перезагрузить серверы', callback_data: 'admin:servers:restart' }]);
    }

    return { inline_keyboard: buttons };
  }

  function restartConfirmationKeyboard() {
    return { inline_keyboard: [
      [{ text: '⚠️ Да, перезагрузить оба', callback_data: 'admin:servers:restart:confirm' }],
      [{ text: 'Отмена', callback_data: 'admin:cancel' }],
    ] };
  }

  function subscriptionTermKeyboard(mode, targetId) {
    return { inline_keyboard: [
      [
        { text: '7 дней', callback_data: `admin:${mode}:7:${targetId}` },
        { text: '30 дней', callback_data: `admin:${mode}:30:${targetId}` },
      ],
      [
        { text: '90 дней', callback_data: `admin:${mode}:90:${targetId}` },
        { text: '365 дней', callback_data: `admin:${mode}:365:${targetId}` },
      ],
      [
        { text: '♾ Бессрочно', callback_data: `admin:${mode}:forever:${targetId}` },
        { text: '📅 Указать дату', callback_data: `admin:${mode}:date:${targetId}` },
      ],
      [{ text: 'Отмена', callback_data: 'admin:cancel' }],
    ] };
  }

  function appInlineKeyboard() {
    const buttons = [];
    const openButton = createOpenAppButton();

    if (openButton) {
      buttons.push([openButton]);
    }

    if (buildMagicLink('preview')) {
      buttons.push([{ text: BROWSER_BUTTON_TEXT, callback_data: 'user:browser' }]);
    }

    return { inline_keyboard: buttons };
  }

  function createOpenAppButton() {
    if (!miniAppUrl) {
      return null;
    }

    return {
      text: APP_BUTTON_TEXT,
      web_app: { url: miniAppUrl },
    };
  }

  function cancelKeyboard() {
    return {
      inline_keyboard: [[{ text: 'Отмена', callback_data: 'admin:cancel' }]],
    };
  }

  function buildMagicLink(token) {
    try {
      const url = new URL('/auth/magic', publicBaseUrl);

      if (url.protocol !== 'https:') {
        return null;
      }

      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      return null;
    }
  }

  function buildInviteLink(token) {
    const username = String(botUsername || '').replace(/^@/, '').trim();
    return /^[A-Za-z\d_]{5,32}$/.test(username)
      ? `https://t.me/${username}?start=invite_${token}`
      : null;
  }
}

export function formatTtl(ttlSeconds) {
  const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
  return `${minutes} ${pluralizeMinutes(minutes)}`;
}

export function parseMoscowEndOfDay(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value || '').trim());

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 2020 || year > 9999 ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day, 20, 59, 59) / 1000);
}

export function formatSubscriptionDate(timestamp) {
  if (!Number.isSafeInteger(Number(timestamp))) {
    return 'дата не указана';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(new Date(Number(timestamp) * 1000));
}

function formatAccessTerm(user) {
  if (user?.role === 'admin' || user?.accessExpiresAt === null) {
    return 'Срок: бессрочно';
  }
  if (!user?.accessExpiresAt) {
    return 'Срок: не указан';
  }
  const prefix = user.accessExpiresAt <= Math.floor(Date.now() / 1000) ? 'Срок истёк' : 'Доступ до';
  return `${prefix}: ${formatSubscriptionDate(user.accessExpiresAt)}`;
}

function buildActiveAccessMessage(user, detail) {
  return `Статус доступа: активен ✅\n${formatAccessTerm(user)}\n\n${detail}`;
}

function getDisplayAccessState(user) {
  if (user.status !== 'active') {
    return user.status;
  }
  return user.role !== 'admin' &&
    user.accessExpiresAt !== null &&
    user.accessExpiresAt <= Math.floor(Date.now() / 1000)
    ? 'expired'
    : 'active';
}

function pluralizeMinutes(minutes) {
  const lastTwoDigits = minutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'минут';
  }

  const lastDigit = minutes % 10;

  if (lastDigit === 1) {
    return 'минута';
  }

  return lastDigit >= 2 && lastDigit <= 4 ? 'минуты' : 'минут';
}

function getSentMessageId(result) {
  const messageId = Number(result?.message_id);
  return Number.isSafeInteger(messageId) && messageId > 0 ? messageId : null;
}

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
  if (typeof text !== 'string') {
    return null;
  }

  const match = /^\/([a-z_]+)(?:@[a-z\d_]+)?(?:\s+(.+))?$/i.exec(text.trim());
  return match ? { name: match[1].toLowerCase(), argument: match[2]?.trim() || '' } : null;
}

function cleanOptional(value, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'unknown error';
}
