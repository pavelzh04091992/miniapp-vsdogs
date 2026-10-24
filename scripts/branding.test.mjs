import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('auth screens use the public school logo without legacy branding', async () => {
  const [bootstrapSource, serverSource] = await Promise.all([
    readFile(new URL('../src/bootstrap.ts', import.meta.url), 'utf8'),
    readFile(new URL('./app-server.mjs', import.meta.url), 'utf8'),
  ]);
  const accessScreen = sourceSection(
    bootstrapSource,
    'function renderAccessScreen',
    'function getAccessScreenContent',
  );
  const confirmationScreen = sourceSection(
    serverSource,
    'function respondMagicLinkConfirmation',
    'function handleLogout',
  );

  for (const screen of [accessScreen, confirmationScreen]) {
    assert.match(screen, /\/assets\/logo-dog\.svg/);
    assert.doesNotMatch(screen, /Puppys|🐾/);
  }

  assert.match(confirmationScreen, /Высшая школа собак/);
});

test('player descriptions render a highlighted lead and local emoji assets', async () => {
  const [appSource, mainSource, stylesSource, emojiSource] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/emoji.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /lesson-description__paragraph--lead/);
  assert.match(stylesSource, /\.lesson-description__paragraph--lead\s*\{/);
  assert.match(stylesSource, /\.app-emoji\s*\{/);
  assert.match(emojiSource, /@twemoji\/svg\/1f436\.svg\?url/);
  assert.doesNotMatch(emojiSource, /@twemoji\/parser/);
  assert.doesNotMatch(emojiSource, /https?:\/\//);
  assert.match(mainSource, /image\.decoding = 'async'/);
});

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}
