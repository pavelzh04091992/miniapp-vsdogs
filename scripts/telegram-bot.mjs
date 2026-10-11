import { normalizeTelegramId } from './telegram-auth.mjs';
import { createRateLimiter } from './rate-limit.mjs';
import { createTelegramApi } from './telegram-api.mjs';

export { createTelegramApi } from './telegram-api.mjs';

const USER_PAGE_SIZE = 8;

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
  } = options;

  if (!botToken || !adminTelegramId) {
    return { enabled: false, handleUpdate: async () => {} };
  }

  const api = createTelegramApi(botToken, {
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

    if (
      currentUser.role === 'admin' &&
      database.getBotState(sender.id, botStateTtlSeconds) === 'awaiting_grant_id'
    ) {
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
    database.clearBotState(sender.id);
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

    let userWasNotified = false;

    try {
      await api.sendMessage(targetId, 'Вам открыт доступ к приложению.', {
        reply_markup: userKeyboard(),
      });
      userWasNotified = true;
    } catch (error) {
      const invite = database.createInvite(targetId, actorId, inviteTtlSeconds);
      const link = buildInviteLink(invite.token);
      const suffix = link
        ? `\n\nПользователь ещё не открыл бота. Передайте ему ссылку:\n${link}`
        : '\n\nБот не смог написать пользователю. Настройте BOT_USERNAME, чтобы получать ссылки-приглашения.';

      await api.sendMessage(chatId, `Доступ для ${targetId} выдан.${suffix}`, {
        reply_markup: adminKeyboard(),
      });
      console.warn(`[telegram-bot] could not notify user ${targetId}: ${getErrorMessage(error)}`);
    }

    if (userWasNotified) {
      await api.sendMessage(chatId, `Доступ для ${targetId} выдан, пользователь уведомлён.`, {
        reply_markup: adminKeyboard(),
      });
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
      database.clearBotState(sender.id);
      await showMenu(chatId, database.getUser(sender.id));
      return;
    }

    if (action === 'user:browser') {
      const magicLink = database.createMagicLink(sender.id, sender.id, magicLinkTtlSeconds);
      const url = magicLink ? buildMagicLink(magicLink.token) : null;

      await api.sendMessage(
        chatId,
        url
          ? `Одноразовая ссылка для входа в браузере действует ${formatTtl(magicLinkTtlSeconds)}.`
          : 'Не удалось создать безопасную ссылку. Проверьте PUBLIC_BASE_URL или обратитесь к администратору.',
        url ? {
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[{ text: 'Войти в браузере', url }]],
          },
        } : {},
      );
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

    const listAction = /^admin:list(?::(\d{1,6}))?$/.exec(action);

    if (listAction) {
      await showUsers(chatId, Number(listAction[1] || 0));
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
    await api.sendMessage(chatId, `Пользователи · страница ${pageNumber}:\n\n${lines.join('\n')}`, {
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

    const browserButton = createBrowserLoginButton();

    if (browserButton) {
      rows.splice(openButton ? 1 : 0, 0, [browserButton]);
    }

    return { inline_keyboard: rows };
  }

  function userKeyboard() {
    const openButton = createOpenAppButton();
    const browserButton = createBrowserLoginButton();
    const rows = [openButton, browserButton].filter(Boolean).map((button) => [button]);
    return rows.length ? { inline_keyboard: rows } : undefined;
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

  function createBrowserLoginButton() {
    return buildMagicLink('preview')
      ? { text: '🌐 Войти в браузере', callback_data: 'user:browser' }
      : null;
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

function formatTtl(ttlSeconds) {
  const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
  return `${minutes} мин.`;
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
