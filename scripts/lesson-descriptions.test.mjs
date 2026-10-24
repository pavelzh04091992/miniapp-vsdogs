import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const expectedDescriptionIds = Array.from(
  { length: 59 },
  (_, index) => String(index + 1).padStart(2, '0'),
);
const supplementalFeedbackIds = Array.from(
  { length: 20 },
  (_, index) => String(index + 40),
);

test('keeps every source description structured and connected to a player', async () => {
  const [descriptions, feedbackPrompts, appSource] = await Promise.all([
    readJson('../src/video-descriptions.json'),
    readJson('../src/lesson-feedback-prompts.json'),
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
  ]);

  assert.deepEqual(sortDescriptionIds(Object.keys(descriptions)), expectedDescriptionIds);
  assert.deepEqual(sortDescriptionIds(Object.keys(feedbackPrompts)), supplementalFeedbackIds);

  for (const descriptionId of expectedDescriptionIds) {
    const sourceDescription = descriptions[descriptionId];
    const feedbackPrompt = feedbackPrompts[descriptionId];
    const renderedDescription = feedbackPrompt
      ? `${sourceDescription}\n💬 ${feedbackPrompt}`
      : sourceDescription;
    const lines = renderedDescription.split(/\r?\n/u).filter(Boolean);

    assert.ok(lines[0]?.length > 0, `${descriptionId} must have a lead paragraph`);
    assert.ok(
      lines.some((line) => isDescriptionHeading(line)),
      `${descriptionId} must have at least one structured section`,
    );
    assert.match(
      lines.at(-1) ?? '',
      /^(?:💬\s*)|(?:\s*💬)$/u,
      `${descriptionId} must end with a feedback CTA`,
    );
  }

  const assignedIds = [
    ...appSource.matchAll(/descriptionId:\s*'(\d{2})'/gu),
    ...appSource.matchAll(/description:\s*getVideoDescription\('(\d{2})'\)/gu),
  ].map((match) => match[1]);

  assert.deepEqual(sortDescriptionIds([...new Set(assignedIds)]), expectedDescriptionIds);
  assert.match(appSource, /lesson\.longDescription = getVideoDescription\(descriptionId\)/u);
  assert.match(
    appSource,
    /createLessonDescriptionBlocksMarkup\(section\.lines, !section\.title\)/u,
  );
  assert.match(
    appSource,
    /emphasizeFirstParagraph && index === 0 && block\.type === 'paragraph'/u,
  );
});

test('keeps undocumented video lessons free of invented descriptions', async () => {
  const [catalog, appSource] = await Promise.all([
    readJson('../src/local-video-catalog.json'),
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
  ]);
  const describedLessons = new Set(
    [...appSource.matchAll(
      /\{\s*topicSlug:\s*'([^']+)',\s*lessonTitle:\s*'([^']+)',\s*descriptionId:/gu,
    )].map((match) => `${match[1]}|${match[2]}`),
  );
  const undocumentedLessons = catalog.cardMedia
    .filter(({ topicSlug, lessonTitle }) => !describedLessons.has(`${topicSlug}|${lessonTitle}`))
    .map(({ topicSlug, lessonTitle }) => `${topicSlug}|${lessonTitle}`)
    .sort();

  assert.deepEqual(undocumentedLessons, [
    'adult-large-claws|Когти',
    'adult-large-loneliness|Учим постепенно оставаться одному',
    'adult-large-scooters-bikes|Бросается на самокаты и велосипеды',
    'adult-large-wipe-muzzle|Вытри морду',
    'conflicts-vandal|Мой щенок вандалит и разносит квартиру',
    'fitness-left-right|Влево-вправо',
    'fitness-wipe-muzzle|Вытри морду (тач на тряпочку)',
  ]);
});

test('maps the supplemental descriptions to their existing player cards', async () => {
  const [descriptions, appSource] = await Promise.all([
    readJson('../src/video-descriptions.json'),
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(descriptions['54'], /Постановка передних лап/u);
  assert.match(descriptions['54'], /Собака запрыгивает всеми четырьмя лапами/u);
  assert.match(descriptions['55'], /Поворот в другую сторону/u);
  assert.match(descriptions['55'], /ветеринарным специалистом/u);
  assert.match(descriptions['56'], /Питание щенка/u);
  assert.match(descriptions['56'], /ветеринарному диетологу/u);
  assert.match(descriptions['57'], /оставаться одному дома/u);
  assert.match(descriptions['57'], /выраженный стресс/u);
  assert.match(descriptions['58'], /Упражнение «Зайка»/u);
  assert.match(descriptions['59'], /Упражнение «Домик»/u);
  assert.match(
    appSource,
    /topicSlug: 'fitness-paw', lessonTitle: '«Дай лапу»', descriptionId: '54'/u,
  );
  assert.match(
    appSource,
    /topicSlug: 'fitness-spin', lessonTitle: 'Круть-верть', descriptionId: '55'/u,
  );
  assert.match(
    appSource,
    /topicSlug: 'home-begging', lessonTitle: 'Питание', descriptionId: '56'/u,
  );
  assert.match(
    appSource,
    /topicSlug: 'home-loneliness', lessonTitle: 'Учим постепенно оставаться одному', descriptionId: '57'/u,
  );
  assert.match(
    appSource,
    /topicSlug: 'fitness-bunny', lessonTitle: 'Зайка', descriptionId: '58'/u,
  );
  assert.match(
    appSource,
    /topicSlug: 'fitness-house', lessonTitle: 'Домик', descriptionId: '59'/u,
  );
});

test('orders useful cards as trainer, seasonal, complex and fitness', async () => {
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const start = appSource.indexOf('<div class="useful-grid"');
  const end = appSource.indexOf('</div>', start);
  const usefulGrid = appSource.slice(start, end);
  const positions = [
    'Спросить у кинолога',
    'Сезонные темы',
    'Комплекс',
    'Фитнес',
  ].map((title) => usefulGrid.indexOf(`'${title}'`));

  assert.ok(start >= 0 && end > start);
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
});

function isDescriptionHeading(line) {
  const normalizedLine = line.replace(/:$/u, '');

  return /^(?:Как (?:учим|играем|работаем|кормим|приучаем|организуем|выполняем|обучаем)|Подготовка|Результат|Частые ошибки|Особенности 🐾|Важные особенности 🐾|Главное 🐕|С чего начать\? 🐾|Что важно (?:понять|помнить 🐾)|Что можно использовать|Как устроен коготь 🐾|Зачем .+ 🐾)$/u.test(normalizedLine)
    || /^(?:В этом |В )видео (?:разберём|поговорим о том|покажем(?: несколько простых игр)?)$/iu.test(normalizedLine)
    || /^(?:Упражнение развивает|Этот трюк помогает развивать|Главная последовательность|Полный навык выглядит так|Понятный сценарий выглядит так)$/u.test(normalizedLine);
}

function sortDescriptionIds(ids) {
  return ids.sort((left, right) => Number(left) - Number(right));
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}
