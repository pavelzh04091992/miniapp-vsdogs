import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from './rate-limit.mjs';

test('rate limiter blocks excess attempts and resets after its window', () => {
  let currentTime = 10_000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 1_000,
    now: () => currentTime,
  });

  assert.deepEqual(limiter.consume('client-1'), {
    allowed: true,
    remaining: 1,
    retryAfterSeconds: 1,
  });
  assert.equal(limiter.consume('client-1').allowed, true);
  assert.equal(limiter.consume('client-1').allowed, false);
  assert.equal(limiter.consume('client-2').allowed, true);

  currentTime += 1_000;
  assert.equal(limiter.consume('client-1').allowed, true);
});

test('rate limiter bounds the number of tracked keys', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 2 });

  assert.equal(limiter.consume('first').allowed, true);
  assert.equal(limiter.consume('second').allowed, true);
  assert.equal(limiter.consume('third').allowed, true);
  assert.equal(limiter.consume('first').allowed, true);
});
