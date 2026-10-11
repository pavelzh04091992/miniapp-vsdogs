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

    const attempts = await Promise.all([
      Promise.resolve(database.consumeMagicLink(second.token, 120)),
      Promise.resolve(database.consumeMagicLink(second.token, 120)),
    ]);
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal(database.isMagicLinkUsable(second.token), false);
    assert.equal(database.getSessionUser(attempts.find(Boolean).token).telegramId, '20002');

    const expired = database.createMagicLink('20002', '20002', 10);
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
