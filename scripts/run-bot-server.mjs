import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  getRequiredEnv,
  loadDotEnv,
  loadVideoCatalog,
  upsertChannelVideo,
} from './video-catalog.mjs';

loadDotEnv();

const port = Number(process.env.BOT_SERVER_PORT || 8787);
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const publicChannelUsername = process.env.PUBLIC_CHANNEL_USERNAME || '';
const defaultSituationSlug = process.env.DEFAULT_VIDEO_SITUATION_SLUG || 'puppy-toilet-home';
const distPath = resolve(process.cwd(), 'dist');
const indexHtmlPath = resolve(distPath, 'index.html');
const knownSlugs = (process.env.KNOWN_VIDEO_SITUATION_SLUGS || 'puppy-toilet-home')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

getRequiredEnv('BOT_TOKEN');

const server = createServer(async (request, response) => {
  const pathname = getRequestPathname(request);

  if (request.method === 'GET' && pathname === '/health') {
    respondJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && pathname === '/data/videos.json') {
    respondJson(response, 200, loadVideoCatalog());
    return;
  }

  if (request.method !== 'POST' || pathname !== webhookPath) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      await serveStaticFile(pathname, request.method, response);
      return;
    }

    respondJson(response, 404, { ok: false, error: 'not_found' });
    return;
  }

  if (webhookSecret) {
    const providedSecret = request.headers['x-telegram-bot-api-secret-token'];

    if (providedSecret !== webhookSecret) {
      respondJson(response, 401, { ok: false, error: 'invalid_secret' });
      return;
    }
  }

  try {
    const body = await readJsonBody(request);
    const message = body.channel_post || body.edited_channel_post;

    if (message) {
      const result = upsertChannelVideo(message, {
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
    } else {
      console.log('[video-catalog] skipped non-channel update');
    }

    respondJson(response, 200, { ok: true });
  } catch (error) {
    console.error('[video-catalog] webhook error', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[bot-server] listening on http://0.0.0.0:${port}`);
  console.log(`[bot-server] webhook endpoint: ${webhookPath}`);
  console.log('[bot-server] health endpoint: /health');
  console.log('[bot-server] static frontend: dist/');
});

function readJsonBody(request) {
  return new Promise((resolveJson, reject) => {
    let raw = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolveJson({});
        return;
      }

      try {
        resolveJson(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function serveStaticFile(pathname, method, response) {
  const filePath = resolveStaticFilePath(pathname);
  const shouldFallbackToIndex = !isAssetRequest(pathname);
  const targetPath = filePath || (shouldFallbackToIndex ? indexHtmlPath : null);

  if (!targetPath) {
    respondJson(response, 404, { ok: false, error: 'not_found' });
    return;
  }

  try {
    const content = await readFile(targetPath);

    response.writeHead(200, {
      'Cache-Control': getCacheControl(targetPath),
      'Content-Type': getContentType(targetPath),
    });

    if (method === 'HEAD') {
      response.end();
      return;
    }

    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT' && shouldFallbackToIndex && targetPath !== indexHtmlPath) {
      await serveIndexFile(method, response);
      return;
    }

    if (error.code === 'ENOENT') {
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

    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    });

    if (method === 'HEAD') {
      response.end();
      return;
    }

    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      respondJson(response, 404, { ok: false, error: 'frontend_not_built' });
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

function respondJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function isAssetRequest(pathname) {
  return pathname.startsWith('/assets/') || Boolean(extname(pathname));
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
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };

  return contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
}
