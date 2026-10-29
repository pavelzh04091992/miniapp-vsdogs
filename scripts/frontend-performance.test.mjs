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

test('tracks stable Telegram viewport dimensions so transient browser UI does not rescale the shell', async () => {
  const [mainSource, styles, telegramSource] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/telegram.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(mainSource, /setupAppViewportHeight\(webApp\)/);
  assert.match(mainSource, /webApp\?\.viewportStableHeight/);
  assert.match(mainSource, /document\.documentElement\.clientWidth/);
  assert.match(mainSource, /--app-viewport-width/);
  assert.match(mainSource, /webApp\?\.onEvent\?\.\('viewportChanged'/);
  assert.match(mainSource, /isStateStable/);
  assert.doesNotMatch(mainSource, /window\.visualViewport\?\.height/);
  assert.match(styles, /#app\s*\{[\s\S]*?height: var\(--app-viewport-height\)/);
  assert.match(styles, /\.app-shell\s*\{[\s\S]*?height: var\(--app-viewport-height\)/);
  assert.match(styles, /--frame-width-mobile: var\(--app-viewport-width\)/);
  assert.match(styles, /\.bottom-nav\s*\{[\s\S]*?flex: 0 0 auto[\s\S]*?--tg-content-safe-area-inset-bottom/);
  assert.match(telegramSource, /viewportStableHeight\?: number/);
  assert.match(telegramSource, /onEvent\?:/);
});

test('opens a simple vertical program picker from the Lessons bottom navigation', async () => {
  const [appSource, mainSource, styles] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);
  const navStart = appSource.indexOf('function createBottomNav');
  const navEnd = appSource.indexOf('function escapeHtml', navStart);
  const navSource = appSource.slice(navStart, navEnd);

  assert.match(navSource, /createNavTab\('Уроки', 'lessons', activeTab === 'lessons', 'puppies'\)/u);
  assert.match(navSource, /data-lessons-nav aria-expanded="false"/u);
  assert.match(navSource, /bottom-nav__lessons-book[\s\S]*?bottom-nav__lessons-paw/u);
  assert.match(navSource, /program-menu-dog-skills\.webp/u);
  assert.match(mainSource, /data-lesson-program="puppies"[\s\S]*?data-lesson-program="adult-large"/u);
  assert.match(mainSource, /program-menu-puppies\.webp[\s\S]*?program-menu-adults\.webp/u);
  assert.equal((mainSource.match(/data-lesson-program=/gu) ?? []).length, 2);
  assert.match(mainSource, /if \(target\.closest\('\.bottom-nav__lessons-paw'\)\) chooseLessonProgram\('dog-skills'\);[\s\S]*?else closeLessonProgramMenu\(\)/u);
  assert.match(mainSource, /const destination = selectedLessonProgram \?\? 'puppies'/u);
  assert.match(mainSource, /root\.append\(backdrop, menu\)/u);
  assert.match(mainSource, /const anchorY = iconRect\.top \+ iconRect\.height \/ 2 - appRect\.top[\s\S]*?buttonSize = 52[\s\S]*?buttonGap = 13/u);
  assert.match(styles, /\.bottom-nav__lessons-paw\s*\{[\s\S]*?width: 52px;[\s\S]*?height: 52px;/u);
  assert.match(styles, /\.lesson-program-menu\s*\{[\s\S]*?width: 52px;[\s\S]*?height: 117px;[\s\S]*?gap: 13px;/u);
  assert.match(styles, /\.lesson-program-menu__choice\s*\{[\s\S]*?width: 52px;[\s\S]*?height: 52px;/u);
  assert.match(styles, /\.lesson-program-menu__choice img\s*\{[\s\S]*?object-fit: contain;/u);
  assert.match(styles, /\.lesson-program-menu-backdrop\s*\{[\s\S]*?background: rgba\(8, 38, 87, 0\.18\)/u);
  assert.doesNotMatch(mainSource, /lessons-triangle-menu|lessons-menu__surface|viewBox="0 0 290 190"/u);
  assert.doesNotMatch(styles, /lessons-menu__surface|lessons-menu-trigger-press/u);
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

test('renders combined and puppy fitness with independent page builders', async () => {
  const [appSource, mainSource, styles] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);
  const combinedFitnessMarkup = appSource.slice(
    appSource.indexOf('function createFitnessMarkup'),
    appSource.indexOf('function createSituationTopicsMarkup'),
  );
  const puppyFitnessMarkup = appSource.slice(
    appSource.indexOf('function createSituationTopicsMarkup'),
    appSource.indexOf('function createTopicLessonsMarkup'),
  );

  assert.match(appSource, /createUsefulCard\([\s\S]*?'Фитнес'[\s\S]*?'fitness'/);
  assert.match(appSource, /route === 'fitness'[\s\S]*?createFitnessMarkup\(\)/);
  assert.match(appSource, /route === 'puppy-fitness'[\s\S]*?createSituationTopicsMarkup\('fitness'\)/);
  assert.match(appSource, /slug === 'fitness' \? 'puppy-fitness' : `puppy-situation:\$\{slug\}`/);
  assert.match(combinedFitnessMarkup, /puppy-hero puppy-hero--fitness/);
  assert.match(combinedFitnessMarkup, /assets\/images\/programs\/fitness-hero\.webp/);
  assert.match(combinedFitnessMarkup, /Для щенков/);
  assert.match(combinedFitnessMarkup, /Для взрослых собак/);
  assert.match(combinedFitnessMarkup, /createAdultLargeTopicCard/);
  assert.doesNotMatch(puppyFitnessMarkup, /puppy-hero/);
  assert.doesNotMatch(puppyFitnessMarkup, /includeAdultFitness/);
  assert.doesNotMatch(appSource, />Подразделы</);
  assert.match(appSource, /const backRoute = getPuppySituationRoute\(topic\.parentSlug\)/);
  assert.match(appSource, /const backRoute: AppRoute = `adult-large-situation:\$\{topic\.parentSlug\}`/);
  assert.match(styles, /\.puppy-hero--fitness\s*\{[\s\S]*?linear-gradient\(135deg, #e8faf4 0%, #50cbb4 100%\)/);
  assert.doesNotMatch(styles, /\.puppy-hero--fitness\s*\{[\s\S]*?#218a5d/);
  assert.match(styles, /\.puppy-hero__image--fitness\s*\{[\s\S]*?height: auto[\s\S]*?aspect-ratio: 1/);
  assert.match(styles, /\.puppy-hero__image--fitness\s*\{[\s\S]*?width: clamp\(210px, 52vw, 228px\)/);
  assert.match(mainSource, /hash === 'fitness'/);
  assert.match(mainSource, /hash === 'puppy-fitness'/);
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

test('connects the welcome video with its production media and restores it after closing', async () => {
  const [appSource, mainSource, styles] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /data-welcome-video-src="\/media\/img-9038\/video\.mp4"/u);
  assert.match(appSource, /poster="\/media\/img-9038\/poster\.webp"/u);
  assert.doesNotMatch(appSource, /Приветственное видео пока недоступно/u);
  assert.match(mainSource, /video\.src = videoSource;[\s\S]*?video\.load\(\)/u);
  assert.match(mainSource, /video\.removeAttribute\('src'\);[\s\S]*?video\.load\(\)/u);
  assert.match(styles, /\.welcome-video-modal__video video\s*\{[\s\S]*?object-fit: contain/u);
});

test('keeps back navigation in the actual puppy or adult fitness branch', async () => {
  const [appSource, mainSource] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /data-route="\$\{getPuppySituationRoute\(situation\.slug\)\}"/);
  assert.match(appSource, /data-route="adult-large-situation:\$\{situation\.slug\}"/);
  assert.match(appSource, /registerLessonVideo\(lesson, `puppy-topic:\$\{topic\.slug\}`\)/);
  assert.match(appSource, /registerLessonVideo\(lesson, `adult-large-topic:\$\{topic\.slug\}`\)/);
  assert.doesNotMatch(appSource, /topic\.parentSlug === '(?:fitness|adult-large-fitness)'/);
  assert.match(mainSource, /initializeRouteHistory\(\)/);
  assert.match(mainSource, /routeButton\.classList\.contains\('back-button'\)[\s\S]*?navigateBack\(route\)/);
  assert.match(mainSource, /getAllowedParentRoutes\(currentRoute, fallbackRoute\)/);
  assert.match(mainSource, /canUseBrowserBack\(historyState, currentRoute, allowedParentRoutes\)/);
  assert.match(mainSource, /window\.history\.back\(\)/);
  assert.match(mainSource, /replaceRouteWithFallback\(fallbackRoute\)/);
  assert.doesNotMatch(mainSource, /navigateTo\(fallbackRoute\)/);
});

test('adds the dog skills program, four planned cards, descriptions, and destination views', async () => {
  const [appSource, mainSource, styles, contentSource] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/dog-skills-content.ts', import.meta.url), 'utf8'),
  ]);

  const cardStart = appSource.indexOf("'Пёс умеет',");
  const cardSource = appSource.slice(cardStart, cardStart + 420);

  assert.match(cardSource, /'Команды, трюки и полезные навыки',[\s\S]*?'\/assets\/images\/programs\/dog-skills\.webp',[\s\S]*?'program-card--skills',[\s\S]*?route: 'dog-skills'/u);
  assert.match(appSource, /imagePath: string \| undefined/u);
  assert.match(appSource, /const mediaMarkup = imagePath/u);
  assert.match(appSource, /route === 'dog-skills'[\s\S]*?createDogSkillsMarkup\(\)/u);
  assert.match(appSource, /dogSkillsLessons\.map\(createDogSkillsCardMarkup\)/u);
  assert.match(appSource, /function createDogSkillsCardMarkup\(lesson: DogSkillsLesson, index: number\)[\s\S]*?String\(index \+ 1\)\.padStart\(2, '0'\)[\s\S]*?dog-skills-card__index/u);
  assert.match(appSource, /dogSkillsLesson\.mediaId[\s\S]*?dogSkillsLesson\.sourceType[\s\S]*?backRoute: 'dog-skills'/u);
  assert.match(appSource, /video\.id\.startsWith\('dog-skills-'\)[\s\S]*?app-shell--dog-skills-detail/u);
  assert.doesNotMatch(appSource, /Видео скоро/u);
  assert.match(appSource, /puppy-hero puppy-hero--dog-skills[\s\S]*?dog-skills-hero-title[\s\S]*?\/assets\/images\/programs\/dog-skills\.webp/u);
  assert.match(appSource, /getAllAppAssetPaths[\s\S]*?'\/assets\/images\/programs\/dog-skills\.webp'/u);
  assert.match(mainSource, /hash === 'dog-skills'/u);
  assert.match(mainSource, /hash\.startsWith\('dog-skills-video:'\)[\s\S]*?isDogSkillsLessonRoute\(route\)/u);
  assert.match(styles, /\.program-card--skills\s*\{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?height: 163px;[\s\S]*?linear-gradient\(105deg, #fafffc 0%, #d8f7ed 100%\)/u);
  assert.match(styles, /\.program-grid > \.program-card--skills \.program-card__media\s*\{[\s\S]*?left: calc\(46% \+ 12px\);[\s\S]*?right: calc\(var\(--skills-arrow-size\) \+ 12px\)/u);
  assert.match(styles, /\.program-grid > \.program-card--skills \.program-card__media img\s*\{[\s\S]*?position: static;[\s\S]*?height: 138px;[\s\S]*?object-fit: contain/u);
  assert.match(styles, /\.program-grid > \.program-card--skills \.program-card__copy\s*\{[\s\S]*?max-width: 48%;[\s\S]*?gap: 7px/u);
  assert.match(styles, /\.program-grid > \.program-card--skills \.program-card__arrow\s*\{[\s\S]*?position: absolute;[\s\S]*?top: 0;[\s\S]*?right: 0;[\s\S]*?width: var\(--skills-arrow-size\)/u);
  assert.match(styles, /@media \(max-width: 485px\)\s*\{[\s\S]*?\.program-card--skills\s*\{[\s\S]*?height: clamp\(150px, calc\(124px \+ 8vw\), 163px\);[\s\S]*?\.program-grid > \.program-card--skills \.program-card__media img\s*\{[\s\S]*?height: clamp\(124px, calc\(96\.8px \+ 8\.5vw\), 138px\)/u);
  assert.doesNotMatch(styles, /\.program-grid > \.program-card--skills[\s\S]{0,180}?height: 168px/u);
  assert.match(styles, /\.puppy-hero--dog-skills\s*\{[\s\S]*?linear-gradient\(135deg, #dff8ef 0%, #b8ecd9 54%, #82d5ba 100%\)/u);
  assert.match(styles, /\.puppy-hero__image--dog-skills\s*\{[\s\S]*?object-fit: contain/u);
  assert.match(styles, /\.dog-skills-card\s*\{[\s\S]*?min-height: 103px;[\s\S]*?padding: 12px;[\s\S]*?grid-template-columns: 136px minmax\(0, 1fr\) 38px[\s\S]*?background: #ffffff/u);
  assert.match(styles, /\.dog-skills-card__media-wrap\s*\{[\s\S]*?width: 136px;[\s\S]*?position: relative;[\s\S]*?overflow: visible/u);
  assert.match(styles, /\.dog-skills-card__index\s*\{[\s\S]*?width: clamp\(32px, 6vw, 38px\);[\s\S]*?position: absolute;[\s\S]*?top: 7px;[\s\S]*?left: -10px;[\s\S]*?border-radius: 50%/u);
  assert.match(styles, /\.dog-skills-card__media\s*\{[\s\S]*?width: 136px;[\s\S]*?aspect-ratio: 16 \/ 9/u);
  assert.match(styles, /@media \(max-width: 360px\)\s*\{[\s\S]*?grid-template-columns: clamp\(104px, 31vw, 112px\) minmax\(0, 1fr\) 36px[\s\S]*?\.dog-skills-card__media-wrap,[\s\S]*?\.dog-skills-card__media\s*\{[\s\S]*?width: clamp\(104px, 31vw, 112px\)/u);
  assert.match(styles, /\.dog-skills-card:nth-child\(4n \+ 1\)[\s\S]*?#72d5c3[\s\S]*?\.dog-skills-card:nth-child\(4n \+ 2\)[\s\S]*?#f27fa6[\s\S]*?\.dog-skills-card:nth-child\(4n \+ 3\)[\s\S]*?#91c9f5[\s\S]*?\.dog-skills-card:nth-child\(4n \+ 4\)[\s\S]*?#f8c66c/u);
  assert.match(styles, /\.dog-skills-detail__cover\s*\{[\s\S]*?aspect-ratio: 16 \/ 9/u);

  const lessonIds = [...contentSource.matchAll(/^\s+id: '([^']+)'/gmu)].map((match) => match[1]);
  assert.deepEqual(lessonIds, ['turn-off-light', 'high-ten', 'thimbles', 'obstacle-course']);
  assert.deepEqual(
    [...contentSource.matchAll(/^\s+mediaId: '([^']+)'/gmu)].map((match) => match[1]),
    ['turn-off-light', 'high-ten', 'napertstki', 'obstacle-course'],
  );
  assert.equal([...contentSource.matchAll(/^\s+sourceType: 'hls'/gmu)].length, 4);
  assert.match(contentSource, /🐾 Этапы обучения/u);
  assert.match(contentSource, /🎯 Правила челленджа/u);
  assert.match(contentSource, /🐾 Какие элементы можно использовать/u);
  assert.match(contentSource, /⚠️ Частая ошибка/u);

  const artwork = await stat(new URL('../public/assets/images/programs/dog-skills.webp', import.meta.url));
  assert.ok(artwork.size > 0);

  const covers = await Promise.all([
    'dog-skills-turn-off-light.webp',
    'dog-skills-high-ten.webp',
    'dog-skills-thimbles.webp',
    'dog-skills-obstacle-course.webp',
  ].map((fileName) => stat(new URL(`../public/assets/covers/${fileName}`, import.meta.url))));
  assert.ok(covers.every((cover) => cover.size > 0));
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
