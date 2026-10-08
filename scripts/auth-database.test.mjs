import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

    const granted = database.grantUser('20002', '10001');
    assert.equal(granted.status, 'active');

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

    const session = database.createSession('20002', 60);
    assert.equal(database.getSessionUser(session.token).telegramId, '20002');

    database.setUserStatus('20002', 'revoked', '10001');
    assert.equal(database.getSessionUser(session.token), null);
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
