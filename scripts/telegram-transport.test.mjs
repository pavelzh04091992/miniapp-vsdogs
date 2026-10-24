import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTelegramTransport,
  normalizeTelegramEgressMode,
} from './telegram-transport.mjs';

test('supports explicit direct, SSH tunnel and HTTP proxy Telegram transports', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    calls.push({ input, init });
    return new Response('{}');
  };

  for (const mode of ['direct', 'ssh-tunnel']) {
    const transport = createTelegramTransport({ mode, fetchImpl });
    await transport.fetch('https://api.telegram.org/test');
    assert.equal(transport.mode, mode);
    assert.ok(calls.at(-1).init.dispatcher);
    await transport.close();
  }

  const proxyTransport = createTelegramTransport({
    mode: 'http-proxy',
    proxyUrl: 'http://user:secret@proxy.example:8080',
    fetchImpl,
  });
  await proxyTransport.fetch('https://api.telegram.org/test');
  assert.equal(proxyTransport.description, 'http-proxy');
  assert.doesNotMatch(proxyTransport.description, /secret|proxy\.example/);
  assert.ok(calls.at(-1).init.dispatcher);
  await proxyTransport.close();
});

test('rejects ambiguous or incomplete Telegram egress configuration', () => {
  assert.throws(() => normalizeTelegramEgressMode('global-proxy'), /TELEGRAM_EGRESS_MODE/);
  assert.throws(
    () => createTelegramTransport({ mode: 'http-proxy' }),
    /TELEGRAM_PROXY_URL is required/,
  );
  assert.throws(
    () => createTelegramTransport({ mode: 'http-proxy', proxyUrl: 'socks://proxy.example' }),
    /HTTP or HTTPS/,
  );
});
