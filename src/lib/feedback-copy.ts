export interface LessonFeedbackCopy {
  question: string;
  guidance: string;
}

const trainerCallToActionPattern = /(?:,\s*)?(?:обязательно\s+)?(?:напишите|задайте вопрос|обсудите ситуацию)\s+(?:в\s+)?(?:чат(?:е)?\s+с\s+кинологом|кинологу\s+в\s+чате|с\s+кинологом\s+в\s+чате)\.?/iu;

export function formatLessonFeedbackCopy(prompt: string): LessonFeedbackCopy {
  const normalizedPrompt = prompt.replace(/^💬\s*|\s*💬$/gu, '').trim();
  const callToActionMatch = trainerCallToActionPattern.exec(normalizedPrompt);

  if (!callToActionMatch) {
    return {
      question: toQuestion(normalizedPrompt),
      guidance: 'Наш кинолог поможет подобрать безопасный план и адаптировать занятие под вашу собаку.',
    };
  }

  const situation = normalizedPrompt.slice(0, callToActionMatch.index).trim();
  const trailingAdvice = normalizedPrompt
    .slice(callToActionMatch.index + callToActionMatch[0].length)
    .trim();

  if (
    /сильно реагирует на звуки/iu.test(situation) &&
    /не увеличивайте громкость через силу/iu.test(trailingAdvice)
  ) {
    return {
      question: toQuestion(situation),
      guidance: 'Не увеличивайте громкость через силу, наш кинолог поможет вам и вашей собаке справиться со страхом.',
    };
  }

  const normalizedAdvice = trailingAdvice
    .replace(/^Специалист/iu, 'Наш кинолог')
    .replace(/специалист/giu, 'наш кинолог');
  const trainerHelp = getTrainerHelpText(situation);
  const alreadyMentionsTrainer = /наш кинолог/iu.test(normalizedAdvice);

  return {
    question: toQuestion(situation),
    guidance: normalizedAdvice
      ? `${normalizedAdvice} ${alreadyMentionsTrainer ? '' : trainerHelp}`.trim()
      : trainerHelp,
  };
}

function toQuestion(value: string): string {
  const withoutCondition = value.replace(/^Если\s+/iu, '').replace(/[.!]+$/u, '').trim();
  const capitalized = withoutCondition
    ? `${withoutCondition.charAt(0).toLocaleUpperCase('ru-RU')}${withoutCondition.slice(1)}`
    : 'Нужна помощь с занятием';

  return `${capitalized}?`;
}

function getTrainerHelpText(situation: string): string {
  if (/звук|боится|страх|тревож/iu.test(situation)) {
    return 'Наш кинолог поможет снизить тревогу и подобрать комфортный темп занятий.';
  }

  if (/амуниц|поводок|ошейн|шлейк/iu.test(situation)) {
    return 'Наш кинолог поможет выбрать безопасную амуницию с учётом ваших прогулок и задач.';
  }

  if (/дистанц|срыв|реагирует|лает|куса|охраняет/iu.test(situation)) {
    return 'Наш кинолог поможет разобраться в причине реакции и составить безопасный план работы.';
  }

  if (/контакт|внимани|игр/iu.test(situation)) {
    return 'Наш кинолог подскажет, как сделать занятие понятнее и вернуть интерес к взаимодействию.';
  }

  if (/пелёнк|туалет|метк|режим/iu.test(situation)) {
    return 'Наш кинолог поможет скорректировать режим и выстроить понятные правила дома.';
  }

  if (/гост|возбуж|остановиться/iu.test(situation)) {
    return 'Наш кинолог поможет выстроить спокойный сценарий и снизить уровень возбуждения.';
  }

  if (
    /пространств|оставаться отдельно/iu.test(situation) ||
    /(?:^|[\s«„])мест(?:о|а|е|у|ом)(?:$|[\s,.!?»“])/iu.test(situation)
  ) {
    return 'Наш кинолог поможет организовать пространство и подобрать последовательный план обучения.';
  }

  if (/сигнал|этап|сложност|упражнен|трюк|выдержк|поклон/iu.test(situation)) {
    return 'Наш кинолог поможет определить следующий посильный шаг и избежать лишней нагрузки.';
  }

  return 'Наш кинолог разберёт ситуацию и предложит понятный план дальнейших действий.';
}
