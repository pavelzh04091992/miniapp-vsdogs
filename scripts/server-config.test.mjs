import assert from 'node:assert/strict';
import test from 'node:test';
import { readServerConfig } from './server-config.mjs';

test('normalizes server URLs and builds an explicit origin allowlist', () => {
  const config = readServerConfig({
    PUBLIC_BASE_URL: 'https://app.example.com/',
    MINI_APP_URL: 'https://mini.example.com/navigation',
    ALLOWED_ORIGINS: 'https://admin.example.com, http://localhost:4173',
    ADMIN_TELEGRAM_ID: '123456',
    PUBLIC_CHANNEL_ID: '-1001234567890',
  }, process.cwd());

  assert.equal(config.publicBaseUrl, 'https://app.example.com');
  assert.equal(config.adminTelegramId, '123456');
  assert.equal(config.publicChannelId, '-1001234567890');
  assert.ok(config.allowedOrigins.has('https://app.example.com'));
  assert.ok(config.allowedOrigins.has('https://mini.example.com'));
  assert.ok(config.allowedOrigins.has('https://admin.example.com'));
  assert.ok(config.allowedOrigins.has('http://localhost:4173'));
  assert.equal(config.sessionCookieName, '__Host-miniapp_session');
  assert.equal(config.sessionCookieSameSite, 'None');
});

test('rejects unsafe server configuration values', () => {
  assert.throws(
    () => readServerConfig({ PUBLIC_BASE_URL: 'javascript:alert(1)' }),
    /PUBLIC_BASE_URL/,
  );
  assert.throws(
    () => readServerConfig({ ALLOWED_ORIGINS: 'https://ok.example,not-a-url' }),
    /ALLOWED_ORIGINS/,
  );
  assert.throws(
    () => readServerConfig({ TELEGRAM_WEBHOOK_PATH: 'telegram/webhook?token=secret' }),
    /TELEGRAM_WEBHOOK_PATH/,
  );
  assert.throws(
    () => readServerConfig({
      SESSION_COOKIE_NAME: '__Host-miniapp_session',
      SESSION_COOKIE_SECURE: 'false',
    }),
    /__Host-/,
  );
  assert.throws(
    () => readServerConfig({
      SESSION_COOKIE_SAME_SITE: 'None',
      SESSION_COOKIE_SECURE: 'false',
    }),
    /requires SESSION_COOKIE_SECURE=true/,
  );
  assert.throws(
    () => readServerConfig({ SESSION_COOKIE_SAME_SITE: 'sometimes' }),
    /SESSION_COOKIE_SAME_SITE/,
  );
  assert.throws(
    () => readServerConfig({ PUBLIC_CHANNEL_ID: 'not-a-chat' }),
    /PUBLIC_CHANNEL_ID/,
  );
});

test('does not trust loopback browser origins implicitly in production', () => {
  const config = readServerConfig({
    NODE_ENV: 'production',
    PUBLIC_BASE_URL: 'https://app.example.com',
  });

  assert.equal(config.allowedOrigins.has('https://app.example.com'), true);
  assert.equal(config.allowedOrigins.has('http://localhost:3000'), false);
});
