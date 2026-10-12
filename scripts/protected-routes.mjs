import { posix } from 'node:path';

export const PROTECTED_ROUTE_PREFIXES = Object.freeze([
  '/api',
  '/assets',
  '/auth',
  '/data',
  '/health',
  '/internal',
  '/media',
  '/private',
  '/telegram',
]);

export const PUBLIC_BRAND_ASSET_PATH = '/assets/logo-dog.svg';

export function isPublicBrandAssetPath(pathname) {
  return normalizeRequestPathname(pathname).toLowerCase() === PUBLIC_BRAND_ASSET_PATH;
}

export function isPrivateStaticAssetPath(pathname) {
  const normalizedPathname = String(pathname || '').toLowerCase();
  return ['/assets', '/private'].some(
    (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`),
  );
}

export function isProtectedRoutePath(pathname) {
  const normalizedPathname = normalizeRequestPathname(pathname)
    .toLowerCase();
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`),
  );
}

export function normalizeRequestPathname(pathname) {
  const normalizedSeparators = String(pathname || '').replaceAll('\\', '/');
  const normalizedDots = posix.normalize(normalizedSeparators);
  const normalizedWindowsAliases = normalizedDots
    .split('/')
    .map(normalizeWindowsPathSegment)
    .join('/');

  return posix.normalize(normalizedWindowsAliases);
}

function normalizeWindowsPathSegment(segment) {
  const withoutTrailingSpaces = segment.replace(/ +$/g, '');

  if (withoutTrailingSpaces === '.' || withoutTrailingSpaces === '..') {
    return withoutTrailingSpaces;
  }

  return withoutTrailingSpaces.replace(/\.+$/g, '');
}

export function isCanonicalProtectedRoutePath(pathname) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getRawRequestPathname(rawUrl) {
  try {
    return new URL(rawUrl || '/', 'http://localhost').pathname;
  } catch {
    return null;
  }
}

export function getDecodedRequestPathname(rawUrl) {
  const pathname = getRawRequestPathname(rawUrl);

  if (!pathname) {
    return null;
  }

  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

export function shouldBlockDevStaticFallback(rawUrl) {
  const rawPathname = getRawRequestPathname(rawUrl);
  const decodedPathname = getDecodedRequestPathname(rawUrl);
  return Boolean(
    rawPathname &&
    decodedPathname &&
    isProtectedRoutePath(decodedPathname) &&
    !isCanonicalProtectedRoutePath(rawPathname)
  );
}
