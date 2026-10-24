export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
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
});

export class RequestError extends Error {
  constructor(statusCode, publicCode) {
    super(publicCode);
    this.name = 'RequestError';
    this.statusCode = statusCode;
    this.publicCode = publicCode;
  }
}

export function readJsonBody(request, maxBodyBytes) {
  return new Promise((resolveJson, reject) => {
    const contentType = String(request.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();

    if (contentType !== 'application/json') {
      request.resume();
      reject(new RequestError(415, 'unsupported_media_type'));
      return;
    }

    const contentLength = request.headers['content-length'];
    const declaredSize = contentLength === undefined ? 0 : Number(contentLength);

    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
      request.resume();
      reject(new RequestError(400, 'invalid_content_length'));
      return;
    }

    if (Number.isFinite(declaredSize) && declaredSize > maxBodyBytes) {
      request.resume();
      reject(new RequestError(413, 'payload_too_large'));
      return;
    }

    const chunks = [];
    let receivedBytes = 0;
    let bodyTooLarge = false;
    let settled = false;

    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    request.on('data', (chunk) => {
      if (bodyTooLarge) {
        return;
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.length;

      if (receivedBytes > maxBodyBytes) {
        bodyTooLarge = true;
        chunks.length = 0;
        return;
      }

      chunks.push(buffer);
    });
    request.on('end', () => {
      if (bodyTooLarge) {
        fail(new RequestError(413, 'payload_too_large'));
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');

      try {
        const parsed = raw ? JSON.parse(raw) : {};

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('JSON body must be an object');
        }

        settled = true;
        resolveJson(parsed);
      } catch {
        fail(new RequestError(400, 'invalid_json'));
      }
    });
    request.on('aborted', () => fail(new RequestError(400, 'request_aborted')));
    request.on('error', fail);
  });
}

export function getRequestUrl(request) {
  try {
    return new URL(request.url || '/', 'http://localhost');
  } catch {
    return new URL('http://localhost/');
  }
}

export function getRequestPathname(request) {
  return getRequestUrl(request).pathname;
}

export function respondJson(response, statusCode, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body));

  writeResponseHead(response, statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.byteLength),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(payload);
}

export function writeResponseHead(response, statusCode, headers = {}) {
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    ...headers,
  });
}

export function redirect(response, location, extraHeaders = {}) {
  writeResponseHead(response, 303, {
    'Cache-Control': 'no-store',
    Location: location,
    ...extraHeaders,
  });
  response.end();
}

export function parseCookies(cookieHeader) {
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

export function hasAllowedOrigin(request, allowedOrigins) {
  const origin = request.headers.origin;

  if (typeof origin !== 'string') {
    return false;
  }

  try {
    const normalizedOrigin = origin.trim();
    const parsedOrigin = new URL(normalizedOrigin);
    return parsedOrigin.origin === normalizedOrigin && allowedOrigins.has(normalizedOrigin);
  } catch {
    return false;
  }
}

export function getClientIdentifier(request, options = {}) {
  if (options.trustProxyHeaders) {
    const realIp = request.headers['x-real-ip'];
    const normalizedRealIp = (Array.isArray(realIp) ? realIp[0] : realIp)?.trim();

    if (normalizedRealIp) {
      return normalizedRealIp.slice(0, 128);
    }

    const forwarded = request.headers['x-forwarded-for'];
    const firstForwarded = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',', 1)[0]
      ?.trim();

    if (firstForwarded) {
      return firstForwarded.slice(0, 128);
    }
  }

  return (request.socket.remoteAddress || 'unknown').slice(0, 128);
}
