import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppAccess } from '../src/lib/auth.ts';

const USER = {
  telegramId: '20002',
  role: 'user',
  status: 'active',
  username: 'pup',
  firstName: 'Pup',
  lastName: null,
};

test('authenticates a Telegram Mini App using raw initData', async () => {
  const requests = [];
  const result = await resolveAppAccess({
    initData: 'signed-init-data',
    fetchImpl: sequenceFetchWithRequests([
      response(401, { ok: false }),
      response(200, { ok: true, user: USER }),
    ], requests),
  });

  assert.equal(result.status, 'authenticated');
  assert.equal(result.user.telegramId, '20002');
  assert.equal(requests[1].url, '/api/auth/telegram');
  assert.deepEqual(JSON.parse(requests[1].options.body), { initData: 'signed-init-data' });
});

test('accepts an existing browser session', async () => {
  const result = await resolveAppAccess({
    fetchImpl: async () => response(200, { ok: true, user: USER }),
  });

  assert.equal(result.status, 'authenticated');
});

test('shows bot login for a browser without a session', async () => {
  const result = await resolveAppAccess({
    fetchImpl: sequenceFetch([
      response(401, { ok: false }),
      response(200, { ok: true, botUrl: 'https://t.me/access_bot' }),
    ]),
  });

  assert.deepEqual(result, {
    status: 'unauthenticated',
    botUrl: 'https://t.me/access_bot',
  });
});

test('distinguishes denied Telegram access and invalid browser links', async () => {
  const denied = await resolveAppAccess({
    initData: 'signed-init-data',
    fetchImpl: sequenceFetch([
      response(401, { ok: false }),
      response(403, { ok: false }),
      response(200, { ok: true, botUrl: 'https://t.me/access_bot' }),
    ]),
  });
  const invalidLink = await resolveAppAccess({
    authSignal: 'invalid-link',
    fetchImpl: sequenceFetch([
      response(401, { ok: false }),
      response(200, { ok: true, botUrl: 'https://t.me/access_bot' }),
    ]),
  });

  assert.equal(denied.status, 'denied');
  assert.equal(invalidLink.status, 'invalid-link');
});

test('returns a retryable error when the auth server is unavailable', async () => {
  const result = await resolveAppAccess({
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.deepEqual(result, { status: 'error' });
});

test('times out stalled authentication requests', async () => {
  const result = await resolveAppAccess({
    requestTimeoutMs: 5,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });

  assert.deepEqual(result, { status: 'error' });
});

test('rejects malformed user payloads from the server', async () => {
  const result = await resolveAppAccess({
    fetchImpl: async () => response(200, {
      ok: true,
      user: { ...USER, telegramId: 'not-an-id' },
    }),
  });

  assert.deepEqual(result, { status: 'error' });
});

function sequenceFetch(responses) {
  let index = 0;
  return async () => responses[index++];
}

function sequenceFetchWithRequests(responses, requests) {
  let index = 0;
  return async (url, options) => {
    requests.push({ url, options });
    return responses[index++];
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
