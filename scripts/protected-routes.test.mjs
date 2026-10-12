import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDecodedRequestPathname,
  isPublicBrandAssetPath,
  isProtectedRoutePath,
  normalizeRequestPathname,
  shouldBlockDevStaticFallback,
} from './protected-routes.mjs';

test('recognizes protected routes after decoding and Windows path normalization', () => {
  for (const pathname of [
    '/data/videos.json',
    '/DATA/videos.json',
    '/data\\videos.json',
    '/data./videos.json',
    '/data /videos.json',
    '/assets/hero.webp',
    '/private/app.js',
  ]) {
    assert.equal(isProtectedRoutePath(pathname), true);
  }

  assert.equal(getDecodedRequestPathname('/d%61ta%2Fvideos.json'), '/data/videos.json');
  assert.equal(normalizeRequestPathname('/public/../src/main.ts'), '/src/main.ts');
  assert.equal(normalizeRequestPathname('/public/.. /src/main.ts'), '/src/main.ts');
  assert.equal(normalizeRequestPathname('/src\\main.ts'), '/src/main.ts');
  assert.equal(isProtectedRoutePath('/public/index.js'), false);
  assert.equal(isPublicBrandAssetPath('/assets/logo-dog.svg'), true);
  assert.equal(isPublicBrandAssetPath('/ASSETS/LOGO-DOG.SVG'), true);
  assert.equal(isPublicBrandAssetPath('/assets/hero-dog.webp'), false);
});

test('blocks protected paths from falling through the Vite static server', () => {
  assert.equal(shouldBlockDevStaticFallback('/data/videos.json'), false);

  for (const rawUrl of [
    '/data%2Fvideos.json',
    '/d%61ta/videos.json',
    '/DATA/videos.json',
    '/data%5cvideos.json',
    '/data./videos.json',
    '/data%20/videos.json',
    '/a%73sets/hero.webp',
    '/PRIVATE/app.js',
  ]) {
    assert.equal(shouldBlockDevStaticFallback(rawUrl), true, rawUrl);
  }
});
