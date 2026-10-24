import { deliverFeedback, readFeedbackForm, removeFeedbackFiles } from './feedback.mjs';
import { RequestError, hasAllowedOrigin, respondJson } from './http-utils.mjs';

export function createFeedbackHandler(options) {
  const {
    adminTelegramId,
    allowedOrigins,
    api,
    getSessionUser,
    rateLimiter,
    parseForm = readFeedbackForm,
    deliver = deliverFeedback,
    removeFiles = removeFeedbackFiles,
    logError = (message) => console.error(message),
  } = options;

  return async function handleFeedback(request, response) {
    if (request.method !== 'POST') {
      respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
      return;
    }

    if (!hasAllowedOrigin(request, allowedOrigins)) {
      request.resume();
      respondJson(response, 403, { ok: false, error: 'origin_not_allowed' });
      return;
    }

    const user = getSessionUser(request);

    if (!user) {
      request.resume();
      respondJson(response, 401, { ok: false, error: 'not_authenticated' });
      return;
    }

    const rateLimit = rateLimiter.consume(user.telegramId);

    if (!rateLimit.allowed) {
      request.resume();
      respondJson(
        response,
        429,
        { ok: false, error: 'rate_limited' },
        { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      );
      return;
    }

    let submission;

    try {
      submission = await parseForm(request);
      await deliver({ api, adminTelegramId, submission, user });

      try {
        await removeFiles(submission.temporaryDirectory);
        submission.temporaryDirectory = null;
      } catch {
        // Retry in `finally`; the orphan sweeper is the final fallback.
      }

      respondJson(response, 200, { ok: true });
    } catch (error) {
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { ok: false, error: error.publicCode });
        return;
      }

      logError('[feedback] Telegram delivery failed');
      respondJson(response, 502, { ok: false, error: 'telegram_delivery_failed' });
    } finally {
      if (submission?.temporaryDirectory) {
        await removeFiles(submission.temporaryDirectory).catch(() => {
          logError('[feedback] temporary file cleanup failed');
        });
      }
    }
  };
}
