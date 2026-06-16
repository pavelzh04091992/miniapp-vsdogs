import { createServer } from 'node:http';
import {
  getRequiredEnv,
  loadDotEnv,
  upsertChannelVideo,
} from './video-catalog.mjs';

loadDotEnv();

const port = Number(process.env.BOT_SERVER_PORT || 8787);
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const publicChannelUsername = process.env.PUBLIC_CHANNEL_USERNAME || '';
const defaultSituationSlug = process.env.DEFAULT_VIDEO_SITUATION_SLUG || 'puppy-toilet-home';
const knownSlugs = (process.env.KNOWN_VIDEO_SITUATION_SLUGS || 'puppy-toilet-home')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

getRequiredEnv('BOT_TOKEN');

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== 'POST' || request.url !== webhookPath) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'not_found' }));
    return;
  }

  if (webhookSecret) {
    const providedSecret = request.headers['x-telegram-bot-api-secret-token'];

    if (providedSecret !== webhookSecret) {
      response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: 'invalid_secret' }));
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

    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error('[video-catalog] webhook error', error);
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'internal_error' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[bot-server] listening on http://0.0.0.0:${port}${webhookPath}`);
  console.log('[bot-server] health endpoint: /health');
});

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}
