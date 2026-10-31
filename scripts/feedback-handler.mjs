import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { deliverFeedback, readFeedbackForm, removeFeedbackFiles } from './feedback.mjs';
import { RequestError, hasAllowedOrigin, respondJson } from './http-utils.mjs';
import { createTelegramApi } from './telegram-api.mjs';

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

      const mediaUrls = [];
      if (submission.attachments && submission.attachments.length > 0) {
        try {
          const uploadsDir = join(dirname(authDatabasePath || '/app/data/auth.sqlite'), 'uploads');
          await mkdir(uploadsDir, { recursive: true });
          for (const attachment of submission.attachments) {
            const ext = extname(attachment.originalName || '') || (attachment.kind === 'photo' ? '.jpg' : '.mp4');
            const fileName = `${randomUUID()}${ext}`;
            await copyFile(attachment.path, join(uploadsDir, fileName));
            mediaUrls.push(`/admin/uploads/${fileName}`);
          }
        } catch (uploadError) {
          logError(`[feedback] Failed to save media attachments: ${uploadError?.message}`);
        }
      }

      let mediaUrl = null;
      if (mediaUrls.length === 1) {
        mediaUrl = mediaUrls[0];
      } else if (mediaUrls.length > 1) {
        mediaUrl = JSON.stringify(mediaUrls);
      }

      let ticketId = null;
      if (authDatabase?.createTrainerTicket) {
        try {
          ticketId = authDatabase.createTrainerTicket({
            user,
            submission,
            mediaUrl,
          });
        } catch (dbErr) {
          logError(`[feedback] Failed to save trainer ticket: ${dbErr?.message}`);
        }
      }

      if (deliver) {
        let deliveryApi = api;
        if (process.env.TICKET_BOT_TOKEN && deliver === deliverFeedback) {
          deliveryApi = createTelegramApi(process.env.TICKET_BOT_TOKEN, {
            fetchImpl: options.fetchImpl || api?.fetchImpl,
            uploadTimeoutMs: options.uploadTimeoutMs,
          });
        }

        const recipients = new Set();
        if (process.env.TICKET_CHAT_ID) {
          recipients.add(String(process.env.TICKET_CHAT_ID).trim());
        }

        if (authDatabase?.getAuthorizedBotTrainers) {
          try {
            const trainers = authDatabase.getAuthorizedBotTrainers();
            for (const trainer of trainers) {
              if (trainer.telegram_id) {
                recipients.add(String(trainer.telegram_id).trim());
              }
            }
          } catch (trainerErr) {
            logError(`[feedback] Failed to get authorized bot trainers: ${trainerErr?.message}`);
          }
        }

        if (recipients.size === 0 && adminTelegramId) {
          recipients.add(String(adminTelegramId).trim());
        }

        let firstSuccess = null;
        for (const targetId of recipients) {
          try {
            const deliveryResult = await deliver({
              api: deliveryApi,
              adminTelegramId: targetId,
              submission,
              user,
              ticketId,
            });

            if (deliveryResult?.rootMessageId && ticketId) {
              if (!firstSuccess) {
                firstSuccess = { rootMessageId: deliveryResult.rootMessageId, chatId: targetId };
              }
              if (authDatabase?.saveTicketTelegramMessage) {
                authDatabase.saveTicketTelegramMessage(ticketId, deliveryResult.rootMessageId, targetId);
              }
            }
          } catch (delivErr) {
            if (!ticketId && recipients.size === 1) {
              throw delivErr;
            }
            logError(`[feedback] Failed to deliver ticket to Telegram recipient ${targetId}: ${delivErr?.message}`);
          }
        }

        if (firstSuccess && ticketId && authDatabase?.setTrainerTicketTelegramMessage) {
          try {
            authDatabase.setTrainerTicketTelegramMessage(ticketId, firstSuccess.rootMessageId, String(firstSuccess.chatId));
          } catch (linkErr) {
            logError(`[feedback] Failed to associate ticket with telegram message: ${linkErr?.message}`);
          }
        }
      }

      try {
        await removeFiles(submission.temporaryDirectory);
        submission.temporaryDirectory = null;
      } catch {
        // Retry in finally; the orphan sweeper is the final fallback.
      }

      respondJson(response, 200, { ok: true });
      return;
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
