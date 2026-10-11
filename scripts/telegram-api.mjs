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
  };
}
