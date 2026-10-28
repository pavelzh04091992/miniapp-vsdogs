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

const expectedSeasonIcons = {
  winter: 'winter-icon.webp',
  spring: 'spring-icon.webp',
  summer: 'summer-icon.webp',
  autumn: 'autumn-icon.webp',
};

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

  for (const season of seasons.elements) {
    const id = getStringProperty(sourceFile, season, 'id');
    const iconImagePath = getStringProperty(sourceFile, season, 'iconImagePath');

    assert.equal(iconImagePath, `/assets/images/seasons/${expectedSeasonIcons[id]}`);
  }

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
  assert.match(appSource, /createLessonPlayerMarkup\(lessonVideo, activeSeason\)/u);
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
  const assets = [
    'winter-pug.webp',
    'spring-pug.webp',
    'summer-pug.webp',
    'autumn-pug.webp',
    'walks-icon.webp',
    ...Object.values(expectedSeasonIcons),
  ];

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

test('seasonal overview keeps bento cards while all-video routes use the horizontal list', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((appSource.match(/class="seasonal-bento"/gu) ?? []).length, 1);
  assert.equal((appSource.match(/class="seasonal-video-list"/gu) ?? []).length, 1);
  assert.match(appSource, /createSeasonalVideoCardMarkup\(video, index === 0 \? 'featured' : 'compact'\)/u);
  assert.match(appSource, /createSeasonalVideoCardMarkup\(video, 'list'\)/u);
  assert.doesNotMatch(appSource, /seasonal-list__grid/u);
  assert.match(css, /\.seasonal-bento\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
  assert.match(css, /\.seasonal-video-list\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?gap: 12px;/u);
  assert.match(css, /\.seasonal-video-card--list\s*\{[\s\S]*?width: 100%;[\s\S]*?min-height: 104px;[\s\S]*?grid-template-columns: 120px minmax\(0, 1fr\);/u);
  assert.match(css, /\.seasonal-video-card--list \.seasonal-video-card__media\s*\{[\s\S]*?width: 120px;[\s\S]*?min-height: 102px;/u);
  assert.match(css, /\.seasonal-video-card--list \.seasonal-video-card__title\s*\{[\s\S]*?font-size: clamp\(14px, 1\.9vw, 15px\);[\s\S]*?font-weight: 700;/u);
  assert.match(css, /grid-template-columns: clamp\(96px, 31vw, 104px\) minmax\(0, 1fr\)/u);
  assert.doesNotMatch(css, /seasonal-list__grid/u);
  assert.doesNotMatch(css, /\.seasonal-video-card__title\s*\{[^}]*-webkit-line-clamp/gu);
});

test('seasonal players apply their season accent only to structured descriptions', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /seasons: video\.seasons/u);
  assert.match(appSource, /video\.seasons\?\.includes\(activeSeason\)/u);
  assert.match(appSource, /app-shell app-shell--seasonal-player/u);
  assert.match(appSource, /data-season-theme="\$\{escapeHtml\(seasonalTheme\.id\)\}"/u);
  assert.match(css, /\.app-shell--seasonal-player \.lesson-player-card__description/u);
  assert.match(css, /\.app-shell--seasonal-player \.lesson-description__step-number[\s\S]*?color: var\(--season-accent\)/u);
  assert.match(css, /\.app-shell--seasonal-player \.lesson-description__callout-icon[\s\S]*?var\(--season-accent\)/u);
  assert.match(css, /\.app-shell--seasonal-player \.lesson-description__section--note/u);
  assert.doesNotMatch(css, /\.app-shell--seasonal-player \.lesson-description__section--mistakes/u);
});

test('every season keeps the collection CTA and empty states have no play glyph', async () => {
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const heroStart = appSource.indexOf('function createSeasonHeroMarkup');
  const heroEnd = appSource.indexOf('function createSeasonSwitcherMarkup', heroStart);
  const emptyStart = appSource.indexOf('function createSeasonalEmptyStateMarkup');
  const emptyEnd = appSource.indexOf('function createSeasonalSectionIconMarkup', emptyStart);
  const heroSource = appSource.slice(heroStart, heroEnd);
  const emptySource = appSource.slice(emptyStart, emptyEnd);

  assert.match(heroSource, /data-seasonal-cta/u);
  assert.match(heroSource, />Смотреть подборку</u);
  assert.doesNotMatch(heroSource, /hasVideos/u);
  assert.doesNotMatch(emptySource, /createPlayIconMarkup|seasonal-empty__(?:icon|play)/u);
});

test('season switcher renders the supplied WebP icons as decorative images', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /class="season-switcher__icon"[\s\S]*?src="\$\{escapeHtml\(season\.iconImagePath\)\}"[\s\S]*?width="90"[\s\S]*?height="90"[\s\S]*?alt=""[\s\S]*?aria-hidden="true"/u);
  assert.doesNotMatch(appSource, /function createSeasonIconMarkup/u);
  assert.match(css, /\.season-switcher__icon\s*\{[\s\S]*?width: 24px;[\s\S]*?height: 24px;[\s\S]*?object-fit: contain;/u);
});

test('seasonal sections color the supplied dog park icon and standard lightbulb contextually', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /seasonal-section__icon--dog-park" aria-hidden="true"/u);
  assert.match(appSource, /seasonal-section__icon--lightbulb" aria-hidden="true"/u);
  assert.match(css, /\.seasonal-section__icon--dog-park\s*\{[\s\S]*?background-color: var\(--season-accent\);[\s\S]*?-webkit-mask: url\('\/assets\/images\/seasons\/walks-icon\.webp'\) center \/ contain no-repeat;[\s\S]*?(?<!-webkit-)mask: url\('\/assets\/images\/seasons\/walks-icon\.webp'\) center \/ contain no-repeat;/u);
  assert.match(css, /-webkit-mask: url\('\/assets\/icons\/lightbulb\.svg'\) center \/ contain no-repeat;/u);
  assert.match(css, /(?<!-webkit-)mask: url\('\/assets\/icons\/lightbulb\.svg'\) center \/ contain no-repeat;/u);
});

test('seasonal heroes isolate copy, artwork and the standard app header geometry', async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /seasonal-hero__visual/u);
  assert.match(appSource, /seasonal-hero__clip/u);
  assert.match(css, /--seasonal-copy-width: clamp\(178px, calc\(45% \+ 34px\), 420px\)/u);
  assert.match(css, /--seasonal-visual-gap: 12px/u);
  assert.match(css, /--seasonal-app-max-width: 810px/u);
  assert.match(css, /width: min\(100%, var\(--seasonal-app-max-width\)\)/u);
  assert.match(css, /\.app-shell--seasonal \.bottom-nav__inner/u);
  assert.match(css, /--seasonal-hero-height: clamp\(250px, calc\(25vw \+ 120px\), 280px\)/u);
  assert.match(css, /--seasonal-image-width: clamp\(600px, calc\(60vw \+ 288px\), 672px\)/u);
  assert.match(css, /--seasonal-title-row-height: clamp\(49px, calc\(30\.833vw - 111\.332px\), 86px\)/u);
  assert.match(css, /--seasonal-description-row-height: clamp\(48px, calc\(15vw - 30px\), 66px\)/u);
  assert.match(css, /--seasonal-cta-height: clamp\(42px, calc\(1\.667vw \+ 33\.332px\), 44px\)/u);
  assert.match(css, /\.seasonal-hero\s*\{[\s\S]*?container-type: inline-size;[\s\S]*?overflow: visible;/u);
  assert.match(css, /\.seasonal-hero__clip\s*\{[\s\S]*?border-radius: inherit;[\s\S]*?overflow: hidden;/u);
  assert.match(css, /\.seasonal-hero__visual\s*\{[\s\S]*?inset: 0;/u);
  assert.match(css, /\.seasonal-hero__veil\s*\{[\s\S]*?z-index: -1;/u);
  assert.match(css, /\.seasonal-hero__content\s*\{[\s\S]*?width: var\(--seasonal-copy-width\)/u);
  assert.match(css, /\.app-shell--seasonal \.content-frame,\s*\.app-shell--seasonal \.bottom-nav__inner/u);
  assert.match(css, /left: calc\(var\(--seasonal-copy-width\) \+ var\(--seasonal-visual-gap\)\)/u);
  assert.match(css, /--season-image-face-anchor-x: -53%/u);
  assert.match(css, /--season-image-face-anchor-x: -58%/u);
  assert.match(css, /--season-image-slide-x: clamp\(0px, calc\(16px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(1px, calc\(17px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(2px, calc\(18px - 2\.5vw\), 8px\)/u);
  assert.match(css, /--season-image-slide-x: clamp\(0px, calc\(16px - 2\.5vw\), 7px\)/u);
  assert.match(css, /--season-image-wide-slide-x: clamp\(0px, calc\(50vw - 345px\), 60px\)/u);
  assert.match(css, /max\([\s\S]*?var\(--season-image-face-anchor-x, -56%\)[\s\S]*?100cqw -[\s\S]*?var\(--seasonal-image-width\)/u);
  assert.match(css, /width: var\(--seasonal-image-width\);[\s\S]*?max-width: none;[\s\S]*?height: auto;[\s\S]*?position: absolute;/u);
  assert.match(css, /display: grid;[\s\S]*?grid-template-rows:[\s\S]*?var\(--seasonal-title-row-height\)[\s\S]*?var\(--seasonal-description-row-height\)[\s\S]*?var\(--seasonal-cta-height\);[\s\S]*?row-gap: 15px;/u);
  assert.match(css, /font-size: var\(--seasonal-title-size\)/u);
  assert.match(css, /font-size: var\(--seasonal-description-size\)/u);
  assert.doesNotMatch(css, /@media \(max-width: 480px\)\s*\{\s*\.seasonal-hero/gu);
  assert.doesNotMatch(css, /@media \(max-width: 430px\)\s*\{\s*\.seasonal-hero/gu);
  assert.doesNotMatch(css, /height: (?:350|380|400)px;/u);
});

test('seasonal shadow gutters preserve card and switcher elevation', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.season-switcher\s*\{[\s\S]*?margin: 16px -10px -12px;[\s\S]*?padding: 0 10px 12px;/u);
  assert.match(css, /\.seasonal-bento,[\s\S]*?margin: 0 -10px -12px;[\s\S]*?padding: 0 10px 12px;/u);
});

test('empty seasonal state stays compact and groups its copy centrally', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const emptyStart = css.indexOf('.seasonal-empty {');
  const emptyEnd = css.indexOf('@media (hover: hover)', emptyStart);
  const emptyCss = css.slice(emptyStart, emptyEnd);

  assert.match(emptyCss, /width: 100%/u);
  assert.match(emptyCss, /min-height: 140px/u);
  assert.match(emptyCss, /padding: 24px 20px/u);
  assert.match(emptyCss, /display: flex/u);
  assert.match(emptyCss, /justify-content: center/u);
  assert.match(emptyCss, /circle at 50% 50%/u);
  assert.match(emptyCss, /max-width: 320px/u);
  assert.match(emptyCss, /margin-top: 12px/u);
  assert.doesNotMatch(emptyCss, /seasonal-empty__(?:icon|play)/u);
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
