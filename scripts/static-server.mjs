import { readFile } from 'node:fs/promises';
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
      const content = await readFile(targetPath);

      writeResponseHead(response, 200, {
        'Cache-Control': getCacheControl(targetPath),
        'Content-Length': String(content.byteLength),
        'Content-Type': getContentType(targetPath),
      });

      response.end(method === 'HEAD' ? undefined : content);
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
    return 'private, no-store';
  }

  return filePath.includes(`${sep}public${sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
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
