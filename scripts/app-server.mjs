import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createAuthDatabase } from './auth-database.mjs';
import { createTelegramBot } from './telegram-bot.mjs';
import {
  TelegramAuthError,
  normalizeTelegramId,
  validateTelegramInitData,
} from './telegram-auth.mjs';
import { loadDotEnv, loadVideoCatalog, upsertChannelVideo } from './video-catalog.mjs';

loadDotEnv();

const port = parsePositiveInteger(process.env.APP_SERVER_PORT, 8787, 'APP_SERVER_PORT');
const maxWebhookBodyBytes = parsePositiveInteger(
  process.env.WEBHOOK_MAX_BODY_BYTES,
  1024 * 1024,
  'WEBHOOK_MAX_BODY_BYTES',
);
const webhookPath = normalizeWebhookPath(process.env.TELEGRAM_WEBHOOK_PATH);
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
const botToken = process.env.BOT_TOKEN?.trim() || '';
const botUsername = process.env.BOT_USERNAME?.trim() || '';
const adminTelegramId = normalizeOptionalTelegramId(process.env.ADMIN_TELEGRAM_ID);
const miniAppUrl = (process.env.MINI_APP_URL || process.env.PUBLIC_BASE_URL || '').trim();
const configuredAuthDatabasePath = process.env.AUTH_DATABASE_PATH || 'data/auth.sqlite';
const authDatabasePath = configuredAuthDatabasePath === ':memory:'
  ? configuredAuthDatabasePath
  : resolve(process.cwd(), configuredAuthDatabasePath);
const telegramInitDataMaxAgeSeconds = parsePositiveInteger(
  process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
  900,
  'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
);
const sessionTtlSeconds = parsePositiveInteger(
  process.env.SESSION_TTL_SECONDS,
  7 * 24 * 60 * 60,
  'SESSION_TTL_SECONDS',
);
const inviteTtlSeconds = parsePositiveInteger(
  process.env.INVITE_TTL_SECONDS,
  24 * 60 * 60,
  'INVITE_TTL_SECONDS',
);
const sessionCookieName = normalizeCookieName(process.env.SESSION_COOKIE_NAME);
const secureSessionCookie = parseBoolean(
  process.env.SESSION_COOKIE_SECURE,
  miniAppUrl.startsWith('https://') || process.env.NODE_ENV === 'production',
);
const publicChannelUsername = process.env.PUBLIC_CHANNEL_USERNAME || '';
const defaultSituationSlug = process.env.DEFAULT_VIDEO_SITUATION_SLUG || 'puppy-toilet-home';
const distPath = resolve(process.cwd(), 'dist');
const indexHtmlPath = resolve(distPath, 'index.html');
const knownSlugs = (process.env.KNOWN_VIDEO_SITUATION_SLUGS || 'puppy-toilet-home')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://telegram.org",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    "form-action 'self'",
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

// Validate the writable catalog mount before the service starts accepting traffic.
loadVideoCatalog();
const authDatabase = createAuthDatabase(authDatabasePath);

if (adminTelegramId) {
  authDatabase.ensureAdmin(adminTelegramId);
}

const telegramBot = createTelegramBot({
  botToken,
  botUsername,
  miniAppUrl,
  adminTelegramId,
  database: authDatabase,
  inviteTtlSeconds,
});

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('[app-server] unhandled request error', error);

    if (response.headersSent) {
      response.destroy();
      return;
    }

    respondJson(response, 500, { ok: false, error: 'internal_error' });
  });
});

async function handleRequest(request, response) {
  const pathname = getRequestPathname(request);

  if (request.method === 'GET' && pathname === '/health') {
    respondJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && pathname === '/data/videos.json') {
    respondJson(response, 200, loadVideoCatalog());
    return;
  }

  if (pathname === '/api/auth/telegram') {
    await handleTelegramAuth(request, response);
    return;
  }

  if (pathname === '/api/me') {
    handleCurrentUser(request, response);
    return;
  }

  if (pathname === '/api/logout') {
    handleLogout(request, response);
    return;
  }

  if (pathname === webhookPath) {
    await handleTelegramWebhook(request, response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    await serveStaticFile(pathname, request.method, response);
    return;
  }

  respondJson(response, 404, { ok: false, error: 'not_found' });
}

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(port, '0.0.0.0', () => {
  console.log(`[app-server] listening on http://0.0.0.0:${port}`);
  console.log('[app-server] health endpoint: /health');
  console.log('[app-server] static frontend: dist/');

  if (webhookSecret) {
    console.log(`[app-server] Telegram webhook enabled: ${webhookPath}`);
  } else {
    console.log('[app-server] Telegram webhook disabled: TELEGRAM_WEBHOOK_SECRET is empty');
  }

  if (botToken && adminTelegramId) {
    console.log('[app-server] Telegram access bot and initData authentication enabled');
  } else {
    console.log('[app-server] Telegram access bot disabled: BOT_TOKEN or ADMIN_TELEGRAM_ID is empty');
  }
});

server.on('clientError', (_error, socket) => {
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown(signal));
}

async function handleTelegramWebhook(request, response) {
  if (request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  if (!webhookSecret) {
    respondJson(response, 503, { ok: false, error: 'webhook_disabled' });
    return;
  }

  if (!hasValidWebhookSecret(request.headers['x-telegram-bot-api-secret-token'])) {
    respondJson(response, 401, { ok: false, error: 'invalid_secret' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const updateId = body.update_id;

    if (authDatabase.isTelegramUpdateProcessed(updateId)) {
      respondJson(response, 200, { ok: true, duplicate: true });
      return;
    }

    const channelMessage = body.channel_post || body.edited_channel_post;

    if (channelMessage) {
      const result = upsertChannelVideo(channelMessage, {
        knownSlugs,
        defaultSituationSlug,
        publicChannelUsername,
      });

      if (result.changed) {
        console.log(
          `[video-catalog] saved message_id=${result.entry.telegramMessageId} slug=${result.situationSlug}`,
        );
      } else {
        console.log(`[video-catalog] skipped update: ${result.reason}`);
      }
    }

    if (telegramBot.enabled) {
      await telegramBot.handleUpdate(body);
    } else if (!channelMessage) {
      console.log('[telegram-bot] skipped update: access bot is disabled');
    }

    authDatabase.markTelegramUpdateProcessed(updateId);

    respondJson(response, 200, { ok: true });
  } catch (error) {
    if (error instanceof RequestError) {
      respondJson(response, error.statusCode, { ok: false, error: error.publicCode });
      return;
    }

    console.error('[telegram-webhook] update failed', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
}

async function handleTelegramAuth(request, response) {
  if (request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  if (!botToken || !adminTelegramId) {
    respondJson(response, 503, { ok: false, error: 'telegram_auth_disabled' });
    return;
  }

  if (!hasAllowedOrigin(request)) {
    respondJson(response, 403, { ok: false, error: 'invalid_origin' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const verified = validateTelegramInitData(body.initData, botToken, {
      maxAgeSeconds: telegramInitDataMaxAgeSeconds,
    });

    if (verified.user.id === adminTelegramId) {
      authDatabase.ensureAdmin(adminTelegramId);
    }

    const knownUser = authDatabase.getUser(verified.user.id);

    if (!knownUser || knownUser.status !== 'active') {
      respondJson(response, 403, { ok: false, error: 'access_denied' });
      return;
    }

    authDatabase.touchTelegramUser(verified.user);
    const session = authDatabase.createSession(verified.user.id, sessionTtlSeconds);

    if (!session) {
      respondJson(response, 403, { ok: false, error: 'access_denied' });
      return;
    }

    respondJson(
      response,
      200,
      { ok: true, user: publicUser(authDatabase.getUser(verified.user.id)) },
      { 'Set-Cookie': serializeSessionCookie(session.token, session.expiresAt) },
    );
  } catch (error) {
    if (error instanceof RequestError) {
      respondJson(response, error.statusCode, { ok: false, error: error.publicCode });
      return;
    }

    if (error instanceof TelegramAuthError) {
      respondJson(response, 401, { ok: false, error: error.code });
      return;
    }

    console.error('[telegram-auth] authentication failed', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
}

function handleCurrentUser(request, response) {
  if (request.method !== 'GET') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET' });
    return;
  }

  const user = getSessionUser(request);

  if (!user) {
    respondJson(response, 401, { ok: false, error: 'not_authenticated' });
    return;
  }

  respondJson(response, 200, { ok: true, user: publicUser(user) });
}

function handleLogout(request, response) {
  if (request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  if (!hasAllowedOrigin(request)) {
    respondJson(response, 403, { ok: false, error: 'invalid_origin' });
    return;
  }

  const token = parseCookies(request.headers.cookie)[sessionCookieName];
  authDatabase.revokeSession(token);
  respondJson(response, 200, { ok: true }, {
    'Set-Cookie': serializeSessionCookie('', 0),
  });
}

function getSessionUser(request) {
  const token = parseCookies(request.headers.cookie)[sessionCookieName];
  return token ? authDatabase.getSessionUser(token) : null;
}

function publicUser(user) {
  return {
    telegramId: user.telegramId,
    role: user.role,
    status: user.status,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

function hasValidWebhookSecret(providedSecret) {
  if (typeof providedSecret !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(webhookSecret);
  const providedBuffer = Buffer.from(providedSecret);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function readJsonBody(request) {
  return new Promise((resolveJson, reject) => {
    const declaredSize = Number(request.headers['content-length'] || 0);

    if (Number.isFinite(declaredSize) && declaredSize > maxWebhookBodyBytes) {
      request.resume();
      reject(new RequestError(413, 'payload_too_large'));
      return;
    }

    const chunks = [];
    let receivedBytes = 0;
    let bodyTooLarge = false;

    request.on('data', (chunk) => {
      if (bodyTooLarge) {
        return;
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.length;

      if (receivedBytes > maxWebhookBodyBytes) {
        bodyTooLarge = true;
        chunks.length = 0;
        return;
      }

      chunks.push(buffer);
    });
    request.on('end', () => {
      if (bodyTooLarge) {
        reject(new RequestError(413, 'payload_too_large'));
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');

      if (!raw) {
        resolveJson({});
        return;
      }

      try {
        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('JSON body must be an object');
        }

        resolveJson(parsed);
      } catch {
        reject(new RequestError(400, 'invalid_json'));
      }
    });
    request.on('error', reject);
  });
}

async function serveStaticFile(pathname, method, response) {
  const filePath = resolveStaticFilePath(pathname);
  const shouldFallbackToIndex = isSpaRoute(pathname);
  const targetPath = filePath || (shouldFallbackToIndex ? indexHtmlPath : null);

  if (!targetPath) {
    respondJson(response, 404, { ok: false, error: 'not_found' });
    return;
  }

  try {
    const content = await readFile(targetPath);

    writeResponseHead(response, 200, {
      'Cache-Control': getCacheControl(targetPath),
      'Content-Length': String(content.byteLength),
      'Content-Type': getContentType(targetPath),
    });

    response.end(method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT' && shouldFallbackToIndex && targetPath !== indexHtmlPath) {
      await serveIndexFile(method, response);
      return;
    }

    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      respondJson(response, 404, { ok: false, error: 'not_found' });
      return;
    }

    console.error('[static] file serving error', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
}

async function serveIndexFile(method, response) {
  try {
    const content = await readFile(indexHtmlPath);

    writeResponseHead(response, 200, {
      'Cache-Control': 'no-cache',
      'Content-Length': String(content.byteLength),
      'Content-Type': 'text/html; charset=utf-8',
    });

    response.end(method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      respondJson(response, 503, { ok: false, error: 'frontend_not_built' });
      return;
    }

    console.error('[static] index serving error', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
}

function resolveStaticFilePath(pathname) {
  const cleanPathname = pathname === '/' ? '/index.html' : pathname;
  const decodedPathname = safeDecodeURIComponent(cleanPathname);

  if (!decodedPathname || decodedPathname.includes('\0')) {
    return null;
  }

  const filePath = resolve(distPath, `.${decodedPathname}`);
  const distRoot = `${distPath}${sep}`;

  if (filePath !== distPath && !filePath.startsWith(distRoot)) {
    return null;
  }

  return filePath;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function getRequestPathname(request) {
  try {
    return new URL(request.url || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function respondJson(response, statusCode, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body));

  writeResponseHead(response, statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.byteLength),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(payload);
}

function writeResponseHead(response, statusCode, headers) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...headers,
  });
}

function isSpaRoute(pathname) {
  return (
    !extname(pathname) &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/assets/') &&
    !pathname.startsWith('/data/') &&
    !pathname.startsWith('/media/') &&
    !pathname.startsWith('/telegram/')
  );
}

function getCacheControl(filePath) {
  if (filePath.includes(`${sep}assets${sep}`)) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}

function getContentType(filePath) {
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };

  return contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function normalizeWebhookPath(value) {
  const path = value?.trim() || '/telegram/webhook';
  return path.startsWith('/') ? path : `/${path}`;
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

function normalizeCookieName(value) {
  const name = value?.trim() || 'miniapp_session';

  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error('SESSION_COOKIE_NAME contains unsupported characters');
  }

  return name;
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

function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== 'string') {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return separator === -1
          ? [part, '']
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

function serializeSessionCookie(token, expiresAt) {
  const maxAge = token ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : 0;
  const parts = [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (secureSessionCookie) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function hasAllowedOrigin(request) {
  const origin = request.headers.origin;

  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === request.headers.host;
  } catch {
    return false;
  }
}

function shutdown(signal) {
  console.log(`[app-server] received ${signal}, shutting down`);

  server.close((error) => {
    if (error) {
      console.error('[app-server] graceful shutdown failed', error);
      process.exitCode = 1;
    }

    authDatabase.close();
  });
  server.closeIdleConnections();

  setTimeout(() => {
    server.closeAllConnections();
  }, 10_000).unref();
}

class RequestError extends Error {
  constructor(statusCode, publicCode) {
    super(publicCode);
    this.name = 'RequestError';
    this.statusCode = statusCode;
    this.publicCode = publicCode;
  }
}
