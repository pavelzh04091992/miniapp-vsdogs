import { loadDotEnv } from './env.mjs';

loadDotEnv();

const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080');
const videoId =
  process.env.SMOKE_VIDEO_ID === undefined
    ? 'map-puppy-fitness-house'
    : process.env.SMOKE_VIDEO_ID.trim();
const sessionCookie = process.env.SMOKE_SESSION_COOKIE?.trim() || '';

await checkJson('/health', (payload) => payload?.ok === true, 'health endpoint');
await checkText('/', (body) => body.includes('<div id="app"></div>'), 'frontend');

if (sessionCookie) {
  await checkJson(
    '/data/videos.json',
    (payload) => Array.isArray(payload?.videos),
    'authenticated video catalog',
    sessionHeaders(),
  );
  await checkStatus('/assets/hero-dog.webp', 200, 'authenticated private asset', sessionHeaders());
  await checkVideoRange(videoId);
} else {
  await checkStatus('/data/videos.json', 401, 'anonymous video catalog rejection');
  await checkStatus('/assets/hero-dog.webp', 401, 'anonymous private asset rejection');
  await checkStatus('/media/smoke-protected/video.mp4', 401, 'anonymous media rejection');
  console.log('[smoke] authenticated checks skipped (SMOKE_SESSION_COOKIE is empty)');
}

console.log(`[smoke] deployment is ready: ${baseUrl}`);

async function checkJson(pathname, validate, label, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();

  if (!response.ok || !validate(payload)) {
    fail(`${label} failed with status ${response.status}`);
  }

  console.log(`[smoke] ok: ${label}`);
}

async function checkStatus(pathname, expectedStatus, label, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status !== expectedStatus) {
    fail(`${label} failed with status ${response.status}; expected ${expectedStatus}`);
  }

  await response.body?.cancel();
  console.log(`[smoke] ok: ${label}`);
}

async function checkText(pathname, validate, label) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();

  if (!response.ok || !validate(body)) {
    fail(`${label} failed with status ${response.status}`);
  }

  console.log(`[smoke] ok: ${label}`);
}

async function checkVideoRange(id) {
  if (!id) {
    console.log('[smoke] skipped: video range request (SMOKE_VIDEO_ID is empty)');
    return;
  }

  const response = await fetch(`${baseUrl}/media/${encodeURIComponent(id)}/video.mp4`, {
    headers: { Range: 'bytes=0-1023', ...sessionHeaders() },
    signal: AbortSignal.timeout(10_000),
  });
  const contentRange = response.headers.get('content-range') || '';

  if (response.status !== 206 || !contentRange.startsWith('bytes 0-1023/')) {
    fail(`video range request failed with status ${response.status}`);
  }

  await response.body?.cancel();
  console.log(`[smoke] ok: video range request (${id})`);
}

function sessionHeaders() {
  return sessionCookie ? { Cookie: sessionCookie } : {};
}

function normalizeBaseUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    fail(`invalid base URL: ${value}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('base URL must use http or https');
  }

  return parsed.toString().replace(/\/$/, '');
}

function fail(message) {
  console.error(`[smoke] ${message}`);
  process.exit(1);
}
