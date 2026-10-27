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
  assert.match(mainSource, /let activeSeason: SeasonId = 'autumn'/u);
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
  assert.match(css, /@media \(min-width: 560px\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /\.seasonal-video-card--poster-error/u);
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
