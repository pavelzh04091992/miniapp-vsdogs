import { resolve } from 'node:path';
import { normalizeTelegramId } from './telegram-auth.mjs';
import { normalizeTelegramEgressMode } from './telegram-transport.mjs';

const LOOPBACK_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export function readServerConfig(env = process.env, cwd = process.cwd()) {
  const lockedMode = parseBoolean(env.LOCKED_MODE, false);
  const publicBaseUrl = normalizePublicBaseUrl(env.PUBLIC_BASE_URL);
  const miniAppUrl = normalizeOptionalUrl(env.MINI_APP_URL || publicBaseUrl, 'MINI_APP_URL');
  const secureSessionCookie = parseBoolean(
    env.SESSION_COOKIE_SECURE,
    miniAppUrl.startsWith('https://') || env.NODE_ENV === 'production',
  );
  const sessionCookieSameSite = normalizeSameSite(
    env.SESSION_COOKIE_SAME_SITE,
    secureSessionCookie ? 'None' : 'Lax',
  );

  if (sessionCookieSameSite === 'None' && !secureSessionCookie) {
    throw new Error('SESSION_COOKIE_SAME_SITE=None requires SESSION_COOKIE_SECURE=true');
  }
  const configuredAuthDatabasePath = env.AUTH_DATABASE_PATH || 'data/auth.sqlite';
  const allowedOrigins = new Set(env.NODE_ENV === 'production' ? [] : LOOPBACK_ORIGINS);
  const knownSlugs = normalizeSlugs(env.KNOWN_VIDEO_SITUATION_SLUGS);
  const defaultSituationSlug = normalizeSlug(
    env.DEFAULT_VIDEO_SITUATION_SLUG || knownSlugs[0],
    'DEFAULT_VIDEO_SITUATION_SLUG',
  );

  if (!knownSlugs.includes(defaultSituationSlug)) {
    throw new Error('DEFAULT_VIDEO_SITUATION_SLUG must be included in KNOWN_VIDEO_SITUATION_SLUGS');
  }

  for (const value of [publicBaseUrl, miniAppUrl, ...(env.ALLOWED_ORIGINS || '').split(',')]) {
    const origin = normalizeOptionalOrigin(value, 'ALLOWED_ORIGINS');

    if (origin) {
      allowedOrigins.add(origin);
    }
  }

  const config = {
    lockedMode,
    port: parsePositiveInteger(env.APP_SERVER_PORT, 8787, 'APP_SERVER_PORT'),
    maxRequestBodyBytes: parsePositiveInteger(
      env.WEBHOOK_MAX_BODY_BYTES,
      1024 * 1024,
      'WEBHOOK_MAX_BODY_BYTES',
    ),
    webhookPath: normalizeWebhookPath(env.TELEGRAM_WEBHOOK_PATH),
    webhookSecret: normalizeWebhookSecret(env.TELEGRAM_WEBHOOK_SECRET),
    botToken: env.BOT_TOKEN?.trim() || '',
    botUsername: normalizeOptionalBotUsername(env.BOT_USERNAME),
    adminTelegramId: normalizeOptionalTelegramId(env.ADMIN_TELEGRAM_ID),
    publicBaseUrl,
    miniAppUrl,
    authDatabasePath: configuredAuthDatabasePath === ':memory:'
      ? configuredAuthDatabasePath
      : resolve(cwd, configuredAuthDatabasePath),
    telegramInitDataMaxAgeSeconds: parsePositiveInteger(
      env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
      900,
      'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
    ),
    telegramEgressMode: normalizeTelegramEgressMode(env.TELEGRAM_EGRESS_MODE),
    telegramProxyUrl: env.TELEGRAM_PROXY_URL?.trim() || '',
    sessionTtlSeconds: parsePositiveInteger(
      env.SESSION_TTL_SECONDS,
      7 * 24 * 60 * 60,
      'SESSION_TTL_SECONDS',
    ),
    inviteTtlSeconds: parsePositiveInteger(
      env.INVITE_TTL_SECONDS,
      24 * 60 * 60,
      'INVITE_TTL_SECONDS',
    ),
    magicLinkTtlSeconds: parsePositiveInteger(
      env.MAGIC_LINK_TTL_SECONDS,
      10 * 60,
      'MAGIC_LINK_TTL_SECONDS',
    ),
    botStateTtlSeconds: parsePositiveInteger(
      env.BOT_STATE_TTL_SECONDS,
      10 * 60,
      'BOT_STATE_TTL_SECONDS',
    ),
    subscriptionWarningSeconds: parsePositiveInteger(
      env.SUBSCRIPTION_WARNING_SECONDS,
      3 * 24 * 60 * 60,
      'SUBSCRIPTION_WARNING_SECONDS',
    ),
    subscriptionSweepIntervalSeconds: parsePositiveInteger(
      env.SUBSCRIPTION_SWEEP_INTERVAL_SECONDS,
      5 * 60,
      'SUBSCRIPTION_SWEEP_INTERVAL_SECONDS',
    ),
    rateLimitWindowSeconds: parsePositiveInteger(
      env.RATE_LIMIT_WINDOW_SECONDS,
      60,
      'RATE_LIMIT_WINDOW_SECONDS',
    ),
    trustProxyHeaders: parseBoolean(
      env.TRUST_PROXY_HEADERS,
      env.NODE_ENV === 'production',
    ),
    authRateLimitMax: parsePositiveInteger(env.AUTH_RATE_LIMIT_MAX, 20, 'AUTH_RATE_LIMIT_MAX'),
    magicLinkRateLimitMax: parsePositiveInteger(
      env.MAGIC_LINK_RATE_LIMIT_MAX,
      30,
      'MAGIC_LINK_RATE_LIMIT_MAX',
    ),
    botCommandRateLimitMax: parsePositiveInteger(
      env.BOT_COMMAND_RATE_LIMIT_MAX,
      40,
      'BOT_COMMAND_RATE_LIMIT_MAX',
    ),
    feedbackRateLimitMax: parsePositiveInteger(
      env.FEEDBACK_RATE_LIMIT_MAX,
      4,
      'FEEDBACK_RATE_LIMIT_MAX',
    ),
    feedbackRateLimitWindowSeconds: parsePositiveInteger(
      env.FEEDBACK_RATE_LIMIT_WINDOW_SECONDS,
      10 * 60,
      'FEEDBACK_RATE_LIMIT_WINDOW_SECONDS',
    ),
    sessionCookieName: normalizeCookieName(env.SESSION_COOKIE_NAME, secureSessionCookie),
    sessionCookieSameSite,
    secureSessionCookie,
    publicChannelId: normalizeOptionalChatId(env.PUBLIC_CHANNEL_ID),
    publicChannelUsername: env.PUBLIC_CHANNEL_USERNAME || '',
    defaultSituationSlug,
    knownSlugs,
    distPath: resolve(cwd, 'dist'),
    allowedOrigins,
  };

  validateLockedConfig(config);

  if (config.telegramEgressMode === 'http-proxy' && !config.telegramProxyUrl) {
    throw new Error('TELEGRAM_PROXY_URL is required for http-proxy mode');
  }

  return config;
}

function validateLockedConfig(config) {
  if (!config.lockedMode) {
    return;
  }

  const missing = [];

  if (!config.botToken) missing.push('BOT_TOKEN');
  if (!config.botUsername) missing.push('BOT_USERNAME');
  if (!config.adminTelegramId) missing.push('ADMIN_TELEGRAM_ID');
  if (!config.publicBaseUrl) missing.push('PUBLIC_BASE_URL');
  if (!config.miniAppUrl) missing.push('MINI_APP_URL');
  if (!config.webhookSecret) missing.push('TELEGRAM_WEBHOOK_SECRET');

  if (missing.length > 0) {
    throw new Error(`LOCKED_MODE requires: ${missing.join(', ')}`);
  }

  if (!config.publicBaseUrl.startsWith('https://')) {
    throw new Error('LOCKED_MODE requires an HTTPS PUBLIC_BASE_URL');
  }

  if (!config.miniAppUrl.startsWith('https://')) {
    throw new Error('LOCKED_MODE requires an HTTPS MINI_APP_URL');
  }

  if (!config.secureSessionCookie) {
    throw new Error('LOCKED_MODE requires SESSION_COOKIE_SECURE=true');
  }

  if (!config.trustProxyHeaders) {
    throw new Error('LOCKED_MODE requires TRUST_PROXY_HEADERS=true');
  }
}

function normalizeWebhookPath(value) {
  const path = value?.trim() || '/telegram/webhook';

  if (!/^\/telegram\/[A-Za-z\d_-]+$/.test(path)) {
    throw new Error('TELEGRAM_WEBHOOK_PATH must match /telegram/<name>');
  }

  return path;
}

function normalizeWebhookSecret(value) {
  const secret = value?.trim() || '';

  if (secret && !/^[A-Za-z\d_-]{1,256}$/.test(secret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET contains unsupported characters');
  }

  return secret;
}

function parsePositiveInteger(value, fallback, name) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function normalizeOptionalTelegramId(value) {
  if (!value?.trim()) {
    return null;
  }

  const id = normalizeTelegramId(value);

  if (!id) {
    throw new Error('ADMIN_TELEGRAM_ID must be a positive numeric Telegram ID');
  }

  return id;
}

function normalizeOptionalBotUsername(value) {
  const username = value?.trim().replace(/^@/, '') || '';

  if (username && !/^[A-Za-z\d_]{5,32}$/.test(username)) {
    throw new Error('BOT_USERNAME must be a valid Telegram bot username');
  }

  return username;
}

function normalizeOptionalChatId(value) {
  const normalized = value?.trim();

  if (!normalized) {
    return '';
  }

  if (!/^-?[1-9]\d{0,19}$/.test(normalized)) {
    throw new Error('PUBLIC_CHANNEL_ID must be a numeric Telegram chat ID');
  }

  return normalized;
}

function normalizeCookieName(value, secure) {
  const name = value?.trim() || (secure ? '__Host-miniapp_session' : 'miniapp_session');

  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error('SESSION_COOKIE_NAME contains unsupported characters');
  }

  if (name.startsWith('__Host-') && !secure) {
    throw new Error('__Host- session cookies require SESSION_COOKIE_SECURE=true');
  }

  return name;
}

function normalizeSameSite(value, fallback) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const values = {
    lax: 'Lax',
    strict: 'Strict',
    none: 'None',
  };

  if (!values[normalized]) {
    throw new Error('SESSION_COOKIE_SAME_SITE must be Lax, Strict, or None');
  }

  return values[normalized];
}

function parseBoolean(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  throw new Error('Boolean environment value must be true/false or 1/0');
}

function normalizeOptionalUrl(value, name) {
  if (!value?.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }

    if (url.username || url.password || url.hash) {
      throw new Error();
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
}

function normalizePublicBaseUrl(value) {
  const normalized = normalizeOptionalUrl(value, 'PUBLIC_BASE_URL');

  if (!normalized) {
    return '';
  }

  const url = new URL(normalized);

  if (url.pathname !== '/' || url.search) {
    throw new Error('PUBLIC_BASE_URL must contain only an HTTP(S) origin');
  }

  return url.origin;
}

function normalizeSlugs(value) {
  const slugs = (value || 'puppy-toilet-home')
    .split(',')
    .map((slug) => normalizeSlug(slug.trim(), 'KNOWN_VIDEO_SITUATION_SLUGS'));
  return [...new Set(slugs)];
}

function normalizeSlug(value, name) {
  if (!/^[a-z\d]+(?:-[a-z\d]+)*$/.test(value || '')) {
    throw new Error(`${name} must contain lowercase slugs separated by commas`);
  }

  return value;
}

function normalizeOptionalOrigin(value, name) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new Error(`${name} must contain absolute HTTP(S) origins`);
  }
}
