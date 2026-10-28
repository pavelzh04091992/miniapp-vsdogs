import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const expectedVideoIds = [
  'night-walk-safety',
  'walk-motivation',
  'walk-enrichment',
  'autumn-wardrobe',
  'paw-protection',
  'stop-putting-paws',
];

test('seasonal catalog contains four seasons and six unique autumn videos', async () => {
  const sourceText = await readFile(new URL('../src/seasonal-content.ts', import.meta.url), 'utf8');
  const sourceFile = ts.createSourceFile(
    'seasonal-content.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const seasons = getArrayDeclaration(sourceFile, 'seasonThemes');
  const videos = getArrayDeclaration(sourceFile, 'seasonalVideos');
  const seasonIds = seasons.elements.map((season) => getStringProperty(sourceFile, season, 'id'));
  const videoIds = videos.elements.map((video) => getStringProperty(sourceFile, video, 'id'));

  assert.deepEqual(seasonIds, ['winter', 'spring', 'summer', 'autumn']);
  assert.deepEqual(videoIds, expectedVideoIds);
  assert.equal(new Set(videoIds).size, expectedVideoIds.length);

  for (const video of videos.elements) {
    const id = getStringProperty(sourceFile, video, 'id');
    const mediaId = getStringProperty(sourceFile, video, 'mediaId');
    const section = getStringProperty(sourceFile, video, 'section');
    const seasonsProperty = getProperty(sourceFile, video, 'seasons');

    assert.equal(mediaId, id);
    assert.ok(section === 'walks' || section === 'tips');
    assert.ok(seasonsProperty && ts.isArrayLiteralExpression(seasonsProperty));
    assert.deepEqual(seasonsProperty.elements.map((season) => getStringValue(season)), ['autumn']);
  }
});

test('seasonal descriptions preserve the six structured document bodies', async () => {
  const descriptions = JSON.parse(
    await readFile(new URL('../src/seasonal-video-descriptions.json', import.meta.url), 'utf8'),
  );

  assert.deepEqual(Object.keys(descriptions).sort(), [...expectedVideoIds].sort());

  for (const id of expectedVideoIds) {
    const description = descriptions[id];

    assert.equal(typeof description, 'string');
    assert.ok(description.length > 300);
    assert.match(description, /пошагово/u);
    assert.match(description, /Частые ошибки ❌/u);
    assert.match(description, /Важные нюансы 🐾/u);
  }
});

test('seasonal navigation uses the existing player and supports list return routes', async () => {
  const [appSource, mainSource] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /\| 'seasonal'/u);
  assert.match(appSource, /`seasonal-list:\$\{SeasonId\}:\$\{SeasonalSection\}`/u);
  assert.match(appSource, /createUsefulCard\([^\n]+useful-card--seasonal', 'seasonal'\)/u);
  assert.match(appSource, /createLessonPlayerMarkup\(lessonVideo\)/u);
  assert.match(mainSource, /let activeSeason: SeasonId = readStoredSeason\(\)/u);
  assert.match(mainSource, /window\.sessionStorage\.setItem\(ACTIVE_SEASON_STORAGE_KEY, season\)/u);
  assert.match(mainSource, /async function switchSeason\(nextSeason: SeasonId\)/u);
  assert.match(mainSource, /await preloadAsset\(theme\.heroImagePath\)/u);
  assert.match(mainSource, /seasonTransitionSequence/u);
  assert.match(mainSource, /currentShell\.className = nextShell\.className/u);
  assert.match(mainSource, /currentShell\.dataset\.seasonTheme = nextShell\.dataset\.seasonTheme/u);
  assert.match(mainSource, /seasonal-list:autumn:walks/u);
  assert.match(mainSource, /seasonal-list:autumn:tips/u);
  assert.match(mainSource, /pageScrollPositions = new Map<AppRoute, number>/u);
});

test('seasonal assets are optimized WebP files and CSS covers responsive states', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const assets = ['winter-pug.webp', 'spring-pug.webp', 'summer-pug.webp', 'autumn-pug.webp'];

  for (const asset of assets) {
    const assetUrl = new URL(`../public/assets/images/seasons/${asset}`, import.meta.url);
    const [header, details] = await Promise.all([
      readFile(assetUrl).then((buffer) => buffer.subarray(0, 12)),
      stat(assetUrl),
    ]);

    assert.equal(header.toString('ascii', 0, 4), 'RIFF');
    assert.equal(header.toString('ascii', 8, 12), 'WEBP');
    assert.ok(details.size > 0 && details.size < 200_000);
  }

  assert.match(css, /@media \(max-width: 359px\)/u);
  assert.match(css, /@media \(max-width: 300px\)/u);
  assert.match(css, /@media \(min-width: 560px\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /\.seasonal-video-card--poster-error/u);
  assert.match(css, /\.seasonal-screen--season-leave/u);
  assert.match(css, /\.seasonal-screen--season-enter/u);
  assert.match(css, /object-fit: contain/u);
  assert.doesNotMatch(css, /\.seasonal-video-card__title\s*\{[^}]*-webkit-line-clamp/gu);
});

test('seasonal cards show duration only on the preview badge', async () => {
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const cardStart = appSource.indexOf('function createSeasonalVideoCardMarkup');
  const cardEnd = appSource.indexOf('function createSeasonalVideoListMarkup', cardStart);
  const cardSource = appSource.slice(cardStart, cardEnd);

  assert.match(cardSource, /seasonal-video-card__duration[^\n]+video\.duration/u);
  assert.match(cardSource, /seasonal-video-card__category[^\n]+video\.category/u);
  assert.doesNotMatch(cardSource, /seasonal-video-card__meta/u);
  assert.equal((cardSource.match(/video\.duration/gu) ?? []).length, 1);
  assert.equal((cardSource.match(/video\.category/gu) ?? []).length, 1);
});

test('seasonal heroes isolate copy, artwork and the standard app header geometry', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /seasonal-hero__visual/u);
  assert.match(css, /--seasonal-copy-width: clamp\(178px, calc\(45% \+ 34px\), 420px\)/u);
  assert.match(css, /--seasonal-visual-gap: 12px/u);
  assert.match(css, /--seasonal-hero-height: clamp\(250px, calc\(25vw \+ 120px\), 280px\)/u);
  assert.match(css, /\.seasonal-hero__visual\s*\{[\s\S]*?inset: 0;/u);
  assert.match(css, /\.seasonal-hero__veil\s*\{[\s\S]*?z-index: -1;/u);
  assert.match(css, /\.seasonal-hero__content\s*\{[\s\S]*?width: var\(--seasonal-copy-width\)/u);
  assert.match(css, /\.app-shell--seasonal \.subpage-header \.content-frame/u);
  assert.match(css, /left: calc\(var\(--seasonal-copy-width\) \+ var\(--seasonal-visual-gap\)\)/u);
  assert.match(css, /--season-image-face-anchor-x: -53%/u);
  assert.match(css, /--season-image-face-anchor-x: -58%/u);
  assert.match(css, /--season-image-slide-x: clamp\(0px, calc\(16px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(1px, calc\(17px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(2px, calc\(18px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(0px, calc\(16px - 2\.5vw\), 7px\)/u);
  assert.match(css, /calc\(var\(--season-image-face-anchor-x, -56%\) \+ var\(--season-image-slide-x, 0px\)\)/u);
  assert.match(css, /width: auto;[\s\S]*?max-width: none;[\s\S]*?position: absolute;/u);
  assert.match(css, /height: var\(--seasonal-hero-height\)/u);
  assert.match(css, /font-size: clamp\(24px, calc\(15vw - 54px\), 42px\)/u);
  assert.match(css, /font-size: clamp\(11\.5px, calc\(3\.75vw - 8px\), 16px\)/u);
  assert.doesNotMatch(css, /@media \(max-width: 480px\)\s*\{\s*\.seasonal-hero/gu);
  assert.doesNotMatch(css, /@media \(max-width: 430px\)\s*\{\s*\.seasonal-hero/gu);
  assert.doesNotMatch(css, /height: (?:350|380|400)px;/u);
});

test('season themes use the approved central accent and surface tokens', async () => {
  const source = await readFile(new URL('../src/seasonal-content.ts', import.meta.url), 'utf8');

  for (const [accent, soft] of [
    ['#4C97EB', '#EDF6FF'],
    ['#E66EA3', '#FFF0F6'],
    ['#E5A321', '#FFF8E8'],
    ['#FF7847', '#FFF3EA'],
  ]) {
    assert.match(source, new RegExp(`accent: '${accent}'[\\s\\S]*?softBackground: '${soft}'`, 'u'));
  }
});

function getArrayDeclaration(sourceFile, name) {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(sourceFile) === name);
  const initializer = unwrapExpression(declaration?.initializer);

  assert.ok(initializer && ts.isArrayLiteralExpression(initializer), `Missing array ${name}`);
  return initializer;
}

function unwrapExpression(node) {
  if (!node) return null;
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return unwrapExpression(node.expression);
  return node;
}

function getProperty(sourceFile, object, name) {
  assert.ok(ts.isObjectLiteralExpression(object));
  return object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate)
      && candidate.name.getText(sourceFile).replace(/["']/gu, '') === name,
  )?.initializer;
}

function getStringProperty(sourceFile, object, name) {
  return getStringValue(getProperty(sourceFile, object, name));
}

function getStringValue(node) {
  assert.ok(node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)));
  return node.text;
}
