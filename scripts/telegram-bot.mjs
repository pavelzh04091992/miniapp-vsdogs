import { normalizeTelegramId } from './telegram-auth.mjs';

export function createTelegramBot(options) {
  const {
    botToken,
    botUsername,
    miniAppUrl,
    adminTelegramId,
    database,
    fetchImpl = fetch,
    inviteTtlSeconds = 86_400,
  } = options;

  if (!botToken || !adminTelegramId) {
    return { enabled: false, handleUpdate: async () => {} };
  }

  const api = createTelegramApi(botToken, fetchImpl);

  return {
    enabled: true,

    async handleUpdate(update) {
      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
      }

      if (update.message?.chat?.type === 'private') {
        await handlePrivateMessage(update.message);
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

    const currentUser = database.getUser(sender.id);

    if (!currentUser || currentUser.status !== 'active') {
      await api.sendMessage(message.chat.id, 'Доступ к приложению не выдан. Обратитесь к администратору.');
      return;
    }

    database.touchTelegramUser(sender);

    if (currentUser.role === 'admin' && database.getBotState(sender.id) === 'awaiting_grant_id') {
      await handleGrantInput(message.chat.id, sender.id, message.text);
      return;
    }

    await showMenu(message.chat.id, database.getUser(sender.id));
  }

  async function handleStart(chatId, sender, argument) {
    if (argument?.startsWith('invite_')) {
      const result = database.consumeInvite(argument.slice('invite_'.length), sender.id);

      if (!result.ok) {
        const text = result.reason === 'telegram_id_mismatch'
          ? 'Это приглашение предназначено для другого Telegram-аккаунта.'
          : 'Приглашение недействительно или уже истекло.';
        await api.sendMessage(chatId, text);
        return;
      }
    }

    let user = database.getUser(sender.id);

    if (!user || user.status !== 'active') {
      await api.sendMessage(chatId, 'Доступ к приложению не выдан. Обратитесь к администратору.');
      return;
    }

    database.touchTelegramUser(sender);
    user = database.getUser(sender.id);
    await showMenu(chatId, user, 'Добро пожаловать!');
  }

  async function handleGrantInput(chatId, actorId, text) {
    const targetId = normalizeTelegramId(text);

    if (!targetId) {
      await api.sendMessage(chatId, 'Пришлите числовой Telegram ID или нажмите «Отмена».', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (targetId === adminTelegramId) {
      database.clearBotState(actorId);
      await api.sendMessage(chatId, 'Этот Telegram ID уже является администратором.', {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    database.grantUser(targetId, actorId);
    database.clearBotState(actorId);

    try {
      await api.sendMessage(targetId, 'Вам открыт доступ к приложению.', {
        reply_markup: userKeyboard(),
      });
      await api.sendMessage(chatId, `Доступ для ${targetId} выдан, пользователь уведомлён.`, {
        reply_markup: adminKeyboard(),
      });
    } catch (error) {
      const invite = database.createInvite(targetId, actorId, inviteTtlSeconds);
      const link = buildInviteLink(invite.token);
      const suffix = link
        ? `\n\nПользователь ещё не открыл бота. Передайте ему ссылку:\n${link}`
        : '\n\nБот не смог написать пользователю. Настройте BOT_USERNAME, чтобы получать ссылки-приглашения.';

      await api.sendMessage(chatId, `Доступ для ${targetId} выдан.${suffix}`, {
        reply_markup: adminKeyboard(),
      });
      console.warn(`[telegram-bot] could not notify user ${targetId}: ${error.message}`);
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

    const user = database.getUser(sender.id);
    const chatId = query.message?.chat?.id ?? sender.id;

    if (!user || user.status !== 'active') {
      await api.sendMessage(chatId, 'Доступ к приложению не выдан.');
      return;
    }

    database.touchTelegramUser(sender);
    const action = String(query.data || '');

    if (action === 'user:menu') {
      await showMenu(chatId, database.getUser(sender.id));
      return;
    }

    if (user.role !== 'admin') {
      await api.sendMessage(chatId, 'Эта команда доступна только администратору.');
      return;
    }

    if (action === 'admin:add') {
      database.setBotState(sender.id, 'awaiting_grant_id');
      await api.sendMessage(chatId, 'Отправьте числовой Telegram ID пользователя.', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (action === 'admin:cancel') {
      database.clearBotState(sender.id);
      await showMenu(chatId, database.getUser(sender.id), 'Действие отменено.');
      return;
    }

    if (action === 'admin:list') {
      await showUsers(chatId);
      return;
    }

    const statusAction = /^(admin):(revoke|activate):([1-9]\d{0,19})$/.exec(action);

    if (statusAction) {
      const [, , operation, targetId] = statusAction;
      const status = operation === 'activate' ? 'active' : 'revoked';

      try {
        const changed = database.setUserStatus(targetId, status, sender.id);
        await api.sendMessage(
          chatId,
          changed
            ? `Доступ для ${targetId}: ${status === 'active' ? 'активен' : 'отозван'}.`
            : `Пользователь ${targetId} не найден.`,
        );
      } catch (error) {
        await api.sendMessage(chatId, error.message);
      }

      await showUsers(chatId);
      return;
    }

    await showMenu(chatId, database.getUser(sender.id));
  }

  async function showMenu(chatId, user, prefix = '') {
    const isAdmin = user.role === 'admin';
    const name = user.firstName ? `, ${user.firstName}` : '';
    const heading = isAdmin ? `Панель администратора${name}.` : `Ваш доступ активен${name}.`;
    const text = prefix ? `${prefix}\n\n${heading}` : heading;

    await api.sendMessage(chatId, text, {
      reply_markup: isAdmin ? adminKeyboard() : userKeyboard(),
    });
  }

  async function showUsers(chatId) {
    const users = database.listUsers(30).filter((entry) => entry.role !== 'admin');

    if (users.length === 0) {
      await api.sendMessage(chatId, 'Пользователей пока нет.', {
        reply_markup: adminKeyboard(),
      });
      return;
    }

    const statusIcon = { active: '✅', revoked: '⛔', blocked: '🚫' };
    const lines = users.map((entry) => {
      const identity = entry.username ? `@${entry.username}` : entry.firstName || 'без профиля';
      return `${statusIcon[entry.status]} ${entry.telegramId} — ${identity}`;
    });
    const buttons = users.map((entry) => [{
      text: `${entry.status === 'active' ? 'Отозвать' : 'Активировать'} ${entry.telegramId}`,
      callback_data: `admin:${entry.status === 'active' ? 'revoke' : 'activate'}:${entry.telegramId}`,
    }]);

    buttons.push([{ text: '➕ Добавить', callback_data: 'admin:add' }]);
    buttons.push([{ text: '↩️ В меню', callback_data: 'user:menu' }]);
    await api.sendMessage(chatId, `Пользователи:\n\n${lines.join('\n')}`, {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  function adminKeyboard() {
    const rows = [
      [{ text: '➕ Выдать доступ', callback_data: 'admin:add' }],
      [{ text: '👥 Пользователи', callback_data: 'admin:list' }],
    ];
    const openButton = createOpenAppButton();

    if (openButton) {
      rows.unshift([openButton]);
    }

    return { inline_keyboard: rows };
  }

  function userKeyboard() {
    const openButton = createOpenAppButton();
    return openButton ? { inline_keyboard: [[openButton]] } : undefined;
  }

  function createOpenAppButton() {
    if (!miniAppUrl) {
      return null;
    }

    return {
      text: '🐾 Открыть приложение',
      web_app: { url: miniAppUrl },
    };
  }

  function cancelKeyboard() {
    return {
      inline_keyboard: [[{ text: 'Отмена', callback_data: 'admin:cancel' }]],
    };
  }

  function buildInviteLink(token) {
    const username = String(botUsername || '').replace(/^@/, '').trim();
    return /^[A-Za-z\d_]{5,32}$/.test(username)
      ? `https://t.me/${username}?start=invite_${token}`
      : null;
  }
}

export function createTelegramApi(botToken, fetchImpl = fetch) {
  async function request(method, payload = {}) {
    const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body.ok) {
      throw new Error(`Telegram API ${method} failed: ${body.description || response.statusText}`);
    }

    return body.result;
  }

  return {
    answerCallbackQuery: (callbackQueryId) => request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
    }),
    sendMessage: (chatId, text, extra = {}) => request('sendMessage', {
      chat_id: chatId,
      text,
      ...extra,
    }),
  };
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
