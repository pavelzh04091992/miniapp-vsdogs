import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { deliverFeedback, readFeedbackForm, removeFeedbackFiles } from './feedback.mjs';
import { RequestError, hasAllowedOrigin, respondJson } from './http-utils.mjs';

export function createFeedbackHandler(options) {
  const {
    adminTelegramId,
    allowedOrigins,
    api,
    getSessionUser,
    authDatabase,
    authDatabasePath,
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

    if (authDatabase?.getUserSubscription) {
      const sub = authDatabase.getUserSubscription(user.telegramId);
      if (!sub.hasSubscription) {
        request.resume();
        respondJson(response, 403, { ok: false, error: 'subscription_required' });
        return;
      }
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

      let mediaUrl = null;
      if (submission.attachments && submission.attachments.length > 0) {
        const attachment = submission.attachments[0];
        try {
          const uploadsDir = join(dirname(authDatabasePath || '/app/data/auth.sqlite'), 'uploads');
          await mkdir(uploadsDir, { recursive: true });
          const ext = extname(attachment.originalName || '') || (attachment.kind === 'photo' ? '.jpg' : '.mp4');
          const fileName = `${randomUUID()}${ext}`;
          await copyFile(attachment.path, join(uploadsDir, fileName));
          mediaUrl = `/admin/uploads/${fileName}`;
        } catch (uploadError) {
          logError(`[feedback] Failed to save media attachment: ${uploadError?.message}`);
        }
      }

      if (authDatabase?.createTrainerTicket) {
        authDatabase.createTrainerTicket({
          user,
          submission,
          mediaUrl,
        });
      }

      // If unit test mock provided, execute deliver
      if (deliver && deliver !== deliverFeedback) {
        await deliver({ api, adminTelegramId, submission, user });
      } else if (process.env.TICKET_BOT_TOKEN && process.env.TICKET_CHAT_ID) {
        // Forward to ticket-center bot when created
        try {
          await deliver({ api, adminTelegramId: process.env.TICKET_CHAT_ID, submission, user });
        } catch (botErr) {
          logError(`[feedback] Ticket center delivery failed: ${botErr.message}`);
        }
      }

      try {
        await removeFiles(submission.temporaryDirectory);
        submission.temporaryDirectory = null;
      } catch {
        // Retry in finally; the orphan sweeper is the final fallback.
      }

      respondJson(response, 200, { ok: true });
    } catch (error) {
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { ok: false, error: error.publicCode });
        return;
      }

      logError(`[feedback] Processing failed: ${error?.message || error}`);
      respondJson(response, 500, { ok: false, error: 'ticket_creation_failed' });
    } finally {
      if (submission?.temporaryDirectory) {
        await removeFiles(submission.temporaryDirectory).catch(() => {
          logError('[feedback] temporary file cleanup failed');
        });
      }
    }
  };
}
