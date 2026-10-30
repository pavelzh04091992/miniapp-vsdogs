import https from 'node:https';
import db from '../../db/database.js';
import { logAudit } from '../auth.js';

const TICKET_BOT_TOKEN = process.env.TICKET_BOT_TOKEN || '9208966722:AAHw2JkQg4FkBPEPifF1CA5kTLu54thCV1s';
const STUDENT_BOT_TOKEN = process.env.BOT_TOKEN;
const TICKET_CHAT_ID = process.env.TICKET_CHAT_ID;
const EGRESS_HOST = process.env.TELEGRAM_EGRESS_HOST || 'telegram-egress';

/**
 * Нормализация телефонного номера (оставляет только цифры, заменяет 8 на 7)
 */
export function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  return digits;
}

/**
 * Поиск сотрудника в admin_users по номеру телефона
 */
export function findAdminUserByPhone(phone, customDb = db) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  try {
    const users = customDb.prepare('SELECT * FROM admin_users WHERE is_active = 1').all();
    for (const u of users) {
      if (u.phone && normalizePhone(u.phone) === norm) {
        return u;
      }
    }
  } catch (err) {
    console.error('[ticketBotService] findAdminUserByPhone error:', err);
  }
  return null;
}

/**
 * Проверка прав доступа сотрудника к боту кинологов по его Telegram ID или @username
 */
export function isTrainerAuthorizedForBot(fromUser, customDb = db) {
  if (!fromUser || !fromUser.id) return null;

  const tgId = String(fromUser.id).trim();
  const tgUsername = fromUser.username ? String(fromUser.username).replace(/^@/, '').toLowerCase().trim() : '';

  try {
    const row = customDb.prepare(`
      SELECT * FROM admin_users
      WHERE is_active = 1
        AND (can_answer_tickets_bot = 1 OR is_owner = 1)
        AND (
          (telegram_id IS NOT NULL AND telegram_id != '' AND telegram_id = ?)
          OR
          (telegram_username IS NOT NULL AND telegram_username != '' AND LOWER(telegram_username) = ?)
        )
      LIMIT 1
    `).get(tgId, tgUsername || null);

    return row || null;
  } catch (err) {
    console.error('[ticketBotService] Ошибка проверки прав тренера:', err);
    return null;
  }
}

/**
 * Универсальный вызов Telegram API (поддерживает прямой режим и egress-прокси)
 */
export function callTelegramApi(token, method, payload = {}) {
  const isDirect = process.env.TELEGRAM_EGRESS_MODE === 'direct' || process.env.NODE_ENV !== 'production';
  const host = isDirect ? 'api.telegram.org' : EGRESS_HOST;
  const jsonPayload = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request({
      host,
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      servername: 'api.telegram.org',
      headers: {
        'Host': 'api.telegram.org',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonPayload),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || `Telegram API ${method} failed`));
          }
        } catch {
          reject(new Error(`Invalid JSON response from Telegram API: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(jsonPayload);
    req.end();
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Отправка ответа ученику в его личный клиентский бот
 */
export async function sendAnswerToStudent({ studentTelegramId, studentName, questionText, trainerName, answerText }, callApi = callTelegramApi) {
  if ((!STUDENT_BOT_TOKEN && callApi === callTelegramApi) || !studentTelegramId) {
    console.error('[ticketBotService] BOT_TOKEN or studentTelegramId is missing');
    return false;
  }

  const text = `🐾 <b>Ответ кинолога на ваш вопрос</b>\n\n` +
    `Здравствуйте, ${escapeHtml(studentName || 'ученик')}!\n\n` +
    `❓ <b>Ваш вопрос:</b>\n<i>${escapeHtml(questionText)}</i>\n\n` +
    `💬 <b>Ответ кинолога (${escapeHtml(trainerName)}):</b>\n${escapeHtml(answerText)}\n\n` +
    `Желаем продуктивных тренировок! 🐶`;

  return callApi(STUDENT_BOT_TOKEN || 'mock-token', 'sendMessage', {
    chat_id: studentTelegramId,
    text,
    parse_mode: 'HTML',
  });
}

/**
 * Обработка одного входящего Update от @ticket_centr_bot
 */
export async function handleTicketBotUpdate(update, customDb = db, callApi = callTelegramApi) {
  // 1. Нажатие на кнопку (callback_query)
  if (update.callback_query) {
    const query = update.callback_query;
    const data = String(query.data || '');
    const fromUser = query.from;

    if (data.startsWith('ticket_take:')) {
      const ticketId = Number(data.split(':')[1]);
      if (!ticketId) return;

      // Проверка авторизации: есть ли у сотрудника галочка в админке?
      const trainer = isTrainerAuthorizedForBot(fromUser, customDb);
      if (!trainer) {
        await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: '⛔ У вас нет доступа к ответам на тикеты.\nАдминистратор школы должен включить доступ для вашего аккаунта в панели управления (раздел «Команда»).',
          show_alert: true,
        }).catch(() => {});
        return;
      }

      // Получаем тикет
      const ticket = customDb.prepare('SELECT * FROM trainer_tickets WHERE id = ?').get(ticketId);
      if (!ticket) {
        await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'Вопрос не найден в базе данных.',
          show_alert: true,
        }).catch(() => {});
        return;
      }

      if (ticket.status === 'in_progress') {
        const who = ticket.assigned_trainer_name || 'коллегой';
        await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: `⚠️ Этот вопрос уже взят в работу (${who})!`,
          show_alert: true,
        }).catch(() => {});
        return;
      }

      if (ticket.status === 'answered') {
        await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: '✅ На этот вопрос уже отправлен ответ.',
          show_alert: true,
        }).catch(() => {});
        return;
      }

      // Закрепляем за кинологом
      customDb.prepare(`
        UPDATE trainer_tickets 
        SET status = 'in_progress', assigned_trainer_id = ?, assigned_trainer_name = ?
        WHERE id = ?
      `).run(trainer.id, trainer.full_name, ticketId);

      logAudit(trainer.id, trainer.full_name, 'TAKE_TICKET', null, `Взят в работу вопрос #${ticketId} через Telegram-бота`, 'telegram');

      await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: `✅ Вопрос взят в работу (${trainer.full_name})!`,
      }).catch(() => {});

      // Обновляем клавиатуру и статус в сообщении
      if (query.message?.chat?.id && query.message?.message_id) {
        const hasAttachments = Boolean(ticket.media_url);
        const inlineKeyboard = [
          [{ text: '↩️ Вернуть в общие', callback_data: `ticket_release:${ticketId}` }],
        ];
        if (hasAttachments) {
          inlineKeyboard.push([
            { text: '📎 Посмотреть вложения в админке', url: `https://admin.miniapp-vsdogs.ru/admin/tickets?tab=my#ticket-${ticketId}` }
          ]);
        } else {
          inlineKeyboard.push([
            { text: '🌐 Открыть в тикет-центре', url: 'https://admin.miniapp-vsdogs.ru/admin/tickets?tab=my' }
          ]);
        }

        await callApi(TICKET_BOT_TOKEN, 'editMessageReplyMarkup', {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }).catch(() => {});

        await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
          chat_id: query.message.chat.id,
          text: `✍️ <b>Вопрос #${ticketId} взят в работу кинологом: ${escapeHtml(trainer.full_name)}</b>\n\nЧтобы отправить ответ ученику, ответьте <b>Reply</b> на исходное сообщение с вопросом.`,
          parse_mode: 'HTML',
          reply_parameters: { message_id: query.message.message_id },
        }).catch(() => {});
      }
      return;
    }

    if (data.startsWith('ticket_release:')) {
      const ticketId = Number(data.split(':')[1]);
      if (!ticketId) return;

      const trainer = isTrainerAuthorizedForBot(fromUser, customDb);
      if (!trainer) {
        await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: '⛔ У вас нет доступа к управлению тикетами.',
          show_alert: true,
        }).catch(() => {});
        return;
      }

      customDb.prepare(`
        UPDATE trainer_tickets 
        SET status = 'new', assigned_trainer_id = NULL, assigned_trainer_name = NULL 
        WHERE id = ?
      `).run(ticketId);

      await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Вопрос возвращен в общие нераспределенные.',
      }).catch(() => {});

      if (query.message?.chat?.id && query.message?.message_id) {
        const ticket = customDb.prepare('SELECT * FROM trainer_tickets WHERE id = ?').get(ticketId);
        const hasAttachments = Boolean(ticket?.media_url);
        const inlineKeyboard = [
          [{ text: '✋ Взять в работу', callback_data: `ticket_take:${ticketId}` }],
        ];
        if (hasAttachments) {
          inlineKeyboard.push([
            { text: '📎 Посмотреть вложения в админке', url: `https://admin.miniapp-vsdogs.ru/admin/tickets?tab=new#ticket-${ticketId}` }
          ]);
        } else {
          inlineKeyboard.push([
            { text: '🌐 Открыть в тикет-центре', url: 'https://admin.miniapp-vsdogs.ru/admin/tickets?tab=new' }
          ]);
        }

        await callApi(TICKET_BOT_TOKEN, 'editMessageReplyMarkup', {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }).catch(() => {});
      }
      return;
    }

    await callApi(TICKET_BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: query.id }).catch(() => {});
    return;
  }

  // 2. Входящее сообщение
  if (update.message) {
    const msg = update.message;
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';

    // Обработка отправленного контакта (кнопка "Поделиться контактом")
    if (msg.contact) {
      const contactPhone = msg.contact.phone_number;
      const normPhone = normalizePhone(contactPhone);
      const user = findAdminUserByPhone(normPhone, customDb);

      if (user) {
        const tgId = String(msg.from?.id || msg.contact.user_id || '').trim();
        const tgUsername = msg.from?.username ? String(msg.from.username).replace(/^@/, '').trim() : null;

        customDb.prepare(`
          UPDATE admin_users 
          SET telegram_id = COALESCE(?, telegram_id),
              telegram_username = COALESCE(?, telegram_username)
          WHERE id = ?
        `).run(tgId || null, tgUsername || null, user.id);

        if (user.can_answer_tickets_bot || user.is_owner) {
          await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
            chat_id: msg.chat.id,
            text: `✅ <b>Авторизация успешна!</b>\n\n` +
              `Здравствуйте, <b>${escapeHtml(user.full_name)}</b>!\n` +
              `Номер телефона: <code>+${normPhone}</code>\n` +
              `Доступ к ответам на вопросы: <b>Разрешен ✅</b>\n\n` +
              `Сюда и в рабочий чат поступают вопросы учеников.\n` +
              `Нажмите кнопку <b>«Взять в работу»</b> под вопросом, а затем отправьте ответ через <b>Reply</b>.`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true },
          }).catch(() => {});
        } else {
          await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
            chat_id: msg.chat.id,
            text: `⚠️ <b>Доступ ограничен</b>\n\n` +
              `Здравствуйте, <b>${escapeHtml(user.full_name)}</b>!\n` +
              `Ваш номер <code>+${normPhone}</code> найден в списке сотрудников, но у вашей учетной записи <b>не включена галочка «Отвечает на вопросы в боте»</b>.\n\n` +
              `Обратитесь к администратору (Дарье), чтобы вам включили доступ в разделе «Команда» панели управления.`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true },
          }).catch(() => {});
        }
      } else {
        await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `⛔ <b>Сотрудник не найден</b>\n\n` +
            `Номер телефона <code>+${normPhone}</code> не найден в списке сотрудников школы VS Dogs.\n\n` +
            `Пожалуйста, убедитесь, что администратор добавил ваш номер в разделе «Команда» панели управления: https://admin.miniapp-vsdogs.ru/admin/team`,
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        }).catch(() => {});
      }
      return;
    }

    // Команда /start в личке с ботом
    if (text === '/start' || text.startsWith('/start ')) {
      const trainer = isTrainerAuthorizedForBot(msg.from, customDb);
      if (trainer) {
        await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `👋 <b>Добро пожаловать в тикет-центр школы VS Dogs!</b>\n\n` +
            `Вы авторизованы как сотрудник: <b>${escapeHtml(trainer.full_name)}</b>\n` +
            `Доступ к ответам на тикеты: <b>Включен</b> ✅\n\n` +
            `Сюда и в рабочий чат поступают вопросы учеников по урокам и поведению собак.\n` +
            `Нажмите кнопку <b>«Взять в работу»</b> под вопросом, а затем отправьте ответ через <b>Reply</b>.`,
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        }).catch(() => {});
      } else {
        const tgId = msg.from?.id || '—';
        const tgUser = msg.from?.username ? `@${msg.from.username}` : 'нет ника';
        await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `👋 <b>Добро пожаловать в тикет-центр школы VS Dogs!</b>\n\n` +
            `Этот бот предназначен для кинологов и сотрудников школы.\n\n` +
            `Для входа нажмите кнопку <b>«📱 Поделиться контактом»</b> ниже, чтобы подтвердить ваш номер телефона.\n\n` +
            `<i>(Ваш Telegram ID: <code>${tgId}</code>, ник: <b>${escapeHtml(tgUser)}</b>)</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Поделиться контактом', request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }).catch(() => {});
      }
      return;
    }

    // Ответ на тикет через Reply в группе или личке
    if (msg.reply_to_message) {
      const repliedMessageId = msg.reply_to_message.message_id;
      const ticket = customDb.prepare(`
        SELECT t.*, u.telegram_id as student_telegram_id, u.first_name, u.last_name, u.username as student_username
        FROM trainer_tickets t
        JOIN users u ON (u.telegram_id = t.user_id OR CAST(u.rowid AS TEXT) = CAST(t.user_id AS TEXT) OR u.id = t.user_id)
        WHERE t.tg_message_id = ?
      `).get(repliedMessageId);

      if (ticket) {
        if (ticket.status === 'answered') {
          await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
            chat_id: msg.chat.id,
            text: `⚠️ На тикет #${ticket.id} ответ уже был отправлен ранее (${escapeHtml(ticket.answered_by_name || 'кинологом')}).`,
            reply_parameters: { message_id: msg.message_id },
          }).catch(() => {});
          return;
        }

        // Проверяем права тренера
        const trainer = isTrainerAuthorizedForBot(msg.from, customDb);
        if (!trainer) {
          await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
            chat_id: msg.chat.id,
            text: `⛔ <b>Отказано в доступе.</b>\nУ вас нет прав для отправки ответов ученикам в этом боте.\nОбратитесь к администратору школы для включения доступа в разделе «Команда».`,
            parse_mode: 'HTML',
            reply_parameters: { message_id: msg.message_id },
          }).catch(() => {});
          return;
        }

        const answerText = text;
        if (!answerText) return;

        // 1. Фиксируем ответ в БД
        customDb.prepare(`
          UPDATE trainer_tickets 
          SET status = 'answered', 
              answer_text = ?, 
              answered_by_name = ?, 
              assigned_trainer_id = ?, 
              answered_at = datetime('now')
          WHERE id = ?
        `).run(answerText, trainer.full_name, trainer.id, ticket.id);

        logAudit(trainer.id, trainer.full_name, 'ANSWER_TICKET', ticket.user_id, `Ответ на вопрос #${ticket.id} через Telegram-бота`, 'telegram');

        // 2. Отправляем ответ ученику в клиентский бот (@testpuppybot)
        if (ticket.student_telegram_id) {
          await sendAnswerToStudent({
            studentTelegramId: ticket.student_telegram_id,
            studentName: ticket.first_name,
            questionText: ticket.question_text,
            trainerName: trainer.full_name,
            answerText,
          }, callApi).catch(err => {
            console.error('[ticketBotService] Ошибка отправки ответа ученику:', err);
          });
        }

        // 3. Подтверждаем в чате кинологов
        await callApi(TICKET_BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `🎉 <b>Ответ на вопрос #${ticket.id} успешно доставлен ученику (${escapeHtml(ticket.first_name || 'Ученик')}) в Telegram!</b>\nОтветил: ${escapeHtml(trainer.full_name)}`,
          parse_mode: 'HTML',
          reply_parameters: { message_id: msg.message_id },
        }).catch(() => {});

        // 4. Очищаем кнопки у исходного сообщения с вопросом
        if (ticket.tg_chat_id && ticket.tg_message_id) {
          await callApi(TICKET_BOT_TOKEN, 'editMessageReplyMarkup', {
            chat_id: ticket.tg_chat_id,
            message_id: ticket.tg_message_id,
            reply_markup: { inline_keyboard: [] },
          }).catch(() => {});
        }
      }
    }
  }
}

/**
 * Фоновый цикл Long-Polling для @ticket_centr_bot
 */
let pollerActive = false;
let pollerStopping = false;

export async function startTicketBotPoller({ botToken = TICKET_BOT_TOKEN, customDb = db } = {}) {
  if (pollerActive) return;
  pollerActive = true;
  pollerStopping = false;

  console.log(`[ticketBotService] Запуск слушателя бота кинологов (@ticket_centr_bot)...`);

  // Удаляем webhook у служебного бота, если он был установлен
  try {
    await callApi(botToken, 'deleteWebhook', { drop_pending_updates: false });
  } catch (err) {
    console.warn('[ticketBotService] Предупреждение при deleteWebhook:', err.message);
  }

  let offset = 0;

  (async () => {
    while (!pollerStopping) {
      try {
        const updates = await callApi(botToken, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        });

        if (Array.isArray(updates)) {
          for (const update of updates) {
            try {
              await handleTicketBotUpdate(update, customDb);
            } catch (err) {
              console.error('[ticketBotService] Ошибка обработки update:', err);
            }
            offset = Number(update.update_id) + 1;
          }
        }
      } catch (pollErr) {
        if (!pollerStopping) {
          // Небольшая задержка при ошибках сети
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    }
    pollerActive = false;
  })();
}

export function stopTicketBotPoller() {
  pollerStopping = true;
}
