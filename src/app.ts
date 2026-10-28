import { SituationSlug, SituationVideo } from './lib/videos';
import { getEmojiAssetUrl, renderEmojiText } from './lib/emoji';
import { formatLessonFeedbackCopy } from './lib/feedback-copy';
import localVideoCatalog from './local-video-catalog.json';
import lessonFeedbackPrompts from './lesson-feedback-prompts.json';
import videoDescriptions from './video-descriptions.json';
import {
  getSeasonTheme,
  getSeasonalVideo,
  getSeasonalVideos,
  isSeasonId,
  isSeasonalSection,
  seasonThemes,
  seasonalSectionDefinitions,
  seasonalVideos,
  type SeasonId,
  type SeasonalSection,
  type SeasonalVideo,
} from './seasonal-content';
import {
  dogSkillsLessons,
  getDogSkillsLesson,
  type DogSkillsLesson,
  type DogSkillsLessonId,
} from './dog-skills-content';

type VideoDescriptionId = keyof typeof videoDescriptions;

const descriptionsWithDocumentTitle = new Set<VideoDescriptionId>(['56', '57', '58', '59']);

function getVideoDescription(descriptionId: VideoDescriptionId): string {
  const sourceDescription = videoDescriptions[descriptionId];
  const description = descriptionsWithDocumentTitle.has(descriptionId)
    ? sourceDescription.replace(/^[^\n]+\n/u, '')
    : sourceDescription;
  const feedbackPrompt = lessonFeedbackPrompts[
    descriptionId as keyof typeof lessonFeedbackPrompts
  ];

  return feedbackPrompt ? `${description}\n💬 ${feedbackPrompt}` : description;
}

export type PuppySituationSlug =
  | 'ideal-walk'
  | 'calm-home'
  | 'aggression-conflicts'
  | 'fears-anxiety'
  | 'care-without-fight'
  | 'fitness';

export type PuppyTopicSlug =
  | 'walk-leash'
  | 'walk-food-pickup'
  | 'walk-recall'
  | 'walk-ignore-triggers'
  | 'home-barking'
  | 'home-loneliness'
  | 'home-jumping-on-guests'
  | 'home-begging'
  | 'home-toilet'
  | 'conflicts-biting-hands'
  | 'conflicts-vandal'
  | 'conflicts-resource-guarding'
  | 'conflicts-barks-at-people'
  | 'conflicts-neutering'
  | 'fears-sounds'
  | 'fears-cars'
  | 'fears-new-places'
  | 'fears-place-command'
  | 'fears-follows-tail'
  | 'care-claws'
  | 'care-paws'
  | 'fitness-bow'
  | 'fitness-bunny'
  | 'fitness-house'
  | 'fitness-paw'
  | 'fitness-wipe-muzzle'
  | 'fitness-spin'
  | 'fitness-left-right';

export type AdultLargeSituationSlug =
  | 'adult-large-ideal-walk'
  | 'adult-large-calm-home'
  | 'adult-large-aggression-conflicts'
  | 'adult-large-fears-anxiety'
  | 'adult-large-care-without-fight'
  | 'adult-large-fitness';

export type AdultLargeTopicSlug =
  | 'adult-large-leash'
  | 'adult-large-food-pickup'
  | 'adult-large-recall'
  | 'adult-large-ignore-triggers'
  | 'adult-large-barking'
  | 'adult-large-loneliness'
  | 'adult-large-jumping-on-guests'
  | 'adult-large-begging'
  | 'adult-large-toilet'
  | 'adult-large-overaroused-play'
  | 'adult-large-resource-guarding'
  | 'adult-large-barks-at-people'
  | 'adult-large-neutering'
  | 'adult-large-scooters-bikes'
  | 'adult-large-place-space'
  | 'adult-large-follows-tail'
  | 'adult-large-sounds'
  | 'adult-large-cars'
  | 'adult-large-new-places'
  | 'adult-large-claws'
  | 'adult-large-paws'
  | 'adult-large-eight'
  | 'adult-large-go-around'
  | 'adult-large-wipe-muzzle'
  | 'adult-large-jump-over-leg'
  | 'adult-large-bow';

export type AppRoute =
  | 'home'
  | 'video-library'
  | 'seasonal'
  | `seasonal-list:${SeasonId}:${SeasonalSection}`
  | 'fitness'
  | 'puppy-fitness'
  | 'complex'
  | 'complex-levels:timed'
  | 'complex-levels:self-check'
  | 'puppies'
  | 'adult-large'
  | 'dog-skills'
  | `dog-skills-video:${DogSkillsLessonId}`
  | `lesson-video:${string}`
  | `puppy-situation:${PuppySituationSlug}`
  | `puppy-topic:${PuppyTopicSlug}`
  | `adult-large-situation:${AdultLargeSituationSlug}`
  | `adult-large-topic:${AdultLargeTopicSlug}`;

export type PuppyFilter = 'all' | 'home' | 'walk' | 'behavior' | 'commands';

export type SituationVideosState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; videos: SituationVideo[] }
  | { status: 'error'; message: string };

type LessonVideoSource = 'hls' | 'mp4';

interface PuppyLessonItem {
  title: string;
  description: string;
  longDescription?: string;
  coverPath?: string;
  video?: {
    id: string;
    mediaId?: string;
    sourceType?: LessonVideoSource;
  };
  externalUrl?: string;
  feedback?: string;
  route?: AppRoute;
}

interface PuppyTopic {
  slug: PuppyTopicSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  lessons: PuppyLessonItem[];
  videoSourceSlug?: SituationSlug;
}

interface PuppySituation {
  slug: PuppySituationSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  category: Exclude<PuppyFilter, 'all'>;
  topics: PuppyTopic[];
}

interface AdultLargeTopic {
  slug: AdultLargeTopicSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  lessons: PuppyLessonItem[];
}

interface AdultLargeSituation {
  slug: AdultLargeSituationSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  topics: AdultLargeTopic[];
}



const puppySituations: PuppySituation[] = [
  {
    slug: 'ideal-walk',
    title: 'Идеальная прогулка',
    description: 'Поводок, подзыв, контакт и спокойная прогулка без перегруза',
    meta: '4 раздела',
    imagePath: '/assets/icons/leash.webp',
    category: 'walk',
    topics: [
      {
        slug: 'walk-leash',
        title: 'Поводок',
        description: 'Амуниция, движение рядом и безопасные остановки на улице',
        meta: '4 видео',
        imagePath: '/assets/icons/povodok.webp',
        lessons: [
          {
            title: 'Ошейник или шлейка?',
            description: 'Разбираем, какая амуниция подойдёт щенку в разных прогулочных сценариях',
            coverPath: '/assets/covers/ideal_prog.webp',
            video: {
              id: 'puppy-leash-collar-harness',
            },
          },
          {
            title: 'Как отучить тянуть поводок?',
            description: 'Собираем базу для спокойного движения рядом без рывков и борьбы',
            coverPath: '/assets/covers/tech_vlad.webp',
            video: {
              id: 'puppy-leash-stop-pulling',
            },
          },
          {
            title: 'Поводок или рулетка?',
            description: 'Разбираем преимущества обычного поводка и подходящую длину для прогулки',
            coverPath: '/assets/covers/povod_rulet.webp',
            video: {
              id: 'puppy-leash-or-retractable-part-1',
            },
          },
          {
            title: '«Стоп» перед дорогой',
            description: 'Учим щенка останавливаться перед дорогой и не вылетать вперёд',
            coverPath: '/assets/covers/stop_dor.webp',
            video: {
              id: 'puppy-leash-stop-road',
            },
          },
        ],
      },
      {
        slug: 'walk-food-pickup',
        title: 'Подбор еды',
        description: 'Профилактика подбора с земли и понятная работа через самоконтроль',
        meta: '1 видео',
        imagePath: '/assets/icons/podbor_puppy.webp',
        lessons: [
          {
            title: 'Намордник без драмы',
            description: 'Постепенно знакомим щенка с намордником без давления и лишнего стресса',
          },
        ],
      },
      {
        slug: 'walk-recall',
        title: 'Подзыв',
        description: 'Возврат к человеку, кличка и устойчивый контакт на прогулке',
        meta: '2 видео',
        imagePath: '/assets/icons/puppy-podziv.webp',
        lessons: [
          {
            title: 'Команда «Ко мне!» и «кличка»',
            description: 'Строим понятный сигнал возврата и закрепляем отклик в быту',
          },
          {
            title: 'Собака слушает вас, а не улицу',
            description: 'Развиваем контакт через взгляд, движение рядом и спокойное внимание к человеку',
          },
        ],
      },
      {
        slug: 'walk-ignore-triggers',
        title: 'Игнорирование раздражителей',
        description: 'Упражнения против отвлечений, выдержка и экологичный контакт на улице',
        meta: '3 видео',
        imagePath: '/assets/icons/razdrazh_puppy.webp',
        lessons: [
          {
            title: 'Упражнение против отвлечений (1-2-3)',
            description: 'Используем ритмичное упражнение 1-2-3, чтобы вернуть щенка в контакт',
            coverPath: '/assets/covers/1-2-3.webp',
            video: {
              id: 'puppy-ignore-123',
            },
          },
          {
            title: 'Выдержка: не срываемся на всё подряд',
            description: 'Собираем спокойное ожидание и уменьшаем импульсивные срывы на прогулке',
          },
          {
            title: 'Топ интересных игр на прогулке, или как наладить контакт',
            description: 'Подбираем короткие игры, которые делают человека интереснее улицы',
            coverPath: '/assets/covers/igri.webp',
            video: {
              id: 'puppy-ignore-walk-games',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'calm-home',
    title: 'Спокойный дом',
    description: 'Домашние сценарии, уверенность, правила и спокойный режим без хаоса',
    meta: '5 разделов',
    imagePath: '/assets/icons/home.webp',
    category: 'home',
    topics: [
      {
        slug: 'home-barking',
        title: 'Лай',
        description: 'Снижаем перегруз от бытовых звуков и учим щенка быстрее успокаиваться',
        meta: '2 видео',
        imagePath: '/assets/icons/lai_puppy.webp',
        lessons: [
          {
            title: 'Команда «тише»',
            description: 'Закладываем понятный бытовой сигнал без давления и наказаний',
          },
          {
            title: 'Приучаем к звукам дома',
            description: 'Работаем с домофоном, хлопками и другими резкими бытовыми звуками',
          },
        ],
      },
      {
        slug: 'home-loneliness',
        title: 'Одиночество',
        description: 'Уверенность в себе, безопасное пространство и постепенное увеличение дистанции',
        meta: '3 видео',
        imagePath: '/assets/icons/lonely_puppy.webp',
        lessons: [
          {
            title: 'Убираем страх и повышаем уверенность в себе',
            description: 'Помогаем щенку спокойнее проживать паузы без постоянного контроля человека',
          },
          {
            title: 'Правильная организация пространства',
            description: 'Подстраиваем домашнюю среду так, чтобы тревожности было меньше',
          },
          {
            title: 'Учим постепенно оставаться одному',
            description: 'Пошагово увеличиваем время отсутствия без резких скачков и откатов',
          },
        ],
      },
      {
        slug: 'home-jumping-on-guests',
        title: 'Прыжки на гостей',
        description: 'Спокойный приход домой, контроль возбуждения и более понятный сценарий встречи',
        meta: '2 видео',
        imagePath: '/assets/icons/jump_puppy.webp',
        lessons: [
          {
            title: 'Правильный приход/выход из дома',
            description: 'Собираем спокойный ритуал входа и выхода без суеты и скачков возбуждения',
          },
          {
            title: 'Прыжки на гостей',
            description: 'Показываем, как заменить прыжки на более удобный и управляемый сценарий встречи',
            coverPath: '/assets/covers/gosti.webp',
            video: {
              id: 'puppy-home-jumping-guests',
            },
          },
        ],
      },
      {
        slug: 'home-begging',
        title: 'Попрошайничество',
        description: 'Место, ритуалы дома и полезные занятия вместо выпрашивания еды',
        meta: '3 видео',
        imagePath: '/assets/icons/please_puppy.webp',
        lessons: [
          {
            title: 'Команда «место»',
            description: 'Формируем удобную точку отдыха на время еды и бытовой суеты',
            coverPath: '/assets/covers/mesto.webp',
            video: {
              id: 'puppy-home-begging-place',
            },
          },
          {
            title: 'Топ долгоиграющих лакомств и умных девайсов',
            description: 'Подбираем конг, лизательные и нюхательные коврики под повседневный ритм',
            coverPath: '/assets/covers/pogriz.webp',
            video: {
              id: 'puppy-home-begging-enrichment',
            },
          },
          {
            title: 'Питание',
            description: 'Смотрим, как режим и рацион влияют на бытовое поведение щенка',
            coverPath: '/assets/covers/korm.webp',
            video: {
              id: 'puppy-home-begging-feeding',
            },
          },
        ],
      },
      {
        slug: 'home-toilet',
        title: 'Туалет',
        description: 'Пелёнка, улица, режим и спокойная работа с запахом без наказаний',
        meta: '3 видео',
        imagePath: '/assets/icons/toilet_puppy.webp',
        lessons: [
          {
            title: 'Приучение к пелёнке и средства от запаха',
            description: 'Разбираем рабочую схему дома и средства, которые реально помогают',
          },
          {
            title: 'Приучение к улице и режим',
            description: 'Выстраиваем понятный ритм прогулок, чтобы щенку было проще попасть в успех',
          },
          {
            title: 'Метки дома',
            description: 'Смотрим, когда это часть этапа и как спокойно реагировать без лишнего стресса',
          },
        ],
      },
    ],
  },
  {
    slug: 'aggression-conflicts',
    title: 'Агрессия и конфликты',
    description: 'Работа с агрессией, конфликтами и защитой ресурсов',
    meta: '5 разделов',
    imagePath: '/assets/icons/agress_puppy.webp',
    category: 'behavior',
    topics: [
      {
        slug: 'conflicts-biting-hands',
        title: 'Грызёт руки и ноги',
        description: 'Правильная игра, снижение перегруза и более безопасный контакт со щенком',
        meta: '1 видео',
        imagePath: '/assets/icons/kus_puppy.webp',
        lessons: [
          {
            title: 'Грызёт руки и ноги: спокойная и правильная игра',
            description: 'Показываем, как не усиливать кусание и чем заменить хаотичное возбуждение',
          },
        ],
      },
      {
        slug: 'conflicts-vandal',
        title: 'Мой щенок вандалит',
        description: 'Разносит квартиру, портит вещи и не умеет сам успокаиваться',
        meta: '1 видео',
        imagePath: '/assets/icons/vandal_puppy.webp',
        lessons: [
          {
            title: 'Мой щенок вандалит и разносит квартиру',
            description: 'Разбираем причины разрушительного поведения и собираем бытовую профилактику',
          },
        ],
      },
      {
        slug: 'conflicts-resource-guarding',
        title: 'Охраняет чашку, вещи, игрушки',
        description: 'Безопасная работа рядом с ценными объектами и профилактика ресурсной охраны',
        meta: '1 видео',
        imagePath: '/assets/icons/ohrana_puppy.webp',
        lessons: [
          {
            title: 'Охраняет чашку, вещи и игрушки',
            description: 'Снижаем напряжение вокруг еды, игрушек и предметов без давления на щенка',
          },
        ],
      },
      {
        slug: 'conflicts-barks-at-people',
        title: 'Лает на людей или собак',
        description: 'Разбираем причины поведения и первые шаги к более устойчивой реакции',
        meta: '1 видео',
        imagePath: '/assets/icons/lai_puppy.webp',
        lessons: [
          {
            title: 'Лает на людей или собак',
            description: 'Смотрим, как снизить перегруз и начать более экологичную работу с реакцией',
          },
        ],
      },
      {
        slug: 'conflicts-neutering',
        title: 'Кастрировать или стерилизовать?',
        description: 'Контекст, возраст и реальные ожидания от такого решения',
        meta: '1 видео',
        imagePath: '/assets/icons/voprox_puppy.webp',
        lessons: [
          {
            title: 'Кастрировать или стерилизовать?',
            description: 'Разбираем, что реально меняет операция и что важно обсудить заранее',
          },
        ],
      },
    ],
  },
  {
    slug: 'fears-anxiety',
    title: 'Страхи и тревожность',
    description: 'Помогаем щенку справляться со страхами и тревогой',
    meta: '5 разделов',
    imagePath: '/assets/icons/sad_puppy.webp',
    category: 'behavior',
    topics: [
      {
        slug: 'fears-sounds',
        title: 'Боязнь звуков',
        description: 'Салюты, пылесос, фен и другие звуки, которые могут перегружать щенка',
        meta: '1 видео',
        imagePath: '/assets/icons/earphones_puppy.webp',
        lessons: [
          {
            title: 'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)',
            description: 'Помогаем щенку спокойнее переживать резкие и неожиданные шумы',
          },
        ],
      },
      {
        slug: 'fears-cars',
        title: 'Приучаем постепенно к машине',
        description: 'Постепенное привыкание к поездкам и более комфортный сценарий дороги',
        meta: '1 видео',
        imagePath: '/assets/icons/car_puppy.webp',
        lessons: [
          {
            title: 'Приучаем постепенно к машине',
            description: 'Пошагово снижаем тревогу и делаем поездки более предсказуемыми',
            coverPath: '/assets/covers/maschin.webp',
            video: {
              id: 'puppy-fears-car',
            },
          },
        ],
      },
      {
        slug: 'fears-new-places',
        title: 'Страх лестницы и лифта',
        description: 'Новые места, незнакомые поверхности и базовая техника безопасности',
        meta: '1 видео',
        imagePath: '/assets/icons/stair_puppy.webp',
        lessons: [
          {
            title: 'Страх лестницы и лифта',
            description: 'Вводим лестницы и лифт в комфортном темпе без перегруза и форсирования',
          },
        ],
      },
      {
        slug: 'fears-place-command',
        title: 'Команда «место»',
        description: 'Якорь спокойствия и понятная точка отдыха в домашнем пространстве',
        meta: '1 видео',
        imagePath: '/assets/icons/lay_puppy.webp',
        lessons: [
          {
            title: 'Команда «место»',
            description: 'Формируем понятное место, куда щенок может вернуться и расслабиться',
            coverPath: '/assets/covers/mesto.webp',
            video: {
              id: 'puppy-fears-place',
            },
          },
        ],
      },
      {
        slug: 'fears-follows-tail',
        title: 'Ходит хвостиком + Как минимизировать тревожность?',
        description: 'Сильная привязка к человеку и трудности с тем, чтобы остаться отдельно',
        meta: '1 видео',
        imagePath: '/assets/icons/tail_puppy.webp',
        lessons: [
          {
            title: 'Ходит хвостиком + Как минимизировать тревожность?',
            description: 'Делаем упражнения с оставлением в комнатах и мягко снижаем зависание на человеке',
          },
        ],
      },
    ],
  },
  {
    slug: 'care-without-fight',
    title: 'Уход без борьбы',
    description: 'Гигиена и уход через согласие, ритуалы и предсказуемость',
    meta: '2 раздела',
    imagePath: '/assets/icons/puppy_hand.webp',
    category: 'home',
    topics: [
      {
        slug: 'care-claws',
        title: 'Когти',
        description: 'Анатомия когтя и мягкое приучение к стрижке без лишнего напряжения',
        meta: '1 видео',
        imagePath: '/assets/icons/nails_puppy.webp',
        lessons: [
          {
            title: 'Когти: анатомия когтя и стрижка',
            description: 'Разбираем анатомию когтя и безопасную механику стрижки',
          },
        ],
      },
      {
        slug: 'care-paws',
        title: 'Лапы',
        description: 'Пять свобод, право отказаться и спокойная организация ванной зоны',
        meta: '1 видео',
        imagePath: '/assets/icons/lapa__puppy.webp',
        lessons: [
          {
            title: 'Лапы',
            description: 'Готовим пространство ванной и учим щенка больше доверять процессу ухода',
            coverPath: '/assets/covers/lapi-shen.webp',
            video: {
              id: 'puppy-care-paws',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'fitness',
    title: 'Фитнес',
    description: 'Упражнения на координацию, контроль тела и контакт',
    meta: '7 разделов',
    imagePath: '/assets/icons/fitness.webp',
    category: 'commands',
    topics: [
      {
        slug: 'fitness-bow',
        title: 'Поклон',
        description: 'Простое упражнение на контроль корпуса и концентрацию',
        meta: '1 видео',
        imagePath: '/assets/icons/poklon__puppy.webp.webp',
        lessons: [
          {
            title: 'Поклон',
            description: 'Шаг за шагом собираем красивое и безопасное положение',
          },
        ],
      },
      {
        slug: 'fitness-bunny',
        title: 'Зайка',
        description: 'Баланс, аккуратное удержание позиции и контроль центра тела',
        meta: '1 видео',
        imagePath: '/assets/icons/bunny_puppy.webp',
        lessons: [
          {
            title: 'Зайка',
            description: 'Разбираем технику и ограничения, чтобы упражнение оставалось безопасным',
          },
        ],
      },
      {
        slug: 'fitness-house',
        title: 'Домик',
        description: 'Координация, наведение и внимательная работа с позой',
        meta: '1 видео',
        imagePath: '/assets/icons/home_puppy.webp',
        lessons: [
          {
            title: 'Домик',
            description: 'Собираем упражнение через понятные короткие шаги',
          },
        ],
      },
      {
        slug: 'fitness-paw',
        title: '«Дай лапу»',
        description: 'Небольшой трюк для контакта и более аккуратной работы с импульсом',
        meta: '1 видео',
        imagePath: '/assets/icons/lapa__puppy.webp',
        lessons: [
          {
            title: '«Дай лапу»',
            description: 'Формируем упражнение без навязчивого махания лапами',
          },
        ],
      },
      {
        slug: 'fitness-wipe-muzzle',
        title: 'Поставь лапки или "тач"',
        description: 'Постановка передних лап на мишень через спокойную пошаговую работу',
        meta: '1 видео',
        imagePath: '/assets/icons/tap_puppy.webp',
        lessons: [
          {
            title: 'Поставь лапки или "тач"',
            description: 'Формируем спокойную постановку передних лап и закрепляем команду «Тач»',
            video: {
              id: 'map-puppy-fitness-wipe-muzzle',
            },
          },
        ],
      },
      {
        slug: 'fitness-spin',
        title: 'Круть-верть',
        description: 'Повороты вокруг своей оси для координации и контакта',
        meta: '1 видео',
        imagePath: '/assets/icons/krutvert_puppy.webp',
        lessons: [
          {
            title: 'Круть-верть',
            description: 'Собираем плавный поворот в обе стороны через короткие понятные шаги',
            video: {
              id: 'map-puppy-fitness-spin',
            },
          },
        ],
      },
      {
        slug: 'fitness-left-right',
        title: 'Влево-вправо',
        description: 'Перенос веса и направленные движения для контроля тела',
        meta: '1 видео',
        imagePath: '/assets/icons/levopravo_puppy.webp',
        lessons: [
          {
            title: 'Влево-вправо',
            description: 'Учимся двигаться в стороны по понятному сигналу без спешки',
            video: {
              id: 'map-puppy-fitness-left-right',
            },
          },
        ],
      },
    ],
  },
];

const puppySituationsBySlug = new Map<PuppySituationSlug, PuppySituation>(
  puppySituations.map((situation) => [situation.slug, situation]),
);

const puppyTopics = puppySituations.flatMap((situation) =>
  situation.topics.map((topic) => ({
    ...topic,
    parentSlug: situation.slug,
    parentTitle: situation.title,
  })),
);

const puppyTopicsBySlug = new Map<
  PuppyTopicSlug,
  PuppyTopic & { parentSlug: PuppySituationSlug; parentTitle: string }
>(puppyTopics.map((topic) => [topic.slug, topic]));

const adultLargeSituations: AdultLargeSituation[] = [
  {
    slug: 'adult-large-ideal-walk',
    title: 'Идеальная прогулка',
    description: 'Поводок, подзыв, контакт и спокойная работа с раздражителями на улице',
    meta: '4 раздела',
    imagePath: '/assets/icons/leash.webp',
    topics: [
      {
        slug: 'adult-large-leash',
        title: 'Поводок',
        description: 'Поводок, остановки и усложнение в обычной жизни',
        meta: '4 видео',
        imagePath: '/assets/icons/leash.webp',
        lessons: [
          { title: 'Как отучить тянуть поводок?', description: 'Разбираем причины натяжения поводка и собираем спокойную механику прогулки' },
          { title: 'Ошейник или шлейка?', description: 'Как подобрать амуницию под сценарии прогулки и особенности собаки', coverPath: '/assets/covers/ideal_prog.webp' },
          { title: 'Поводок или рулетка?', description: 'Сравниваем варианты амуниции и выбираем подходящий формат прогулки', coverPath: '/assets/covers/povod_rulet.webp' },
          {
            title: '«Дорога» и «стоп»',
            description: 'Учимся останавливаться и безопасно проходить сложные участки маршрута',
            coverPath: '/assets/covers/stop_dor.webp',
            video: {
              id: 'adult-large-leash-road-stop',
            },
          },
        ],
      },
      {
        slug: 'adult-large-food-pickup',
        title: 'Подбор еды',
        description: 'Фокус, выдержка и импульс-контроль при еде на улице',
        meta: '2 видео',
        imagePath: '/assets/icons/big_podbor_edi.webp',
        lessons: [
          { title: 'Импульс-контроль + Выдержка', description: 'Учимся спокойно переживать близость еды и формируем паузу перед действием' },
          { title: 'Намордник без драмы', description: 'Пошагово формируем комфортное отношение к наморднику без давления' },
        ],
      },
      {
        slug: 'adult-large-recall',
        title: 'Подзыв',
        description: 'Контакт, команда «ко мне» и работа на фоне раздражителей',
        meta: '2 видео',
        imagePath: '/assets/icons/big_podziv.webp',
        lessons: [
          { title: 'Контакт', description: 'Возвращаем внимание собаки к человеку на прогулке' },
          { title: 'Ко мне', description: 'Формируем понятный и надёжный сигнал возвращения' },
        ],
      },
      {
        slug: 'adult-large-ignore-triggers',
        title: 'Игнорирование раздражителей',
        description: 'Протоколы внимания и самоконтроля на фоне сильных стимулов',
        meta: '3 видео',
        imagePath: '/assets/icons/big_ignor.webp',
        lessons: [
          { title: 'Упражнение против отвлечений (1-2-3)', description: 'Возвращаем собаку в понятный ритм при сильных отвлечениях', coverPath: '/assets/covers/1-2-3.webp' },
          { title: 'Выдержка: не срываемся на всё подряд', description: 'Развиваем импульс-контроль на фоне раздражителей' },
          { title: 'Топ интересных игр на прогулке, или как наладить контакт', description: 'Подбираем игры, которые усиливают ценность человека на улице', coverPath: '/assets/covers/igri.webp' },
        ],
      },
    ],
  },
  {
    slug: 'adult-large-calm-home',
    title: 'Спокойный дом',
    description: 'Домашний режим, тишина, одиночество и бытовые правила',
    meta: '5 разделов',
    imagePath: '/assets/icons/home.webp',
    topics: [
      { slug: 'adult-large-barking', title: 'Лай', description: 'Команда «тише» и спокойное привыкание к звукам', meta: '2 видео', imagePath: '/assets/icons/big_lai.webp', lessons: [
        { title: 'Команда «тише»', description: 'Формируем бытовой сигнал без давления и наказаний' },
        { title: 'Приучаем к звукам: домофон и хлопки', description: 'Постепенно снижаем реакцию на домофон, хлопки и другие бытовые шумы' },
      ]},
      { slug: 'adult-large-loneliness', title: 'Одиночество', description: 'Уверенность, пространство и постепенное обучение оставаться одному', meta: '3 видео', imagePath: '/assets/icons/big_kreslo.webp', lessons: [
        { title: 'Убираем страх и повышаем уверенность в себе', description: 'Собираем бытовые сценарии, где собака справляется без постоянной помощи' },
        { title: 'Правильная организация пространства', description: 'Подготавливаем дома среду, в которой собаке проще расслабляться' },
        { title: 'Учим постепенно оставаться одному', description: 'Пошагово увеличиваем дистанцию и время без резких скачков' },
      ]},
      { slug: 'adult-large-jumping-on-guests', title: 'Прыжки на гостей', description: 'Спокойная встреча гостей и понятный сценарий прихода домой', meta: '2 видео', imagePath: '/assets/icons/big_prig.webp', lessons: [
        { title: 'Правильный приход/выход из дома', description: 'Формируем предсказуемый сценарий входа и выхода без лишнего возбуждения' },
        {
          title: 'Прыжки на гостей',
          description: 'Заменяем прыжки на более спокойный и управляемый сценарий встречи',
          coverPath: '/assets/covers/gosti.webp',
          video: {
            id: 'adult-large-jumping-guests',
          },
        },
      ]},
      { slug: 'adult-large-begging', title: 'Попрошайничество', description: 'Команда «место», полезные занятия и питание', meta: '3 видео', imagePath: '/assets/icons/big_please.webp', lessons: [
        {
          title: 'Команда «место»',
          description: 'Формируем удобную бытовую точку отдыха во время еды',
          coverPath: '/assets/covers/mesto.webp',
          video: {
            id: 'adult-large-begging-place',
          },
        },
        {
          title: 'Топ долгоиграющих лакомств и умных девайсов',
          description: 'Подбираем конг, лизательные и нюхательные коврики',
          coverPath: '/assets/covers/pogriz.webp',
          video: {
            id: 'adult-large-begging-enrichment',
          },
        },
        { title: 'Питание', description: 'Разбираем режим, логику выдачи еды и бытовые рамки', coverPath: '/assets/covers/korm.webp' },
      ]},
      { slug: 'adult-large-toilet', title: 'Туалет', description: 'Улица, режим и метки дома у взрослой собаки', meta: '2 видео', imagePath: '/assets/icons/big_toilet.webp', lessons: [
        { title: 'Приучение к улице + режим', description: 'Перестраиваем туалетный сценарий на улицу и выстраиваем понятный ритм прогулок' },
        { title: 'Метки дома', description: 'Разбираем причины меток и первые шаги по изменению ситуации' },
      ]},
    ],
  },
  {
    slug: 'adult-large-aggression-conflicts',
    title: 'Агрессия и конфликты',
    description: 'Сложное поведение, реакция на объекты и охрана ресурсов',
    meta: '5 разделов',
    imagePath: '/assets/icons/big_agress.webp',
    topics: [
      { slug: 'adult-large-overaroused-play', title: 'Перевозбуждается при игре', description: 'Работа с чрезмерным возбуждением во время совместной игры', meta: '1 видео', imagePath: '/assets/icons/big_vozbud.webp', lessons: [
        { title: 'Перевозбуждается при игре', description: 'Учимся вовремя замечать перегруз и возвращать собаке спокойное состояние' },
      ]},
      { slug: 'adult-large-resource-guarding', title: 'Охраняет вещи', description: 'Безопасная работа с охраной ценных ресурсов', meta: '1 видео', imagePath: '/assets/icons/big_ohran.webp', lessons: [
        { title: 'Охраняет вещи', description: 'Снижаем напряжение вокруг еды, вещей и игрушек' },
      ]},
      { slug: 'adult-large-barks-at-people', title: 'Лает на людей или собак', description: 'Причины поведения и работа с реакцией', meta: '1 видео', imagePath: '/assets/icons/big_bark.webp', lessons: [
        { title: 'Лает на людей или собак', description: 'Определяем причины реакции и собираем безопасный протокол работы' },
      ]},
      { slug: 'adult-large-neutering', title: 'Кастрировать/стерилизовать или нет?', description: 'Реальные ожидания и ограничения такого решения', meta: '1 видео', imagePath: '/assets/icons/voprox_puppy.webp', lessons: [
        { title: 'Кастрировать/стерилизовать или нет?', description: 'Разбираем ожидания, ограничения и вопросы к специалистам' },
      ]},
      { slug: 'adult-large-scooters-bikes', title: 'Бросается на самокаты и велосипеды', description: 'Работа со страхом, напряжением и погоней за движущимися объектами', meta: '1 видео', imagePath: '/assets/icons/big_velo.webp', lessons: [
        { title: 'Бросается на самокаты и велосипеды', description: 'Учимся отличать мотивацию и выбирать корректную стратегию работы' },
      ]},
    ],
  },
  {
    slug: 'adult-large-fears-anxiety',
    title: 'Страхи и тревожность',
    description: 'Пространство, хвостик, звуки, машины и новые места',
    meta: '5 разделов',
    imagePath: '/assets/icons/big_fear.webp',
    topics: [
      { slug: 'adult-large-place-space', title: 'Команда «место»', description: 'Понятная и спокойная точка отдыха для собаки', meta: '1 видео', imagePath: '/assets/icons/big_sidit.webp', lessons: [
        {
          title: 'Команда «место»',
          description: 'Делаем точку отдыха понятной и полезной для собаки',
          coverPath: '/assets/covers/mesto.webp',
          video: {
            id: 'adult-large-fears-place',
          },
        },
      ]},
      { slug: 'adult-large-follows-tail', title: 'Ходит хвостиком + Как минимизировать тревожность?', description: 'Снижаем тревожность и учим собаку оставаться отдельно', meta: '1 видео', imagePath: '/assets/icons/big_hvost.webp', lessons: [
        { title: 'Ходит хвостиком + Как минимизировать тревожность?', description: 'Постепенно учим собаку выдерживать разлуку в пределах дома' },
      ]},
      { slug: 'adult-large-sounds', title: 'Боязнь звуков', description: 'Работа с неожиданными и неприятными шумами', meta: '1 видео', imagePath: '/assets/icons/big_headphones.webp', lessons: [
        { title: 'Боязнь звуков', description: 'Пошагово меняем эмоциональную реакцию на шумы' },
      ]},
      { slug: 'adult-large-cars', title: 'Приучаем постепенно к машине', description: 'Постепенное знакомство с машиной и поездками', meta: '1 видео', imagePath: '/assets/icons/big_car.webp', lessons: [
        { title: 'Приучаем постепенно к машине', description: 'Двигаемся от знакомства к коротким безопасным поездкам' },
      ]},
      { slug: 'adult-large-new-places', title: 'Страх лестницы и лифта', description: 'Постепенное знакомство с лестницей и лифтом', meta: '1 видео', imagePath: '/assets/icons/big_lift.webp', lessons: [
        { title: 'Страх лестницы и лифта', description: 'Знакомим собаку с лестницей и лифтом в комфортном темпе' },
      ]},
    ],
  },
  {
    slug: 'adult-large-care-without-fight',
    title: 'Уход без борьбы',
    description: 'Когти и лапы через предсказуемость и согласие',
    meta: '2 раздела',
    imagePath: '/assets/icons/big_bath.webp',
    topics: [
      { slug: 'adult-large-claws', title: 'Когти', description: 'Спокойный и предсказуемый уход за когтями', meta: '1 видео', imagePath: '/assets/icons/big_kogot.webp', lessons: [
        { title: 'Когти', description: 'Собираем аккуратную процедуру ухода шаг за шагом' },
      ]},
      { slug: 'adult-large-paws', title: 'Лапы', description: 'Спокойный уход за лапами без борьбы', meta: '1 видео', imagePath: '/assets/icons/big_lapi.webp', lessons: [
        {
          title: 'Лапы',
          description: 'Собираем понятный и комфортный сценарий ухода за лапами',
          coverPath: '/assets/covers/lapi-bolsh.webp',
          video: {
            id: 'adult-large-care-paws',
          },
        },
      ]},
    ],
  },
  {
    slug: 'adult-large-fitness',
    title: 'Фитнес для взрослых',
    description: 'Небольшие упражнения на координацию, контроль тела и контакт',
    meta: '5 разделов',
    imagePath: '/assets/icons/big_fitness.webp',
    topics: [
      { slug: 'adult-large-eight', title: 'Восемь', description: 'Контроль движения вокруг ног человека', meta: '1 видео', imagePath: '/assets/icons/big_vosem.webp', lessons: [
        { title: 'Восемь', description: 'Собираем плавное движение по траектории вокруг ног без спешки' },
      ]},
      { slug: 'adult-large-go-around', title: 'Обойди', description: 'Координация движения вокруг человека или предмета', meta: '1 видео', imagePath: '/assets/icons/big_oboidi.webp', lessons: [
        { title: 'Обойди', description: 'Собираем понятное движение вокруг человека или предмета' },
      ]},
      { slug: 'adult-large-wipe-muzzle', title: 'Вытри морду', description: 'Полезный бытовой навык через работу с мишенью', meta: '1 видео', imagePath: '/assets/icons/big_lapananose.webp', lessons: [
        { title: 'Вытри морду', description: 'Формируем спокойную постановку передних лап и закрепляем команду «Тач»' },
      ]},
      { slug: 'adult-large-jump-over-leg', title: 'Прыг', description: 'Аккуратный прыжок с контролем импульса и траектории', meta: '1 видео', imagePath: '/assets/icons/big_jump.webp', lessons: [
        { title: 'Прыг', description: 'Учимся безопасному прыжку через понятную и короткую механику' },
      ]},
      { slug: 'adult-large-bow', title: 'Поклон', description: 'Упражнение на координацию, контроль корпуса и концентрацию', meta: '1 видео', imagePath: '/assets/icons/big_poklon.webp', lessons: [
        { title: 'Поклон', description: 'Собираем красивое и понятное упражнение через короткие шаги' },
      ]},
    ],
  },
];

type PlannedVideoTopicSlug = PuppyTopicSlug | AdultLargeTopicSlug;
type PlannedLessonVideo = readonly [
  topicSlug: PlannedVideoTopicSlug,
  lessonTitle: string,
  videoId: string,
  sourceType?: LessonVideoSource,
];

const plannedLessonVideos = [
  [
    'walk-food-pickup',
    'Намордник без драмы',
    'map-puppy-food-pickup-muzzle',
  ],
  [
    'walk-recall',
    'Команда «Ко мне!» и «кличка»',
    'map-puppy-recall-name',
  ],
  [
    'walk-recall',
    'Собака слушает вас, а не улицу',
    'map-puppy-recall-contact',
  ],
  [
    'walk-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    'map-puppy-ignore-impulse',
  ],
  [
    'home-barking',
    'Команда «тише»',
    'map-puppy-home-quiet',
  ],
  [
    'home-barking',
    'Приучаем к звукам дома',
    'map-puppy-home-sounds',
  ],
  [
    'home-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    'map-puppy-loneliness-confidence',
  ],
  [
    'home-loneliness',
    'Учим постепенно оставаться одному',
    'map-puppy-loneliness-alone',
  ],
  [
    'home-jumping-on-guests',
    'Правильный приход/выход из дома',
    'map-puppy-guests-arrival',
  ],
  [
    'home-toilet',
    'Приучение к пелёнке и средства от запаха',
    'map-puppy-toilet-pad',
  ],
  [
    'home-toilet',
    'Приучение к улице и режим',
    'map-puppy-toilet-outside',
  ],
  [
    'home-toilet',
    'Метки дома',
    'map-puppy-toilet-marking',
  ],
  [
    'conflicts-biting-hands',
    'Грызёт руки и ноги: спокойная и правильная игра',
    'map-puppy-conflicts-biting',
  ],
  [
    'conflicts-vandal',
    'Мой щенок вандалит и разносит квартиру',
    'map-puppy-conflicts-vandal',
  ],
  [
    'conflicts-resource-guarding',
    'Охраняет чашку, вещи и игрушки',
    'map-puppy-conflicts-guarding',
  ],
  [
    'conflicts-barks-at-people',
    'Лает на людей или собак',
    'map-puppy-conflicts-barking',
  ],
  [
    'conflicts-neutering',
    'Кастрировать или стерилизовать?',
    'map-puppy-conflicts-neutering',
  ],
  [
    'fears-sounds',
    'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)',
    'map-puppy-fears-sounds',
  ],
  [
    'fears-new-places',
    'Страх лестницы и лифта',
    'map-puppy-fears-stairs-lift',
  ],
  [
    'home-loneliness',
    'Правильная организация пространства',
    'map-puppy-loneliness-space',
  ],
  [
    'care-claws',
    'Когти: анатомия когтя и стрижка',
    'map-puppy-care-claws',
  ],
  [
    'fitness-bow',
    'Поклон',
    'map-puppy-fitness-bow',
  ],
  [
    'fitness-bunny',
    'Зайка',
    'map-puppy-fitness-bunny',
  ],
  [
    'fitness-house',
    'Домик',
    'map-puppy-fitness-house',
    'mp4',
  ],
  [
    'fitness-paw',
    '«Дай лапу»',
    'map-puppy-fitness-paw',
  ],
  [
    'adult-large-leash',
    'Как отучить тянуть поводок?',
    'map-adult-large-leash-pulling',
  ],
  [
    'adult-large-food-pickup',
    'Импульс-контроль + Выдержка',
    'map-adult-large-food-impulse',
  ],
  [
    'adult-large-food-pickup',
    'Намордник без драмы',
    'map-adult-large-food-muzzle',
  ],
  [
    'adult-large-recall',
    'Контакт',
    'map-adult-large-recall-contact',
  ],
  [
    'adult-large-recall',
    'Ко мне',
    'map-adult-large-recall-come',
  ],
  [
    'adult-large-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    'map-adult-large-ignore-impulse',
  ],
  [
    'adult-large-ignore-triggers',
    'Топ интересных игр на прогулке, или как наладить контакт',
    'map-adult-large-ignore-games',
  ],
  [
    'adult-large-barking',
    'Команда «тише»',
    'map-adult-large-home-quiet',
  ],
  [
    'adult-large-barking',
    'Приучаем к звукам: домофон и хлопки',
    'map-adult-large-home-sounds',
  ],
  [
    'adult-large-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    'map-adult-large-loneliness-confidence',
  ],
  [
    'adult-large-loneliness',
    'Правильная организация пространства',
    'map-adult-large-loneliness-space',
  ],
  [
    'adult-large-loneliness',
    'Учим постепенно оставаться одному',
    'map-adult-large-loneliness-alone',
  ],
  [
    'adult-large-jumping-on-guests',
    'Правильный приход/выход из дома',
    'map-adult-large-guests-arrival',
  ],
  [
    'adult-large-begging',
    'Питание',
    'map-adult-large-begging-feeding',
  ],
  [
    'adult-large-toilet',
    'Приучение к улице + режим',
    'map-adult-large-toilet-outside',
  ],
  [
    'adult-large-toilet',
    'Метки дома',
    'map-adult-large-toilet-marking',
  ],
  [
    'adult-large-overaroused-play',
    'Перевозбуждается при игре',
    'map-adult-large-conflicts-overaroused',
  ],
  [
    'adult-large-resource-guarding',
    'Охраняет вещи',
    'map-adult-large-conflicts-guarding',
  ],
  [
    'adult-large-barks-at-people',
    'Лает на людей или собак',
    'map-adult-large-conflicts-barking',
  ],
  [
    'adult-large-neutering',
    'Кастрировать/стерилизовать или нет?',
    'map-adult-large-conflicts-neutering',
  ],
  [
    'adult-large-scooters-bikes',
    'Бросается на самокаты и велосипеды',
    'map-adult-large-conflicts-scooters',
  ],
  [
    'adult-large-follows-tail',
    'Ходит хвостиком + Как минимизировать тревожность?',
    'map-adult-large-fears-follows-tail',
  ],
  [
    'adult-large-sounds',
    'Боязнь звуков',
    'map-adult-large-fears-sounds',
  ],
  [
    'adult-large-cars',
    'Приучаем постепенно к машине',
    'map-adult-large-fears-cars',
  ],
  [
    'adult-large-new-places',
    'Страх лестницы и лифта',
    'map-adult-large-fears-stairs-lift',
  ],
  [
    'adult-large-claws',
    'Когти',
    'map-adult-large-care-claws',
  ],
  [
    'adult-large-eight',
    'Восемь',
    'map-adult-large-fitness-eight',
  ],
  [
    'adult-large-go-around',
    'Обойди',
    'map-adult-large-fitness-go-around',
  ],
  [
    'adult-large-wipe-muzzle',
    'Вытри морду',
    'map-adult-large-fitness-wipe-muzzle',
  ],
  [
    'adult-large-bow',
    'Поклон',
    'map-adult-large-fitness-bow',
  ],
] as const satisfies readonly PlannedLessonVideo[];

type PlannedLessonCover = readonly [
  topicSlug: PlannedVideoTopicSlug,
  lessonTitle: string,
  coverPath: string,
];

const plannedLessonCovers = [
  ['conflicts-vandal', 'Мой щенок вандалит и разносит квартиру', '/assets/covers/puppy-vandal.webp'],
  ['walk-food-pickup', 'Намордник без драмы', '/assets/covers/muzzle.webp'],
  ['walk-recall', 'Команда «Ко мне!» и «кличка»', '/assets/covers/puppy-recall-come.webp'],
  ['walk-recall', 'Собака слушает вас, а не улицу', '/assets/covers/puppy-recall-contact.webp'],
  ['walk-ignore-triggers', 'Выдержка: не срываемся на всё подряд', '/assets/covers/puppy-ignore-impulse.webp'],
  ['home-barking', 'Команда «тише»', '/assets/covers/quiet.webp'],
  ['home-barking', 'Приучаем к звукам дома', '/assets/covers/puppy-fears-sounds.webp'],
  ['home-loneliness', 'Убираем страх и повышаем уверенность в себе', '/assets/covers/puppy-confidence.webp'],
  ['home-loneliness', 'Учим постепенно оставаться одному', '/assets/covers/puppy-alone.webp'],
  ['home-jumping-on-guests', 'Правильный приход/выход из дома', '/assets/covers/puppy-arrival.webp'],
  [
    'home-toilet',
    'Приучение к пелёнке и средства от запаха',
    '/assets/covers/puppy-toilet-pad.webp',
  ],
  ['home-toilet', 'Приучение к улице и режим', '/assets/covers/toilet-outside.webp'],
  ['home-toilet', 'Метки дома', '/assets/covers/toilet-marking.webp'],
  [
    'conflicts-biting-hands',
    'Грызёт руки и ноги: спокойная и правильная игра',
    '/assets/covers/puppy-biting.webp',
  ],
  [
    'conflicts-resource-guarding',
    'Охраняет чашку, вещи и игрушки',
    '/assets/covers/puppy-resource-guarding.webp',
  ],
  ['conflicts-barks-at-people', 'Лает на людей или собак', '/assets/covers/barking-triggers.webp'],
  ['conflicts-neutering', 'Кастрировать или стерилизовать?', '/assets/covers/neutering.webp'],
  [
    'fears-sounds',
    'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)',
    '/assets/covers/puppy-fears-sounds.webp',
  ],
  ['fears-new-places', 'Страх лестницы и лифта', '/assets/covers/puppy-stairs-lift.webp'],
  ['home-loneliness', 'Правильная организация пространства', '/assets/covers/puppy-home.webp'],
  [
    'fears-follows-tail',
    'Ходит хвостиком + Как минимизировать тревожность?',
    '/assets/covers/adult-anxiety.webp',
  ],
  ['care-claws', 'Когти: анатомия когтя и стрижка', '/assets/covers/kogti.webp'],
  ['fitness-bow', 'Поклон', '/assets/covers/bow.webp'],
  ['fitness-bunny', 'Зайка', '/assets/covers/puppy-bunny.webp'],
  ['fitness-house', 'Домик', '/assets/covers/puppy-house.webp'],
  ['fitness-paw', '«Дай лапу»', '/assets/covers/puppy-give-paw.webp'],
  ['fitness-wipe-muzzle', 'Поставь лапки или "тач"', '/assets/covers/wipe-muzzle.webp'],
  ['fitness-spin', 'Круть-верть', '/assets/covers/puppy-spin.webp'],
  ['fitness-left-right', 'Влево-вправо', '/assets/covers/puppy-left-right.webp'],
  ['adult-large-leash', 'Как отучить тянуть поводок?', '/assets/covers/adult-leash-technique.webp'],
  ['adult-large-food-pickup', 'Импульс-контроль + Выдержка', '/assets/covers/adult-food-impulse.webp'],
  ['adult-large-food-pickup', 'Намордник без драмы', '/assets/covers/muzzle.webp'],
  ['adult-large-recall', 'Контакт', '/assets/covers/adult-recall-contact.webp'],
  ['adult-large-recall', 'Ко мне', '/assets/covers/adult-recall-come.webp'],
  [
    'adult-large-ignore-triggers',
    'Топ интересных игр на прогулке, или как наладить контакт',
    '/assets/covers/adult-walk-games.webp',
  ],
  [
    'adult-large-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    '/assets/covers/adult-food-impulse.webp',
  ],
  ['adult-large-barking', 'Команда «тише»', '/assets/covers/quiet.webp'],
  [
    'adult-large-barking',
    'Приучаем к звукам: домофон и хлопки',
    '/assets/covers/adult-home-sounds.webp',
  ],
  [
    'adult-large-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    '/assets/covers/adult-confidence.webp',
  ],
  ['adult-large-loneliness', 'Учим постепенно оставаться одному', '/assets/covers/adult-alone.webp'],
  [
    'adult-large-loneliness',
    'Правильная организация пространства',
    '/assets/covers/adult-space.webp',
  ],
  [
    'adult-large-jumping-on-guests',
    'Правильный приход/выход из дома',
    '/assets/covers/adult-arrival.webp',
  ],
  ['adult-large-begging', 'Питание', '/assets/covers/adult-feeding.webp'],
  ['adult-large-toilet', 'Приучение к улице + режим', '/assets/covers/toilet-outside.webp'],
  ['adult-large-toilet', 'Метки дома', '/assets/covers/toilet-marking.webp'],
  [
    'adult-large-overaroused-play',
    'Перевозбуждается при игре',
    '/assets/covers/adult-overaroused.webp',
  ],
  [
    'adult-large-resource-guarding',
    'Охраняет вещи',
    '/assets/covers/adult-resource-guarding.webp',
  ],
  [
    'adult-large-barks-at-people',
    'Лает на людей или собак',
    '/assets/covers/barking-triggers.webp',
  ],
  [
    'adult-large-neutering',
    'Кастрировать/стерилизовать или нет?',
    '/assets/covers/neutering.webp',
  ],
  [
    'adult-large-scooters-bikes',
    'Бросается на самокаты и велосипеды',
    '/assets/covers/adult-scooters.webp',
  ],
  [
    'adult-large-follows-tail',
    'Ходит хвостиком + Как минимизировать тревожность?',
    '/assets/covers/adult-anxiety.webp',
  ],
  ['adult-large-sounds', 'Боязнь звуков', '/assets/covers/adult-fears-sounds.webp'],
  ['adult-large-cars', 'Приучаем постепенно к машине', '/assets/covers/maschin.webp'],
  ['adult-large-new-places', 'Страх лестницы и лифта', '/assets/covers/adult-stairs-lift.webp'],
  ['adult-large-claws', 'Когти', '/assets/covers/kogti-bolsh.webp'],
  ['adult-large-eight', 'Восемь', '/assets/covers/adult-eight.webp'],
  ['adult-large-go-around', 'Обойди', '/assets/covers/adult-go-around.webp'],
  ['adult-large-wipe-muzzle', 'Вытри морду', '/assets/covers/wipe-muzzle.webp'],
  ['adult-large-bow', 'Поклон', '/assets/covers/bow.webp'],
] as const satisfies readonly PlannedLessonCover[];

function applyPlannedLessonVideos(): void {
  const topics: Array<{ slug: PlannedVideoTopicSlug; lessons: PuppyLessonItem[] }> = [
    ...puppySituations.flatMap((situation) => situation.topics),
    ...adultLargeSituations.flatMap((situation) => situation.topics),
  ];
  const topicsBySlug = new Map<string, { lessons: PuppyLessonItem[] }>(
    topics.map((topic) => [topic.slug, topic]),
  );

  plannedLessonVideos.forEach(([topicSlug, lessonTitle, videoId, sourceType]) => {
    const topic = topicsBySlug.get(topicSlug);
    const lesson = topic?.lessons.find((item) => item.title === lessonTitle);

    if (!lesson) {
      throw new Error(`Planned lesson video target not found: ${topicSlug} / ${lessonTitle}`);
    }

    lesson.video = { id: videoId, sourceType };
  });

  plannedLessonCovers.forEach(([topicSlug, lessonTitle, coverPath]) => {
    const topic = topicsBySlug.get(topicSlug);
    const lesson = topic?.lessons.find((item) => item.title === lessonTitle);

    if (!lesson) {
      throw new Error(`Planned lesson cover target not found: ${topicSlug} / ${lessonTitle}`);
    }

    lesson.coverPath = coverPath;
  });
}

applyPlannedLessonVideos();

const adultLargeSituationsBySlug = new Map<AdultLargeSituationSlug, AdultLargeSituation>(
  adultLargeSituations.map((situation) => [situation.slug, situation]),
);

const adultLargeTopics = adultLargeSituations.flatMap((situation) =>
  situation.topics.map((topic) => ({
    ...topic,
    parentSlug: situation.slug,
    parentTitle: situation.title,
  })),
);

const adultLargeTopicsBySlug = new Map<
  AdultLargeTopicSlug,
  AdultLargeTopic & { parentSlug: AdultLargeSituationSlug; parentTitle: string }
>(adultLargeTopics.map((topic) => [topic.slug, topic]));


type LocalVideoTopicSlug = PuppyTopicSlug | AdultLargeTopicSlug;

const localLessonMediaAssignments = localVideoCatalog.cardMedia as Array<{
  topicSlug: LocalVideoTopicSlug;
  lessonTitle: string;
  mediaId: string;
}>;

const lessonDescriptionAssignments: Array<{
  topicSlug: LocalVideoTopicSlug;
  lessonTitle: string;
  descriptionId: VideoDescriptionId;
}> = [
  { topicSlug: 'walk-leash', lessonTitle: 'Ошейник или шлейка?', descriptionId: '21' },
  { topicSlug: 'walk-leash', lessonTitle: 'Как отучить тянуть поводок?', descriptionId: '01' },
  { topicSlug: 'walk-leash', lessonTitle: 'Поводок или рулетка?', descriptionId: '05' },
  { topicSlug: 'walk-leash', lessonTitle: '«Стоп» перед дорогой', descriptionId: '06' },
  { topicSlug: 'walk-food-pickup', lessonTitle: 'Намордник без драмы', descriptionId: '04' },
  { topicSlug: 'walk-recall', lessonTitle: 'Команда «Ко мне!» и «кличка»', descriptionId: '09' },
  { topicSlug: 'walk-recall', lessonTitle: 'Собака слушает вас, а не улицу', descriptionId: '08' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Упражнение против отвлечений (1-2-3)', descriptionId: '10' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Выдержка: не срываемся на всё подряд', descriptionId: '11' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Топ интересных игр на прогулке, или как наладить контакт', descriptionId: '12' },
  { topicSlug: 'home-barking', lessonTitle: 'Команда «тише»', descriptionId: '36' },
  { topicSlug: 'home-barking', lessonTitle: 'Приучаем к звукам дома', descriptionId: '37' },
  { topicSlug: 'home-loneliness', lessonTitle: 'Убираем страх и повышаем уверенность в себе', descriptionId: '15' },
  { topicSlug: 'home-loneliness', lessonTitle: 'Правильная организация пространства', descriptionId: '02' },
  { topicSlug: 'home-loneliness', lessonTitle: 'Учим постепенно оставаться одному', descriptionId: '57' },
  { topicSlug: 'home-jumping-on-guests', lessonTitle: 'Правильный приход/выход из дома', descriptionId: '38' },
  { topicSlug: 'home-jumping-on-guests', lessonTitle: 'Прыжки на гостей', descriptionId: '39' },
  { topicSlug: 'home-begging', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'home-begging', lessonTitle: 'Топ долгоиграющих лакомств и умных девайсов', descriptionId: '42' },
  { topicSlug: 'home-begging', lessonTitle: 'Питание', descriptionId: '56' },
  { topicSlug: 'home-toilet', lessonTitle: 'Приучение к пелёнке и средства от запаха', descriptionId: '34' },
  { topicSlug: 'home-toilet', lessonTitle: 'Приучение к улице и режим', descriptionId: '35' },
  { topicSlug: 'home-toilet', lessonTitle: 'Метки дома', descriptionId: '35' },
  { topicSlug: 'conflicts-biting-hands', lessonTitle: 'Грызёт руки и ноги: спокойная и правильная игра', descriptionId: '03' },
  { topicSlug: 'conflicts-vandal', lessonTitle: 'Мой щенок вандалит и разносит квартиру', descriptionId: '61' },
  { topicSlug: 'conflicts-resource-guarding', lessonTitle: 'Охраняет чашку, вещи и игрушки', descriptionId: '14' },
  { topicSlug: 'conflicts-barks-at-people', lessonTitle: 'Лает на людей или собак', descriptionId: '29' },
  { topicSlug: 'conflicts-neutering', lessonTitle: 'Кастрировать или стерилизовать?', descriptionId: '18' },
  { topicSlug: 'fears-sounds', lessonTitle: 'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)', descriptionId: '31' },
  { topicSlug: 'fears-cars', lessonTitle: 'Приучаем постепенно к машине', descriptionId: '16' },
  { topicSlug: 'fears-new-places', lessonTitle: 'Страх лестницы и лифта', descriptionId: '17' },
  { topicSlug: 'fears-place-command', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'fears-follows-tail', lessonTitle: 'Ходит хвостиком + Как минимизировать тревожность?', descriptionId: '20' },
  { topicSlug: 'care-claws', lessonTitle: 'Когти: анатомия когтя и стрижка', descriptionId: '43' },
  { topicSlug: 'care-paws', lessonTitle: 'Лапы', descriptionId: '44' },
  { topicSlug: 'fitness-bow', lessonTitle: 'Поклон', descriptionId: '40' },
  { topicSlug: 'fitness-bunny', lessonTitle: 'Зайка', descriptionId: '58' },
  { topicSlug: 'fitness-house', lessonTitle: 'Домик', descriptionId: '59' },
  { topicSlug: 'fitness-wipe-muzzle', lessonTitle: 'Поставь лапки или "тач"', descriptionId: '54' },
  { topicSlug: 'fitness-spin', lessonTitle: 'Круть-верть', descriptionId: '55' },
  { topicSlug: 'fitness-left-right', lessonTitle: 'Влево-вправо', descriptionId: '60' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Как отучить тянуть поводок?', descriptionId: '22' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Ошейник или шлейка?', descriptionId: '21' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Поводок или рулетка?', descriptionId: '23' },
  { topicSlug: 'adult-large-leash', lessonTitle: '«Дорога» и «стоп»', descriptionId: '24' },
  { topicSlug: 'adult-large-food-pickup', lessonTitle: 'Импульс-контроль + Выдержка', descriptionId: '07' },
  { topicSlug: 'adult-large-food-pickup', lessonTitle: 'Намордник без драмы', descriptionId: '04' },
  { topicSlug: 'adult-large-recall', lessonTitle: 'Контакт', descriptionId: '08' },
  { topicSlug: 'adult-large-recall', lessonTitle: 'Ко мне', descriptionId: '09' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Упражнение против отвлечений (1-2-3)', descriptionId: '25' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Выдержка: не срываемся на всё подряд', descriptionId: '26' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Топ интересных игр на прогулке, или как наладить контакт', descriptionId: '27' },
  { topicSlug: 'adult-large-barking', lessonTitle: 'Команда «тише»', descriptionId: '36' },
  { topicSlug: 'adult-large-barking', lessonTitle: 'Приучаем к звукам: домофон и хлопки', descriptionId: '37' },
  { topicSlug: 'adult-large-loneliness', lessonTitle: 'Убираем страх и повышаем уверенность в себе', descriptionId: '15' },
  { topicSlug: 'adult-large-loneliness', lessonTitle: 'Правильная организация пространства', descriptionId: '02' },
  { topicSlug: 'adult-large-loneliness', lessonTitle: 'Учим постепенно оставаться одному', descriptionId: '62' },
  { topicSlug: 'adult-large-jumping-on-guests', lessonTitle: 'Правильный приход/выход из дома', descriptionId: '38' },
  { topicSlug: 'adult-large-jumping-on-guests', lessonTitle: 'Прыжки на гостей', descriptionId: '39' },
  { topicSlug: 'adult-large-begging', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'adult-large-begging', lessonTitle: 'Топ долгоиграющих лакомств и умных девайсов', descriptionId: '42' },
  { topicSlug: 'adult-large-begging', lessonTitle: 'Питание', descriptionId: '41' },
  { topicSlug: 'adult-large-toilet', lessonTitle: 'Приучение к улице + режим', descriptionId: '35' },
  { topicSlug: 'adult-large-toilet', lessonTitle: 'Метки дома', descriptionId: '35' },
  { topicSlug: 'adult-large-overaroused-play', lessonTitle: 'Перевозбуждается при игре', descriptionId: '03' },
  { topicSlug: 'adult-large-resource-guarding', lessonTitle: 'Охраняет вещи', descriptionId: '14' },
  { topicSlug: 'adult-large-barks-at-people', lessonTitle: 'Лает на людей или собак', descriptionId: '30' },
  { topicSlug: 'adult-large-neutering', lessonTitle: 'Кастрировать/стерилизовать или нет?', descriptionId: '18' },
  { topicSlug: 'adult-large-scooters-bikes', lessonTitle: 'Бросается на самокаты и велосипеды', descriptionId: '28' },
  { topicSlug: 'adult-large-place-space', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'adult-large-follows-tail', lessonTitle: 'Ходит хвостиком + Как минимизировать тревожность?', descriptionId: '20' },
  { topicSlug: 'adult-large-sounds', lessonTitle: 'Боязнь звуков', descriptionId: '31' },
  { topicSlug: 'adult-large-cars', lessonTitle: 'Приучаем постепенно к машине', descriptionId: '32' },
  { topicSlug: 'adult-large-new-places', lessonTitle: 'Страх лестницы и лифта', descriptionId: '33' },
  { topicSlug: 'adult-large-claws', lessonTitle: 'Когти', descriptionId: '63' },
  { topicSlug: 'adult-large-paws', lessonTitle: 'Лапы', descriptionId: '44' },
  { topicSlug: 'adult-large-eight', lessonTitle: 'Восемь', descriptionId: '45' },
  { topicSlug: 'adult-large-go-around', lessonTitle: 'Обойди', descriptionId: '46' },
  { topicSlug: 'adult-large-wipe-muzzle', lessonTitle: 'Вытри морду', descriptionId: '54' },
  { topicSlug: 'adult-large-bow', lessonTitle: 'Поклон', descriptionId: '47' },
];

function applyLocalLessonVideos(): void {
  const topics: Array<{ slug: LocalVideoTopicSlug; lessons: PuppyLessonItem[] }> = [
    ...puppySituations.flatMap((situation) => situation.topics),
    ...adultLargeSituations.flatMap((situation) => situation.topics),
  ];
  const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic]));

  localLessonMediaAssignments.forEach(({ topicSlug, lessonTitle, mediaId }) => {
    const topic = topicsBySlug.get(topicSlug);
    const lessonIndex = topic?.lessons.findIndex((lesson) => lesson.title === lessonTitle) ?? -1;
    const lesson = lessonIndex >= 0 ? topic?.lessons[lessonIndex] : undefined;

    if (!lesson) {
      throw new Error(`Local video target not found: ${topicSlug} / ${lessonTitle}`);
    }
    if (!(mediaId in localVideoCatalog.mediaFiles)) {
      throw new Error(`Unknown local media id: ${mediaId}`);
    }

    lesson.video = {
      id: lesson.video?.id ?? `${topicSlug}-${lessonIndex + 1}`,
      mediaId,
      sourceType: 'mp4',
    };
  });
}

function applyLessonDescriptions(): void {
  const topics: Array<{ slug: LocalVideoTopicSlug; lessons: PuppyLessonItem[] }> = [
    ...puppySituations.flatMap((situation) => situation.topics),
    ...adultLargeSituations.flatMap((situation) => situation.topics),
  ];
  const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic]));

  lessonDescriptionAssignments.forEach(({ topicSlug, lessonTitle, descriptionId }) => {
    const lesson = topicsBySlug
      .get(topicSlug)
      ?.lessons.find((candidate) => candidate.title === lessonTitle);

    if (!lesson) {
      throw new Error(`Lesson description target not found: ${topicSlug} / ${lessonTitle}`);
    }

    lesson.longDescription = getVideoDescription(descriptionId);
  });
}

applyLocalLessonVideos();
applyLessonDescriptions();


interface LessonVideoEntry {
  id: string;
  mediaId?: string;
  title: string;
  description?: string;
  sourceType: LessonVideoSource;
  backRoute: AppRoute;
  seasons?: readonly SeasonId[];
  coverPath?: string;
  summary?: string;
}

const lessonVideosById = new Map<string, LessonVideoEntry>();

function registerLessonVideo(lesson: PuppyLessonItem, backRoute: AppRoute): void {
  if (!lesson.video?.sourceType) {
    return;
  }

  if (lessonVideosById.has(lesson.video.id)) {
    throw new Error(`Duplicate lesson video id: ${lesson.video.id}`);
  }

  lessonVideosById.set(lesson.video.id, {
    id: lesson.video.id,
    mediaId: lesson.video.mediaId,
    title: lesson.title,
    description: lesson.longDescription,
    sourceType: lesson.video.sourceType,
    backRoute,
    coverPath: lesson.coverPath,
    summary: lesson.description,
  });
}

puppyTopics.forEach((topic) => {
  topic.lessons.forEach((lesson) => registerLessonVideo(lesson, `puppy-topic:${topic.slug}`));
});

adultLargeTopics.forEach((topic) => {
  topic.lessons.forEach((lesson) => registerLessonVideo(lesson, `adult-large-topic:${topic.slug}`));
});


const complexLevelVideos = [
  {
    id: 'complex-timed-beginner',
    mediaId: 'complex-timed-beginner',
    title: 'Комплекс: Начальный — На время',
    description: getVideoDescription('49'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:timed',
  },
  {
    id: 'complex-timed-intermediate',
    mediaId: 'complex-timed-intermediate',
    title: 'Комплекс: Средний — На время',
    description: getVideoDescription('51'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:timed',
  },
  {
    id: 'complex-timed-advanced',
    mediaId: 'complex-timed-advanced',
    title: 'Комплекс: Сложный — На время',
    description: getVideoDescription('53'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:timed',
  },
  {
    id: 'complex-self-check-beginner',
    mediaId: 'complex-self-check-beginner',
    title: 'Комплекс: Начальный — Проверь себя',
    description: getVideoDescription('48'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:self-check',
  },
  {
    id: 'complex-self-check-intermediate',
    mediaId: 'complex-self-check-intermediate',
    title: 'Комплекс: Средний — Проверь себя',
    description: getVideoDescription('50'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:self-check',
  },
  {
    id: 'complex-self-check-advanced',
    mediaId: 'complex-self-check-advanced',
    title: 'Комплекс: Сложный — Проверь себя',
    description: getVideoDescription('52'),
    sourceType: 'mp4',
    backRoute: 'complex-levels:self-check',
  },
] as const satisfies readonly LessonVideoEntry[];

complexLevelVideos.forEach((video) => {
  if (lessonVideosById.has(video.id)) {
    throw new Error(`Duplicate lesson video id: ${video.id}`);
  }

  lessonVideosById.set(video.id, { ...video });
});

seasonalVideos.forEach((video) => {
  if (lessonVideosById.has(video.id)) {
    throw new Error(`Duplicate seasonal lesson video id: ${video.id}`);
  }

  lessonVideosById.set(video.id, {
    id: video.id,
    mediaId: video.mediaId,
    title: video.title,
    description: video.description,
      summary: video.description.split(/[.!?\n]/u, 1)[0] ?? '',
    sourceType: 'hls',
    backRoute: 'seasonal',
    seasons: video.seasons,
  });
});

export type VideoLibraryCategory = 'commands' | 'tricks' | 'walks' | 'seasonal' | 'fitness';

export type VideoLibraryFilter = 'all' | VideoLibraryCategory;
export type VideoLibraryMode = 'wheel' | 'list';

export interface VideoLibraryState {
  category: VideoLibraryFilter;
  mode: VideoLibraryMode;
  query: string;
  searchOpen: boolean;
  activeId: string | null;
  transitionFromId: string | null;
  transitionRetainedIds: string[];
  transitionMode: 'none' | 'card' | 'jump';
}

export const initialVideoLibraryState: VideoLibraryState = {
  category: 'all',
  mode: 'wheel',
  query: '',
  searchOpen: false,
  activeId: null,
  transitionFromId: null,
  transitionRetainedIds: [],
  transitionMode: 'none',
};

export interface VideoLibraryItem {
  id: string;
  order: number;
  title: string;
  description: string;
  coverPath: string;
  durationLabel: string;
  mediaId?: string;
  sourceType?: 'hls' | 'mp4';
  category: VideoLibraryCategory | null;
  route: AppRoute;
  available: boolean;
  searchText: string;
}

const videoLibraryItems = createVideoLibraryItems();

export function getVideoLibraryItems(): readonly VideoLibraryItem[] {
  return videoLibraryItems;
}

function createVideoLibraryItems(): VideoLibraryItem[] {
  const itemsByMedia = new Map<string, VideoLibraryItem>();

  lessonVideosById.forEach((video) => {
    const sourceId = video.mediaId ?? video.id;
    const seasonal = Boolean(video.seasons?.length);
    const category = seasonal ? 'seasonal' : getVideoLibraryCategory(video);
    const coverPath = video.coverPath ?? `/media/${encodeURIComponent(sourceId)}/poster.webp`;
    const item: VideoLibraryItem = {
      id: video.id,
      order: itemsByMedia.size + 1,
      title: video.title,
      description: video.summary ?? video.description?.split(/\n/u, 1)[0] ?? '',
      coverPath,
      durationLabel: seasonalVideos.find((seasonalVideo) => seasonalVideo.id === video.id)?.duration ?? '',
      mediaId: sourceId,
      sourceType: video.sourceType,
      category,
      route: `lesson-video:${video.id}`,
      available: true,
      searchText: `${video.title} ${video.description ?? ''} ${getVideoLibraryCategoryLabel(category)}`.toLocaleLowerCase(),
    };

    const dedupeKey = `${video.sourceType}:${sourceId}`;
    if (!itemsByMedia.has(dedupeKey)) {
      itemsByMedia.set(dedupeKey, item);
    }
  });

  dogSkillsLessons.forEach((lesson) => {
    const item: VideoLibraryItem = {
      id: `dog-skills-${lesson.id}`,
      order: itemsByMedia.size + 1,
      title: lesson.title,
      description: lesson.cardDescription,
      coverPath: lesson.coverPath,
      durationLabel: '',
      category: 'tricks',
      route: `dog-skills-video:${lesson.id}`,
      available: Boolean(lesson.mediaId && lesson.sourceType),
      searchText: `${lesson.title} ${lesson.cardDescription} ${getVideoLibraryCategoryLabel('tricks')}`.toLocaleLowerCase(),
    };

    itemsByMedia.set(`unavailable:${lesson.id}`, item);
  });

  return [...itemsByMedia.values()];
}

function getVideoLibraryCategoryLabel(category: VideoLibraryCategory | null): string {
  switch (category) {
    case 'commands': return 'Команды';
    case 'tricks': return 'Трюки';
    case 'walks': return 'Прогулки';
    case 'seasonal': return 'Сезонное';
    case 'fitness': return 'Фитнес';
    default: return '';
  }
}

function getVideoLibraryCategory(video: LessonVideoEntry): VideoLibraryCategory | null {
  const routeSlug = video.backRoute.split(':').at(-1) ?? '';
  const puppyTopic = puppyTopicsBySlug.get(routeSlug as PuppyTopicSlug);
  const adultTopic = adultLargeTopicsBySlug.get(routeSlug as AdultLargeTopicSlug);
  const parentSlug = puppyTopic?.parentSlug ?? adultTopic?.parentSlug ?? '';
  const normalizedTitle = video.title.toLocaleLowerCase();

  if (parentSlug.includes('fitness') || routeSlug.startsWith('fitness-') || routeSlug.startsWith('adult-large-')) {
    return routeSlug.includes('fitness') || parentSlug.includes('fitness') ? 'fitness' : getTitleCategory(normalizedTitle);
  }

  if (routeSlug.includes('walk') || parentSlug.includes('walk')) {
    return 'walks';
  }

  return getTitleCategory(normalizedTitle);
}

function getTitleCategory(title: string): VideoLibraryCategory | null {
  if (/команд|ко мне|рядом|дай лап|стоп|сидеть|лежать|место/u.test(title)) {
    return 'commands';
  }

  if (/прогул|повод|улиц|гулять/u.test(title)) {
    return 'walks';
  }

  if (/трюк|напёрст|домик|зайка|поклон|круть/u.test(title)) {
    return 'tricks';
  }

  return null;
}

function getLessonVideoFromRoute(route: AppRoute): LessonVideoEntry | null {
  if (!route.startsWith('lesson-video:')) {
    return null;
  }

  return lessonVideosById.get(route.slice('lesson-video:'.length)) ?? null;
}

function getDogSkillsLessonFromRoute(route: AppRoute): DogSkillsLesson | null {
  if (!route.startsWith('dog-skills-video:')) {
    return null;
  }

  return getDogSkillsLesson(route.slice('dog-skills-video:'.length));
}

export function isDogSkillsLessonRoute(route: AppRoute): boolean {
  return getDogSkillsLessonFromRoute(route) !== null;
}

export function createAppMarkup(
  route: AppRoute,
  activeFilter: PuppyFilter,
  videosState: SituationVideosState,
  activeSeason: SeasonId = 'autumn',
  videoLibraryState: VideoLibraryState = initialVideoLibraryState,
): string {
  const lessonVideo = getLessonVideoFromRoute(route);
  const dogSkillsLesson = getDogSkillsLessonFromRoute(route);

  if (lessonVideo) {
    return createLessonPlayerMarkup(lessonVideo, activeSeason);
  }

  if (dogSkillsLesson) {
    return createLessonPlayerMarkup({
      id: `dog-skills-${dogSkillsLesson.id}`,
      mediaId: dogSkillsLesson.mediaId,
      title: dogSkillsLesson.title,
      description: dogSkillsLesson.description,
      sourceType: dogSkillsLesson.sourceType,
      backRoute: 'dog-skills',
      coverPath: dogSkillsLesson.coverPath,
      summary: dogSkillsLesson.cardDescription,
    }, activeSeason);
  }

  if (route === 'complex') {
    return createComplexMarkup();
  }

  if (route === 'seasonal') {
    return createSeasonalVideosMarkup(activeSeason);
  }

  if (route === 'video-library') {
    return createVideoLibraryMarkup(videoLibraryState);
  }

  if (route.startsWith('seasonal-list:')) {
    const seasonalListRoute = getSeasonalListRoute(route);

    if (seasonalListRoute) {
      return createSeasonalVideoListMarkup(seasonalListRoute.season, seasonalListRoute.section);
    }
  }

  if (route === 'dog-skills') {
    return createDogSkillsMarkup();
  }

  if (route === 'fitness') {
    return createFitnessMarkup();
  }

  if (route === 'puppy-fitness') {
    return createSituationTopicsMarkup('fitness');
  }

  if (route === 'complex-levels:timed') {
    return createComplexLevelsMarkup('timed');
  }

  if (route === 'complex-levels:self-check') {
    return createComplexLevelsMarkup('self-check');
  }


  if (route === 'adult-large') {
    return createAdultLargeMarkup();
  }

  if (route === 'puppies') {
    return createPuppiesMarkup(activeFilter);
  }

  if (route.startsWith('adult-large-situation:')) {
    const slug = getAdultLargeSituationSlugFromRoute(route);

    if (slug) {
      return createAdultLargeSituationTopicsMarkup(slug);
    }
  }

  if (route.startsWith('adult-large-topic:')) {
    const slug = getAdultLargeTopicSlugFromRoute(route);

    if (slug) {
      return createAdultLargeTopicLessonsMarkup(slug);
    }
  }


  if (route.startsWith('puppy-situation:')) {
    const slug = getSituationSlugFromRoute(route);

    if (slug) {
      return createSituationTopicsMarkup(slug);
    }
  }

  if (route.startsWith('puppy-topic:')) {
    const slug = getTopicSlugFromRoute(route);

    if (slug) {
      return createTopicLessonsMarkup(slug, videosState);
    }
  }

  return createHomeMarkup();
}

const APP_ICON_ASSET_PATHS = [
  '/assets/nav-home.svg',
  '/assets/nav-lessons.svg',
  '/assets/nav-chat.svg',
  '/assets/nav-user.svg',
  '/assets/useful-heart.svg',
  '/assets/useful-home.svg',
  '/assets/useful-leash.svg',
  '/assets/useful-warning.svg',
  '/assets/icons/agress_puppy.webp',
  '/assets/icons/alarm.webp',
  '/assets/icons/arrow-right.svg',
  '/assets/icons/ask_kinolog.webp',
  '/assets/icons/back_puppy.webp',
  '/assets/icons/big_agress.webp',
  '/assets/icons/big_bark.webp',
  '/assets/icons/big_bath.webp',
  '/assets/icons/big_car.webp',
  '/assets/icons/big_fear.webp',
  '/assets/icons/big_fitness.webp',
  '/assets/icons/big_grum.webp',
  '/assets/icons/big_headphones.webp',
  '/assets/icons/big_hvost.webp',
  '/assets/icons/big_ignor.webp',
  '/assets/icons/big_jump.webp',
  '/assets/icons/big_kogot.webp',
  '/assets/icons/big_kreslo.webp',
  '/assets/icons/big_lai.webp',
  '/assets/icons/big_lapananose.webp',
  '/assets/icons/big_lapi.webp',
  '/assets/icons/big_lift.webp',
  '/assets/icons/big_oboidi.webp',
  '/assets/icons/big_ohran.webp',
  '/assets/icons/big_please.webp',
  '/assets/icons/big_podbor_edi.webp',
  '/assets/icons/big_podziv.webp',
  '/assets/icons/big_poklon.webp',
  '/assets/icons/big_prig.webp',
  '/assets/icons/big_sidit.webp',
  '/assets/icons/big_toilet.webp',
  '/assets/icons/big_velo.webp',
  '/assets/icons/big_vosem.webp',
  '/assets/icons/big_vozbud.webp',
  '/assets/icons/bunny_puppy.webp',
  '/assets/icons/car_puppy.webp',
  '/assets/icons/clock.svg',
  '/assets/icons/comp_big_check.webp',
  '/assets/icons/comp_big_time.webp',
  '/assets/icons/comp_lil_check.webp',
  '/assets/icons/comp_lil_time.webp',
  '/assets/icons/comp_middle_check.webp',
  '/assets/icons/comp_middle_time.webp',
  '/assets/icons/course.webp',
  '/assets/icons/earphones_puppy.webp',
  '/assets/icons/fitness.webp',
  '/assets/icons/gantel.webp',
  '/assets/icons/hair_puppy.webp',
  '/assets/icons/home_puppy.webp',
  '/assets/icons/home.webp',
  '/assets/icons/jump_puppy.webp',
  '/assets/icons/krutvert_puppy.webp',
  '/assets/icons/kus_puppy.webp',
  '/assets/icons/lai_puppy.webp',
  '/assets/icons/lapa__puppy.webp',
  '/assets/icons/lay_puppy.webp',
  '/assets/icons/leash.webp',
  '/assets/icons/levopravo_puppy.webp',
  '/assets/icons/lightbulb.svg',
  '/assets/icons/lonely_puppy.webp',
  '/assets/icons/message.svg',
  '/assets/icons/nails_puppy.webp',
  '/assets/icons/ohrana_puppy.webp',
  '/assets/icons/order_puppy.webp',
  '/assets/icons/paperclip.svg',
  '/assets/icons/please_puppy.webp',
  '/assets/icons/podbor_puppy.webp',
  '/assets/icons/poklon__puppy.webp.webp',
  '/assets/icons/polzi_puppy.webp.webp',
  '/assets/icons/povodok.webp',
  '/assets/icons/puppy_hand.webp',
  '/assets/icons/puppy-podziv.webp',
  '/assets/icons/razdrazh_puppy.webp',
  '/assets/icons/ruletka.webp',
  '/assets/icons/sad_puppy.webp',
  '/assets/icons/video-library-shuffle.svg',
  '/assets/icons/search-library.webp',
  '/assets/icons/seasons.webp',
  '/assets/icons/stair_puppy.webp',
  '/assets/icons/tail_puppy.webp',
  '/assets/icons/tap_puppy.webp',
  '/assets/icons/thought_puppy.webp',
  '/assets/icons/toilet_puppy.webp',
  '/assets/icons/vandal_puppy.webp',
  '/assets/icons/voprox_puppy.webp',
];

const APP_EMOJI_ASSET_PATHS = [
  '/assets/emoji/bed.svg',
  '/assets/emoji/bone.svg',
  '/assets/emoji/bowl-with-spoon.svg',
  '/assets/emoji/check-mark-button.svg',
  '/assets/emoji/cross-mark.svg',
  '/assets/emoji/dog-face.svg',
  '/assets/emoji/dog.svg',
  '/assets/emoji/door.svg',
  '/assets/emoji/eyes.svg',
  '/assets/emoji/grinning-face-sweat.svg',
  '/assets/emoji/heart-suit.svg',
  '/assets/emoji/herb.svg',
  '/assets/emoji/house.svg',
  '/assets/emoji/key.svg',
  '/assets/emoji/light-bulb.svg',
  '/assets/emoji/man-running.svg',
  '/assets/emoji/paws.svg',
  '/assets/emoji/poodle.svg',
  '/assets/emoji/puzzle-piece.svg',
  '/assets/emoji/raised-back-of-hand.svg',
  '/assets/emoji/sleeping-face.svg',
  '/assets/emoji/small-blue-diamond.svg',
  '/assets/emoji/smiling-face.svg',
  '/assets/emoji/speech-balloon.svg',
  '/assets/emoji/thinking-face.svg',
  '/assets/emoji/walking.svg',
  '/assets/emoji/warning.svg',
  '/assets/emoji/white-heart.svg',
].map(getEmojiAssetUrl);

export function getAllAppAssetPaths(): string[] {
  const paths = [
    '/assets/logo-dog.svg',
    '/assets/hero-dog.webp',
    '/assets/nav-home.svg',
    '/assets/nav-lessons.svg',
    '/assets/nav-chat.svg',
    '/assets/feedback/feedback-main.svg',
    '/assets/feedback/feedback-sent.svg',
    '/assets/icons/ask_kinolog.webp',
    '/assets/icons/paperclip.svg',
    '/assets/icons/clock.svg',
    '/assets/icons/message.svg',
    '/assets/icons/lightbulb.svg',
    '/assets/icons/arrow-right.svg',
    '/assets/icons/gantel.webp',
    '/assets/icons/seasons.webp',
    '/assets/icons/course.webp',
    '/assets/images/programs/puppy.webp',
    '/assets/images/programs/teen_dog.webp',
    '/assets/images/programs/adult_dog.webp',
    '/assets/images/programs/shelter_dog.webp',
    '/assets/images/programs/dog-skills.webp',
    '/assets/images/programs/puppy-hero.webp',
    '/assets/images/programs/fitness-hero.webp',
    '/assets/icons/comp_lil_time.webp',
    '/assets/icons/comp_middle_time.webp',
    '/assets/icons/comp_big_time.webp',
    '/assets/icons/comp_lil_check.webp',
    '/assets/icons/comp_middle_check.webp',
    '/assets/icons/comp_big_check.webp',
  ].map(resolveCardImagePath);

  paths.push(...APP_ICON_ASSET_PATHS);
  paths.push(...APP_EMOJI_ASSET_PATHS);
  paths.push(...seasonThemes.flatMap(({ heroImagePath, iconImagePath }) => [
    heroImagePath,
    iconImagePath,
  ]));
  paths.push('/assets/images/seasons/walks-icon.webp');

  [...puppySituations, ...adultLargeSituations].forEach((situation) => {
    paths.push(resolveCardImagePath(situation.imagePath));

    situation.topics.forEach((topic) => {
      paths.push(resolveCardImagePath(topic.imagePath));

      topic.lessons.forEach((lesson) => {
        if (lesson.coverPath) {
          paths.push(resolveCardImagePath(lesson.coverPath));
        }
      });
    });
  });

  dogSkillsLessons.forEach((lesson) => {
    paths.push(resolveCardImagePath(lesson.coverPath));
  });

  return [...new Set(paths)];
}

export function getSeasonalListRoute(
  route: AppRoute,
): { season: SeasonId; section: SeasonalSection } | null {
  if (!route.startsWith('seasonal-list:')) {
    return null;
  }

  const [, season, section] = route.split(':');

  if (!season || !section || !isSeasonId(season) || !isSeasonalSection(section)) {
    return null;
  }

  return { season, section };
}

export function getSituationSlugFromRoute(route: AppRoute): PuppySituationSlug | null {
  if (!route.startsWith('puppy-situation:')) {
    return null;
  }

  return route.replace('puppy-situation:', '') as PuppySituationSlug;
}

export function getTopicSlugFromRoute(route: AppRoute): PuppyTopicSlug | null {
  if (!route.startsWith('puppy-topic:')) {
    return null;
  }

  return route.replace('puppy-topic:', '') as PuppyTopicSlug;
}

export function getAdultLargeSituationSlugFromRoute(route: AppRoute): AdultLargeSituationSlug | null {
  if (!route.startsWith('adult-large-situation:')) {
    return null;
  }

  return route.replace('adult-large-situation:', '') as AdultLargeSituationSlug;
}

export function getAdultLargeTopicSlugFromRoute(route: AppRoute): AdultLargeTopicSlug | null {
  if (!route.startsWith('adult-large-topic:')) {
    return null;
  }

  return route.replace('adult-large-topic:', '') as AdultLargeTopicSlug;
}

export function getVideoSourceSlugForRoute(route: AppRoute): SituationSlug | null {
  const topicSlug = getTopicSlugFromRoute(route);

  if (!topicSlug) {
    return null;
  }

  return puppyTopicsBySlug.get(topicSlug)?.videoSourceSlug ?? null;
}

function createHomeMarkup(): string {
  return `
    <div class="app-shell">
      <header class="home-header">
        <div class="content-frame content-frame--header">
          <button
            class="brand-mark"
            type="button"
            aria-label="На главную"
            data-route="home"
          >
            <img src="/assets/logo-dog.svg" alt="" />
          </button>

          <h1 class="brand-title">Высшая школа собак</h1>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="hero-card" aria-labelledby="hero-title">
            <div class="hero-card__content">
              <h2 id="hero-title">Добро пожаловать!</h2>
              <p class="hero-card__description">
                Мы помогаем вам и вашей собаке понимать друг друга и быть одной командой
              </p>

              <button class="hero-card__cta" type="button" data-welcome-video-open>
                <span class="hero-card__cta-icon" aria-hidden="true"></span>
                <span>Смотреть видео</span>
              </button>
            </div>

            <div class="hero-card__media">
              <img
                class="hero-card__dog"
                src="/assets/hero-dog.webp"
                width="204"
                height="282"
                alt=""
                aria-hidden="true"
              />
            </div>
          </section>

          <section class="section-block" aria-labelledby="useful-title">
            <div class="section-heading">
              <h2 id="useful-title">Полезное</h2>
              <button
                class="section-link"
                type="button"
                data-route="video-library"
              >
                <span>Смотреть всё</span>
                <span class="section-link__arrow" aria-hidden="true"></span>
              </button>
            </div>

            <div class="useful-grid" role="list" aria-label="Полезные материалы">
              ${createUsefulCard('Спросить у кинолога', '/assets/icons/ask_kinolog.webp', 'useful-card--ask', undefined, 'home')}
              ${createUsefulCard('Сезонные темы', '/assets/icons/seasons.webp', 'useful-card--seasonal', 'seasonal')}
              ${createUsefulCard('Комплекс', '/assets/icons/course.webp', 'useful-card--course', 'complex')}
              ${createUsefulCard(
                'Фитнес',
                '/assets/icons/gantel.webp',
                'useful-card--fitness',
                'fitness',
              )}
            </div>
          </section>

          ${createWelcomeVideoModalMarkup()}

          <section class="section-block" aria-labelledby="programs-title">
            <div class="section-heading">
              <h2 id="programs-title">Программы</h2>
            </div>

            <div class="program-grid">
              ${createProgramCard(
                'Щенки',
                'Щенки',
                'Первые шаги к послушной и уверенной собаке',
                '/assets/images/programs/puppy.webp',
                'program-card--blue',
                { route: 'puppies' },
              )}
              ${createProgramCard(
                'Подростки',
                'Подростки',
                'Курс для собак подросткового возраста',
                '/assets/images/programs/teen_dog.webp',
                'program-card--rose',
                { feedback: 'Раздел "Подростки" пока в разработке' },
              )}
              ${createProgramCard(
                'Взрослые',
                'Взрослые',
                'Дрессировка и коррекция поведения',
                '/assets/images/programs/adult_dog.webp',
                'program-card--red',
                { route: 'adult-large' },
              )}
              ${createProgramCard(
                'Собаки из приюта',
                'Собаки<br />из приюта',
                'Помогаем начать новую жизнь вместе',
                '/assets/images/programs/shelter_dog.webp',
                'program-card--rose',
                { feedback: 'Раздел "Собаки из приюта" пока в разработке' },
              )}
              ${createProgramCard(
                'Пёс умеет',
                'Пёс умеет',
                'Команды, трюки и полезные навыки',
                '/assets/images/programs/dog-skills.webp',
                'program-card--skills',
                { route: 'dog-skills' },
              )}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('home')}
    </div>
  `;
}

function createWelcomeVideoModalMarkup(): string {
  return `
    <div class="welcome-video-modal" data-welcome-video-modal aria-hidden="true">
      <button class="welcome-video-modal__backdrop" type="button" data-welcome-video-backdrop aria-label="Закрыть приветственное видео"></button>
      <section class="welcome-video-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="welcome-video-title" aria-describedby="welcome-video-subtitle">
        <header class="welcome-video-modal__header">
          <div class="welcome-video-modal__heading">
            <h2 id="welcome-video-title">Знакомство со школой</h2>
            <p id="welcome-video-subtitle">Узнайте, как устроено наше обучение</p>
          </div>
          <button class="welcome-video-modal__close" type="button" data-welcome-video-close aria-label="Закрыть">
            <span aria-hidden="true"></span>
          </button>
        </header>
        <div class="welcome-video-modal__video" role="status">
          <div class="welcome-video-modal__unavailable">
            <p>Приветственное видео пока недоступно</p>
          </div>
        </div>
        <button class="welcome-video-modal__lessons" type="button" data-welcome-video-close>
          <span>Перейти к урокам</span>
          <span class="welcome-video-modal__arrow" aria-hidden="true"></span>
        </button>
      </section>
    </div>
  `;
}

function createSubpageHeaderMarkup(title: string, backRoute: AppRoute, headerActionMarkup = ''): string {
  return `
    <header class="subpage-header">
      <div class="content-frame">
        <div class="subpage-header__inner subpage-header__inner--branded">
          <button class="subpage-header__logo-button" type="button" data-route="home" aria-label="На главную">
            <img class="subpage-header__logo" src="/assets/logo-dog.svg" alt="" aria-hidden="true" />
          </button>
          <h1 class="subpage-title">${escapeHtml(title)}</h1>
          ${headerActionMarkup
            ? `<span class="subpage-header__actions">${headerActionMarkup}<button class="back-button" type="button" data-route="${escapeHtml(backRoute)}" aria-label="Назад"><span class="back-button__icon" aria-hidden="true"></span></button></span>`
            : `<button class="back-button" type="button" data-route="${escapeHtml(backRoute)}" aria-label="Назад"><span class="back-button__icon" aria-hidden="true"></span></button>`}
        </div>
      </div>
    </header>
  `;
}

const videoLibraryCategories: readonly { id: VideoLibraryFilter; label: string }[] = [
  { id: 'all', label: 'Все видео' },
  { id: 'commands', label: 'Команды' },
  { id: 'tricks', label: 'Трюки' },
  { id: 'walks', label: 'Прогулки' },
  { id: 'seasonal', label: 'Сезонное' },
  { id: 'fitness', label: 'Фитнес' },
];

function createVideoLibraryMarkup(state: VideoLibraryState): string {
  const allVideos = getVideoLibraryItems();
  const directionCount = new Set(allVideos.map((video) => video.category ?? 'uncategorized')).size;
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = allVideos.filter((video) =>
    (state.category === 'all' || video.category === state.category) &&
    (!query || video.searchText.includes(query)),
  );
  const hasAvailableVideos = filtered.some((video) => video.available);
  const activeIndex = Math.max(0, filtered.findIndex((video) => video.id === state.activeId));
  const progressCurrent = filtered.length > 0 ? activeIndex + 1 : 0;
  const progressPercent = filtered.length > 1
    ? (activeIndex / (filtered.length - 1)) * 100
    : filtered.length === 1 ? 100 : 0;
  const transitionFromIndex = state.transitionMode === 'card' && state.transitionFromId
    ? filtered.findIndex((video) => video.id === state.transitionFromId)
    : -1;
  const visibleIndexes = new Set<number>();
  for (const centerIndex of [activeIndex, transitionFromIndex]) {
    if (centerIndex < 0) continue;
    for (let offset = -2; offset <= 2; offset += 1) {
      const index = centerIndex + offset;
      if (index >= 0 && index < filtered.length) visibleIndexes.add(index);
    }
  }
  if (state.transitionMode === 'card') {
    for (const id of state.transitionRetainedIds) {
      const index = filtered.findIndex((video) => video.id === id);
      if (index >= 0) visibleIndexes.add(index);
    }
  }
  const visibleVideos = filtered
    .map((video, index) => ({ video, index, offset: index - activeIndex }))
    .filter(({ index }) => visibleIndexes.has(index))
    .sort((a, b) => Number(Math.abs(b.offset) > 2) - Number(Math.abs(a.offset) > 2) ||
      Number(a.offset === 0) - Number(b.offset === 0));
  const categoryMarkup = videoLibraryCategories.map((category) => {
    const count = category.id === 'all'
      ? getVideoLibraryItems().length
      : getVideoLibraryItems().filter((video) => video.category === category.id).length;
    return `
      <button class="video-library__category${state.category === category.id ? ' is-active' : ''}"
        type="button" data-library-category="${category.id}" aria-pressed="${state.category === category.id}">
        <span>${category.label}</span><span class="video-library__category-count">${count}</span>
      </button>
    `;
  }).join('');
  const carouselMarkup = filtered.length === 0
    ? `<div class="video-library__empty" role="status"><h2>${query ? 'Ничего не найдено' : 'Здесь скоро появятся видео!'}</h2><p>${query ? 'Измените запрос или выберите другую категорию.' : 'Мы готовим новые материалы для этой категории.'}</p>${query ? '<button type="button" data-library-reset>Сбросить фильтры</button>' : ''}</div>`
    : state.mode === 'wheel'
      ? `
        <div class="video-library__carousel-stage">
          <div class="video-library__carousel-viewport">
            <div class="video-library__wheel" data-library-wheel aria-label="Карусель видео" tabindex="0">
              ${visibleVideos.map(({ video, index, offset }) => createVideoLibraryWheelCard(video, index, offset, state.transitionMode, state.transitionFromId)).join('')}
            </div>
          </div>
        </div>

      `
      : `<div class="video-library__list">${filtered.map((video) => createVideoLibraryListCard(video)).join('')}</div>`;
  const carouselProgressMarkup = state.mode === 'wheel'
    ? `
        <div class="video-library__carousel-progress">
          <div class="video-library__position" aria-live="polite">
            <span>${String(progressCurrent).padStart(2, '0')}</span><span aria-hidden="true">/</span><span>${String(filtered.length).padStart(2, '0')}</span>
          </div>
          <div class="video-library__progress-track" role="progressbar" aria-label="Положение в подборке" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progressPercent)}" aria-valuetext="${progressCurrent} из ${filtered.length} видео">
            <span class="video-library__progress-fill" data-library-progress-fill style="width:${progressPercent.toFixed(2)}%"></span>
          </div>
        </div>
      `
    : '';

  return `
    <div class="app-shell app-shell--video-library">
      ${createSubpageHeaderMarkup(
        'Видеотека',
        'home',
        `<button type="button" class="video-library__header-search" data-library-search-toggle aria-label="Поиск видео" aria-expanded="${state.searchOpen}"><img class="video-library__search-icon" src="/assets/icons/search-library.webp" alt="" /></button>`,
      )}
      <main class="screen-content video-library-screen">
        <div class="content-frame video-library-frame">
          ${state.searchOpen || state.query ? `
            <label class="video-library__search">
              <img class="video-library__search-icon" src="/assets/icons/search-library.webp" alt="" />
              <input type="search" data-library-search value="${escapeHtml(state.query)}" placeholder="Найти видео..." aria-label="Найти видео" />
              ${state.query ? '<button type="button" data-library-clear-search aria-label="Очистить поиск">×</button>' : ''}
            </label>
          ` : ''}
          <div class="video-library__toolbar">
            <div class="video-library__toolbar-copy">
              <h2 class="video-library__toolbar-title">Видео для вас</h2>
              <p class="video-library__toolbar-statistics">${allVideos.length} видео <span aria-hidden="true">·</span> ${directionCount} направлений</p>
            </div>
            <div class="video-library__toolbar-actions">
              <div class="video-library__view-switch" role="group" aria-label="Режим просмотра">
                <button type="button" data-library-mode="wheel" aria-label="Режим карусели" aria-pressed="${state.mode === 'wheel'}">◉</button>
                <button type="button" data-library-mode="list" aria-label="Режим списка" aria-pressed="${state.mode === 'list'}">☷</button>
              </div>
            </div>
          </div>
        <div class="video-library__carousel-content${state.mode === 'wheel' ? ' video-library__carousel-content--wheel' : ''}" style="view-transition-name:${state.transitionMode === 'jump' ? 'video-library-carousel' : 'none'}">
            ${carouselMarkup}
          </div>
          ${carouselProgressMarkup}
          <div class="video-library__categories-heading"><h2>Выберите категорию</h2></div>
          <div class="video-library__categories" data-library-categories role="group" aria-label="Категории видео"><span class="video-library__category-indicator" data-library-category-indicator aria-hidden="true"></span>${categoryMarkup}</div>
          <button
            class="video-library__surprise"
            type="button"
            data-library-surprise${hasAvailableVideos ? '' : ' disabled'}
            aria-disabled="${!hasAvailableVideos}"
            aria-label="Удиви меня! Найдём случайное видео для вас и питомца"
          >
            <span class="video-library__surprise-copy">
              <span class="video-library__surprise-title">Удиви меня!</span>
              <span class="video-library__surprise-description">Найдём случайное видео для вас и питомца</span>
            </span>
            <img
              class="video-library__surprise-icon"
              src="/assets/icons/video-library-shuffle.svg"
              alt=""
              aria-hidden="true"
            />
          </button>        </div>
      </main>
      ${createBottomNav('lessons')}
    </div>
  `;
}

function createVideoLibraryWheelCard(
  video: VideoLibraryItem,
  index: number,
  offset: number,
  transitionMode: VideoLibraryState['transitionMode'],
  transitionFromId: VideoLibraryState['transitionFromId'],
): string {
  const active = offset === 0;
  const outsideCarouselWindow = Math.abs(offset) > 2;
  const visibleOffset = Math.max(-2, Math.min(2, offset));
  const depth = Math.abs(visibleOffset);
  const scale = depth === 0 ? 1 : depth === 1 ? 0.86 : Math.max(0.58, 1 - depth * 0.14);
  const opacity = outsideCarouselWindow ? 0 : depth === 0 ? 1 : depth === 1 ? 0.8 : 0.52;
  const rotation = visibleOffset < 0 ? 7 : visibleOffset > 0 ? -7 : 0;
  const horizontalPosition = visibleOffset === 0
    ? '-50%'
    : `calc(-50% ${visibleOffset < 0 ? '-' : '+'} ${Math.abs(visibleOffset) * 82}%)`;
  const style = `--wheel-offset:${visibleOffset};--wheel-depth:${depth};--wheel-position-x:${horizontalPosition};--wheel-scale:${scale};--wheel-opacity:${opacity};--wheel-rotate:${rotation}deg`;
  const transitionName = transitionMode === 'jump'
    ? 'none'
    : `video-library-card-${video.id.replace(/[^A-Za-z0-9_-]/gu, '-')}`;
  const transitionLayerClass = transitionMode === 'card'
    ? active
      ? ' is-transition-promoting'
      : video.id === transitionFromId
        ? ' is-transition-demoting'
        : ''
    : '';
  return `
    <button class="video-library-card${active ? ' is-active' : ''}${video.available ? '' : ' is-unavailable'}${outsideCarouselWindow ? ' is-transition-exiting' : ''}${transitionLayerClass}"
      type="button" data-library-card data-library-index="${index}" data-route="${active ? video.route : ''}"
      data-library-id="${escapeHtml(video.id)}"
      data-library-offset="${visibleOffset}" data-media-id="${escapeHtml(video.mediaId ?? '')}"
      data-media-source="${video.sourceType ?? ''}"
      style="${style};view-transition-name:${transitionName}" aria-label="${active ? (video.available ? 'Открыть видео: ' : 'Посмотреть информацию: ') : 'Перейти к видео: '}${escapeHtml(video.title)}"
      aria-current="${active ? 'true' : 'false'}" aria-hidden="${outsideCarouselWindow}" tabindex="${active ? '0' : '-1'}"${outsideCarouselWindow ? ' disabled' : ''}>
      <span class="video-library-card__cover">
        <img src="${escapeHtml(video.coverPath)}" alt="" loading="${Math.abs(offset) === 0 ? 'eager' : 'lazy'}" />
        ${video.available && active ? `<span class="video-library-card__play" aria-hidden="true">${createPlayIconMarkup('video-library-card__play-icon')}</span>` : ''}
        ${video.available ? `<span class="video-library-card__duration" data-library-duration${video.durationLabel ? '' : ' hidden'}>${escapeHtml(video.durationLabel)}</span>` : ''}
      </span>
      <span class="video-library-card__body"><strong>${escapeHtml(video.title)}</strong><span>${escapeHtml(video.description)}</span></span>
    </button>
  `;
}

function createVideoLibraryListCard(video: VideoLibraryItem): string {
  return `
    <button class="video-library-list-card${video.available ? '' : ' is-unavailable'}" type="button" data-route="${video.route}">
      <span class="video-library-list-card__cover"><img src="${escapeHtml(video.coverPath)}" alt="" loading="lazy" />${video.available ? '' : '<span>Скоро</span>'}</span>
      <span class="video-library-list-card__copy"><strong>${escapeHtml(video.title)}</strong><span>${escapeHtml(video.description)}</span></span>
      <span class="video-library-list-card__arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function createSeasonalVideosMarkup(activeSeason: SeasonId): string {
  const theme = getSeasonTheme(activeSeason);
  const videos = getSeasonalVideos(activeSeason);
  const hasVideos = videos.length > 0;

  return `
    <div class="app-shell app-shell--seasonal" data-season-theme="${theme.id}">
      ${createSubpageHeaderMarkup('Сезонные видео', 'home')}

      <main class="screen-content seasonal-screen">
        <div class="content-frame">
          ${createSeasonHeroMarkup(theme)}
          ${createSeasonSwitcherMarkup(activeSeason)}
          <div class="seasonal-content" data-seasonal-content>
            ${hasVideos
              ? seasonalSectionDefinitions
                  .map((section) => createSeasonalSectionMarkup(activeSeason, section.id, section.title))
                  .join('')
              : createSeasonalEmptyStateMarkup(theme.label)}
          </div>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createSeasonHeroMarkup(theme: ReturnType<typeof getSeasonTheme>): string {
  return `
    <section class="seasonal-hero" aria-labelledby="seasonal-hero-title">
      <div class="seasonal-hero__clip">
        <span class="seasonal-hero__visual" aria-hidden="true">
          <img
            class="seasonal-hero__image"
            src="${escapeHtml(theme.heroImagePath)}"
            width="1440"
            height="600"
            alt=""
            aria-hidden="true"
          />
        </span>
        <span class="seasonal-hero__veil" aria-hidden="true"></span>
        <div class="seasonal-hero__content">
          <h2 id="seasonal-hero-title">${escapeHtml(theme.heroTitle)}</h2>
          <p>${escapeHtml(theme.heroDescription)}</p>
          <button class="seasonal-hero__cta" type="button" data-seasonal-cta>
            <span>Смотреть подборку</span>
            ${createArrowIconMarkup('seasonal-hero__cta-icon')}
          </button>
        </div>
      </div>
    </section>
  `;
}

function createSeasonSwitcherMarkup(activeSeason: SeasonId): string {
  return `
    <div class="season-switcher" role="group" aria-label="Выберите сезон">
      ${seasonThemes
        .map((season) => {
          const activeClass = season.id === activeSeason ? ' season-switcher__button--active' : '';

          return `
            <button
              class="season-switcher__button${activeClass}"
              type="button"
              data-season="${season.id}"
              aria-pressed="${season.id === activeSeason}"
            >
              <img
                class="season-switcher__icon"
                src="${escapeHtml(season.iconImagePath)}"
                width="90"
                height="90"
                alt=""
                aria-hidden="true"
              />
              <span>${escapeHtml(season.label)}</span>
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

function createSeasonalSectionMarkup(
  season: SeasonId,
  section: SeasonalSection,
  title: string,
): string {
  const videos = getSeasonalVideos(season, section);

  if (videos.length === 0) {
    return '';
  }

  const listRoute: AppRoute = `seasonal-list:${season}:${section}`;

  return `
    <section class="seasonal-section" aria-labelledby="seasonal-${section}-title">
      <div class="seasonal-section__heading">
        <h2 id="seasonal-${section}-title">
          ${createSeasonalSectionIconMarkup(section)}
          <span>${escapeHtml(title)}</span>
        </h2>
        <button class="seasonal-section__link" type="button" data-route="${listRoute}">
          <span>Все видео</span>
          ${createArrowIconMarkup('seasonal-section__link-icon')}
        </button>
      </div>
      <div class="seasonal-bento">
        ${videos
          .map((video, index) => createSeasonalVideoCardMarkup(video, index === 0 ? 'featured' : 'compact'))
          .join('')}
      </div>
    </section>
  `;
}

function createSeasonalVideoCardMarkup(
  video: SeasonalVideo,
  variant: 'featured' | 'compact' | 'list',
): string {
  const route: AppRoute = `lesson-video:${video.id}`;
  const variantClass = `seasonal-video-card--${variant}`;
  const posterPath = `/media/${encodeURIComponent(video.mediaId)}/poster.webp`;
  const featuredOverlayMarkup = variant === 'featured'
    ? `
        <span class="seasonal-video-card__poster-fallback" aria-hidden="true">
          ${createPlayIconMarkup('seasonal-video-card__fallback-icon')}
        </span>
        <span class="seasonal-video-card__shade" aria-hidden="true"></span>
        <span class="seasonal-video-card__category">${escapeHtml(video.category)}</span>
        <span class="seasonal-video-card__play" aria-hidden="true">
          ${createPlayIconMarkup('seasonal-video-card__play-icon')}
        </span>
      `
    : '';
  const listArrowMarkup = variant === 'list'
    ? `<span class="seasonal-video-card__arrow" aria-hidden="true">${createArrowIconMarkup('seasonal-video-card__arrow-icon')}</span>`
    : '';

  return `
    <button
      class="seasonal-video-card ${variantClass}"
      type="button"
      data-route="${route}"
      aria-label="Смотреть видео: ${escapeHtml(video.title)}"
    >
      <span class="seasonal-video-card__media">
        <img
          class="seasonal-video-card__poster-backdrop"
          src="${posterPath}"
          alt=""
          aria-hidden="true"
          data-seasonal-backdrop
        />
        <img
          class="seasonal-video-card__poster"
          src="${posterPath}"
          alt=""
          data-seasonal-poster
        />
        ${featuredOverlayMarkup}
        <span class="seasonal-video-card__duration">${escapeHtml(video.duration)}</span>
      </span>
      <span class="seasonal-video-card__body">
        <strong class="seasonal-video-card__title">${escapeHtml(video.title)}</strong>
        ${listArrowMarkup}
      </span>
    </button>
  `;
}

function createSeasonalVideoListMarkup(season: SeasonId, section: SeasonalSection): string {
  const theme = getSeasonTheme(season);
  const sectionDefinition = seasonalSectionDefinitions.find((candidate) => candidate.id === section);
  const videos = getSeasonalVideos(season, section);
  const title = `${sectionDefinition?.title ?? 'Видео'} · ${theme.label}`;

  return `
    <div class="app-shell app-shell--seasonal" data-season-theme="${theme.id}">
      ${createSubpageHeaderMarkup(title, 'seasonal')}

      <main class="screen-content seasonal-list-screen">
        <div class="content-frame">
          <section class="seasonal-list" aria-labelledby="seasonal-list-title">
            <div class="seasonal-list__content">
              <div class="seasonal-list__heading">
                ${createSeasonalSectionIconMarkup(section)}
                <div>
                  <p>${escapeHtml(theme.label)}</p>
                  <h2 id="seasonal-list-title">${escapeHtml(sectionDefinition?.title ?? 'Видео')}</h2>
                </div>
              </div>
              ${videos.length > 0
                ? `<div class="seasonal-video-list">${videos
                    .map((video) => createSeasonalVideoCardMarkup(video, 'list'))
                    .join('')}</div>`
                : createSeasonalEmptyStateMarkup(theme.label)}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createSeasonalEmptyStateMarkup(seasonLabel: string): string {
  return `
    <section class="seasonal-empty" aria-labelledby="seasonal-empty-title">
      <h2 id="seasonal-empty-title">Здесь скоро появятся новые видео!</h2>
      <p>Мы готовим полезные материалы для сезона «${escapeHtml(seasonLabel)}».</p>
    </section>
  `;
}

function createSeasonalSectionIconMarkup(section: SeasonalSection): string {
  if (section === 'walks') {
    return '<span class="seasonal-section__icon seasonal-section__icon--dog-park" aria-hidden="true"></span>';
  }

  return '<span class="seasonal-section__icon seasonal-section__icon--lightbulb" aria-hidden="true"></span>';
}

function createPlayIconMarkup(className: string): string {
  return `
    <svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m9 7 8 5-8 5V7Z" />
    </svg>
  `;
}

function createArrowIconMarkup(className: string): string {
  return `
    <svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m9 5 7 7-7 7" />
    </svg>
  `;
}

export function isSeasonalVideoRoute(route: AppRoute): boolean {
  return route.startsWith('lesson-video:')
    && getSeasonalVideo(route.slice('lesson-video:'.length)) !== null;
}

function createDogSkillsMarkup(): string {
  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup('Пёс умеет', 'home')}

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero puppy-hero--dog-skills" aria-labelledby="dog-skills-hero-title">
            <div class="puppy-hero__content">
              <h2 id="dog-skills-hero-title">Пёс умеет</h2>
              <p class="puppy-hero__description">
                Команды, трюки и полезные навыки
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img
                class="puppy-hero__image puppy-hero__image--dog-skills"
                src="/assets/images/programs/dog-skills.webp"
                alt=""
              />
            </div>
          </section>

          <section class="section-block section-block--tight" aria-labelledby="dog-skills-lessons-title">
            <div class="section-heading section-heading--solo">
              <h2 id="dog-skills-lessons-title">Видео</h2>
            </div>

            <div class="dog-skills-list" aria-label="Видео программы Пёс умеет">
              ${dogSkillsLessons.map(createDogSkillsCardMarkup).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createDogSkillsCardMarkup(lesson: DogSkillsLesson, index: number): string {
  const route: AppRoute = `dog-skills-video:${lesson.id}`;
  const sequenceNumber = String(index + 1).padStart(2, '0');

  return `
    <button class="dog-skills-card" type="button" data-route="${route}">
      <span class="dog-skills-card__media-wrap">
        <span class="dog-skills-card__index" aria-hidden="true">${sequenceNumber}</span>
        <span class="dog-skills-card__media">
          <img src="${escapeHtml(lesson.coverPath)}" alt="" loading="lazy" aria-hidden="true" />
        </span>
      </span>
      <span class="dog-skills-card__body">
        <strong class="dog-skills-card__title">${escapeHtml(lesson.title)}</strong>
        <span class="dog-skills-card__description">${escapeHtml(lesson.cardDescription)}</span>
      </span>
      <span class="dog-skills-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createPuppiesMarkup(activeFilter: PuppyFilter): string {
  const visibleSituations =
    activeFilter === 'all'
      ? puppySituations
      : puppySituations.filter((situation) => situation.category === activeFilter);

  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup('Щенки', 'home')}

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero" aria-labelledby="puppy-hero-title">
            <div class="puppy-hero__content">
              <h2 id="puppy-hero-title">Программа<br />для щенков</h2>
              <p class="puppy-hero__description">
                Первые шаги к спокойной, уверенной и послушной собаке
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img class="puppy-hero__image" src="/assets/images/programs/puppy-hero.webp" alt="" />
            </div>
          </section>

          <section class="section-block section-block--tight" aria-labelledby="situations-title">
            <div class="section-heading section-heading--solo">
              <h2 id="situations-title">Частые ситуации</h2>
            </div>

            <div class="filter-row" role="tablist" aria-label="Фильтры ситуаций">
              ${createFilterPill('Все', 'all', activeFilter)}
              ${createFilterPill('Дома', 'home', activeFilter)}
              ${createFilterPill('Прогулка', 'walk', activeFilter)}
              ${createFilterPill('Поведение', 'behavior', activeFilter)}
              ${createFilterPill('Команды', 'commands', activeFilter)}
            </div>

            <div class="situation-list">
              ${visibleSituations.map((situation, index) => createSituationCard(situation, index, 'blue')).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createAdultLargeMarkup(): string {
  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup('Большие собаки', 'home')}

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero puppy-hero--adult-large" aria-labelledby="adult-large-hero-title">
            <div class="puppy-hero__content">
              <h2 id="adult-large-hero-title">Программа<br />для больших собак</h2>
              <p class="puppy-hero__description">
                Спокойная прогулка, понятный дом и управляемое поведение взрослой собаки
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img class="puppy-hero__image" src="/assets/images/programs/adult_dog.webp" alt="" />
            </div>
          </section>

          <section class="section-block section-block--tight" aria-labelledby="adult-large-title">
            <div class="section-heading section-heading--solo">
              <h2 id="adult-large-title">Разделы</h2>
            </div>

            <div class="situation-list">
              ${adultLargeSituations.map((situation, index) => createAdultLargeSituationCard(situation, index, 'rose')).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createAdultLargeSituationTopicsMarkup(slug: AdultLargeSituationSlug): string {
  const situation = adultLargeSituationsBySlug.get(slug);

  if (!situation) {
    return createAdultLargeMarkup();
  }

  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup(situation.title, 'adult-large')}

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Разделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic, index) => createAdultLargeTopicCard(topic, index, 'rose')).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createAdultLargeTopicLessonsMarkup(slug: AdultLargeTopicSlug): string {
  const topic = adultLargeTopicsBySlug.get(slug);

  if (!topic) {
    return createAdultLargeMarkup();
  }

  const backRoute: AppRoute = `adult-large-situation:${topic.parentSlug}`;

  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup(topic.title, backRoute)}

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Материалы</h2>
            </div>
            <div class="lesson-list">
              ${topic.lessons.map((lesson) => createLessonCard(lesson)).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createFitnessMarkup(): string {
  const puppyFitness = puppySituationsBySlug.get('fitness');
  const adultFitness = adultLargeSituationsBySlug.get('adult-large-fitness');

  if (!puppyFitness || !adultFitness) {
    return createHomeMarkup();
  }

  return `
    <div class="app-shell app-shell--fitness">
      ${createSubpageHeaderMarkup('Фитнес', 'home')}

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero puppy-hero--fitness" aria-labelledby="fitness-hero-title">
            <div class="puppy-hero__content">
              <h2 id="fitness-hero-title">Фитнес<br />для собак</h2>
              <p class="puppy-hero__description">
                Упражнения на координацию, контроль тела и контакт
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img
                class="puppy-hero__image puppy-hero__image--fitness"
                src="/assets/images/programs/fitness-hero.webp"
                width="1254"
                height="1254"
                decoding="async"
                fetchpriority="high"
                alt=""
              />
            </div>
          </section>

          <section class="section-block section-block--detail-first" aria-labelledby="general-puppy-fitness-title">
            <div class="section-heading section-heading--solo">
              <h2 id="general-puppy-fitness-title">Для щенков</h2>
            </div>
            <div class="topic-list">
              ${puppyFitness.topics.map((topic, index) => createTopicCard(topic, index, 'blue')).join('')}
            </div>
          </section>

          <section class="section-block" aria-labelledby="general-adult-fitness-title">
            <div class="section-heading section-heading--solo">
              <h2 id="general-adult-fitness-title">Для взрослых собак</h2>
            </div>
            <div class="topic-list">
              ${adultFitness.topics.map((topic, index) => createAdultLargeTopicCard(topic, index, 'blue')).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createSituationTopicsMarkup(slug: PuppySituationSlug): string {
  const situation = puppySituationsBySlug.get(slug);

  if (!situation) {
    return createPuppiesMarkup('all');
  }

  const topicSectionsMarkup =
    situation.slug === 'fitness'
      ? `
          <section class="section-block section-block--detail-first" aria-labelledby="puppy-fitness-topics-title">
            <div class="section-heading section-heading--solo">
              <h2 id="puppy-fitness-topics-title">Разделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic, index) => createTopicCard(topic, index, 'blue')).join('')}
            </div>
          </section>
        `
      : `
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Разделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic, index) => createTopicCard(topic, index, 'blue')).join('')}
            </div>
          </section>
        `;

  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup(situation.title, 'puppies')}

      <main class="screen-content">
        <div class="content-frame">
          ${topicSectionsMarkup}
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createTopicLessonsMarkup(slug: PuppyTopicSlug, videosState: SituationVideosState): string {
  const topic = puppyTopicsBySlug.get(slug);

  if (!topic) {
    return createPuppiesMarkup('all');
  }

  const backRoute = getPuppySituationRoute(topic.parentSlug);

  const extraFeedSection =
    topic.videoSourceSlug
      ? `
          <section class="section-block section-block--tight">
            <div class="section-heading section-heading--solo">
              <h2>Видео и разборы</h2>
            </div>
            ${topic.videoSourceSlug ? createSituationVideoContent(videosState) : ''}
          </section>
        `
      : '';

  return `
    <div class="app-shell">
      ${createSubpageHeaderMarkup(topic.title, backRoute)}

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Материалы</h2>
            </div>
            <div class="lesson-list">
              ${topic.lessons.map((lesson) => createLessonCard(lesson)).join('')}
            </div>
          </section>
          ${extraFeedSection}
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createLessonPlayerMarkup(video: LessonVideoEntry, activeSeason: SeasonId): string {
  const playerSeason = video.seasons?.includes(activeSeason)
    ? activeSeason
    : video.seasons?.[0];
  const seasonalTheme = playerSeason ? getSeasonTheme(playerSeason) : null;
  const shellClassName = seasonalTheme
    ? 'app-shell app-shell--seasonal-player'
    : video.id.startsWith('dog-skills-')
      ? 'app-shell app-shell--dog-skills-detail'
      : 'app-shell';
  const seasonThemeAttribute = seasonalTheme
    ? ` data-season-theme="${escapeHtml(seasonalTheme.id)}"`
    : '';
  const escapedTitle = escapeHtml(video.title);
  const titleMarkup = createPlayerTitleMarkup(video.title);
  const descriptionMarkup = video.description
    ? createLessonDescriptionMarkup(video.description, video.id, video.title)
    : '';
  const escapedVideoId = escapeHtml(video.mediaId ?? video.id);
  const escapedSourceType = escapeHtml(video.sourceType ?? 'hls');

  return `
    <div class="${shellClassName}"${seasonThemeAttribute}>
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner subpage-header__inner--player">
            <h1 class="subpage-title subpage-title--player">${titleMarkup}</h1>
            <button class="back-button" type="button" data-route="${video.backRoute}" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame content-frame--player">
          <section class="section-block section-block--detail-first">
            <div class="lesson-player-card">
              <div
                class="lesson-player lesson-player--loading"
                data-video-player
                data-video-id="${escapedVideoId}"
                data-video-source="${escapedSourceType}"
                tabindex="0"
              >
                <video
                  class="lesson-player__video"
                  data-video-element
                  preload="metadata"
                  playsinline
                  webkit-playsinline
                  controlslist="nodownload nofullscreen noremoteplayback"
                  disablepictureinpicture
                  disableremoteplayback
                  aria-label="${escapedTitle}"
                ></video>

                <button class="lesson-player__center-play" type="button" data-video-action="toggle" aria-label="Воспроизвести">
                  <span class="lesson-player__play-symbol" aria-hidden="true"></span>
                </button>

                <div class="lesson-player__status" aria-live="polite">
                  <span class="lesson-player__spinner" aria-hidden="true"></span>
                  <span data-video-status-text>Загрузка видео…</span>
                </div>

                <div class="lesson-player__controls">
                  <input
                    class="lesson-player__seek"
                    type="range"
                    min="0"
                    max="1000"
                    value="0"
                    step="1"
                    data-video-seek
                    aria-label="Перемотка видео"
                  />
                  <div class="lesson-player__control-row">
                    <button class="lesson-player__button lesson-player__button--play" type="button" data-video-action="toggle" aria-label="Воспроизвести">
                      <span class="lesson-player__play-symbol" aria-hidden="true"></span>
                    </button>
                    <span class="lesson-player__time">
                      <span data-video-current-time>0:00</span>
                      <span aria-hidden="true">/</span>
                      <span data-video-duration>0:00</span>
                    </span>
                    <span class="lesson-player__control-spacer"></span>
                    <label class="lesson-player__select-wrap" data-video-quality-control hidden>
                      <span class="sr-only">Качество</span>
                      <select class="lesson-player__select" data-video-quality aria-label="Качество видео">
                        <option value="-1">Авто</option>
                      </select>
                    </label>
                    <label class="lesson-player__select-wrap">
                      <span class="sr-only">Скорость</span>
                      <select class="lesson-player__select" data-video-speed aria-label="Скорость воспроизведения">
                        <option value="0.75">0.75×</option>
                        <option value="1" selected>1×</option>
                        <option value="1.25">1.25×</option>
                        <option value="1.5">1.5×</option>
                        <option value="2">2×</option>
                      </select>
                    </label>
                    <button class="lesson-player__button lesson-player__button--volume" type="button" data-video-action="mute" aria-label="Выключить звук">
                      <svg class="lesson-player__volume-symbol" viewBox="0 0 24 24" aria-hidden="true">
                        <path class="lesson-player__volume-speaker" d="M4 9.25v5.5h3.6l4.15 3.35V5.9L7.6 9.25H4Z"></path>
                        <path class="lesson-player__volume-waves" d="M15.1 9.1a4 4 0 0 1 0 5.8M17.85 6.65a7.45 7.45 0 0 1 0 10.7"></path>
                        <path class="lesson-player__volume-muted" d="m15.25 9.25 5.5 5.5m0-5.5-5.5 5.5"></path>
                      </svg>
                    </button>
                    <input class="lesson-player__volume" type="range" min="0" max="100" value="85" data-video-volume aria-label="Громкость" />
                    <button class="lesson-player__button lesson-player__button--fullscreen" type="button" data-video-action="fullscreen" aria-label="На весь экран">
                      <svg class="lesson-player__fullscreen-symbol" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8.5 4.5h-4v4m11-4h4v4m-15 7v4h4m11-4v4h-4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div class="lesson-player-card__divider" aria-hidden="true">
                <span class="lesson-player-card__divider-dog"></span>
              </div>
              ${descriptionMarkup}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createPlayerTitleMarkup(title: string): string {
  const parts = title.match(/\S+|\s+/gu) ?? [];
  const markup: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (!part.includes('/')) {
      markup.push(escapeHtml(part));
      continue;
    }

    let nonBreakingText = part;

    if (part.endsWith('/') && /^\s+$/u.test(parts[index + 1] ?? '') && parts[index + 2]) {
      nonBreakingText += `${parts[index + 1]}${parts[index + 2]}`;
      index += 2;
    }

    markup.push(`<span class="subpage-title__no-break">${escapeHtml(nonBreakingText)}</span>`);
  }

  return markup.join('');
}

type LessonDescriptionTone = 'default' | 'mistakes' | 'note';
type LessonDescriptionIcon = 'bullet' | 'mistake' | 'note' | 'message' | 'flow';
type LessonDescriptionLayout = 'auto' | 'steps' | 'mistakes' | 'bullets';

type LessonDescriptionBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'steps'; items: Array<{ number: string; title: string; details: string[] }> }
  | { type: 'bullets'; items: string[] }
  | { type: 'mistakes'; items: LessonDescriptionMistake[] }
  | { type: 'callout'; text: string; icon: 'message' | 'tip' | 'warning' }
  | { type: 'flow'; text: string }
  | { type: 'separator' };

interface LessonDescriptionMistake {
  problem: string;
  details?: string;
  correction?: string;
}

interface LessonDescriptionSection {
  title: string | null;
  tone: LessonDescriptionTone;
  lines: string[];
}

function createLessonDescriptionMarkup(description: string, lessonId: string, lessonTitle: string): string {
  const { body, feedbackPrompt } = extractLessonFeedbackPrompt(description);
  const sections = parseLessonDescriptionSections(body);
  let content = sections
    .map((section) => createLessonDescriptionSectionMarkup(section))
    .join('');
  const fitnessExercise = getFitnessExerciseName(lessonTitle);

  if (fitnessExercise) {
    const highlightedContent = highlightFitnessExerciseName(content, fitnessExercise.terms);
    content = highlightedContent.markup;

    if (fitnessExercise.alwaysShowName || !highlightedContent.didHighlight) {
      content = `<p class="lesson-description__exercise-name"><strong>${escapeHtml(fitnessExercise.name)}</strong></p>${content}`;
    }
  }

  const feedbackMarkup = feedbackPrompt
    ? createLessonFeedbackMarkup(feedbackPrompt, lessonId, lessonTitle)
    : '';

  return `<article class="lesson-player-card__description lesson-description">${content}${feedbackMarkup}</article>`;
}

function getFitnessExerciseName(lessonTitle: string): { name: string; terms: string[]; alwaysShowName?: boolean } | null {
  const exerciseNames: Record<string, { name: string; terms: string[]; alwaysShowName?: boolean }> = {
    Поклон: { name: 'Поклон', terms: ['Поклон'] },
    Зайка: { name: 'Зайка', terms: ['Зайка'] },
    Домик: { name: 'Домик', terms: ['Домик'] },
    'Поставь лапки или "тач"': { name: 'Поставь лапки', terms: ['Поставь лапки', 'тач'], alwaysShowName: true },
    'Круть-верть': { name: 'Круть-верть', terms: ['Круть-верть'] },
    'Влево-вправо': { name: 'Лево–право', terms: ['Лево–право', 'Влево-вправо'] },
    Восемь: { name: 'Восьмёрка', terms: ['Восьмёрка', 'Восемь'] },
    Обойди: { name: 'Обойди', terms: ['Обойди'] },
  };

  return exerciseNames[lessonTitle] ?? null;
}

function highlightFitnessExerciseName(markup: string, terms: string[]): { markup: string; didHighlight: boolean } {
  let highlightedMarkup = markup;

  terms.forEach((term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exercisePattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedTerm})(?![\\p{L}\\p{N}])`, 'giu');
    highlightedMarkup = highlightedMarkup.replace(
      exercisePattern,
      '$1<strong class="lesson-description__exercise-highlight">$2</strong>',
    );
  });

  return { markup: highlightedMarkup, didHighlight: highlightedMarkup !== markup };
}

function extractLessonFeedbackPrompt(description: string): { body: string; feedbackPrompt: string | null } {
  const lines = description.replaceAll('\r', '').split('\n');
  let lastContentIndex = lines.length - 1;

  while (lastContentIndex >= 0 && !lines[lastContentIndex].trim()) {
    lastContentIndex -= 1;
  }

  const lastLine = lines[lastContentIndex]?.trim() ?? '';

  if (!lastLine.startsWith('💬') && !lastLine.endsWith('💬')) {
    return { body: description, feedbackPrompt: null };
  }

  const feedbackPrompt = lastLine.replace(/^(?:💬\s*)|(?:\s*💬)$/gu, '').trim();
  lines.splice(lastContentIndex, 1);
  return { body: lines.join('\n').trim(), feedbackPrompt };
}

function createLessonFeedbackMarkup(prompt: string, lessonId: string, lessonTitle: string): string {
  const copy = formatLessonFeedbackCopy(prompt);

  return `
    <aside class="lesson-feedback-cta">
      <p class="lesson-feedback-cta__text">
        <strong class="lesson-feedback-cta__question">${renderEmojiText(copy.question)}</strong>
        <span class="lesson-feedback-cta__guidance">${renderEmojiText(copy.guidance)}</span>
      </p>
      <button
        class="lesson-feedback-cta__button"
        type="button"
        data-feedback-open
        data-feedback-entry="player"
        data-feedback-lesson-id="${escapeHtml(lessonId)}"
        data-feedback-lesson-title="${escapeHtml(lessonTitle)}"
      >
        <img class="lesson-feedback-cta__message-icon" src="${getEmojiAssetUrl('/assets/emoji/speech-balloon.svg')}" alt="" aria-hidden="true" />
        <span>Спросить у кинолога</span>
        <span class="lesson-feedback-cta__arrow" aria-hidden="true"></span>
      </button>
    </aside>
  `;
}

function parseLessonDescriptionSections(description: string): LessonDescriptionSection[] {
  const lines = description
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: LessonDescriptionSection[] = [
    { title: null, tone: 'default', lines: [] },
  ];

  lines.forEach((line) => {
    if (isLessonDescriptionHeading(line)) {
      sections.push({
        title: line,
        tone: getLessonDescriptionSectionTone(line),
        lines: [],
      });
      return;
    }

    sections.at(-1)?.lines.push(line);
  });

  return sections.filter((section) => section.title || section.lines.length > 0);
}

function isLessonDescriptionHeading(line: string): boolean {
  const normalizedLine = normalizeLessonDescriptionHeading(line);

  if (
    /^(?:Этапы обучения|Частая ошибка|Важн(?:ый нюанс|ые нюансы)|Дополнительно|Какие элементы можно использовать|Главный принцип|Правила челленджа|Челлендж)$/u.test(normalizedLine)
  ) {
    return true;
  }

  if (
    /^(?:Как (?:учим|обучаем|играем|работаем|кормим|приучаем|организуем|выполняем)|Как .+ пошагово|Подготовка|Результат|Частые ошибки(?: ❌)?|Особенности 🐾|Важные (?:особенности|нюансы)(?: 🐾)?|Обратите внимание(?: 🐾)?|Что важно (?:понять|помнить 🐾)|Что можно использовать|Как устроен коготь 🐾|Зачем .+ 🐾|Разберём основные этапы обучения|Разберём распространённые ошибки и способы их исправления|Главное правило)$/.test(normalizedLine)
  ) {
    return true;
  }

  if (/^(?:С чего начать\?(?: 🐾)?|Главное(?: 🐕)?|Как научить щенка оставаться одному дома 🐶🏠|Упражнение «[^»]+»: .+)$/u.test(normalizedLine)) {
    return true;
  }

  if (/^(?:В этом |В )видео (?:разберём|поговорим о том|покажем(?: несколько простых игр)?)$/i.test(normalizedLine)) {
    return true;
  }

  if (
    /^(?:Упражнение развивает|Этот трюк помогает развивать|Главная последовательность|Полный навык выглядит так|Понятный сценарий выглядит так)$/.test(normalizedLine)
  ) {
    return true;
  }

  return /^[А-ЯЁ0-9][А-ЯЁ0-9\s]+$/u.test(normalizedLine) && /[А-ЯЁ]/u.test(normalizedLine);
}

function getLessonDescriptionSectionTone(title: string): LessonDescriptionTone {
  const normalizedTitle = normalizeLessonDescriptionHeading(title);

  if (
    normalizedTitle.startsWith('Частая ошибка')
    || normalizedTitle.startsWith('Частые ошибки')
    || normalizedTitle.includes('ошибки и способы их исправления')
  ) {
    return 'mistakes';
  }

  if (
    normalizedTitle.includes('Особенности')
    || normalizedTitle.includes('Важно')
    || normalizedTitle.startsWith('Важн')
    || normalizedTitle === 'Главное правило'
    || normalizedTitle === 'Главное'
    || normalizedTitle === 'Главный принцип'
    || normalizedTitle === 'Дополнительно'
    || normalizedTitle === 'Челлендж'
    || normalizedTitle.endsWith('🐾')
  ) {
    return 'note';
  }

  return 'default';
}

function createLessonDescriptionSectionMarkup(section: LessonDescriptionSection): string {
  const isGettingStartedSection = section.title?.startsWith('С чего начать?') ?? false;
  const sectionClass = [
    'lesson-description__section',
    section.title ? '' : 'lesson-description__section--intro',
    section.tone !== 'default' ? `lesson-description__section--${section.tone}` : '',
    isGettingStartedSection ? 'lesson-description__section--getting-started' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const visibleTitle = section.title
    ?.replace(/^(?:🔹|⚠️|💡|❌|🐾|🎁|🎯|🏆)\s*/u, '')
    .replace(/:\s*$/u, '')
    .replace(/\s*(?:🐾|❌)\s*$/u, '') ?? '';
  const headingIcon = section.tone === 'mistakes'
    ? ''
    : isGettingStartedSection
      ? `<img class="lesson-description__heading-emoji" src="${getEmojiAssetUrl('/assets/emoji/light-bulb.svg')}" alt="" aria-hidden="true" />`
      : section.tone === 'note'
        ? createLessonDescriptionIcon('note')
        : '';
  const titleMarkup = section.title
    ? `<h2 class="lesson-description__heading">${headingIcon}<span>${renderEmojiText(visibleTitle)}</span></h2>`
    : '';

  return `
    <section class="${sectionClass}">
      ${titleMarkup}
      ${createLessonDescriptionBlocksMarkup(
        section.lines,
        !section.title,
        getLessonDescriptionSectionLayout(section),
      )}
    </section>
  `;
}

function getLessonDescriptionSectionLayout(
  section: LessonDescriptionSection,
): LessonDescriptionLayout {
  const normalizedTitle = section.title
    ? normalizeLessonDescriptionHeading(section.title)
    : '';

  if (
    /^Как .+ пошагово$/u.test(normalizedTitle)
    || normalizedTitle === 'Разберём основные этапы обучения'
    || normalizedTitle === 'Этапы обучения'
    || normalizedTitle === 'Какие элементы можно использовать'
    || normalizedTitle === 'Правила челленджа'
  ) {
    return 'steps';
  }

  if (/^Част(?:ая ошибка|ые ошибки)(?: ❌)?$/u.test(normalizedTitle)) {
    return 'mistakes';
  }

  if (
    section.tone === 'note'
    && /^(?:Важные (?:особенности|нюансы)(?: 🐾)?|Обратите внимание(?: 🐾)?)$/u.test(normalizedTitle)
  ) {
    return 'bullets';
  }

  return 'auto';
}

function normalizeLessonDescriptionHeading(line: string): string {
  return line
    .replace(/^(?:🔹|⚠️|💡|❌|🐾|🎁|🎯|🏆)\s*/u, '')
    .replace(/:\s*$/u, '')
    .trim();
}

function createLessonDescriptionBlocksMarkup(
  lines: string[],
  emphasizeFirstParagraph = false,
  layout: LessonDescriptionLayout = 'auto',
): string {
  if (layout === 'steps') {
    return createLessonDescriptionBlockMarkup({
      type: 'steps',
      items: lines.map((line, index) => {
        const sentenceMatch = line.match(/^(.+?[.!?])(?:\s+)(.+)$/u);

        return {
          number: String(index + 1),
          title: sentenceMatch?.[1] ?? line,
          details: sentenceMatch?.[2] ? [sentenceMatch[2]] : [],
        };
      }),
    });
  }

  if (layout === 'mistakes') {
    return createLessonDescriptionBlockMarkup({
      type: 'mistakes',
      items: lines.map(parseLessonDescriptionMistake),
    });
  }

  if (layout === 'bullets') {
    return createLessonDescriptionBlockMarkup({
      type: 'bullets',
      items: lines.map((line) => line.replace(/^(?:🐾|\*|•)\s*/u, '')),
    });
  }

  const blocks: LessonDescriptionBlock[] = [];
  let paragraphLines: string[] = [];
  let stepItems: Array<{ number: string; title: string; details: string[] }> = [];
  let bulletItems: string[] = [];
  let mistakeItems: LessonDescriptionMistake[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
      paragraphLines = [];
    }
  };
  const flushSteps = (): void => {
    if (stepItems.length > 0) {
      blocks.push({ type: 'steps', items: stepItems });
      stepItems = [];
    }
  };
  const flushBullets = (): void => {
    if (bulletItems.length > 0) {
      blocks.push({ type: 'bullets', items: bulletItems });
      bulletItems = [];
    }
  };
  const flushMistakes = (): void => {
    if (mistakeItems.length > 0) {
      blocks.push({ type: 'mistakes', items: mistakeItems });
      mistakeItems = [];
    }
  };
  const flushAll = (): void => {
    flushParagraph();
    flushSteps();
    flushBullets();
    flushMistakes();
  };

  lines.forEach((line) => {
    const stepMatch = line.match(/^(\d+)\.\s+(.+)$/);
    const bulletMatch = line.match(/^(?:🐾|\*|•|🌿|🏃‍♀️|👀|🤚)\s*(.+)$/u);

    if (/^_+$/.test(line)) {
      flushAll();
      blocks.push({ type: 'separator' });
      return;
    }

    let callout: { icon: 'message' | 'tip' | 'warning'; text: string } | null = null;

    if (line.startsWith('💬') || line.endsWith('💬')) {
      callout = { icon: 'message', text: line.replace(/^(?:💬\s*)|(?:\s*💬)$/gu, '').trim() };
    } else if (line.startsWith('💡')) {
      callout = { icon: 'tip', text: line.replace(/^💡\s*/u, '').trim() };
    } else if (line.startsWith('⚠️')) {
      callout = { icon: 'warning', text: line.replace(/^⚠️\s*/u, '').trim() };
    }

    if (callout) {
      flushAll();
      blocks.push({ type: 'callout', ...callout });
      return;
    }

    if (line.startsWith('❌')) {
      flushParagraph();
      flushSteps();
      flushBullets();
      mistakeItems.push(parseLessonDescriptionMistake(line));
      return;
    }

    if (bulletMatch) {
      flushParagraph();
      flushSteps();
      flushMistakes();
      bulletItems.push(bulletMatch[1]);
      return;
    }

    if (stepMatch) {
      flushParagraph();
      flushBullets();
      flushMistakes();
      stepItems.push({ number: stepMatch[1], title: stepMatch[2], details: [] });
      return;
    }

    if (stepItems.length > 0) {
      stepItems.at(-1)?.details.push(line);
      return;
    }

    if (line.includes('→') && line.length <= 180) {
      flushAll();
      blocks.push({ type: 'flow', text: line });
      return;
    }

    flushBullets();
    flushMistakes();
    paragraphLines.push(line);
  });

  flushAll();

  return blocks
    .map((block, index) => createLessonDescriptionBlockMarkup(
      block,
      emphasizeFirstParagraph && index === 0 && block.type === 'paragraph',
    ))
    .join('');
}

function parseLessonDescriptionMistake(line: string): LessonDescriptionMistake {
  const normalized = line.replace(/^❌\s*/u, '').replace(/\s+/gu, ' ').trim();
  const correctionMatch = normalized.match(/\s✅\s*Как исправить:\s*(.+)$/u);

  if (!correctionMatch || correctionMatch.index === undefined) {
    return { problem: normalized };
  }

  const problemAndDetails = normalized.slice(0, correctionMatch.index).trim();
  const sentenceMatch = problemAndDetails.match(/^((?:\d+\.\s*)?.+?[.!?])\s+(.+)$/u);

  return sentenceMatch
    ? { problem: sentenceMatch[1].trim(), details: sentenceMatch[2].trim(), correction: correctionMatch[1].trim() }
    : { problem: problemAndDetails, correction: correctionMatch[1].trim() };
}
function createLessonDescriptionBlockMarkup(
  block: LessonDescriptionBlock,
  isLeadParagraph = false,
): string {
  if (block.type === 'paragraph') {
    const paragraphClass = isLeadParagraph
      ? 'lesson-description__paragraph lesson-description__paragraph--lead'
      : 'lesson-description__paragraph';
    return `<p class="${paragraphClass}">${renderEmojiText(block.lines.join(' '))}</p>`;
  }

  if (block.type === 'steps') {
    return `
      <ol class="lesson-description__steps">
        ${block.items
          .map(
            (item) => `
              <li class="lesson-description__step">
                <span class="lesson-description__step-number" aria-hidden="true">${escapeHtml(item.number)}</span>
                <div class="lesson-description__step-content">
                  <strong>${renderEmojiText(item.title)}</strong>
                  ${item.details.length > 0 ? `<p>${renderEmojiText(item.details.join(' '))}</p>` : ''}
                </div>
              </li>
            `,
          )
          .join('')}
      </ol>
    `;
  }

  if (block.type === 'mistakes') {
    return `
      <ul class="lesson-description__mistakes">
        ${block.items
          .map((item) => `<li>\n            ${createLessonDescriptionIcon('mistake')}\n            <div class="lesson-description__mistake-content">\n              <span>${renderEmojiText(item.problem)}</span>\n              ${item.details ? `<p>${renderEmojiText(item.details)}</p>` : ''}\n              ${item.correction ? `<p class="lesson-description__mistake-correction"><strong>✅ Как исправить:</strong> ${renderEmojiText(item.correction)}</p>` : ''}\n            </div>\n          </li>`)
          .join('')}
      </ul>
    `;
  }

  if (block.type === 'bullets') {
    return `
      <ul class="lesson-description__bullets">
        ${block.items
          .map((item) => `<li>${createLessonDescriptionIcon('bullet')}<span>${renderEmojiText(item)}</span></li>`)
          .join('')}
      </ul>
    `;
  }

  if (block.type === 'callout') {
    const calloutIcon = block.icon === 'message'
      ? createLessonDescriptionIcon('message')
      : `<img class="lesson-description__callout-emoji" src="${getEmojiAssetUrl(`/assets/emoji/${block.icon === 'tip' ? 'light-bulb' : 'warning'}.svg`)}" alt="" aria-hidden="true" />`;

    return `
      <aside class="lesson-description__callout">
        <span class="lesson-description__callout-icon">${calloutIcon}</span>
        <p>${renderEmojiText(block.text)}</p>
      </aside>
    `;
  }

  if (block.type === 'flow') {
    return `
      <div class="lesson-description__flow">
        ${createLessonDescriptionIcon('flow')}
        <p>${renderEmojiText(block.text)}</p>
      </div>
    `;
  }

  return '<hr class="lesson-description__separator" />';
}

function createLessonDescriptionIcon(icon: LessonDescriptionIcon): string {
  if (icon === 'note') {
    return `<img class="lesson-description__icon lesson-description__icon--note" src="${getEmojiAssetUrl('/assets/emoji/light-bulb.svg')}" alt="" aria-hidden="true" />`;
  }

  const iconPaths: Record<Exclude<LessonDescriptionIcon, 'note'>, string> = {
    bullet: '<circle cx="12" cy="12" r="8.5"></circle><path d="m8.7 12.1 2.1 2.1 4.7-4.8"></path>',
    mistake: '<circle cx="12" cy="12" r="8.5"></circle><path d="m9 9 6 6M15 9l-6 6"></path>',
    message: '<path d="M5.5 17.2A8.2 8.2 0 1 1 9 20l-4.7 1 1.2-3.8Z"></path><path d="M8.5 11.8h7M8.5 8.8h4.5M8.5 14.8h4"></path>',
    flow: '<path d="M4 12h13"></path><path d="m13 7 5 5-5 5"></path><circle cx="4" cy="12" r="1.5"></circle>',
  };

  return `
    <svg class="lesson-description__icon lesson-description__icon--${icon}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${iconPaths[icon]}
    </svg>
  `;
}
function createSituationVideoContent(videosState: SituationVideosState): string {
  if (videosState.status === 'loading' || videosState.status === 'idle') {
    return `
      <section class="video-empty-card video-empty-card--loading" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--play" aria-hidden="true"></span>
        <h3>Загружаем видео</h3>
        <p>Подтягиваем актуальные видео из Telegram</p>
      </section>
    `;
  }

  if (videosState.status === 'error') {
    return `
      <section class="video-empty-card" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--alert" aria-hidden="true"></span>
        <h3>Не удалось загрузить видео</h3>
        <p>${escapeHtml(videosState.message)}</p>
      </section>
    `;
  }

  const videos = videosState.status === 'ready' ? videosState.videos : [];

  if (videos.length === 0) {
    return `
      <section class="video-empty-card" aria-live="polite">
        <span class="video-empty-card__icon video-empty-card__icon--play" aria-hidden="true"></span>
        <h3>Видео пока нет</h3>
        <p>Когда в Telegram появятся ролики по этой теме, они автоматически отобразятся здесь</p>
      </section>
    `;
  }

  return `
    <div class="video-card-list">
      ${videos.map((video) => createVideoCard(video)).join('')}
    </div>
  `;
}

function createVideoCard(video: SituationVideo): string {
  const feedback = `Открываем ${video.label.toLowerCase()} в Telegram`;

  return `
    <button
      class="video-card js-feedback"
      type="button"
      data-feedback="${escapeHtml(feedback)}"
      data-external-url="${escapeHtml(video.telegramUrl)}"
    >
      <span class="video-card__preview">
        <img src="${escapeHtml(video.thumbnailUrl)}" alt="" />
        <span class="video-card__play" aria-hidden="true">
          <span class="video-card__play-icon"></span>
        </span>
      </span>

      <span class="video-card__body">
        <span class="video-card__label">${escapeHtml(video.label)}</span>
        <span class="video-card__title">${escapeHtml(video.title)}</span>
        <span class="video-card__description">${renderEmojiText(video.description)}</span>
        <span class="video-card__meta">${escapeHtml(video.durationLabel)} · ${escapeHtml(video.sourceLabel)}</span>
      </span>

      <span class="video-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createLessonCard(lesson: PuppyLessonItem): string {
  const feedback = lesson.feedback ?? `Материал "${lesson.title}" пока без подключённого видео`;
  const externalAttr = lesson.externalUrl ? `data-external-url="${escapeHtml(lesson.externalUrl)}"` : '';
  const route = lesson.video?.sourceType ? `lesson-video:${lesson.video.id}` : lesson.route;
  const routeAttr = route ? `data-route="${route}"` : '';
  const hasAction = Boolean(lesson.externalUrl || route);
  const buttonClass = hasAction ? 'lesson-card' : 'lesson-card lesson-card--placeholder js-feedback';
  const buttonFeedback = hasAction ? '' : `data-feedback="${escapeHtml(feedback)}"`;
  const previewMarkup = lesson.coverPath
    ? `<img src="${escapeHtml(lesson.coverPath)}" alt="" loading="lazy" />`
    : `
        <span class="lesson-card__preview-placeholder" aria-hidden="true">
          <span class="lesson-card__placeholder-icon"></span>
        </span>
      `;

  return `
    <button
      class="${buttonClass}"
      type="button"
      ${externalAttr}
      ${routeAttr}
      ${buttonFeedback}
    >
      <span class="lesson-card__preview">
        ${previewMarkup}
        <span class="lesson-card__play" aria-hidden="true">
          <span class="lesson-card__play-icon"></span>
        </span>
      </span>

      <span class="lesson-card__body">
        <span class="lesson-card__title">${escapeHtml(lesson.title)}</span>
        <span class="lesson-card__description">${escapeHtml(lesson.description)}</span>
        ${hasAction ? '' : '<span class="lesson-card__status">Материал готовится</span>'}
      </span>
    </button>
  `;
}

function createComplexMarkup(): string {
  return `
    <div class="app-shell app-shell--complex">
      <main class="screen-content complex-screen">
        <div class="complex-screen__background" aria-hidden="true">
          <span class="complex-screen__area complex-screen__area--blue"></span>
          <span class="complex-screen__area complex-screen__area--red"></span>
        </div>

        <button
          class="complex-screen__hit-area complex-screen__hit-area--timed"
          type="button"
          data-route="complex-levels:timed"
          aria-label="Открыть уровни режима На время"
        ></button>

        <button
          class="complex-screen__hit-area complex-screen__hit-area--self-check"
          type="button"
          data-route="complex-levels:self-check"
          aria-label="Открыть уровни режима Проверь себя"
        ></button>

        <button class="back-button complex-screen__back" type="button" data-route="home" aria-label="Назад">
          <span class="back-button__icon" aria-hidden="true"></span>
        </button>

        <h1 class="complex-screen__title">Комплекс</h1>

        <div class="complex-screen__option complex-screen__option--timed">
          <span>На время</span>
        </div>

        <div class="complex-screen__option complex-screen__option--self-check">
          <span>Проверь себя</span>
        </div>
      </main>
    </div>
  `;
}

function createComplexLevelsMarkup(mode: 'timed' | 'self-check'): string {
  const isTimed = mode === 'timed';
  const modeTitle = isTimed ? 'На время' : 'Проверь себя';
  const modeClass = isTimed ? 'timed' : 'self-check';
  const iconVariant = isTimed ? 'time' : 'check';
  const videoPrefix = isTimed ? 'complex-timed' : 'complex-self-check';

  return `
    <div class="app-shell app-shell--complex-levels app-shell--complex-levels--${modeClass}">
      <main class="screen-content complex-levels">
        <div class="content-frame complex-levels__frame">
          <header class="complex-levels__header">
            <div class="complex-levels__toolbar">
              <span class="complex-levels__mode">${modeTitle}</span>
              <button class="back-button complex-levels__back" type="button" data-route="complex" aria-label="Назад">
                <span class="back-button__icon" aria-hidden="true"></span>
              </button>
            </div>
            <h1>Выберите уровень</h1>
            <p>Начните с комфортной сложности — повысить её можно в любой момент.</p>
          </header>

          <div class="complex-levels__list" role="list" aria-label="Уровни сложности">
            ${createComplexLevelCard('Начальный', 'Базовые задания в спокойном темпе', `/assets/icons/comp_lil_${iconVariant}.webp`, `${videoPrefix}-beginner`)}
            ${createComplexLevelCard('Средний', 'Больше темпа и концентрации', `/assets/icons/comp_middle_${iconVariant}.webp`, `${videoPrefix}-intermediate`)}
            ${createComplexLevelCard('Сложный', 'Максимальная сложность заданий', `/assets/icons/comp_big_${iconVariant}.webp`, `${videoPrefix}-advanced`)}
          </div>
        </div>
      </main>
    </div>
  `;
}

function createComplexLevelCard(
  title: string,
  description: string,
  iconPath: string,
  videoId: string,
): string {
  return `
    <button
      class="complex-level-card"
      type="button"
      role="listitem"
      data-route="lesson-video:${videoId}"
    >
      <span class="complex-level-card__media" aria-hidden="true">
        <img src="${iconPath}" alt="" />
      </span>
      <span class="complex-level-card__content">
        <span class="complex-level-card__title">${title}</span>
        <span class="complex-level-card__description">${description}</span>
      </span>
      <span class="complex-level-card__arrow" aria-hidden="true"></span>
    </button>
  `;
}

function resolveCardImagePath(imagePath: string): string {
  return imagePath === '/assets/useful-home.svg' ? '/assets/icons/home.webp' : imagePath;
}

function createUsefulCard(
  title: string,
  iconPath: string,
  modifierClass: string,
  route?: AppRoute,
  feedbackEntryPoint?: 'home',
): string {
  const resolvedIconPath = resolveCardImagePath(iconPath);
  const actionClass = route || feedbackEntryPoint ? '' : ' js-feedback';
  const actionAttribute = route
    ? `data-route="${route}"`
    : feedbackEntryPoint
      ? `data-feedback-open data-feedback-entry="${feedbackEntryPoint}"`
      : `data-feedback="Материал &quot;${escapeHtml(title)}&quot; пока в разработке"`;
  const iconMarkup =
    modifierClass === 'useful-card--gray'
      ? '<span class="useful-card__test-icon" aria-hidden="true"></span>'
      : `<img src="${resolvedIconPath}" alt="" />`;
  return `
    <button
      class="useful-card ${modifierClass}${actionClass}"
      type="button"
      ${actionAttribute}
    >
      <span class="useful-card__icon">
        ${iconMarkup}
      </span>
      <span class="useful-card__title">${title}</span>
    </button>
  `;
}

function createProgramCard(
  _title: string,
  titleMarkup: string,
  description: string,
  imagePath: string | undefined,
  cardClass: string,
  action: { route?: AppRoute; feedback?: string },
): string {
  const cardClassAttr = action.route
    ? `class="program-card ${cardClass}"`
    : `class="program-card ${cardClass} js-feedback"`;
  const extraAttrs = action.route
    ? `data-route="${action.route}"`
    : `data-feedback="${escapeHtml(action.feedback ?? '')}"`;
  const mediaMarkup = imagePath
    ? `
      <span class="program-card__media">
        <img src="${imagePath}" alt="" aria-hidden="true" />
      </span>`
    : '';

  return `
    <button
      ${cardClassAttr}
      type="button"
      ${extraAttrs}
    >
      ${mediaMarkup}
      <span class="program-card__body">
        <span class="program-card__copy">
          <span class="program-card__title">${titleMarkup}</span>
          <span class="program-card__description">${description}</span>
        </span>
        <span class="program-card__arrow" aria-hidden="true">
          <span class="program-card__arrow-icon"></span>
        </span>
      </span>
    </button>
  `;
}

function createFilterPill(label: string, value: PuppyFilter, activeFilter: PuppyFilter): string {
  const activeClass = value === activeFilter ? ' filter-pill--active' : '';

  return `
    <button
      class="filter-pill${activeClass}"
      type="button"
      role="tab"
      aria-selected="${value === activeFilter}"
      data-filter="${value}"
    >
      ${label}
    </button>
  `;
}

type AlternatingCardColor = 'blue' | 'rose';

function getAlternatingCardClass(
  cardType: 'situation' | 'topic',
  index: number,
  firstColor: AlternatingCardColor,
): string {
  const color = index % 2 === 0 ? firstColor : firstColor === 'blue' ? 'rose' : 'blue';
  return `${cardType}-card--${color}`;
}

function createSituationCard(
  situation: PuppySituation,
  index: number,
  firstColor: AlternatingCardColor,
): string {
  return `
    <button
      class="situation-card ${getAlternatingCardClass('situation', index, firstColor)}"
      type="button"
      data-route="${getPuppySituationRoute(situation.slug)}"
    >
      <span class="situation-card__media">
        <img src="${situation.imagePath}" alt="" />
      </span>

      <span class="situation-card__body">
        <span class="situation-card__title">${situation.title}</span>
        <span class="situation-card__description">${situation.description}</span>
        <span class="situation-card__meta">${situation.meta}</span>
      </span>

      <span class="situation-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function getPuppySituationRoute(slug: PuppySituationSlug): AppRoute {
  return slug === 'fitness' ? 'puppy-fitness' : `puppy-situation:${slug}`;
}

function createAdultLargeSituationCard(
  situation: AdultLargeSituation,
  index: number,
  firstColor: AlternatingCardColor,
): string {
  return `
    <button
      class="situation-card ${getAlternatingCardClass('situation', index, firstColor)}"
      type="button"
      data-route="adult-large-situation:${situation.slug}"
    >
      <span class="situation-card__media">
        <img src="${situation.imagePath}" alt="" />
      </span>

      <span class="situation-card__body">
        <span class="situation-card__title">${situation.title}</span>
        <span class="situation-card__description">${situation.description}</span>
        <span class="situation-card__meta">${situation.meta}</span>
      </span>

      <span class="situation-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createTopicCard(
  topic: PuppyTopic,
  index: number,
  firstColor: AlternatingCardColor,
): string {
  const imagePath = resolveCardImagePath(topic.imagePath);
  const mediaClass = imagePath.startsWith('/assets/icons/') ? ' topic-card__media--transparent' : '';

  return `
    <button
      class="topic-card ${getAlternatingCardClass('topic', index, firstColor)}"
      type="button"
      data-route="puppy-topic:${topic.slug}"
    >
      <span class="topic-card__media${mediaClass}">
        <img src="${imagePath}" alt="" />
      </span>

      <span class="topic-card__body">
        <span class="topic-card__title">${topic.title}</span>
        <span class="topic-card__description">${topic.description}</span>
        <span class="topic-card__meta">${topic.meta}</span>
      </span>

      <span class="topic-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createAdultLargeTopicCard(
  topic: AdultLargeTopic,
  index: number,
  firstColor: AlternatingCardColor,
): string {
  const imagePath = resolveCardImagePath(topic.imagePath);
  const mediaClass = imagePath.startsWith('/assets/icons/') ? ' topic-card__media--transparent' : '';

  return `
    <button
      class="topic-card ${getAlternatingCardClass('topic', index, firstColor)}"
      type="button"
      data-route="adult-large-topic:${topic.slug}"
    >
      <span class="topic-card__media${mediaClass}">
        <img src="${imagePath}" alt="" />
      </span>

      <span class="topic-card__body">
        <span class="topic-card__title">${topic.title}</span>
        <span class="topic-card__description">${topic.description}</span>
        <span class="topic-card__meta">${topic.meta}</span>
      </span>

      <span class="topic-card__arrow" aria-hidden="true">
        <span class="program-card__arrow-icon"></span>
      </span>
    </button>
  `;
}

function createBottomNav(activeTab: 'home' | 'lessons' | 'chat'): string {
  return `
    <nav class="bottom-nav" aria-label="Основная навигация">
      <div class="bottom-nav__inner">
        <span class="bottom-nav__indicator" aria-hidden="true"></span>
        ${createNavTab('Главная', 'home', activeTab === 'home', 'home')}
        ${createNavTab('Уроки', 'lessons', activeTab === 'lessons', 'puppies')}
        ${createNavTab(
          'Чат с кинологом',
          'chat',
          activeTab === 'chat',
          undefined,
          undefined,
          'chat-nav',
        )}
      </div>
    </nav>
  `;
}

function createNavTab(
  label: string,
  iconName: 'home' | 'lessons' | 'chat',
  isActive = false,
  route?: AppRoute,
  feedback?: string,
  feedbackEntryPoint?: 'chat-nav',
): string {
  const activeClass = isActive ? ' bottom-nav__tab--active' : '';
  const lessonNavAttributes = iconName === 'lessons'
    ? ' data-lessons-nav aria-expanded="false"'
    : '';
  const attrs = route
    ? `data-route="${route}"`
    : feedbackEntryPoint
      ? `data-feedback-open data-feedback-entry="${feedbackEntryPoint}"`
      : `data-feedback="${escapeHtml(feedback ?? `Раздел "${label}" пока в разработке`)}"`;
  const feedbackClass = route || feedbackEntryPoint ? '' : ' js-feedback';
  const iconMarkup = iconName === 'lessons'
    ? `
      <span class="bottom-nav__icon bottom-nav__icon--lessons" aria-hidden="true">
        <span class="bottom-nav__symbol bottom-nav__symbol--book"></span>
        <span class="bottom-nav__symbol bottom-nav__symbol--paw"></span>
      </span>
    `
    : `<span class="bottom-nav__icon bottom-nav__icon--${iconName}" aria-hidden="true"></span>`;

  return `
    <button class="bottom-nav__tab${feedbackClass}${activeClass}" type="button" ${attrs}${lessonNavAttributes}>
      <span class="bottom-nav__content">
        ${iconMarkup}
        <span class="bottom-nav__label">${label}</span>
      </span>
    </button>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
