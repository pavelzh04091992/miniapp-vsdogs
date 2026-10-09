import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { TelegramAuthError, validateTelegramInitData } from './telegram-auth.mjs';

const BOT_TOKEN = '123456:test-token';
const NOW = 1_800_000_000;

test('validates signed Telegram initData and returns a normalized user', () => {
  const initData = createInitData({
    auth_date: String(NOW - 30),
    query_id: 'query-1',
    user: JSON.stringify({
      id: 123456789,
      first_name: ' Ada ',
      last_name: 'Lovelace',
      username: 'ada',
    }),
  });

  const result = validateTelegramInitData(initData, BOT_TOKEN, {
    nowSeconds: NOW,
    maxAgeSeconds: 300,
  });

  assert.equal(result.user.id, '123456789');
  assert.equal(result.user.firstName, 'Ada');
  assert.equal(result.user.username, 'ada');
  assert.equal(result.queryId, 'query-1');
});

test('rejects tampered initData', () => {
  const signed = createInitData({
    auth_date: String(NOW),
    user: JSON.stringify({ id: 123456789, first_name: 'Ada' }),
  });
  const tampered = signed.replace('Ada', 'Eve');

  assert.throws(
    () => validateTelegramInitData(tampered, BOT_TOKEN, { nowSeconds: NOW }),
    (error) => error instanceof TelegramAuthError && error.code === 'invalid_init_data_signature',
  );
});

test('rejects expired initData', () => {
  const initData = createInitData({
    auth_date: String(NOW - 301),
    user: JSON.stringify({ id: 123456789, first_name: 'Ada' }),
  });

  assert.throws(
    () => validateTelegramInitData(initData, BOT_TOKEN, {
      nowSeconds: NOW,
      maxAgeSeconds: 300,
    }),
    (error) => error instanceof TelegramAuthError && error.code === 'expired_init_data',
  );
});

test('rejects duplicate fields', () => {
  const initData = createInitData({
    auth_date: String(NOW),
    user: JSON.stringify({ id: 123456789, first_name: 'Ada' }),
  });

  assert.throws(
    () => validateTelegramInitData(`${initData}&auth_date=${NOW}`, BOT_TOKEN, { nowSeconds: NOW }),
    (error) => error instanceof TelegramAuthError && error.code === 'duplicate_init_data_field',
  );
});

test('rejects signed initData without a Telegram user', () => {
  const initData = createInitData({
    auth_date: String(NOW),
    query_id: 'query-without-user',
  });

  assert.throws(
    () => validateTelegramInitData(initData, BOT_TOKEN, { nowSeconds: NOW }),
    (error) => error instanceof TelegramAuthError && error.code === 'invalid_telegram_user',
  );
});

function createInitData(values) {
  const params = new URLSearchParams(values);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
