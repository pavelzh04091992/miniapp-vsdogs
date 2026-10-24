import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { formatLessonFeedbackCopy } from '../src/lib/feedback-copy.ts';

test('formats the sound-sensitivity feedback copy exactly', () => {
  const copy = formatLessonFeedbackCopy(
    'Если собака сильно реагирует на звуки или вы не уверены, как подобрать безопасную интенсивность, напишите в чат с кинологом. Не увеличивайте громкость через силу.',
  );

  assert.equal(
    copy.question,
    'Собака сильно реагирует на звуки или вы не уверены, как подобрать безопасную интенсивность?',
  );
  assert.equal(
    copy.guidance,
    'Не увеличивайте громкость через силу, наш кинолог поможет вам и вашей собаке справиться со страхом.',
  );
});

test('does not confuse "вместо" with the place command', () => {
  const copy = formatLessonFeedbackCopy(
    'Если собака садится вместо поклона или вы не понимаете, как увеличить выдержку, напишите в чат с кинологом. Не удерживайте собаку в положении силой.',
  );

  assert.equal(
    copy.guidance,
    'Не удерживайте собаку в положении силой. Наш кинолог поможет определить следующий посильный шаг и избежать лишней нагрузки.',
  );
  assert.doesNotMatch(copy.guidance, /организовать пространство/iu);
});

test('converts every lesson feedback prompt into a question and trainer guidance', async () => {
  const [descriptions, supplementalPrompts] = await Promise.all([
    readJson('../src/video-descriptions.json'),
    readJson('../src/lesson-feedback-prompts.json'),
  ]);
  const prompts = Object.entries(descriptions)
    .map(([descriptionId, description]) => supplementalPrompts[descriptionId]
      ? `💬 ${supplementalPrompts[descriptionId]}`
      : description.split(/\r?\n/u).filter(Boolean).at(-1))
    .filter((line) => line?.includes('💬'));

  assert.equal(prompts.length, 59);

  prompts.forEach((prompt) => {
    const copy = formatLessonFeedbackCopy(prompt);
    assert.match(copy.question, /\?$/u);
    assert.match(copy.guidance, /наш кинолог/iu);
    assert.doesNotMatch(`${copy.question} ${copy.guidance}`, /напишите в чат|задайте вопрос|обсудите ситуацию/iu);
    assert.doesNotMatch(copy.guidance, /наш кинолог[\s\S]*наш кинолог/iu);
  });
});

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}
