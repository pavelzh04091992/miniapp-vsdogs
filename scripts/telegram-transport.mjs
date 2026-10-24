import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici';

const TELEGRAM_EGRESS_MODES = new Set(['direct', 'ssh-tunnel', 'http-proxy']);

export function createTelegramTransport(options = {}) {
  const mode = normalizeTelegramEgressMode(options.mode);
  const proxyUrl = normalizeTelegramProxyUrl(options.proxyUrl, mode);
  const fetchImpl = options.fetchImpl ?? undiciFetch;
  const dispatcher = mode === 'http-proxy'
    ? new ProxyAgent({ uri: proxyUrl, connections: 8 })
    : new Agent({
      connections: 8,
      pipelining: 1,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 120_000,
    });

  return {
    mode,
    description: mode,
    fetch: (input, init = {}) => fetchImpl(input, { ...init, dispatcher }),
    close: () => dispatcher.close(),
  };
}

export function createTelegramTransportFromEnv(env = process.env, options = {}) {
  return createTelegramTransport({
    ...options,
    mode: env.TELEGRAM_EGRESS_MODE,
    proxyUrl: env.TELEGRAM_PROXY_URL,
  });
}

export function normalizeTelegramEgressMode(value) {
  const mode = String(value || 'direct').trim().toLowerCase();

  if (!TELEGRAM_EGRESS_MODES.has(mode)) {
    throw new Error('TELEGRAM_EGRESS_MODE must be direct, ssh-tunnel or http-proxy');
  }

  return mode;
}

function normalizeTelegramProxyUrl(value, mode) {
  const rawValue = String(value || '').trim();

  if (mode !== 'http-proxy') {
    return undefined;
  }

  if (!rawValue) {
    throw new Error('TELEGRAM_PROXY_URL is required for http-proxy mode');
  }

  const parsed = new URL(rawValue);

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('TELEGRAM_PROXY_URL must be an HTTP or HTTPS proxy URL');
  }

  return parsed.toString();
}
