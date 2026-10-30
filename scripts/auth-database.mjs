import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createOpaqueToken,
  hashOpaqueToken,
  isOpaqueToken,
  normalizeTelegramId,
} from './telegram-auth.mjs';

export function createAuthDatabase(databasePath, options = {}) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);

  if (databasePath !== ':memory:') {
    chmodSync(databasePath, 0o600);
  }
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  migrate(database);

  const statements = prepareStatements(database);
  cleanupExpiredData(statements, now());

  return {
    close: () => database.close(),

    cleanup() {
      cleanupExpiredData(statements, now());
    },

    ensureAdmin(telegramId) {
      const id = requireTelegramId(telegramId);
      const timestamp = now();

      transaction(database, () => {
        statements.demoteOtherAdmins.run(timestamp, id);
        statements.ensureAdmin.run(id, timestamp, timestamp);
      });

      return mapUser(statements.getUser.get(id));
    },

    getUser(telegramId) {
      const id = normalizeTelegramId(telegramId);
      return id ? mapUser(statements.getUser.get(id)) : null;
    },

    getUserAccess(telegramId) {
      const id = normalizeTelegramId(telegramId);
      const user = id ? mapUser(statements.getUser.get(id)) : null;
      return { state: getUserAccessState(user, now()), user };
    },

    getUserSubscription(telegramId) {
      const id = normalizeTelegramId(telegramId);
      if (!id) return { hasSubscription: false, tariffId: 'free', tariffName: 'Базовый (Free)' };

      const user = statements.getUser.get(id);
      if (!user) return { hasSubscription: false, tariffId: 'free', tariffName: 'Базовый (Free)' };

      if (statements.getActiveLicense) {
        try {
          const activeLic = statements.getActiveLicense.get(user.id);
          if (activeLic && activeLic.tariff_id && activeLic.tariff_id !== 'free') {
            if (activeLic.tariff_id === 'lifetime' || !activeLic.expires_at) {
              return { hasSubscription: true, tariffId: 'lifetime', tariffName: activeLic.tariff_name || 'VIP Бессрочный' };
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            const expStr = String(activeLic.expires_at).trim().slice(0, 10);
            if (expStr >= todayStr) {
              return { hasSubscription: true, tariffId: activeLic.tariff_id, tariffName: activeLic.tariff_name || activeLic.tariff_id };
            }
          }
        } catch (err) {
          console.error('[auth-database] getActiveLicense error:', err);
        }
      }

      if (user.access_expires_at && user.access_expires_at > now()) {
        return { hasSubscription: true, tariffId: 'paid', tariffName: 'Оплаченный доступ' };
      }

      return { hasSubscription: false, tariffId: 'free', tariffName: 'Базовый (Free)' };
    },

    createTrainerTicket({ user, submission, mediaUrl = null }) {
      if (!statements.insertTrainerTicket) return null;
      const id = normalizeTelegramId(user?.telegramId);
      if (!id) {
        throw new Error('Telegram ID is required to create a ticket');
      }

      const userRow = statements.getUser.get(id);
      const targetUserId = userRow ? (userRow.id ?? userRow.rowid ?? userRow.telegram_id) : null;
      if (!targetUserId) {
        throw new Error('User not found for telegram_id: ' + user.telegramId);
      }

      let questionText = String(submission.question || '').trim();
      if (submission.entryPoint === 'player' && submission.lessonTitle) {
        questionText = '[Урок: ' + submission.lessonTitle + ']\n\n' + questionText;
      }

      const info = statements.insertTrainerTicket.run(
        targetUserId,
        questionText,
        mediaUrl,
      );

      return info.lastInsertRowid;
    },

    setTrainerTicketTelegramMessage(ticketId, tgMessageId, tgChatId) {
      if (!statements.setTrainerTicketTelegramMessage) return;
      statements.setTrainerTicketTelegramMessage.run(tgMessageId, String(tgChatId), ticketId);
    },

    getTrainerTicketById(ticketId) {
      const hasTable = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get());
      if (!hasTable) return null;
      return database.prepare(`
        SELECT t.*, u.telegram_id, u.first_name, u.last_name, u.username
        FROM trainer_tickets t
        JOIN users u ON (u.telegram_id = t.user_id OR CAST(u.rowid AS TEXT) = CAST(t.user_id AS TEXT))
        WHERE t.id = ?
      `).get(ticketId);
    },

    getTrainerTicketByTgMessage(messageId) {
      const hasTable = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get());
      if (!hasTable) return null;
      return database.prepare(`
        SELECT t.*, u.telegram_id, u.first_name, u.last_name, u.username
        FROM trainer_tickets t
        JOIN users u ON (u.telegram_id = t.user_id OR CAST(u.rowid AS TEXT) = CAST(t.user_id AS TEXT))
        WHERE t.tg_message_id = ?
      `).get(messageId);
    },

    assignTrainerTicket(ticketId, trainerId, trainerName) {
      const hasTable = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get());
      if (!hasTable) return null;
      return database.prepare(`
        UPDATE trainer_tickets 
        SET status = 'in_progress', assigned_trainer_id = ?, assigned_trainer_name = ? 
        WHERE id = ?
      `).run(trainerId, trainerName, ticketId);
    },

    releaseTrainerTicket(ticketId) {
      const hasTable = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get());
      if (!hasTable) return null;
      return database.prepare(`
        UPDATE trainer_tickets 
        SET status = 'new', assigned_trainer_id = NULL, assigned_trainer_name = NULL 
        WHERE id = ?
      `).run(ticketId);
    },

    answerTrainerTicket(ticketId, answerText, trainerName) {
      const hasTable = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get());
      if (!hasTable) return null;
      return database.prepare(`
        UPDATE trainer_tickets 
        SET status = 'answered', answer_text = ?, answered_by_name = ?, answered_at = datetime('now', 'localtime') 
        WHERE id = ?
      `).run(answerText, trainerName, ticketId);
    },

    touchTelegramUser(profile) {
      const id = requireTelegramId(profile?.id);
      const timestamp = now();
      statements.touchUser.run(
        nullable(profile.username),
        nullable(profile.firstName),
        nullable(profile.lastName),
        timestamp,
        timestamp,
        id,
      );
      return mapUser(statements.getUser.get(id));
    },

    grantUser(targetTelegramId, actorTelegramId, accessExpiresAt = null) {
      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const timestamp = now();
      const expiresAt = normalizeAccessExpiry(accessExpiresAt, timestamp);
      const previous = statements.getUser.get(targetId);

      transaction(database, () => {
        if (previous && !isRowAccessActive(previous, timestamp)) {
          revokeUserCredentials(statements, targetId, timestamp);
        }
        statements.grantUser.run(targetId, actorId, timestamp, timestamp, expiresAt);
        statements.revokeInvitesForUser.run(timestamp, targetId);
        statements.insertAudit.run(
          actorId,
          'grant',
          targetId,
          JSON.stringify({
            previousAccessExpiresAt: previous?.access_expires_at ?? null,
            accessExpiresAt: expiresAt,
          }),
          timestamp,
        );
      });

      return mapUser(statements.getUser.get(targetId));
    },

    extendUserAccess(targetTelegramId, days, actorTelegramId) {
      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const durationDays = Number(days);
      const existing = statements.getUser.get(targetId);

      if (!existing) {
        return null;
      }
      if (existing.role === 'admin') {
        throw new Error('Admin access is always unlimited');
      }
      if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3_650) {
        throw new Error('Unsupported subscription duration');
      }

      const timestamp = now();
      const base = existing.access_expires_at > timestamp ? existing.access_expires_at : timestamp;
      const expiresAt = base + durationDays * 86_400;

      transaction(database, () => {
        if (!isRowAccessActive(existing, timestamp)) {
          revokeUserCredentials(statements, targetId, timestamp);
        }
        statements.setAccessExpiry.run(expiresAt, timestamp, targetId);
        statements.insertAudit.run(
          actorId,
          'subscription_extended',
          targetId,
          JSON.stringify({
            days: durationDays,
            previousAccessExpiresAt: existing.access_expires_at ?? null,
            accessExpiresAt: expiresAt,
          }),
          timestamp,
        );
      });

      return mapUser(statements.getUser.get(targetId));
    },

    setUserAccessExpiry(targetTelegramId, accessExpiresAt, actorTelegramId) {
      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const existing = statements.getUser.get(targetId);

      if (!existing) {
        return null;
      }
      if (existing.role === 'admin') {
        throw new Error('Admin access is always unlimited');
      }

      const timestamp = now();
      const expiresAt = normalizeAccessExpiry(accessExpiresAt, timestamp);

      transaction(database, () => {
        if (!isRowAccessActive(existing, timestamp)) {
          revokeUserCredentials(statements, targetId, timestamp);
        }
        statements.setAccessExpiry.run(expiresAt, timestamp, targetId);
        statements.insertAudit.run(
          actorId,
          expiresAt === null ? 'subscription_unlimited' : 'subscription_set',
          targetId,
          JSON.stringify({
            previousAccessExpiresAt: existing.access_expires_at ?? null,
            accessExpiresAt: expiresAt,
          }),
          timestamp,
        );
      });

      return mapUser(statements.getUser.get(targetId));
    },

    setUserStatus(targetTelegramId, status, actorTelegramId) {
      if (!['active', 'revoked', 'blocked'].includes(status)) {
        throw new Error('Unsupported user status');
      }

      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const existing = statements.getUser.get(targetId);

      if (!existing) {
        return null;
      }

      if (existing.role === 'admin') {
        throw new Error('Admin access cannot be changed from the bot');
      }

      const timestamp = now();

      if (status === 'active' && !isRowSubscriptionCurrent(existing, timestamp)) {
        throw new Error('Renew the subscription before restoring access');
      }

      transaction(database, () => {
        statements.setStatus.run(status, timestamp, targetId);
        revokeUserCredentials(statements, targetId, timestamp);
        if (status !== 'active') {
          statements.demoteCurrentBotMessage.run(timestamp, targetId, 'browser_link');
        }
        statements.insertAudit.run(
          actorId,
          status === 'active' ? 'access_restored' : status,
          targetId,
          JSON.stringify({
            previousStatus: existing.status,
            status,
            accessExpiresAt: existing.access_expires_at ?? null,
          }),
          timestamp,
        );
      });

      return mapUser(statements.getUser.get(targetId));
    },

    listUsers(limit = 30) {
      const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
      return statements.listUsers.all(safeLimit).map(mapUser);
    },

    listManagedUsers(limit = 10, offset = 0) {
      const safeLimit = Math.min(Math.max(Math.trunc(Number(limit)) || 10, 1), 30);
      const safeOffset = Math.min(Math.max(Math.trunc(Number(offset)) || 0, 0), 100_000);
      return statements.listManagedUsers.all(safeLimit, safeOffset).map(mapUser);
    },

    setBotState(telegramId, state) {
      const id = requireTelegramId(telegramId);
      const timestamp = now();
      statements.setBotState.run(id, state, timestamp);
    },

    getBotState(telegramId, maxAgeSeconds = 600) {
      const id = normalizeTelegramId(telegramId);

      if (!id) {
        return null;
      }

      const row = statements.getBotState.get(id);

      if (!row || row.updated_at <= now() - maxAgeSeconds) {
        statements.clearBotState.run(id);
        return null;
      }

      return row.state;
    },

    clearBotState(telegramId) {
      const id = normalizeTelegramId(telegramId);

      if (id) {
        statements.clearBotState.run(id);
      }
    },

    createInvite(targetTelegramId, actorTelegramId, ttlSeconds = 86_400) {
      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const token = createOpaqueToken(24);
      const timestamp = now();
      const expiresAt = timestamp + ttlSeconds;

      transaction(database, () => {
        statements.revokeInvitesForUser.run(timestamp, targetId);
        statements.insertInvite.run(
          targetId,
          hashOpaqueToken(token),
          expiresAt,
          actorId,
          timestamp,
        );
        statements.insertAudit.run(
          actorId,
          'invite_created',
          targetId,
          JSON.stringify({ expiresAt }),
          timestamp,
        );
      });

      return { token, expiresAt };
    },

    consumeInvite(token, telegramId) {
      const userId = requireTelegramId(telegramId);

      if (!isOpaqueToken(token)) {
        return { ok: false, reason: 'invalid_or_expired' };
      }

      const timestamp = now();

      return transaction(database, () => {
        const invite = statements.getInvite.get(hashOpaqueToken(token));

        if (!invite || invite.status !== 'pending' || invite.expires_at <= timestamp) {
          return { ok: false, reason: 'invalid_or_expired' };
        }

        if (invite.target_telegram_id !== userId) {
          statements.insertAudit.run(
            userId,
            'invite_rejected',
            invite.target_telegram_id,
            JSON.stringify({ reason: 'telegram_id_mismatch' }),
            timestamp,
          );
          return { ok: false, reason: 'telegram_id_mismatch' };
        }

        const accepted = statements.acceptInvite.run(timestamp, invite.id);

        if (accepted.changes !== 1) {
          return { ok: false, reason: 'invalid_or_expired' };
        }

        statements.activateUser.run(timestamp, userId);
        statements.insertAudit.run(userId, 'invite_accepted', userId, null, timestamp);
        return { ok: true, user: mapUser(statements.getUser.get(userId)) };
      });
    },

    createSession(telegramId, ttlSeconds = 7 * 86_400) {
      const userId = requireTelegramId(telegramId);
      const user = statements.getUser.get(userId);
      const timestamp = now();

      if (!isRowAccessActive(user, timestamp)) {
        return null;
      }

      const token = createOpaqueToken();
      const expiresAt = timestamp + ttlSeconds;
      transaction(database, () => {
        statements.deleteUnusableSessionsForUser.run(userId, timestamp);
        statements.insertSession.run(hashOpaqueToken(token), userId, expiresAt, timestamp, timestamp);
        statements.deleteSurplusSessionsForUser.run(userId, userId);
        statements.insertAudit.run(userId, 'login_success', userId, null, timestamp);
      });
      return { token, expiresAt };
    },

    createMagicLink(telegramId, actorTelegramId, ttlSeconds = 600) {
      const userId = requireTelegramId(telegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const user = statements.getUser.get(userId);
      const timestamp = now();

      if (!isRowAccessActive(user, timestamp)) {
        return null;
      }

      const token = createOpaqueToken();
      const expiresAt = timestamp + ttlSeconds;

      transaction(database, () => {
        statements.revokeMagicLinksForUser.run(timestamp, userId);
        statements.insertMagicLink.run(
          hashOpaqueToken(token),
          userId,
          expiresAt,
          timestamp,
          timestamp,
        );
        statements.insertAudit.run(
          actorId,
          'magic_link_created',
          userId,
          JSON.stringify({ expiresAt }),
          timestamp,
        );
      });

      return { token, expiresAt };
    },

    prepareMagicLinkDelivery(telegramId, ttlSeconds = 600) {
      const userId = requireTelegramId(telegramId);
      const user = statements.getUser.get(userId);
      const timestamp = now();

      if (!isRowAccessActive(user, timestamp)) {
        return null;
      }

      const token = createOpaqueToken();
      const expiresAt = timestamp + ttlSeconds;
      statements.insertMagicLink.run(
        hashOpaqueToken(token),
        userId,
        expiresAt,
        timestamp,
        null,
      );
      return { token, expiresAt };
    },

    finalizeMagicLinkDelivery(token, telegramId, chatId, messageId) {
      if (!isOpaqueToken(token)) {
        return null;
      }

      const userId = requireTelegramId(telegramId);
      const normalizedChatId = requireTelegramId(chatId);
      const normalizedMessageId = requireMessageId(messageId);
      const tokenHash = hashOpaqueToken(token);
      const timestamp = now();

      return transaction(database, () => {
        const link = statements.getMagicLink.get(tokenHash);

        if (
          !link ||
          link.telegram_id !== userId ||
          link.delivered_at !== null ||
          link.used_at !== null ||
          link.revoked_at !== null ||
          link.expires_at <= timestamp ||
          !isRowAccessActive(link, timestamp)
        ) {
          return null;
        }

        const delivered = statements.markMagicLinkDelivered.run(timestamp, link.id, timestamp);

        if (delivered.changes !== 1) {
          return null;
        }

        statements.revokeOtherMagicLinks.run(timestamp, userId, tokenHash);
        const previousMessage = statements.getCurrentBotMessage.get(userId, 'browser_link');
        statements.demoteCurrentBotMessage.run(timestamp, userId, 'browser_link');
        statements.insertBotMessage.run(
          userId,
          normalizedChatId,
          normalizedMessageId,
          'browser_link',
          1,
          timestamp,
          timestamp,
        );
        statements.insertAudit.run(
          userId,
          'magic_link_created',
          userId,
          JSON.stringify({ expiresAt: link.expires_at }),
          timestamp,
        );

        return { previousMessage: mapBotMessage(previousMessage) };
      });
    },

    abortMagicLinkDelivery(token) {
      if (isOpaqueToken(token)) {
        statements.abortMagicLinkDelivery.run(now(), hashOpaqueToken(token));
      }
    },

    isMagicLinkUsable(token) {
      if (!isOpaqueToken(token)) {
        return false;
      }

      const link = statements.getMagicLink.get(hashOpaqueToken(token));
      const timestamp = now();
      return Boolean(
        link &&
        link.delivered_at !== null &&
        link.used_at === null &&
        link.revoked_at === null &&
        link.expires_at > timestamp &&
        isRowAccessActive(link, timestamp)
      );
    },

    consumeMagicLink(token, sessionTtl = 7 * 86_400) {
      if (!isOpaqueToken(token)) {
        return null;
      }

      const tokenHash = hashOpaqueToken(token);
      const timestamp = now();

      return transaction(database, () => {
        const link = statements.getMagicLink.get(tokenHash);

        if (
          !link ||
          link.delivered_at === null ||
          link.used_at !== null ||
          link.revoked_at !== null ||
          link.expires_at <= timestamp ||
          !isRowAccessActive(link, timestamp)
        ) {
          return null;
        }

        const consumed = statements.consumeMagicLink.run(timestamp, link.id, timestamp);

        if (consumed.changes !== 1) {
          return null;
        }

        const sessionToken = createOpaqueToken();
        const sessionExpiresAt = timestamp + sessionTtl;
        statements.insertSession.run(
          hashOpaqueToken(sessionToken),
          link.telegram_id,
          sessionExpiresAt,
          timestamp,
          timestamp,
        );
        statements.deleteUnusableSessionsForUser.run(link.telegram_id, timestamp);
        statements.deleteSurplusSessionsForUser.run(link.telegram_id, link.telegram_id);
        statements.insertAudit.run(
          link.telegram_id,
          'login_success',
          link.telegram_id,
          JSON.stringify({ method: 'magic_link' }),
          timestamp,
        );

        return {
          token: sessionToken,
          expiresAt: sessionExpiresAt,
          user: mapUser(link),
        };
      });
    },

    getSessionAccess(token, sessionOptions = {}) {
      return resolveSessionAccess(statements, now, token, sessionOptions);
    },

    getSessionUser(token, sessionOptions = {}) {
      const access = resolveSessionAccess(statements, now, token, sessionOptions);
      return access.state === 'active' ? access.user : null;
    },

    revokeSession(token) {
      if (isOpaqueToken(token)) {
        statements.revokeSession.run(now(), hashOpaqueToken(token));
      }
    },

    expireSubscriptions() {
      const timestamp = now();
      return transaction(database, () => {
        const sessions = statements.revokeExpiredSubscriptionSessions.run(timestamp, timestamp).changes;
        const links = statements.revokeExpiredSubscriptionMagicLinks.run(timestamp, timestamp).changes;
        const invites = statements.revokeExpiredSubscriptionInvites.run(timestamp).changes;
        statements.demoteExpiredSubscriptionBrowserMessages.run(timestamp, 'browser_link', timestamp);
        return sessions + links + invites;
      });
    },

    claimDueSubscriptionNotifications(warningSeconds = 3 * 86_400, limit = 50) {
      const timestamp = now();
      const safeWarning = Math.max(60, Math.trunc(Number(warningSeconds)) || 3 * 86_400);
      const safeLimit = Math.min(Math.max(Math.trunc(Number(limit)) || 50, 1), 100);
      const candidates = [
        ...statements.listExpiringAccessUsers.all(timestamp, timestamp + safeWarning, safeLimit)
          .map((row) => ({ ...row, notification_kind: 'warning' })),
        ...statements.listExpiredAccessUsers.all(timestamp, safeLimit)
          .map((row) => ({ ...row, notification_kind: 'expired' })),
      ];
      const claimed = [];

      transaction(database, () => {
        for (const candidate of candidates.slice(0, safeLimit)) {
          const existing = statements.getSubscriptionNotification.get(
            candidate.telegram_id,
            candidate.access_expires_at,
            candidate.notification_kind,
          );

          if (
            (existing && existing.delivered_at !== null) ||
            (existing?.attempts ?? 0) >= 8 ||
            (existing?.next_attempt_at ?? 0) > timestamp
          ) {
            continue;
          }

          const attempts = (existing?.attempts ?? 0) + 1;
          const retrySeconds = Math.min(3_600, 60 * (2 ** Math.min(attempts - 1, 6)));
          statements.reserveSubscriptionNotification.run(
            candidate.telegram_id,
            candidate.access_expires_at,
            candidate.notification_kind,
            attempts,
            timestamp + retrySeconds,
            timestamp,
          );
          claimed.push({
            telegramId: candidate.telegram_id,
            accessExpiresAt: candidate.access_expires_at,
            kind: candidate.notification_kind,
            attempts,
          });
        }
      });

      return claimed;
    },

    markSubscriptionNotificationDelivered(telegramId, accessExpiresAt, kind) {
      const userId = requireTelegramId(telegramId);
      const expiresAt = normalizeStoredExpiry(accessExpiresAt);
      const notificationKind = requireSubscriptionNotificationKind(kind);
      const timestamp = now();
      statements.completeSubscriptionNotification.run(
        userId,
        expiresAt,
        notificationKind,
        timestamp,
        timestamp,
        timestamp,
      );
    },

    trackBotMessage(telegramId, chatId, messageId, kind, isCurrent = false) {
      const userId = requireTelegramId(telegramId);
      const normalizedChatId = requireTelegramId(chatId);
      const normalizedMessageId = requireMessageId(messageId);
      const normalizedKind = requireBotMessageKind(kind);
      const timestamp = now();

      return transaction(database, () => {
        const previousMessage = isCurrent
          ? statements.getCurrentBotMessage.get(userId, normalizedKind)
          : null;

        if (isCurrent) {
          statements.demoteCurrentBotMessage.run(timestamp, userId, normalizedKind);
        }

        statements.insertBotMessage.run(
          userId,
          normalizedChatId,
          normalizedMessageId,
          normalizedKind,
          isCurrent ? 1 : 0,
          timestamp,
          timestamp,
        );
        return mapBotMessage(previousMessage);
      });
    },

    queueCurrentBotMessageForCleanup(telegramId, kind) {
      const userId = requireTelegramId(telegramId);
      const normalizedKind = requireBotMessageKind(kind);
      return statements.demoteCurrentBotMessage.run(now(), userId, normalizedKind).changes > 0;
    },

    listBotMessagesForCleanup(telegramId) {
      const userId = requireTelegramId(telegramId);
      return statements.listBotMessagesForCleanup.all(userId).map(mapBotMessage);
    },

    removeTrackedBotMessage(chatId, messageId) {
      const normalizedChatId = requireTelegramId(chatId);
      const normalizedMessageId = requireMessageId(messageId);
      statements.deleteBotMessage.run(normalizedChatId, normalizedMessageId);
    },

    isTelegramUpdateProcessed(updateId) {
      const id = normalizeUpdateId(updateId);
      return id ? Boolean(statements.getProcessedUpdate.get(id)) : false;
    },

    claimTelegramUpdate(updateId) {
      const id = normalizeUpdateId(updateId);

      if (!id) {
        return false;
      }

      const timestamp = now();
      const result = statements.insertProcessedUpdate.run(id, timestamp);
      statements.deleteOldProcessedUpdates.run(timestamp - 7 * 86_400);
      return result.changes === 1;
    },

    releaseTelegramUpdate(updateId) {
      const id = normalizeUpdateId(updateId);

      if (id) {
        statements.deleteProcessedUpdate.run(id);
      }
    },

    markTelegramUpdateProcessed(updateId) {
      const id = normalizeUpdateId(updateId);

      if (id) {
        const timestamp = now();
        statements.insertProcessedUpdate.run(id, timestamp);
        statements.deleteOldProcessedUpdates.run(timestamp - 7 * 86_400);
      }
    },
  };
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'blocked')),
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER,
      access_expires_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY,
      target_telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
      expires_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      accepted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      revoked_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS magic_links (
      id INTEGER PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      used_at INTEGER,
      revoked_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY,
      actor_telegram_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_telegram_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS bot_states (
      telegram_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS telegram_updates (
      update_id TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS bot_messages (
      telegram_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL CHECK (message_id > 0),
      kind TEXT NOT NULL CHECK (kind IN ('status', 'browser_link', 'browser_request', 'admin_menu')),
      is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (chat_id, message_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS subscription_notifications (
      telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
      access_expires_at INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('warning', 'expired')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      delivered_at INTEGER,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (telegram_id, access_expires_at, kind)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(telegram_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS invites_target_idx ON invites(target_telegram_id, status);
    CREATE INDEX IF NOT EXISTS magic_links_user_idx ON magic_links(telegram_id, expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS bot_messages_current_idx
      ON bot_messages(telegram_id, kind) WHERE is_current = 1;
    CREATE INDEX IF NOT EXISTS bot_messages_cleanup_idx
      ON bot_messages(telegram_id, is_current, created_at);
    CREATE INDEX IF NOT EXISTS subscription_notifications_retry_idx
      ON subscription_notifications(delivered_at, next_attempt_at);
  `);

  const userColumns = database.prepare('PRAGMA table_info(users)').all();

  if (!userColumns.some((column) => column.name === 'access_expires_at')) {
    database.exec('ALTER TABLE users ADD COLUMN access_expires_at INTEGER;');
  }

  if (!userColumns.some((column) => column.name === 'phone')) {
    database.exec('ALTER TABLE users ADD COLUMN phone TEXT;');
  }

  const magicLinkColumns = database.prepare('PRAGMA table_info(magic_links)').all();

  if (!magicLinkColumns.some((column) => column.name === 'delivered_at')) {
    database.exec(`
      ALTER TABLE magic_links ADD COLUMN delivered_at INTEGER;
      UPDATE magic_links SET delivered_at = created_at WHERE delivered_at IS NULL;
    `);
  }

  const ticketsTable = database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get();
  if (ticketsTable) {
    const ticketCols = database.prepare('PRAGMA table_info(trainer_tickets)').all().map((c) => c.name);
    if (!ticketCols.includes('tg_message_id')) {
      database.exec('ALTER TABLE trainer_tickets ADD COLUMN tg_message_id INTEGER;');
    }
    if (!ticketCols.includes('tg_chat_id')) {
      database.exec('ALTER TABLE trainer_tickets ADD COLUMN tg_chat_id TEXT;');
    }
    if (!ticketCols.includes('assigned_trainer_name')) {
      database.exec('ALTER TABLE trainer_tickets ADD COLUMN assigned_trainer_name TEXT;');
    }
  }
}

function prepareStatements(database) {
  return {
    demoteOtherAdmins: database.prepare(`
      UPDATE users SET role = 'user', updated_at = ? WHERE role = 'admin' AND telegram_id <> ?
    `),
    ensureAdmin: database.prepare(`
      INSERT INTO users (telegram_id, role, status, created_by, created_at, updated_at, access_expires_at)
      VALUES (?, 'admin', 'active', 'system', ?, ?, NULL)
      ON CONFLICT(telegram_id) DO UPDATE SET
        role = 'admin', status = 'active', access_expires_at = NULL,
        updated_at = excluded.updated_at
    `),
    getUser: database.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    getActiveLicense: Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='licenses'").get())
      ? database.prepare(`
          SELECT l.*, t.name as tariff_name
          FROM licenses l
          LEFT JOIN tariffs t ON t.id = l.tariff_id
          WHERE l.user_id = ? AND l.status = 'active'
          ORDER BY l.id DESC LIMIT 1
        `)
      : null,
    insertTrainerTicket: Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get()) ? database.prepare("INSERT INTO trainer_tickets (user_id, question_text, media_url, status, created_at) VALUES (?, ?, ?, 'new', datetime('now', 'localtime'))") : null,
    setTrainerTicketTelegramMessage: Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trainer_tickets'").get())
      ? database.prepare('UPDATE trainer_tickets SET tg_message_id = ?, tg_chat_id = ? WHERE id = ?')
      : null,
    touchUser: database.prepare(`
      UPDATE users SET username = ?, first_name = ?, last_name = ?, updated_at = ?, last_seen_at = ?
      WHERE telegram_id = ?
    `),
    grantUser: database.prepare(`
      INSERT INTO users
        (telegram_id, role, status, created_by, created_at, updated_at, access_expires_at)
      VALUES (?, 'user', 'active', ?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        status = 'active', access_expires_at = excluded.access_expires_at,
        updated_at = excluded.updated_at
    `),
    activateUser: database.prepare(`
      UPDATE users SET status = 'active', updated_at = ? WHERE telegram_id = ?
    `),
    setStatus: database.prepare('UPDATE users SET status = ?, updated_at = ? WHERE telegram_id = ?'),
    setAccessExpiry: database.prepare(`
      UPDATE users SET access_expires_at = ?, updated_at = ? WHERE telegram_id = ?
    `),
    listUsers: database.prepare(`
      SELECT * FROM users ORDER BY role = 'admin' DESC, created_at DESC LIMIT ?
    `),
    listManagedUsers: database.prepare(`
      SELECT * FROM users
      WHERE role <> 'admin'
      ORDER BY created_at DESC, telegram_id DESC
      LIMIT ? OFFSET ?
    `),
    setBotState: database.prepare(`
      INSERT INTO bot_states (telegram_id, state, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
    `),
    getBotState: database.prepare('SELECT state, updated_at FROM bot_states WHERE telegram_id = ?'),
    clearBotState: database.prepare('DELETE FROM bot_states WHERE telegram_id = ?'),
    insertInvite: database.prepare(`
      INSERT INTO invites (target_telegram_id, token_hash, status, expires_at, created_by, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `),
    getInvite: database.prepare('SELECT * FROM invites WHERE token_hash = ?'),
    acceptInvite: database.prepare(`
      UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ? AND status = 'pending'
    `),
    revokeInvitesForUser: database.prepare(`
      UPDATE invites SET status = CASE WHEN expires_at <= ? THEN 'expired' ELSE 'revoked' END
      WHERE target_telegram_id = ? AND status = 'pending'
    `),
    insertSession: database.prepare(`
      INSERT INTO sessions (id_hash, telegram_id, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getSessionAccess: database.prepare(`
      SELECT users.*, sessions.id_hash AS session_hash,
        sessions.revoked_at AS session_revoked_at
      FROM sessions JOIN users ON users.telegram_id = sessions.telegram_id
      WHERE sessions.id_hash = ? AND sessions.expires_at > ?
    `),
    touchSession: database.prepare(`
      UPDATE sessions SET last_seen_at = ? WHERE id_hash = ? AND last_seen_at < ?
    `),
    revokeSession: database.prepare('UPDATE sessions SET revoked_at = ? WHERE id_hash = ?'),
    revokeSessions: database.prepare(`
      UPDATE sessions SET revoked_at = ? WHERE telegram_id = ? AND revoked_at IS NULL
    `),
    deleteUnusableSessionsForUser: database.prepare(`
      DELETE FROM sessions
      WHERE telegram_id = ? AND (expires_at <= ? OR revoked_at IS NOT NULL)
    `),
    deleteSurplusSessionsForUser: database.prepare(`
      DELETE FROM sessions
      WHERE telegram_id = ? AND id_hash NOT IN (
        SELECT id_hash FROM sessions
        WHERE telegram_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT 20
      )
    `),
    insertMagicLink: database.prepare(`
      INSERT INTO magic_links (token_hash, telegram_id, expires_at, created_at, delivered_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getMagicLink: database.prepare(`
      SELECT magic_links.id, magic_links.telegram_id, magic_links.expires_at,
        magic_links.delivered_at, magic_links.used_at, magic_links.revoked_at, users.role,
        users.status AS user_status, users.status, users.username,
        users.first_name, users.last_name, users.created_at, users.last_seen_at,
        users.access_expires_at
      FROM magic_links JOIN users ON users.telegram_id = magic_links.telegram_id
      WHERE magic_links.token_hash = ?
    `),
    consumeMagicLink: database.prepare(`
      UPDATE magic_links SET used_at = ?
      WHERE id = ? AND delivered_at IS NOT NULL
        AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?
    `),
    markMagicLinkDelivered: database.prepare(`
      UPDATE magic_links SET delivered_at = ?
      WHERE id = ? AND delivered_at IS NULL AND used_at IS NULL
        AND revoked_at IS NULL AND expires_at > ?
    `),
    revokeOtherMagicLinks: database.prepare(`
      UPDATE magic_links SET revoked_at = ?
      WHERE telegram_id = ? AND token_hash <> ? AND revoked_at IS NULL
    `),
    abortMagicLinkDelivery: database.prepare(`
      UPDATE magic_links SET revoked_at = ?
      WHERE token_hash = ? AND delivered_at IS NULL AND revoked_at IS NULL
    `),
    revokeMagicLinksForUser: database.prepare(`
      UPDATE magic_links SET revoked_at = ?
      WHERE telegram_id = ? AND revoked_at IS NULL
    `),
    revokeExpiredSubscriptionSessions: database.prepare(`
      UPDATE sessions SET revoked_at = ?
      WHERE revoked_at IS NULL AND telegram_id IN (
        SELECT telegram_id FROM users
        WHERE role = 'user' AND status = 'active'
          AND access_expires_at IS NOT NULL AND access_expires_at <= ?
      )
    `),
    revokeExpiredSubscriptionMagicLinks: database.prepare(`
      UPDATE magic_links SET revoked_at = ?
      WHERE revoked_at IS NULL AND telegram_id IN (
        SELECT telegram_id FROM users
        WHERE role = 'user' AND status = 'active'
          AND access_expires_at IS NOT NULL AND access_expires_at <= ?
      )
    `),
    revokeExpiredSubscriptionInvites: database.prepare(`
      UPDATE invites SET status = 'revoked'
      WHERE status = 'pending' AND target_telegram_id IN (
        SELECT telegram_id FROM users
        WHERE role = 'user' AND status = 'active'
          AND access_expires_at IS NOT NULL AND access_expires_at <= ?
      )
    `),
    demoteExpiredSubscriptionBrowserMessages: database.prepare(`
      UPDATE bot_messages SET is_current = 0, updated_at = ?
      WHERE is_current = 1 AND kind = ? AND telegram_id IN (
        SELECT telegram_id FROM users
        WHERE role = 'user' AND status = 'active'
          AND access_expires_at IS NOT NULL AND access_expires_at <= ?
      )
    `),
    listExpiringAccessUsers: database.prepare(`
      SELECT * FROM users
      WHERE role = 'user' AND status = 'active'
        AND access_expires_at > ? AND access_expires_at <= ?
      ORDER BY access_expires_at, telegram_id
      LIMIT ?
    `),
    listExpiredAccessUsers: database.prepare(`
      SELECT * FROM users
      WHERE role = 'user' AND status = 'active'
        AND access_expires_at IS NOT NULL AND access_expires_at <= ?
      ORDER BY access_expires_at, telegram_id
      LIMIT ?
    `),
    getSubscriptionNotification: database.prepare(`
      SELECT * FROM subscription_notifications
      WHERE telegram_id = ? AND access_expires_at = ? AND kind = ?
    `),
    reserveSubscriptionNotification: database.prepare(`
      INSERT INTO subscription_notifications
        (telegram_id, access_expires_at, kind, attempts, next_attempt_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_id, access_expires_at, kind) DO UPDATE SET
        attempts = excluded.attempts,
        next_attempt_at = excluded.next_attempt_at
      WHERE delivered_at IS NULL
    `),
    completeSubscriptionNotification: database.prepare(`
      INSERT INTO subscription_notifications
        (telegram_id, access_expires_at, kind, attempts, next_attempt_at, delivered_at, created_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(telegram_id, access_expires_at, kind) DO UPDATE SET
        delivered_at = excluded.delivered_at,
        next_attempt_at = excluded.next_attempt_at
    `),
    insertAudit: database.prepare(`
      INSERT INTO audit_log (actor_telegram_id, action, target_telegram_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getProcessedUpdate: database.prepare('SELECT 1 FROM telegram_updates WHERE update_id = ?'),
    insertProcessedUpdate: database.prepare(`
      INSERT OR IGNORE INTO telegram_updates (update_id, processed_at) VALUES (?, ?)
    `),
    deleteProcessedUpdate: database.prepare('DELETE FROM telegram_updates WHERE update_id = ?'),
    deleteOldProcessedUpdates: database.prepare('DELETE FROM telegram_updates WHERE processed_at < ?'),
    expirePendingInvites: database.prepare(`
      UPDATE invites SET status = 'expired'
      WHERE status = 'pending' AND expires_at <= ?
    `),
    deleteOldInvites: database.prepare(`
      DELETE FROM invites WHERE status <> 'pending' AND created_at <= ?
    `),
    deleteOldSessions: database.prepare(`
      DELETE FROM sessions
      WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)
    `),
    deleteOldMagicLinks: database.prepare(`
      DELETE FROM magic_links
      WHERE expires_at <= ?
        OR (used_at IS NOT NULL AND used_at <= ?)
        OR (revoked_at IS NOT NULL AND revoked_at <= ?)
    `),
    getCurrentBotMessage: database.prepare(`
      SELECT * FROM bot_messages
      WHERE telegram_id = ? AND kind = ? AND is_current = 1
    `),
    demoteCurrentBotMessage: database.prepare(`
      UPDATE bot_messages SET is_current = 0, updated_at = ?
      WHERE telegram_id = ? AND kind = ? AND is_current = 1
    `),
    insertBotMessage: database.prepare(`
      INSERT INTO bot_messages
        (telegram_id, chat_id, message_id, kind, is_current, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id, message_id) DO UPDATE SET
        telegram_id = excluded.telegram_id,
        kind = excluded.kind,
        is_current = excluded.is_current,
        updated_at = excluded.updated_at
    `),
    listBotMessagesForCleanup: database.prepare(`
      SELECT * FROM bot_messages
      WHERE telegram_id = ? AND is_current = 0
      ORDER BY created_at, message_id
    `),
    deleteBotMessage: database.prepare(`
      DELETE FROM bot_messages WHERE chat_id = ? AND message_id = ?
    `),
    deleteOldBotMessages: database.prepare(`
      DELETE FROM bot_messages WHERE is_current = 0 AND created_at <= ?
    `),
    deleteOldBotStates: database.prepare('DELETE FROM bot_states WHERE updated_at <= ?'),
    deleteOldAuditEntries: database.prepare('DELETE FROM audit_log WHERE created_at <= ?'),
    deleteOldSubscriptionNotifications: database.prepare(`
      DELETE FROM subscription_notifications
      WHERE delivered_at IS NOT NULL AND delivered_at <= ?
    `),
  };
}

function cleanupExpiredData(statements, timestamp) {
  const retentionCutoff = timestamp - 7 * 86_400;
  statements.expirePendingInvites.run(timestamp);
  statements.deleteOldInvites.run(retentionCutoff);
  statements.deleteOldSessions.run(retentionCutoff, retentionCutoff);
  statements.deleteOldMagicLinks.run(retentionCutoff, retentionCutoff, retentionCutoff);
  statements.deleteOldBotMessages.run(timestamp - 2 * 86_400);
  statements.deleteOldBotStates.run(retentionCutoff);
  statements.deleteOldProcessedUpdates.run(retentionCutoff);
  statements.deleteOldAuditEntries.run(timestamp - 180 * 86_400);
  statements.deleteOldSubscriptionNotifications.run(timestamp - 180 * 86_400);
}

function resolveSessionAccess(statements, now, token, sessionOptions) {
  if (!isOpaqueToken(token)) {
    return { state: 'invalid', user: null };
  }

  const timestamp = now();
  const row = statements.getSessionAccess.get(hashOpaqueToken(token), timestamp);

  if (!row) {
    return { state: 'invalid', user: null };
  }

  const user = mapUser(row);
  const accessState = getUserAccessState(user, timestamp);

  if (accessState === 'expired') {
    statements.revokeSession.run(timestamp, row.session_hash);
    return { state: 'expired', user };
  }

  if (accessState !== 'active' || row.session_revoked_at !== null) {
    return { state: 'invalid', user: null };
  }

  if (sessionOptions.touch !== false) {
    statements.touchSession.run(timestamp, row.session_hash, timestamp - 60);
  }
  return { state: 'active', user };
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    telegramId: row.telegram_id,
    role: row.role,
    status: row.status,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    accessExpiresAt: row.access_expires_at ?? null,
  };
}

function mapBotMessage(row) {
  if (!row) {
    return null;
  }

  return {
    telegramId: row.telegram_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    kind: row.kind,
    isCurrent: Boolean(row.is_current),
    createdAt: row.created_at,
  };
}

function transaction(database, operation) {
  database.exec('BEGIN IMMEDIATE');

  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function requireTelegramId(value) {
  const id = normalizeTelegramId(value);

  if (!id) {
    throw new Error('Invalid Telegram ID');
  }

  return id;
}

const BOT_MESSAGE_KINDS = new Set([
  'status',
  'browser_link',
  'browser_request',
  'admin_menu',
]);

function requireBotMessageKind(value) {
  if (!BOT_MESSAGE_KINDS.has(value)) {
    throw new Error('Unsupported bot message kind');
  }

  return value;
}

function requireMessageId(value) {
  const messageId = Number(value);

  if (!Number.isSafeInteger(messageId) || messageId <= 0) {
    throw new Error('Invalid Telegram message ID');
  }

  return messageId;
}

function nullable(value) {
  return typeof value === 'string' && value ? value : null;
}

function getUserAccessState(user, timestamp) {
  if (!user) {
    return 'missing';
  }
  if (user.status === 'blocked') {
    return 'blocked';
  }
  if (user.status !== 'active') {
    return 'revoked';
  }
  if (user.role !== 'admin' && user.accessExpiresAt !== null && user.accessExpiresAt <= timestamp) {
    return 'expired';
  }
  return 'active';
}

function isRowAccessActive(row, timestamp) {
  if (!row) {
    return false;
  }
  const status = row.status ?? row.user_status;
  return status === 'active' && isRowSubscriptionCurrent(row, timestamp);
}

function isRowSubscriptionCurrent(row, timestamp) {
  return row.role === 'admin' || row.access_expires_at === null || row.access_expires_at > timestamp;
}

function normalizeAccessExpiry(value, timestamp) {
  if (value === null || value === undefined) {
    return null;
  }
  const expiresAt = normalizeStoredExpiry(value);

  if (expiresAt <= timestamp) {
    throw new Error('Subscription expiry must be in the future');
  }
  return expiresAt;
}

function normalizeStoredExpiry(value) {
  const expiresAt = Number(value);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error('Invalid subscription expiry');
  }
  return expiresAt;
}

function revokeUserCredentials(statements, telegramId, timestamp) {
  statements.revokeSessions.run(timestamp, telegramId);
  statements.revokeInvitesForUser.run(timestamp, telegramId);
  statements.revokeMagicLinksForUser.run(timestamp, telegramId);
}

const SUBSCRIPTION_NOTIFICATION_KINDS = new Set(['warning', 'expired']);

function requireSubscriptionNotificationKind(value) {
  if (!SUBSCRIPTION_NOTIFICATION_KINDS.has(value)) {
    throw new Error('Unsupported subscription notification kind');
  }
  return value;
}

function normalizeUpdateId(value) {
  const id = String(value ?? '');
  return /^\d{1,20}$/.test(id) ? id : null;
}
