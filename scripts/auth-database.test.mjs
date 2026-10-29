import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createAuthDatabase } from './auth-database.mjs';

test('stores access, profiles, invitations and revocable sessions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-auth-'));
  let currentTime = 1_800_000_000;
  const database = createAuthDatabase(join(directory, 'auth.sqlite'), {
    now: () => currentTime,
  });

  try {
    const admin = database.ensureAdmin('10001');
    assert.equal(admin.role, 'admin');
    assert.equal(admin.status, 'active');

    database.ensureAdmin('10002');
    assert.equal(database.getUser('10001').role, 'user');
    database.ensureAdmin('10001');
    assert.equal(database.isTelegramUpdateProcessed(12345), false);
    database.markTelegramUpdateProcessed(12345);
    assert.equal(database.isTelegramUpdateProcessed(12345), true);
    assert.equal(database.claimTelegramUpdate(12346), true);
    assert.equal(database.claimTelegramUpdate(12346), false);
    database.releaseTelegramUpdate(12346);
    assert.equal(database.claimTelegramUpdate(12346), true);

    const granted = database.grantUser('20002', '10001');
    assert.equal(granted.status, 'active');
    database.grantUser('20003', '10001');
    database.grantUser('20004', '10001');
    assert.deepEqual(
      database.listManagedUsers(2, 0).map((user) => user.telegramId),
      ['20004', '20003'],
    );
    assert.deepEqual(
      database.listManagedUsers(2, 2).map((user) => user.telegramId),
      ['20002', '10002'],
    );

    database.touchTelegramUser({
      id: '20002',
      firstName: 'Grace',
      lastName: 'Hopper',
      username: 'grace',
    });
    assert.equal(database.getUser('20002').username, 'grace');

    const invite = database.createInvite('20002', '10001', 60);
    assert.deepEqual(database.consumeInvite(invite.token, '30003'), {
      ok: false,
      reason: 'telegram_id_mismatch',
    });
    assert.equal(database.consumeInvite(invite.token, '20002').ok, true);
    assert.equal(database.consumeInvite(invite.token, '20002').ok, false);

    database.setBotState('10001', 'awaiting_grant_id');
    assert.equal(database.getBotState('10001', 60), 'awaiting_grant_id');
    currentTime += 61;
    assert.equal(database.getBotState('10001', 60), null);

    const session = database.createSession('20002', 60);
    assert.equal(database.getSessionUser(session.token).telegramId, '20002');

    for (let index = 0; index < 25; index += 1) {
      database.createSession('20002', 60);
    }

    const sessionInspector = new DatabaseSync(join(directory, 'auth.sqlite'), { readOnly: true });
    const storedSessions = sessionInspector.prepare(
      'SELECT COUNT(*) AS count FROM sessions WHERE telegram_id = ?',
    ).get('20002');
    sessionInspector.close();
    assert.equal(storedSessions.count, 20);
    assert.equal(database.getSessionUser(session.token), null);

    const revocableSession = database.createSession('20002', 60);

    database.setUserStatus('20002', 'revoked', '10001');
    assert.equal(database.getSessionUser(revocableSession.token), null);
    assert.equal(database.getUser('20002').status, 'revoked');

    currentTime += 120;
    database.setUserStatus('20002', 'active', '10001');
    const expiringSession = database.createSession('20002', 60);
    currentTime += 61;
    assert.equal(database.getSessionUser(expiringSession.token), null);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('stores the authentication database without group or world access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-auth-permissions-'));
  const databasePath = join(directory, 'permissions.sqlite');
  const database = createAuthDatabase(databasePath);

  database.close();

  try {
    if (process.platform !== 'win32') {
      assert.equal(statSync(databasePath).mode & 0o077, 0);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('magic links are hashed, short-lived, single-use and revoke previous links', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-magic-'));
  const databasePath = join(directory, 'auth.sqlite');
  let currentTime = 1_800_000_000;
  const database = createAuthDatabase(databasePath, { now: () => currentTime });

  try {
    database.ensureAdmin('10001');
    database.grantUser('20002', '10001');

    const first = database.createMagicLink('20002', '20002', 600);
    const inspector = new DatabaseSync(databasePath, { readOnly: true });
    const stored = inspector.prepare('SELECT token_hash FROM magic_links').get();
    inspector.close();
    assert.notEqual(stored.token_hash, first.token);
    assert.match(stored.token_hash, /^[a-f\d]{64}$/);

    const second = database.createMagicLink('20002', '20002', 600);
    assert.equal(database.isMagicLinkUsable(first.token), false);
    assert.equal(database.isMagicLinkUsable(second.token), true);
    assert.equal(database.consumeMagicLink(first.token), null);

    const linkStates = new DatabaseSync(databasePath, { readOnly: true });
    const rows = linkStates.prepare(`
      SELECT used_at, revoked_at
      FROM magic_links
      WHERE telegram_id = ?
      ORDER BY id
    `).all('20002');
    linkStates.close();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].revoked_at, null);
    assert.equal(rows[1].revoked_at, null);

    const attempts = await Promise.all([
      Promise.resolve(database.consumeMagicLink(second.token, 120)),
      Promise.resolve(database.consumeMagicLink(second.token, 120)),
    ]);
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal(database.isMagicLinkUsable(second.token), false);
    assert.equal(database.getSessionUser(attempts.find(Boolean).token).telegramId, '20002');

    const expired = database.createMagicLink('20002', '20002', 10);
    const supersededStates = new DatabaseSync(databasePath, { readOnly: true });
    const supersededRows = supersededStates.prepare(`
      SELECT used_at, revoked_at
      FROM magic_links
      WHERE telegram_id = ?
      ORDER BY id
    `).all('20002');
    supersededStates.close();
    assert.notEqual(supersededRows[1].used_at, null);
    assert.notEqual(supersededRows[1].revoked_at, null);
    assert.equal(supersededRows[2].revoked_at, null);

    currentTime += 11;
    assert.equal(database.consumeMagicLink(expired.token), null);

    const revoked = database.createMagicLink('20002', '20002', 600);
    database.setUserStatus('20002', 'revoked', '10001');
    assert.equal(database.consumeMagicLink(revoked.token), null);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('activates a prepared magic link only after delivery and persists message cleanup state', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-delivery-'));
  const databasePath = join(directory, 'auth.sqlite');
  let currentTime = 1_800_000_000;
  let database = createAuthDatabase(databasePath, { now: () => currentTime });

  try {
    database.ensureAdmin('10001');
    database.grantUser('20002', '10001');

    const first = database.prepareMagicLinkDelivery('20002', 600);
    assert.equal(database.isMagicLinkUsable(first.token), false);
    assert.deepEqual(
      database.finalizeMagicLinkDelivery(first.token, '20002', '20002', 101),
      { previousMessage: null },
    );
    assert.equal(database.isMagicLinkUsable(first.token), true);

    const aborted = database.prepareMagicLinkDelivery('20002', 600);
    database.abortMagicLinkDelivery(aborted.token);
    assert.equal(database.isMagicLinkUsable(first.token), true);
    assert.equal(database.isMagicLinkUsable(aborted.token), false);

    database.trackBotMessage('20002', '20002', 201, 'browser_request');
    database.trackBotMessage('20002', '20002', 201, 'browser_request');
    assert.equal(database.listBotMessagesForCleanup('20002').length, 1);
    const replacement = database.prepareMagicLinkDelivery('20002', 600);
    assert.equal(database.isMagicLinkUsable(first.token), true);
    assert.deepEqual(
      database.finalizeMagicLinkDelivery(replacement.token, '20002', '20002', 102),
      {
        previousMessage: {
          telegramId: '20002',
          chatId: '20002',
          messageId: 101,
          kind: 'browser_link',
          isCurrent: true,
          createdAt: currentTime,
        },
      },
    );
    assert.equal(database.isMagicLinkUsable(first.token), false);
    assert.equal(database.isMagicLinkUsable(replacement.token), true);
    assert.deepEqual(
      database.listBotMessagesForCleanup('20002').map(({ messageId }) => messageId),
      [101, 201],
    );

    const concurrentA = database.prepareMagicLinkDelivery('20002', 600);
    const concurrentB = database.prepareMagicLinkDelivery('20002', 600);
    const finalized = await Promise.all([
      Promise.resolve(database.finalizeMagicLinkDelivery(concurrentA.token, '20002', '20002', 103)),
      Promise.resolve(database.finalizeMagicLinkDelivery(concurrentB.token, '20002', '20002', 104)),
    ]);
    assert.equal(finalized.filter(Boolean).length, 1);

    database.close();
    database = createAuthDatabase(databasePath, { now: () => currentTime });
    assert.deepEqual(
      database.listBotMessagesForCleanup('20002').map(({ messageId }) => messageId),
      [101, 102, 201],
    );

    currentTime += 2 * 86_400 + 1;
    database.cleanup();
    assert.deepEqual(database.listBotMessagesForCleanup('20002'), []);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migrates existing magic links as already delivered', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-magic-migration-'));
  const databasePath = join(directory, 'auth.sqlite');
  let database = createAuthDatabase(databasePath);

  try {
    database.ensureAdmin('10001');
    const link = database.createMagicLink('10001', '10001', 600);
    database.close();
    database = null;

    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec('ALTER TABLE magic_links DROP COLUMN delivered_at');
    legacyDatabase.close();

    database = createAuthDatabase(databasePath);
    assert.equal(database.isMagicLinkUsable(link.token), true);
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('enforces subscription expiry independently from session lifetime and requires a new login after renewal', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-subscription-'));
  const databasePath = join(directory, 'auth.sqlite');
  let currentTime = 1_900_000_000;
  const database = createAuthDatabase(databasePath, { now: () => currentTime });

  try {
    const admin = database.ensureAdmin('10001');
    assert.equal(admin.accessExpiresAt, null);
    assert.equal(database.getUserAccess('10001').state, 'active');

    const granted = database.grantUser('20002', '10001', currentTime + 120);
    assert.equal(granted.accessExpiresAt, currentTime + 120);
    assert.equal(database.getUserAccess('20002').state, 'active');
    const session = database.createSession('20002', 3_600);
    const magicLink = database.createMagicLink('20002', '20002', 600);
    assert.ok(session);
    assert.ok(magicLink);

    currentTime += 120;
    assert.equal(database.getUserAccess('20002').state, 'expired');
    assert.equal(database.getSessionAccess(session.token).state, 'expired');
    assert.equal(database.getSessionUser(session.token), null);
    assert.equal(database.isMagicLinkUsable(magicLink.token), false);

    const renewed = database.extendUserAccess('20002', 7, '10001');
    assert.equal(renewed.accessExpiresAt, currentTime + 7 * 86_400);
    assert.equal(database.getUserAccess('20002').state, 'active');
    assert.equal(database.getSessionAccess(session.token).state, 'invalid');
    assert.ok(database.createSession('20002', 600));

    const extended = database.extendUserAccess('20002', 30, '10001');
    assert.equal(extended.accessExpiresAt, renewed.accessExpiresAt + 30 * 86_400);
    assert.equal(database.setUserAccessExpiry('20002', null, '10001').accessExpiresAt, null);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('claims subscription warning and expiration notifications once per expiry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-subscription-notify-'));
  let currentTime = 1_900_000_000;
  const database = createAuthDatabase(join(directory, 'auth.sqlite'), { now: () => currentTime });

  try {
    database.ensureAdmin('10001');
    const expiresAt = currentTime + 3 * 86_400;
    database.grantUser('20002', '10001', expiresAt);

    const warning = database.claimDueSubscriptionNotifications();
    assert.deepEqual(warning.map(({ telegramId, accessExpiresAt, kind }) => ({
      telegramId,
      accessExpiresAt,
      kind,
    })), [{ telegramId: '20002', accessExpiresAt: expiresAt, kind: 'warning' }]);
    assert.deepEqual(database.claimDueSubscriptionNotifications(), []);
    database.markSubscriptionNotificationDelivered('20002', expiresAt, 'warning');

    currentTime = expiresAt;
    database.expireSubscriptions();
    const expired = database.claimDueSubscriptionNotifications();
    assert.equal(expired.length, 1);
    assert.equal(expired[0].kind, 'expired');
    database.markSubscriptionNotificationDelivered('20002', expiresAt, 'expired');
    assert.deepEqual(database.claimDueSubscriptionNotifications(), []);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migrates existing active users to unlimited subscriptions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-subscription-migration-'));
  const databasePath = join(directory, 'auth.sqlite');
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users (
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
    INSERT INTO users
      (telegram_id, role, status, created_by, created_at, updated_at)
    VALUES ('20002', 'user', 'active', '10001', 1, 1);
  `);
  legacy.close();
  const database = createAuthDatabase(databasePath);

  try {
    assert.equal(database.getUser('20002').accessExpiresAt, null);
    assert.equal(database.getUserAccess('20002').state, 'active');
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
