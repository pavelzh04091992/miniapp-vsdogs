import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createStaticServer } from './static-server.mjs';

test('static server falls back to the SPA without allowing path traversal', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-static-'));
  const distPath = join(directory, 'dist');
  mkdirSync(distPath);
  mkdirSync(join(distPath, 'data'));
  mkdirSync(join(distPath, 'private'));
  writeFileSync(join(distPath, 'index.html'), '<div id="app"></div>');
  writeFileSync(join(distPath, 'data', 'videos.json'), '{"private":true}');
  writeFileSync(join(distPath, 'private', 'app.js'), 'private application code');
  writeFileSync(join(directory, 'secret.txt'), 'must not be served');
  const serveStaticFile = createStaticServer(distPath);

  try {
    const spaResponse = fakeResponse();
    await serveStaticFile('/course', 'GET', spaResponse);
    assert.equal(spaResponse.statusCode, 200);
    assert.match(String(spaResponse.body), /id="app"/);

    const traversalResponse = fakeResponse();
    await serveStaticFile('/%2e%2e%2fsecret.txt', 'GET', traversalResponse);
    assert.equal(traversalResponse.statusCode, 404);
    assert.doesNotMatch(String(traversalResponse.body), /must not be served/);

    const privateResponse = fakeResponse();
    await serveStaticFile('/private/app.js', 'GET', privateResponse);
    assert.equal(privateResponse.statusCode, 404);

    const normalizedPrivateResponse = fakeResponse();
    await serveStaticFile('/public/%2e%2e/private/app.js', 'GET', normalizedPrivateResponse);
    assert.equal(normalizedPrivateResponse.statusCode, 404);

    const authenticatedPrivateResponse = fakeResponse();
    await serveStaticFile('/private/app.js', 'GET', authenticatedPrivateResponse, {
      allowPrivateAssets: true,
    });
    assert.equal(authenticatedPrivateResponse.statusCode, 200);
    assert.equal(String(authenticatedPrivateResponse.body), 'private application code');
    assert.equal(authenticatedPrivateResponse.headers['Cache-Control'], 'private, no-cache');
    assert.match(authenticatedPrivateResponse.headers.ETag, /^W\//);
    assert.ok(authenticatedPrivateResponse.headers['Last-Modified']);

    const revalidatedPrivateResponse = fakeResponse();
    await serveStaticFile('/private/app.js', 'GET', revalidatedPrivateResponse, {
      allowPrivateAssets: true,
      requestHeaders: { 'if-none-match': authenticatedPrivateResponse.headers.ETag },
    });
    assert.equal(revalidatedPrivateResponse.statusCode, 304);
    assert.equal(revalidatedPrivateResponse.body.byteLength, 0);

    const encodedBackslashResponse = fakeResponse();
    await serveStaticFile('/data%5cvideos.json', 'GET', encodedBackslashResponse);
    assert.equal(encodedBackslashResponse.statusCode, 404);
    assert.doesNotMatch(String(encodedBackslashResponse.body), /private/);

    for (const encodedProtectedPath of [
      '/data%2Fvideos.json',
      '/d%61ta/videos.json',
      '/DATA/videos.json',
      '/data./videos.json',
      '/data%20/videos.json',
      '/a%70i/me',
      '/au%74h/magic',
      '/TELEGRAM/webhook',
    ]) {
      const protectedResponse = fakeResponse();
      await serveStaticFile(encodedProtectedPath, 'GET', protectedResponse);
      assert.equal(protectedResponse.statusCode, 404);
      assert.doesNotMatch(String(protectedResponse.body), /private/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fakeResponse() {
  const chunks = [];
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  response.statusCode = 0;
  response.headers = {};
  response.writeHead = (statusCode, headers) => {
    response.statusCode = statusCode;
    response.headers = headers;
  };
  Object.defineProperty(response, 'body', {
    get: () => Buffer.concat(chunks),
  });
  return response;
}
