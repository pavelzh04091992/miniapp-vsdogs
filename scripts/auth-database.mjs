import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createOpaqueToken, hashOpaqueToken, normalizeTelegramId } from './telegram-auth.mjs';

export function createAuthDatabase(databasePath, options = {}) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  migrate(database);

  const statements = prepareStatements(database);

  return {
    close: () => database.close(),

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

    grantUser(targetTelegramId, actorTelegramId) {
      const targetId = requireTelegramId(targetTelegramId);
      const actorId = requireTelegramId(actorTelegramId);
      const timestamp = now();

      transaction(database, () => {
        statements.grantUser.run(targetId, actorId, timestamp, timestamp);
        statements.revokeInvitesForUser.run(timestamp, targetId);
        statements.insertAudit.run(actorId, 'grant', targetId, null, timestamp);
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

      transaction(database, () => {
        statements.setStatus.run(status, timestamp, targetId);
        statements.revokeSessions.run(timestamp, targetId);
        statements.revokeInvitesForUser.run(timestamp, targetId);
        statements.insertAudit.run(actorId, status === 'active' ? 'grant' : status, targetId, null, timestamp);
      });

      return mapUser(statements.getUser.get(targetId));
    },

    listUsers(limit = 30) {
      const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
      return statements.listUsers.all(safeLimit).map(mapUser);
    },

    setBotState(telegramId, state) {
      const id = requireTelegramId(telegramId);
      const timestamp = now();
      statements.setBotState.run(id, state, timestamp);
    },

    getBotState(telegramId) {
      const id = normalizeTelegramId(telegramId);
      return id ? statements.getBotState.get(id)?.state ?? null : null;
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
      const timestamp = now();
      const invite = statements.getInvite.get(hashOpaqueToken(token));

      if (!invite || invite.status !== 'pending' || invite.expires_at < timestamp) {
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

      transaction(database, () => {
        statements.acceptInvite.run(timestamp, invite.id);
        statements.activateUser.run(timestamp, userId);
        statements.insertAudit.run(userId, 'invite_accepted', userId, null, timestamp);
      });

      return { ok: true, user: mapUser(statements.getUser.get(userId)) };
    },

    createSession(telegramId, ttlSeconds = 7 * 86_400) {
      const userId = requireTelegramId(telegramId);
      const user = statements.getUser.get(userId);

      if (!user || user.status !== 'active') {
        return null;
      }

      const token = createOpaqueToken();
      const timestamp = now();
      const expiresAt = timestamp + ttlSeconds;
      statements.insertSession.run(hashOpaqueToken(token), userId, expiresAt, timestamp, timestamp);
      statements.insertAudit.run(userId, 'login_success', userId, null, timestamp);
      return { token, expiresAt };
    },

    getSessionUser(token) {
      if (typeof token !== 'string' || token.length < 32 || token.length > 128) {
        return null;
      }

      const timestamp = now();
      const row = statements.getSessionUser.get(hashOpaqueToken(token), timestamp);

      if (!row) {
        return null;
      }

      statements.touchSession.run(timestamp, row.session_hash);
      return mapUser(row);
    },

    revokeSession(token) {
      if (typeof token === 'string' && token) {
        statements.revokeSession.run(now(), hashOpaqueToken(token));
      }
    },

    isTelegramUpdateProcessed(updateId) {
      const id = normalizeUpdateId(updateId);
      return id ? Boolean(statements.getProcessedUpdate.get(id)) : false;
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
      last_seen_at INTEGER
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

    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(telegram_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS invites_target_idx ON invites(target_telegram_id, status);
  `);
}

function prepareStatements(database) {
  return {
    demoteOtherAdmins: database.prepare(`
      UPDATE users SET role = 'user', updated_at = ? WHERE role = 'admin' AND telegram_id <> ?
    `),
    ensureAdmin: database.prepare(`
      INSERT INTO users (telegram_id, role, status, created_by, created_at, updated_at)
      VALUES (?, 'admin', 'active', 'system', ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        role = 'admin', status = 'active', updated_at = excluded.updated_at
    `),
    getUser: database.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    touchUser: database.prepare(`
      UPDATE users SET username = ?, first_name = ?, last_name = ?, updated_at = ?, last_seen_at = ?
      WHERE telegram_id = ?
    `),
    grantUser: database.prepare(`
      INSERT INTO users (telegram_id, role, status, created_by, created_at, updated_at)
      VALUES (?, 'user', 'active', ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
    `),
    activateUser: database.prepare(`
      UPDATE users SET status = 'active', updated_at = ? WHERE telegram_id = ?
    `),
    setStatus: database.prepare('UPDATE users SET status = ?, updated_at = ? WHERE telegram_id = ?'),
    listUsers: database.prepare(`
      SELECT * FROM users ORDER BY role = 'admin' DESC, created_at DESC LIMIT ?
    `),
    setBotState: database.prepare(`
      INSERT INTO bot_states (telegram_id, state, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
    `),
    getBotState: database.prepare('SELECT state FROM bot_states WHERE telegram_id = ?'),
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
      UPDATE invites SET status = CASE WHEN expires_at < ? THEN 'expired' ELSE 'revoked' END
      WHERE target_telegram_id = ? AND status = 'pending'
    `),
    insertSession: database.prepare(`
      INSERT INTO sessions (id_hash, telegram_id, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getSessionUser: database.prepare(`
      SELECT users.*, sessions.id_hash AS session_hash
      FROM sessions JOIN users ON users.telegram_id = sessions.telegram_id
      WHERE sessions.id_hash = ? AND sessions.expires_at > ? AND sessions.revoked_at IS NULL
        AND users.status = 'active'
    `),
    touchSession: database.prepare('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?'),
    revokeSession: database.prepare('UPDATE sessions SET revoked_at = ? WHERE id_hash = ?'),
    revokeSessions: database.prepare(`
      UPDATE sessions SET revoked_at = ? WHERE telegram_id = ? AND revoked_at IS NULL
    `),
    insertAudit: database.prepare(`
      INSERT INTO audit_log (actor_telegram_id, action, target_telegram_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getProcessedUpdate: database.prepare('SELECT 1 FROM telegram_updates WHERE update_id = ?'),
    insertProcessedUpdate: database.prepare(`
      INSERT OR IGNORE INTO telegram_updates (update_id, processed_at) VALUES (?, ?)
    `),
    deleteOldProcessedUpdates: database.prepare('DELETE FROM telegram_updates WHERE processed_at < ?'),
  };
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

function nullable(value) {
  return typeof value === 'string' && value ? value : null;
}

function normalizeUpdateId(value) {
  const id = String(value ?? '');
  return /^\d{1,20}$/.test(id) ? id : null;
}
