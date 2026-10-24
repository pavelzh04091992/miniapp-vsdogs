import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeedbackHandler } from './feedback-handler.mjs';

const USER = { telegramId: '20002', firstName: 'Иван' };
const ORIGIN = 'https://miniapp.example';

test('feedback handler rejects a disallowed origin before reading the session', async () => {
  let sessionRead = false;
  const { handler, request, response } = createHarness({
    origin: 'https://evil.example',
    getSessionUser: () => { sessionRead = true; return USER; },
  });

  await handler(request, response);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { ok: false, error: 'origin_not_allowed' });
  assert.equal(sessionRead, false);
  assert.equal(request.resumed, true);
});

test('feedback handler requires an active session', async () => {
  const { handler, request, response } = createHarness({ getSessionUser: () => null });
  await handler(request, response);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { ok: false, error: 'not_authenticated' });
});

test('feedback handler rate-limits by Telegram user id', async () => {
  let consumedKey;
  const { handler, request, response } = createHarness({
    rateLimiter: {
      consume: (key) => {
        consumedKey = key;
        return { allowed: false, retryAfterSeconds: 321 };
      },
    },
  });
  await handler(request, response);
  assert.equal(consumedKey, USER.telegramId);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '321');
  assert.deepEqual(response.body, { ok: false, error: 'rate_limited' });
});

test('feedback handler confirms only after delivery and removes temporary files', async () => {
  const calls = [];
  const submission = { question: 'Вопрос', temporaryDirectory: 'temp-one', attachments: [] };
  const { handler, request, response } = createHarness({
    parseForm: async () => { calls.push('parse'); return submission; },
    deliver: async () => { calls.push('deliver'); },
    removeFiles: async () => { calls.push('remove'); },
  });
  await handler(request, response);
  assert.deepEqual(calls, ['parse', 'deliver', 'remove']);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
});

test('feedback handler returns a retryable error and cleans files after delivery failure', async () => {
  const removed = [];
  const logs = [];
  const submission = { question: 'Вопрос', temporaryDirectory: 'temp-two', attachments: [] };
  const { handler, request, response } = createHarness({
    parseForm: async () => submission,
    deliver: async () => { throw new Error('Telegram unavailable'); },
    removeFiles: async (path) => { removed.push(path); },
    logError: (message) => { logs.push(message); },
  });
  await handler(request, response);
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { ok: false, error: 'telegram_delivery_failed' });
  assert.deepEqual(removed, ['temp-two']);
  assert.deepEqual(logs, ['[feedback] Telegram delivery failed']);
});

test('cleanup failure after successful delivery does not turn success into a retry', async () => {
  const logs = [];
  const submission = { question: 'Вопрос', temporaryDirectory: 'temp-three', attachments: [] };
  let removalAttempts = 0;
  const { handler, request, response } = createHarness({
    parseForm: async () => submission,
    deliver: async () => {},
    removeFiles: async () => {
      removalAttempts += 1;
      throw new Error('locked');
    },
    logError: (message) => { logs.push(message); },
  });
  await handler(request, response);
  assert.equal(response.statusCode, 200);
  assert.equal(removalAttempts, 2);
  assert.deepEqual(logs, ['[feedback] temporary file cleanup failed']);
});

function createHarness(overrides = {}) {
  const request = {
    method: 'POST',
    headers: { origin: overrides.origin ?? ORIGIN },
    resumed: false,
    resume() { this.resumed = true; },
  };
  const response = {
    statusCode: null,
    headers: {},
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload ? JSON.parse(Buffer.from(payload).toString('utf8')) : null;
    },
  };
  const handler = createFeedbackHandler({
    adminTelegramId: '10001',
    allowedOrigins: new Set([ORIGIN]),
    api: {},
    getSessionUser: overrides.getSessionUser ?? (() => USER),
    rateLimiter: overrides.rateLimiter ?? { consume: () => ({ allowed: true }) },
    parseForm: overrides.parseForm ?? (async () => ({
      question: 'Вопрос',
      temporaryDirectory: 'temp-default',
      attachments: [],
    })),
    deliver: overrides.deliver ?? (async () => {}),
    removeFiles: overrides.removeFiles ?? (async () => {}),
    logError: overrides.logError ?? (() => {}),
  });

  return { handler, request, response };
}
