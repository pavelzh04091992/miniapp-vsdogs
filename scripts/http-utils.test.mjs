import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  RequestError,
  SECURITY_HEADERS,
  getClientIdentifier,
  hasAllowedOrigin,
  parseCookies,
  readJsonBody,
} from './http-utils.mjs';

test('content security policy allows local attachment previews', () => {
  assert.match(SECURITY_HEADERS['Content-Security-Policy'], /img-src 'self' data: blob: https:/);
  assert.match(SECURITY_HEADERS['Content-Security-Policy'], /media-src 'self' blob:/);
});

test('origin checks require an explicitly allowed browser origin', () => {
  const allowedOrigins = new Set(['https://app.example.com']);

  assert.equal(hasAllowedOrigin({ headers: {} }, allowedOrigins), false);
  assert.equal(
    hasAllowedOrigin({ headers: { origin: 'https://app.example.com/path' } }, allowedOrigins),
    false,
  );
  assert.equal(
    hasAllowedOrigin({ headers: { origin: 'https://app.example.com' } }, allowedOrigins),
    true,
  );
  assert.equal(
    hasAllowedOrigin({ headers: { origin: 'https://evil.example.com' } }, allowedOrigins),
    false,
  );
});

test('JSON body reader enforces content type and byte limits', async () => {
  const validRequest = requestFrom('{"ok":true}', 'application/json; charset=utf-8');
  assert.deepEqual(await readJsonBody(validRequest, 64), { ok: true });

  await assert.rejects(
    readJsonBody(requestFrom('{}', 'text/plain'), 64),
    (error) => error instanceof RequestError && error.statusCode === 415,
  );
  await assert.rejects(
    readJsonBody(requestFrom('{"payload":"too long"}', 'application/json'), 8),
    (error) => error instanceof RequestError && error.statusCode === 413,
  );
  const invalidLengthRequest = requestFrom('{}', 'application/json');
  invalidLengthRequest.headers['content-length'] = '-1';
  await assert.rejects(
    readJsonBody(invalidLengthRequest, 64),
    (error) => error instanceof RequestError && error.publicCode === 'invalid_content_length',
  );
});

test('cookie parser preserves opaque values containing equals signs', () => {
  assert.deepEqual(parseCookies('session=abc==; theme=dark'), {
    session: 'abc==',
    theme: 'dark',
  });
});

test('client identifiers trust forwarding headers only behind a configured proxy', () => {
  const request = {
    headers: {
      'x-real-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.8, 127.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };

  assert.equal(getClientIdentifier(request), '127.0.0.1');
  assert.equal(
    getClientIdentifier(request, { trustProxyHeaders: true }),
    '203.0.113.7',
  );
});

function requestFrom(body, contentType) {
  const request = Readable.from([body]);
  request.headers = {
    'content-length': String(Buffer.byteLength(body)),
    'content-type': contentType,
  };
  return request;
}
