export const PROTECTED_ROUTE_PREFIXES = Object.freeze([
  '/api',
  '/auth',
  '/data',
  '/health',
  '/internal',
  '/media',
  '/telegram',
]);

export function isProtectedRoutePath(pathname) {
  const normalizedPathname = String(pathname || '')
    .replaceAll('\\', '/')
    .split('/')
    .map((segment) => segment.replace(/[ .]+$/g, ''))
    .join('/')
    .toLowerCase();
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`),
  );
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
