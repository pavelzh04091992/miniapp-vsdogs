import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, posix, resolve, sep } from 'node:path';
import { respondJson, writeResponseHead } from './http-utils.mjs';
import { isPrivateStaticAssetPath, isProtectedRoutePath } from './protected-routes.mjs';

export function createStaticServer(distPath) {
  const indexHtmlPath = resolve(distPath, 'index.html');

  return async function serveStaticFile(pathname, method, response, options = {}) {
    const filePath = resolveStaticFilePath(distPath, pathname, options);
    const shouldFallbackToIndex = isSpaRoute(pathname);
    const targetPath = filePath || (shouldFallbackToIndex ? indexHtmlPath : null);

    if (!targetPath) {
      respondJson(response, 404, { ok: false, error: 'not_found' });
      return;
    }

    try {
      const metadata = await getFileMetadata(targetPath);
      const cacheControl = getCacheControl(targetPath);

      if (isNotModified(options.requestHeaders, metadata)) {
        writeResponseHead(response, 304, createFileHeaders(metadata, cacheControl));
        response.end();
        return;
      }

      writeResponseHead(response, 200, createFileHeaders(metadata, cacheControl));

      if (method === 'HEAD') {
        response.end();
        return;
      }

      await streamFile(targetPath, response);
    } catch (error) {
      if (error.code === 'ENOENT' && shouldFallbackToIndex && targetPath !== indexHtmlPath) {
        await serveIndexFile(indexHtmlPath, method, response);
        return;
      }

      if (error.code === 'ENOENT' || error.code === 'EISDIR') {
        respondJson(response, 404, { ok: false, error: 'not_found' });
        return;
      }

      console.error('[static] file serving error', error);
      respondJson(response, 500, { ok: false, error: 'internal_error' });
    }
  };
}

async function serveIndexFile(indexHtmlPath, method, response) {
  try {
    const metadata = await getFileMetadata(indexHtmlPath);

    writeResponseHead(response, 200, createFileHeaders(metadata, 'no-cache'));

    if (method === 'HEAD') {
      response.end();
      return;
    }

    await streamFile(indexHtmlPath, response);
  } catch (error) {
    if (error.code === 'ENOENT') {
      respondJson(response, 503, { ok: false, error: 'frontend_not_built' });
      return;
    }

    console.error('[static] index serving error', error);
    respondJson(response, 500, { ok: false, error: 'internal_error' });
  }
}

function resolveStaticFilePath(distPath, pathname, options) {
  const cleanPathname = pathname === '/' ? '/index.html' : pathname;
  const decodedPathname = safeDecodeURIComponent(cleanPathname);

  // URL paths always use forward slashes. Reject backslashes explicitly because
  // Windows treats them as separators and could otherwise reinterpret an encoded
  // path after the protected-route checks have already run.
  if (
    !decodedPathname ||
    decodedPathname.includes('\0') ||
    decodedPathname.includes('\\') ||
    /[<>:"|?*]/.test(decodedPathname) ||
    decodedPathname.split('/').some((segment) => /[ .]$/.test(segment))
  ) {
    return null;
  }

  const normalizedPathname = posix.normalize(decodedPathname);

  if (
    isProtectedRoutePath(normalizedPathname) &&
    !(options.allowPrivateAssets && isPrivateStaticAssetPath(normalizedPathname))
  ) {
    return null;
  }

  const filePath = resolve(distPath, `.${normalizedPathname}`);
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

function isSpaRoute(pathname) {
  const decodedPathname = safeDecodeURIComponent(pathname);

  if (
    !decodedPathname ||
    decodedPathname.includes('\0') ||
    decodedPathname.includes('\\') ||
    /[<>:"|?*]/.test(decodedPathname) ||
    decodedPathname.split('/').some((segment) => /[ .]$/.test(segment))
  ) {
    return false;
  }

  const normalizedPathname = posix.normalize(decodedPathname);

  return (
    !extname(normalizedPathname) &&
    !isProtectedRoutePath(normalizedPathname)
  );
}

function getCacheControl(filePath) {
  if (filePath.includes(`${sep}assets${sep}`) || filePath.includes(`${sep}private${sep}`)) {
    return 'private, no-cache';
  }

  return filePath.includes(`${sep}public${sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

async function getFileMetadata(filePath) {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    const error = new Error('Path is not a file');
    error.code = 'EISDIR';
    throw error;
  }

  return {
    contentLength: fileStat.size,
    contentType: getContentType(filePath),
    etag: `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`,
    lastModified: fileStat.mtime.toUTCString(),
  };
}

function createFileHeaders(metadata, cacheControl) {
  return {
    'Cache-Control': cacheControl,
    'Content-Length': String(metadata.contentLength),
    'Content-Type': metadata.contentType,
    ETag: metadata.etag,
    'Last-Modified': metadata.lastModified,
  };
}

function isNotModified(requestHeaders = {}, metadata) {
  const ifNoneMatch = requestHeaders['if-none-match'];

  if (typeof ifNoneMatch === 'string') {
    return ifNoneMatch.split(',').map((value) => value.trim()).includes(metadata.etag);
  }

  const ifModifiedSince = requestHeaders['if-modified-since'];

  if (typeof ifModifiedSince !== 'string') {
    return false;
  }

  const modifiedSince = Date.parse(ifModifiedSince);
  const lastModified = Date.parse(metadata.lastModified);
  return Number.isFinite(modifiedSince) && modifiedSince >= lastModified;
}

function streamFile(filePath, response) {
  return new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath);
    stream.on('error', rejectStream);
    stream.on('end', resolveStream);
    stream.pipe(response, { end: true });
  });
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
