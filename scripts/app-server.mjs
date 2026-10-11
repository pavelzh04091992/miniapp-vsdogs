import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createAuthDatabase } from './auth-database.mjs';
import { loadDotEnv } from './env.mjs';
import {
  RequestError,
  getClientIdentifier,
  getRequestPathname,
  getRequestUrl,
  hasAllowedOrigin,
  parseCookies,
  readJsonBody,
  redirect,
  respondJson,
  writeResponseHead,
} from './http-utils.mjs';
import { createRateLimiter } from './rate-limit.mjs';
import { readServerConfig } from './server-config.mjs';
import { createStaticServer } from './static-server.mjs';
import { createTelegramBot } from './telegram-bot.mjs';
import {
  TelegramAuthError,
  hashOpaqueToken,
  isOpaqueToken,
  validateTelegramInitData,
} from './telegram-auth.mjs';
import { loadVideoCatalog, upsertChannelVideo } from './video-catalog.mjs';

loadDotEnv();

const config = readServerConfig();
const {
  adminTelegramId,
  allowedOrigins,
  authDatabasePath,
  authRateLimitMax,
  botCommandRateLimitMax,
  botStateTtlSeconds,
  botToken,
  botUsername,
  defaultSituationSlug,
  distPath,
  inviteTtlSeconds,
  knownSlugs,
  magicLinkRateLimitMax,
  magicLinkTtlSeconds,
  maxRequestBodyBytes,
  miniAppUrl,
  port,
  publicBaseUrl,
  publicChannelId,
  publicChannelUsername,
  rateLimitWindowSeconds,
  secureSessionCookie,
  sessionCookieName,
  sessionCookieSameSite,
  sessionTtlSeconds,
  telegramInitDataMaxAgeSeconds,
  trustProxyHeaders,
  webhookPath,
  webhookSecret,
} = config;
const magicConfirmationCookieName = secureSessionCookie
  ? '__Host-miniapp_magic'
  : 'miniapp_magic';
const serveStaticFile = createStaticServer(distPath);

// Validate the writable catalog mount before the service starts accepting traffic.
loadVideoCatalog();
const authDatabase = createAuthDatabase(authDatabasePath);
const databaseMaintenanceTimer = setInterval(() => {
  try {
    authDatabase.cleanup();
  } catch (error) {
    console.error('[auth-database] scheduled cleanup failed', error);
  }
}, 6 * 60 * 60 * 1000);
databaseMaintenanceTimer.unref();

if (adminTelegramId) {
  authDatabase.ensureAdmin(adminTelegramId);
}

const telegramBot = createTelegramBot({
  botToken,
  botUsername,
  miniAppUrl,
  publicBaseUrl,
  adminTelegramId,
  database: authDatabase,
  inviteTtlSeconds,
  magicLinkTtlSeconds,
  botStateTtlSeconds,
  commandRateLimitMax: botCommandRateLimitMax,
  commandRateLimitWindowMs: rateLimitWindowSeconds * 1000,
});

const telegramAuthRateLimiter = createRateLimiter({
  limit: authRateLimitMax,
  windowMs: rateLimitWindowSeconds * 1000,
});
const magicLinkRateLimiter = createRateLimiter({
  limit: magicLinkRateLimitMax,
  windowMs: rateLimitWindowSeconds * 1000,
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

  if (pathname === '/data' || pathname.startsWith('/data/')) {
    if (request.method !== 'GET') {
      respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET' });
      return;
    }

    if (pathname !== '/data/videos.json') {
      respondJson(response, 404, { ok: false, error: 'not_found' });
      return;
    }

    if (!getSessionUser(request)) {
      respondJson(response, 401, { ok: false, error: 'not_authenticated' });
      return;
    }

    respondJson(response, 200, loadVideoCatalog());
    return;
  }

  if (
    pathname === '/assets' ||
    pathname.startsWith('/assets/') ||
    pathname === '/private' ||
    pathname.startsWith('/private/')
  ) {
    await handlePrivateAsset(request, response, pathname);
    return;
  }

  if (pathname === '/internal/media-auth') {
    handleMediaAuth(request, response);
    return;
  }

  if (pathname === '/api/auth/telegram') {
    await handleTelegramAuth(request, response);
    return;
  }

  if (pathname === '/api/auth/config') {
    handleAuthConfig(request, response);
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

  if (pathname === '/auth/magic') {
    handleMagicLink(request, response);
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

  let claimedUpdateId = null;

  try {
    const body = await readJsonBody(request, maxRequestBodyBytes);
    const updateId = body.update_id;

    if (!authDatabase.claimTelegramUpdate(updateId)) {
      respondJson(response, 200, { ok: true, duplicate: true });
      return;
    }

    claimedUpdateId = updateId;

    const channelMessage = body.channel_post || body.edited_channel_post;

    if (channelMessage) {
      const result = upsertChannelVideo(channelMessage, {
        knownSlugs,
        defaultSituationSlug,
        publicChannelId,
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

    respondJson(response, 200, { ok: true });
  } catch (error) {
    if (claimedUpdateId !== null) {
      authDatabase.releaseTelegramUpdate(claimedUpdateId);
    }

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

  if (!allowRateLimitedRequest(telegramAuthRateLimiter, request, response)) {
    return;
  }

  if (!hasAllowedOrigin(request, allowedOrigins)) {
    respondJson(response, 403, { ok: false, error: 'invalid_origin' });
    return;
  }

  try {
    const body = await readJsonBody(request, maxRequestBodyBytes);
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

function handleAuthConfig(request, response) {
  if (request.method !== 'GET') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET' });
    return;
  }

  respondJson(response, 200, {
    ok: true,
    botUrl: getPublicBotUrl(),
  });
}

function handleMagicLink(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, POST' });
    return;
  }

  if (!allowRateLimitedRequest(magicLinkRateLimiter, request, response)) {
    return;
  }

  const tokens = getRequestUrl(request).searchParams.getAll('token');
  const token = tokens.length === 1 ? tokens[0] : null;

  if (request.method === 'GET') {
    if (!authDatabase.isMagicLinkUsable(token)) {
      redirect(response, '/?auth=invalid-link', {
        'Set-Cookie': serializeMagicConfirmationCookie('', 0),
      });
      return;
    }

    respondMagicLinkConfirmation(response, token, {
      'Set-Cookie': serializeMagicConfirmationCookie(hashOpaqueToken(token), magicLinkTtlSeconds),
    });
    return;
  }

  if (!hasAllowedOrigin(request, allowedOrigins)) {
    respondJson(response, 403, { ok: false, error: 'invalid_origin' });
    return;
  }

  const expectedConfirmation = isOpaqueToken(token) ? hashOpaqueToken(token) : null;
  const providedConfirmation = parseCookies(request.headers.cookie)[magicConfirmationCookieName];
  const clearConfirmationCookie = serializeMagicConfirmationCookie('', 0);

  if (!constantTimeStringEqual(expectedConfirmation, providedConfirmation)) {
    redirect(response, '/?auth=invalid-link', { 'Set-Cookie': clearConfirmationCookie });
    return;
  }

  const session = authDatabase.consumeMagicLink(token, sessionTtlSeconds);

  if (!session) {
    redirect(response, '/?auth=invalid-link', { 'Set-Cookie': clearConfirmationCookie });
    return;
  }

  redirect(response, '/?auth=success', {
    'Set-Cookie': [
      serializeSessionCookie(session.token, session.expiresAt),
      clearConfirmationCookie,
    ],
  });
}

function respondMagicLinkConfirmation(response, token, extraHeaders = {}) {
  const action = `/auth/magic?token=${encodeURIComponent(token)}`;
  const payload = Buffer.from(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Вход в Puppys</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#eef5fc;font-family:system-ui,sans-serif;color:#17324f">
  <main style="width:min(86vw,380px);padding:32px 24px;border-radius:24px;background:#fff;text-align:center;box-shadow:0 20px 50px rgba(26,74,123,.14)">
    <div style="font-size:42px" aria-hidden="true">🐾</div>
    <h1 style="margin:14px 0 8px;font-size:26px">Войти в приложение?</h1>
    <p style="margin:0 0 24px;color:#607086;line-height:1.5">Ссылка одноразовая. Нажмите кнопку, чтобы подтвердить вход в этом браузере.</p>
    <form method="post" action="${action}">
      <button type="submit" style="width:100%;min-height:50px;border:0;border-radius:16px;background:#1150a1;color:#fff;font:inherit;font-weight:700;cursor:pointer">Войти</button>
    </form>
  </main>
</body>
</html>`);

  writeResponseHead(response, 200, {
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.byteLength),
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  });
  response.end(payload);
}

function handleLogout(request, response) {
  if (request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    return;
  }

  if (!hasAllowedOrigin(request, allowedOrigins)) {
    respondJson(response, 403, { ok: false, error: 'invalid_origin' });
    return;
  }

  const token = parseCookies(request.headers.cookie)[sessionCookieName];
  authDatabase.revokeSession(token);
  respondJson(response, 200, { ok: true }, {
    'Set-Cookie': serializeSessionCookie('', 0),
  });
}

function handleMediaAuth(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
    return;
  }

  if (!getSessionUser(request, { touch: false })) {
    respondJson(response, 401, { ok: false, error: 'not_authenticated' });
    return;
  }

  writeResponseHead(response, 204, {
    'Cache-Control': 'no-store',
  });
  response.end();
}

async function handlePrivateAsset(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    respondJson(response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
    return;
  }

  if (!getSessionUser(request, { touch: false })) {
    respondJson(response, 401, { ok: false, error: 'not_authenticated' });
    return;
  }

  await serveStaticFile(pathname, request.method, response, { allowPrivateAssets: true });
}

function getSessionUser(request, options = {}) {
  const token = parseCookies(request.headers.cookie)[sessionCookieName];
  return token ? authDatabase.getSessionUser(token, options) : null;
}

function allowRateLimitedRequest(limiter, request, response) {
  const result = limiter.consume(getClientIdentifier(request, { trustProxyHeaders }));

  if (result.allowed) {
    return true;
  }

  respondJson(
    response,
    429,
    { ok: false, error: 'rate_limited' },
    { 'Retry-After': String(result.retryAfterSeconds) },
  );
  return false;
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
  return constantTimeStringEqual(webhookSecret, providedSecret);
}

function getPublicBotUrl() {
  const username = botUsername.replace(/^@/, '');
  return /^[A-Za-z\d_]{5,32}$/.test(username) ? `https://t.me/${username}` : null;
}

function serializeSessionCookie(token, expiresAt) {
  const maxAge = token ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : 0;
  const parts = [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sessionCookieSameSite}`,
    `Max-Age=${maxAge}`,
  ];

  if (secureSessionCookie) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function serializeMagicConfirmationCookie(value, maxAge) {
  const parts = [
    `${magicConfirmationCookieName}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, maxAge)}`,
  ];

  if (secureSessionCookie) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function constantTimeStringEqual(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function shutdown(signal) {
  console.log(`[app-server] received ${signal}, shutting down`);
  clearInterval(databaseMaintenanceTimer);

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
