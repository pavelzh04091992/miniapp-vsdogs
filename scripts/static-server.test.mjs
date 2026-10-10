import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticServer } from './static-server.mjs';

test('static server falls back to the SPA without allowing path traversal', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-static-'));
  const distPath = join(directory, 'dist');
  mkdirSync(distPath);
  mkdirSync(join(distPath, 'data'));
  writeFileSync(join(distPath, 'index.html'), '<div id="app"></div>');
  writeFileSync(join(distPath, 'data', 'videos.json'), '{"private":true}');
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
  return {
    statusCode: 0,
    headers: {},
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}
