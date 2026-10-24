import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import test from 'node:test';

test('renders immediately while preloading the complete optimized artwork catalog in the background', async () => {
  const [mainSource, appSource] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(mainSource, /void preloadAllAssets\(getAllAppAssetPaths\(\)\);\s*await syncRouteState\(\);/);
  assert.match(mainSource, /const preloadedImages = new Map/);
  assert.match(mainSource, /ASSET_PRELOAD_TIMEOUT_MS = 15_000/);
  assert.match(appSource, /export function getAllAppAssetPaths/);
  assert.match(mainSource, /image\.loading = 'lazy'/);
  assert.match(mainSource, /firstContentImage\.fetchPriority = 'high'/);
  assert.match(mainSource, /\(hover: hover\) and \(pointer: fine\)/);
  assert.doesNotMatch(appSource, /legacyPuppySituations|adult-small/);
});

test('tracks the visible mobile viewport so the flex navigation stays on screen', async () => {
  const [mainSource, styles, telegramSource] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/telegram.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(mainSource, /setupAppViewportHeight\(webApp\)/);
  assert.match(mainSource, /window\.visualViewport\?\.height/);
  assert.match(mainSource, /webApp\?\.viewportHeight/);
  assert.match(mainSource, /webApp\?\.onEvent\?\.\('viewportChanged'/);
  assert.match(styles, /#app\s*\{[\s\S]*?height: var\(--app-viewport-height\)/);
  assert.match(styles, /\.app-shell\s*\{[\s\S]*?height: var\(--app-viewport-height\)/);
  assert.match(styles, /\.bottom-nav\s*\{[\s\S]*?flex: 0 0 auto[\s\S]*?--tg-content-safe-area-inset-bottom/);
  assert.doesNotMatch(styles, /--tg-viewport-stable-height/);
  assert.match(telegramSource, /viewportHeight\?: number/);
  assert.match(telegramSource, /onEvent\?:/);
});

test('keeps optimized artwork within the application asset budget', async () => {
  const assetsRoot = new URL('../public/assets/', import.meta.url);
  const files = await walk(assetsRoot);
  const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size)))
    .reduce((total, size) => total + size, 0);

  assert.ok(totalBytes < 5 * 1024 * 1024, `application artwork is ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
  assert.equal(files.some((file) => extname(file.pathname).toLowerCase() === '.jpg'), false);

  for (const name of ['feedback-main.svg', 'feedback-sent.svg']) {
    const size = (await stat(new URL(`../public/assets/feedback/${name}`, import.meta.url))).size;
    assert.ok(size < 200 * 1024, `${name} is ${(size / 1024).toFixed(0)} KiB`);
  }
});

test('retires the previous header as the complex screen opens', async () => {
  const [mainSource, styles] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(mainSource, /isEnteringComplex[\s\S]*?app-shell--complex-transition-underlay-exit/);
  assert.match(styles, /\.app-shell--complex-transition-underlay-exit\s*\{[\s\S]*?z-index: 0/);
  assert.match(styles, /\.app-shell--complex-transition-underlay-exit > \.home-header/);
});

test('opens fitness as a regular subsection with its optimized green hero', async () => {
  const [appSource, mainSource, styles] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /createUsefulCard\([\s\S]*?'Фитнес'[\s\S]*?'fitness'/);
  assert.match(appSource, /createSituationTopicsMarkup\('fitness', 'home', true\)/);
  assert.match(appSource, /puppy-hero puppy-hero--fitness/);
  assert.match(appSource, /assets\/images\/programs\/fitness-hero\.webp/);
  assert.match(appSource, /Для щенков/);
  assert.match(appSource, /Для взрослых собак/);
  assert.match(appSource, /get\('adult-large-fitness'\)[\s\S]*?createAdultLargeTopicCard/);
  assert.match(appSource, /includeAdultFitness = false/);
  assert.match(appSource, /includeAdultFitness \? 'Для щенков' : 'Подразделы'/);
  assert.match(appSource, /const backRoute: AppRoute = `puppy-situation:\$\{topic\.parentSlug\}`/);
  assert.match(appSource, /const backRoute: AppRoute = `adult-large-situation:\$\{topic\.parentSlug\}`/);
  assert.match(styles, /\.puppy-hero--fitness\s*\{[\s\S]*?linear-gradient\([\s\S]*?#218a5d/);
  assert.match(styles, /\.puppy-hero__image--fitness\s*\{[\s\S]*?height: auto[\s\S]*?aspect-ratio: 1/);
  assert.match(styles, /\.puppy-hero__image--fitness\s*\{[\s\S]*?width: clamp\(210px, 52vw, 228px\)/);
  assert.match(mainSource, /hash === 'fitness'/);
});

test('alternates catalog cards by visible position and keeps fitness endpoints apart', async () => {
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const fitnessStart = appSource.indexOf("slug: 'fitness-bow'");
  const fitnessEnd = appSource.indexOf("slug: 'fitness-crawl'");
  const catalogEnd = appSource.indexOf('const puppySituationsBySlug');

  assert.ok(fitnessStart >= 0);
  assert.ok(fitnessEnd > fitnessStart);
  assert.ok(fitnessEnd < catalogEnd);
  assert.match(appSource.slice(fitnessStart, fitnessEnd), /slug: 'fitness-left-right'/);
  assert.doesNotMatch(appSource, /^\s+cardClass: '(?:situation|topic)-card--/m);
  assert.match(appSource, /function getAlternatingCardClass/);
  assert.match(appSource, /visibleSituations\.map\(\(situation, index\) => createSituationCard\(situation, index, 'blue'\)\)/);
  assert.match(appSource, /adultLargeSituations\.map\(\(situation, index\) => createAdultLargeSituationCard\(situation, index, 'rose'\)\)/);
  assert.ok(
    (appSource.match(/situation\.topics\.map\(\(topic, index\) => createTopicCard\(topic, index, 'blue'\)\)/g) ?? []).length >= 2,
  );
  assert.match(appSource, /createAdultLargeTopicCard\(topic, index, 'blue'\)/);
  assert.match(appSource, /createAdultLargeTopicCard\(topic, index, 'rose'\)/);
});

test('keeps back navigation in the actual puppy or adult fitness branch', async () => {
  const [appSource, mainSource] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /data-route="puppy-situation:\$\{situation\.slug\}"/);
  assert.match(appSource, /data-route="adult-large-situation:\$\{situation\.slug\}"/);
  assert.match(appSource, /registerLessonVideo\(lesson, `puppy-topic:\$\{topic\.slug\}`\)/);
  assert.match(appSource, /registerLessonVideo\(lesson, `adult-large-topic:\$\{topic\.slug\}`\)/);
  assert.doesNotMatch(appSource, /topic\.parentSlug === '(?:fitness|adult-large-fitness)'/);
  assert.match(mainSource, /initializeRouteHistory\(\)/);
  assert.match(mainSource, /routeButton\.classList\.contains\('back-button'\)[\s\S]*?navigateBack\(route\)/);
  assert.match(mainSource, /canUseBrowserBack\(historyState, currentRoute, fallbackRoute\)/);
  assert.match(mainSource, /window\.history\.back\(\)/);
  assert.match(mainSource, /replaceRouteWithFallback\(fallbackRoute\)/);
  assert.doesNotMatch(mainSource, /navigateTo\(fallbackRoute\)/);
});

async function walk(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directoryUrl);
    files.push(...(entry.isDirectory() ? await walk(entryUrl) : [entryUrl]));
  }

  return files;
}
