import { openAsBlob } from 'node:fs';

export class TelegramApiError extends Error {
  constructor(method, message, statusCode = null) {
    super(`Telegram API ${method} failed: ${message}`);
    this.name = 'TelegramApiError';
    this.method = method;
    this.statusCode = statusCode;
  }
}

export function createTelegramApi(botToken, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 10 * 60_000;

  async function request(method, payload = {}) {
    let response;

    try {
      response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Do not retain the fetch error as a cause: implementations may include
      // the request URL, which contains the bot token, in diagnostic output.
      throw new TelegramApiError(method, 'network request failed');
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
      const description = typeof body?.description === 'string'
        ? body.description.slice(0, 500)
        : response.statusText || `HTTP ${response.status}`;
      throw new TelegramApiError(method, description, response.status);
    }

    return body.result;
  }

  async function requestMultipart(method, payload, fieldName, file) {
    const form = new FormData();

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    form.append(
      fieldName,
      await openAsBlob(file.path, { type: file.mimeType || 'application/octet-stream' }),
      file.originalName || 'attachment',
    );

    let response;

    try {
      response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(uploadTimeoutMs),
      });
    } catch {
      throw new TelegramApiError(method, 'network request failed');
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
      const description = typeof body?.description === 'string'
        ? body.description.slice(0, 500)
        : response.statusText || `HTTP ${response.status}`;
      throw new TelegramApiError(method, description, response.status);
    }

    return body.result;
  }

  return {
    request,
    answerCallbackQuery: (callbackQueryId, extra = {}) => request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...extra,
    }),
    sendMessage: (chatId, text, extra = {}) => request('sendMessage', {
      chat_id: chatId,
      text,
      ...extra,
    }),
    sendPhotoFile: (chatId, file, extra = {}) => requestMultipart('sendPhoto', {
      chat_id: chatId,
      ...extra,
    }, 'photo', file),
    sendVideoFile: (chatId, file, extra = {}) => requestMultipart('sendVideo', {
      chat_id: chatId,
      supports_streaming: true,
      ...extra,
    }, 'video', file),
    sendDocumentFile: (chatId, file, extra = {}) => requestMultipart('sendDocument', {
      chat_id: chatId,
      ...extra,
    }, 'document', file),
    deleteMessage: (chatId, messageId) => request('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    }),
    setChatMenuButton: (menuButton) => request('setChatMenuButton', {
      menu_button: menuButton,
    }),
  };
}
