import { SituationSlug, SituationVideo } from './lib/videos';
import { renderEmojiText } from './lib/emoji';
import { formatLessonFeedbackCopy } from './lib/feedback-copy';
import localVideoCatalog from './local-video-catalog.json';
import lessonFeedbackPrompts from './lesson-feedback-prompts.json';
import videoDescriptions from './video-descriptions.json';

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
  | 'fears-space-organization'
  | 'fears-follows-tail'
  | 'care-claws'
  | 'care-paws'
  | 'care-grooming'
  | 'fitness-bow'
  | 'fitness-crawl'
  | 'fitness-bunny'
  | 'fitness-house'
  | 'fitness-paw'
  | 'fitness-back'
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
  | 'adult-large-grooming'
  | 'adult-large-eight'
  | 'adult-large-go-around'
  | 'adult-large-wipe-muzzle'
  | 'adult-large-jump-over-leg'
  | 'adult-large-bow';

export type AppRoute =
  | 'home'
  | 'fitness'
  | 'complex'
  | 'complex-levels:timed'
  | 'complex-levels:self-check'
  | 'puppies'
  | 'adult-large'
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
        meta: '5 видео',
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
            title: 'Команда «рядом»',
            description: 'Закладываем понятное положение рядом и первые шаги в спокойном темпе',
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
        meta: '2 видео',
        imagePath: '/assets/icons/podbor_puppy.webp',
        lessons: [
          {
            title: 'Как отучить подбирать с земли?',
            description: 'Показываем рабочую схему с переключением внимания и простыми упражнениями',
          },
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
        meta: '4 видео',
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
          {
            title: 'Моя собака ко всем лезет',
            description: 'Работаем с реакцией щенка на велосипеды, кошек, птиц и прохожих',
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
            description: 'Собираем дома зону, в которой щенку проще расслабиться и восстановиться',
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
        slug: 'fears-space-organization',
        title: 'Щенок дома',
        description: 'Домашняя среда, в которой щенку проще успокаиваться и чувствовать себя безопасно',
        meta: '1 видео',
        imagePath: '/assets/icons/order_puppy.webp',
        lessons: [
          {
            title: 'Щенок дома',
            description: 'Подстраиваем домашнюю среду так, чтобы тревожности было меньше',
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
    description: 'Гигиена, лапы и груминг через согласие, ритуалы и предсказуемость',
    meta: '3 раздела',
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
      {
        slug: 'care-grooming',
        title: 'Груминг',
        description: 'Как часто мыть, что использовать и как сделать уход понятнее для щенка',
        meta: '1 видео',
        imagePath: '/assets/icons/hair_puppy.webp',
        lessons: [
          {
            title: 'Груминг: как часто мыть и что использовать',
            description: 'Собираем базовый домашний уход без борьбы и лишнего стресса',
          },
        ],
      },
    ],
  },
  {
    slug: 'fitness',
    title: 'Фитнес',
    description: 'Упражнения на координацию, контроль тела и контакт',
    meta: '6 разделов',
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
        slug: 'fitness-back',
        title: '«Назад»',
        description: 'Осознанное движение назад и более точная работа с телом',
        meta: '1 видео',
        imagePath: '/assets/icons/back_puppy.webp',
        lessons: [
          {
            title: '«Назад»',
            description: 'Учимся двигаться задним ходом через узкий коридор и наведение',
          },
        ],
      },
      {
        slug: 'fitness-wipe-muzzle',
        title: 'Вытри морду',
        description: 'Полезный бытовой навык через спокойную работу с мишенью',
        meta: '1 видео',
        imagePath: '/assets/icons/tap_puppy.webp',
        lessons: [
          {
            title: 'Вытри морду (тач на тряпочку)',
            description: 'Формируем спокойное касание тряпочки и переносим навык в бытовой уход',
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
      {
        slug: 'fitness-crawl',
        title: 'Ползи',
        description: 'Низкая позиция, координация и более внимательная работа с телом',
        meta: '1 видео',
        imagePath: '/assets/icons/polzi_puppy.webp.webp',
        lessons: [
          {
            title: 'Ползи',
            description: 'Учимся двигаться низко и мягко без лишнего перевозбуждения',
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
        description: 'Поводок, команда «рядом», остановки и усложнение в обычной жизни',
        meta: '5 видео',
        imagePath: '/assets/icons/leash.webp',
        lessons: [
          { title: 'Как отучить тянуть поводок?', description: 'Разбираем причины натяжения поводка и собираем спокойную механику прогулки' },
          { title: 'Ошейник или шлейка?', description: 'Как подобрать амуницию под сценарии прогулки и особенности собаки', coverPath: '/assets/covers/ideal_prog.webp' },
          { title: 'Поводок или рулетка?', description: 'Сравниваем варианты амуниции и выбираем подходящий формат прогулки', coverPath: '/assets/covers/povod_rulet.webp' },
          { title: 'Команда «рядом»', description: 'Собираем базовый навык движения рядом с человеком' },
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
        meta: '4 видео',
        imagePath: '/assets/icons/big_ignor.webp',
        lessons: [
          { title: 'Упражнение против отвлечений (1-2-3)', description: 'Возвращаем собаку в понятный ритм при сильных отвлечениях', coverPath: '/assets/covers/1-2-3.webp' },
          { title: 'Выдержка: не срываемся на всё подряд', description: 'Развиваем импульс-контроль на фоне раздражителей' },
          { title: 'Топ интересных игр на прогулке, или как наладить контакт', description: 'Подбираем игры, которые усиливают ценность человека на улице', coverPath: '/assets/covers/igri.webp' },
          { title: 'Моя собака ко всем лезет', description: 'Работаем с сильным интересом к людям, животным и движущимся объектам' },
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
    description: 'Когти, лапы и груминг через предсказуемость и согласие',
    meta: '3 раздела',
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
      { slug: 'adult-large-grooming', title: 'Груминг', description: 'Понятный и спокойный сценарий домашнего ухода', meta: '1 видео', imagePath: '/assets/icons/big_grum.webp', lessons: [
        { title: 'Груминг', description: 'Выстраиваем комфортный бытовой ритм ухода' },
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
        { title: 'Вытри морду', description: 'Формируем аккуратное касание мордой подготовленной поверхности' },
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
    'fears-space-organization',
    'Щенок дома',
    'map-puppy-fears-space',
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
  ['fears-space-organization', 'Щенок дома', '/assets/covers/puppy-home.webp'],
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
  ['fitness-wipe-muzzle', 'Вытри морду (тач на тряпочку)', '/assets/covers/wipe-muzzle.webp'],
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
  { topicSlug: 'walk-leash', lessonTitle: 'Команда «рядом»', descriptionId: '23' },
  { topicSlug: 'walk-leash', lessonTitle: '«Стоп» перед дорогой', descriptionId: '06' },
  { topicSlug: 'walk-food-pickup', lessonTitle: 'Намордник без драмы', descriptionId: '04' },
  { topicSlug: 'walk-recall', lessonTitle: 'Команда «Ко мне!» и «кличка»', descriptionId: '09' },
  { topicSlug: 'walk-recall', lessonTitle: 'Собака слушает вас, а не улицу', descriptionId: '08' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Упражнение против отвлечений (1-2-3)', descriptionId: '10' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Выдержка: не срываемся на всё подряд', descriptionId: '11' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Топ интересных игр на прогулке, или как наладить контакт', descriptionId: '12' },
  { topicSlug: 'walk-ignore-triggers', lessonTitle: 'Моя собака ко всем лезет', descriptionId: '13' },
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
  { topicSlug: 'conflicts-resource-guarding', lessonTitle: 'Охраняет чашку, вещи и игрушки', descriptionId: '14' },
  { topicSlug: 'conflicts-barks-at-people', lessonTitle: 'Лает на людей или собак', descriptionId: '29' },
  { topicSlug: 'conflicts-neutering', lessonTitle: 'Кастрировать или стерилизовать?', descriptionId: '18' },
  { topicSlug: 'fears-sounds', lessonTitle: 'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)', descriptionId: '31' },
  { topicSlug: 'fears-cars', lessonTitle: 'Приучаем постепенно к машине', descriptionId: '16' },
  { topicSlug: 'fears-new-places', lessonTitle: 'Страх лестницы и лифта', descriptionId: '17' },
  { topicSlug: 'fears-place-command', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'fears-space-organization', lessonTitle: 'Щенок дома', descriptionId: '02' },
  { topicSlug: 'fears-follows-tail', lessonTitle: 'Ходит хвостиком + Как минимизировать тревожность?', descriptionId: '20' },
  { topicSlug: 'care-claws', lessonTitle: 'Когти: анатомия когтя и стрижка', descriptionId: '43' },
  { topicSlug: 'care-paws', lessonTitle: 'Лапы', descriptionId: '44' },
  { topicSlug: 'fitness-bow', lessonTitle: 'Поклон', descriptionId: '40' },
  { topicSlug: 'fitness-bunny', lessonTitle: 'Зайка', descriptionId: '58' },
  { topicSlug: 'fitness-house', lessonTitle: 'Домик', descriptionId: '59' },
  { topicSlug: 'fitness-paw', lessonTitle: '«Дай лапу»', descriptionId: '54' },
  { topicSlug: 'fitness-spin', lessonTitle: 'Круть-верть', descriptionId: '55' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Как отучить тянуть поводок?', descriptionId: '22' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Ошейник или шлейка?', descriptionId: '21' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Поводок или рулетка?', descriptionId: '23' },
  { topicSlug: 'adult-large-leash', lessonTitle: 'Команда «рядом»', descriptionId: '23' },
  { topicSlug: 'adult-large-leash', lessonTitle: '«Дорога» и «стоп»', descriptionId: '24' },
  { topicSlug: 'adult-large-food-pickup', lessonTitle: 'Импульс-контроль + Выдержка', descriptionId: '07' },
  { topicSlug: 'adult-large-food-pickup', lessonTitle: 'Намордник без драмы', descriptionId: '04' },
  { topicSlug: 'adult-large-recall', lessonTitle: 'Контакт', descriptionId: '08' },
  { topicSlug: 'adult-large-recall', lessonTitle: 'Ко мне', descriptionId: '09' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Упражнение против отвлечений (1-2-3)', descriptionId: '25' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Выдержка: не срываемся на всё подряд', descriptionId: '26' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Топ интересных игр на прогулке, или как наладить контакт', descriptionId: '27' },
  { topicSlug: 'adult-large-ignore-triggers', lessonTitle: 'Моя собака ко всем лезет', descriptionId: '28' },
  { topicSlug: 'adult-large-barking', lessonTitle: 'Команда «тише»', descriptionId: '36' },
  { topicSlug: 'adult-large-barking', lessonTitle: 'Приучаем к звукам: домофон и хлопки', descriptionId: '37' },
  { topicSlug: 'adult-large-loneliness', lessonTitle: 'Убираем страх и повышаем уверенность в себе', descriptionId: '15' },
  { topicSlug: 'adult-large-loneliness', lessonTitle: 'Правильная организация пространства', descriptionId: '02' },
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
  { topicSlug: 'adult-large-place-space', lessonTitle: 'Команда «место»', descriptionId: '19' },
  { topicSlug: 'adult-large-follows-tail', lessonTitle: 'Ходит хвостиком + Как минимизировать тревожность?', descriptionId: '20' },
  { topicSlug: 'adult-large-sounds', lessonTitle: 'Боязнь звуков', descriptionId: '31' },
  { topicSlug: 'adult-large-cars', lessonTitle: 'Приучаем постепенно к машине', descriptionId: '32' },
  { topicSlug: 'adult-large-new-places', lessonTitle: 'Страх лестницы и лифта', descriptionId: '33' },
  { topicSlug: 'adult-large-paws', lessonTitle: 'Лапы', descriptionId: '44' },
  { topicSlug: 'adult-large-eight', lessonTitle: 'Восемь', descriptionId: '45' },
  { topicSlug: 'adult-large-go-around', lessonTitle: 'Обойди', descriptionId: '46' },
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

function getLessonVideoFromRoute(route: AppRoute): LessonVideoEntry | null {
  if (!route.startsWith('lesson-video:')) {
    return null;
  }

  return lessonVideosById.get(route.slice('lesson-video:'.length)) ?? null;
}

export function createAppMarkup(
  route: AppRoute,
  activeFilter: PuppyFilter,
  videosState: SituationVideosState,
): string {
  const lessonVideo = getLessonVideoFromRoute(route);

  if (lessonVideo) {
    return createLessonPlayerMarkup(lessonVideo);
  }

  if (route === 'complex') {
    return createComplexMarkup();
  }

  if (route === 'fitness') {
    return createSituationTopicsMarkup('fitness', 'home', true);
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
    '/assets/images/programs/puppy-hero.webp',
    '/assets/images/programs/fitness-hero.webp',
    '/assets/icons/comp_lil_time.webp',
    '/assets/icons/comp_middle_time.webp',
    '/assets/icons/comp_big_time.webp',
    '/assets/icons/comp_lil_check.webp',
    '/assets/icons/comp_middle_check.webp',
    '/assets/icons/comp_big_check.webp',
  ].map(resolveCardImagePath);

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

  return [...new Set(paths)];
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

              <button
                class="hero-card__cta js-feedback"
                type="button"
                data-feedback="Видео будет доступно позже"
              >
                <span class="hero-card__cta-icon" aria-hidden="true"></span>
                <span>Смотреть видео</span>
              </button>
            </div>

            <div class="hero-card__media">
              <img class="hero-card__dog" src="/assets/hero-dog.webp" alt="" />
            </div>
          </section>

          <section class="section-block" aria-labelledby="useful-title">
            <div class="section-heading">
              <h2 id="useful-title">Полезное</h2>
              <button
                class="section-link js-feedback"
                type="button"
                data-feedback="Раздел со всеми материалами пока в разработке"
              >
                <span>Смотреть всё</span>
                <span class="section-link__arrow" aria-hidden="true"></span>
              </button>
            </div>

            <div class="useful-grid" role="list" aria-label="Полезные материалы">
              ${createUsefulCard('Спросить у кинолога', '/assets/icons/ask_kinolog.webp', 'useful-card--ask', undefined, 'home')}
              ${createUsefulCard('Сезонные темы', '/assets/icons/seasons.webp', 'useful-card--seasonal')}
              ${createUsefulCard('Комплекс', '/assets/icons/course.webp', 'useful-card--course', 'complex')}
              ${createUsefulCard(
                'Фитнес',
                '/assets/icons/gantel.webp',
                'useful-card--fitness',
                'fitness',
              )}
            </div>
          </section>

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
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('home')}
    </div>
  `;
}

function createSubpageHeaderMarkup(title: string, backRoute: AppRoute): string {
  return `
    <header class="subpage-header">
      <div class="content-frame">
        <div class="subpage-header__inner subpage-header__inner--branded">
          <button class="subpage-header__logo-button" type="button" data-route="home" aria-label="На главную">
            <img class="subpage-header__logo" src="/assets/logo-dog.svg" alt="" aria-hidden="true" />
          </button>
          <h1 class="subpage-title">${escapeHtml(title)}</h1>
          <button class="back-button" type="button" data-route="${escapeHtml(backRoute)}" aria-label="Назад">
            <span class="back-button__icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </header>
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
              <h2>Подразделы</h2>
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

function createSituationTopicsMarkup(
  slug: PuppySituationSlug,
  backRoute: AppRoute = 'puppies',
  includeAdultFitness = false,
): string {
  const situation = puppySituationsBySlug.get(slug);

  if (!situation) {
    return createPuppiesMarkup('all');
  }

  const heroMarkup =
    situation.slug === 'fitness'
      ? `
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
        `
      : '';

  const topicSectionsMarkup =
    situation.slug === 'fitness'
      ? `
          <section class="section-block section-block--detail-first" aria-labelledby="puppy-fitness-topics-title">
            <div class="section-heading section-heading--solo">
              <h2 id="puppy-fitness-topics-title">${includeAdultFitness ? 'Для щенков' : 'Подразделы'}</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic, index) => createTopicCard(topic, index, 'blue')).join('')}
            </div>
          </section>

          ${includeAdultFitness
            ? `
                <section class="section-block" aria-labelledby="adult-fitness-topics-title">
                  <div class="section-heading section-heading--solo">
                    <h2 id="adult-fitness-topics-title">Для взрослых собак</h2>
                  </div>
                  <div class="topic-list">
                    ${
                      adultLargeSituationsBySlug
                        .get('adult-large-fitness')
                        ?.topics.map((topic, index) => createAdultLargeTopicCard(topic, index, 'blue'))
                        .join('') ?? ''
                    }
                  </div>
                </section>
              `
            : ''}
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
      ${createSubpageHeaderMarkup(situation.title, backRoute)}

      <main class="screen-content">
        <div class="content-frame">
          ${heroMarkup}
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

  const backRoute: AppRoute = `puppy-situation:${topic.parentSlug}`;

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

function createLessonPlayerMarkup(video: LessonVideoEntry): string {
  const escapedTitle = escapeHtml(video.title);
  const titleMarkup = createPlayerTitleMarkup(video.title);
  const descriptionMarkup = video.description
    ? createLessonDescriptionMarkup(video.description, video.id, video.title)
    : '';
  const escapedVideoId = escapeHtml(video.mediaId ?? video.id);
  const escapedSourceType = escapeHtml(video.sourceType ?? 'hls');

  return `
    <div class="app-shell">
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

type LessonDescriptionBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'steps'; items: Array<{ number: string; title: string; details: string[] }> }
  | { type: 'bullets'; items: string[] }
  | { type: 'mistakes'; items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'flow'; text: string }
  | { type: 'separator' };

interface LessonDescriptionSection {
  title: string | null;
  tone: LessonDescriptionTone;
  lines: string[];
}

function createLessonDescriptionMarkup(description: string, lessonId: string, lessonTitle: string): string {
  const { body, feedbackPrompt } = extractLessonFeedbackPrompt(description);
  const sections = parseLessonDescriptionSections(body);
  const content = sections
    .map((section) => createLessonDescriptionSectionMarkup(section))
    .join('');
  const feedbackMarkup = feedbackPrompt
    ? createLessonFeedbackMarkup(feedbackPrompt, lessonId, lessonTitle)
    : '';

  return `<article class="lesson-player-card__description lesson-description">${content}${feedbackMarkup}</article>`;
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
        <span class="lesson-feedback-cta__message-icon" aria-hidden="true"></span>
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
  const normalizedLine = line.replace(/:$/, '');

  if (
    /^(?:Как (?:учим|играем|работаем|кормим|приучаем|организуем|выполняем)|Подготовка|Результат|Частые ошибки|Особенности 🐾|Важные особенности 🐾|Что важно (?:понять|помнить 🐾)|Что можно использовать|Как устроен коготь 🐾|Зачем .+ 🐾)$/.test(normalizedLine)
  ) {
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
  if (title.startsWith('Частые ошибки')) {
    return 'mistakes';
  }

  if (title.includes('Особенности') || title.includes('Важно') || title.endsWith('🐾')) {
    return 'note';
  }

  return 'default';
}

function createLessonDescriptionSectionMarkup(section: LessonDescriptionSection): string {
  const sectionClass = [
    'lesson-description__section',
    section.title ? '' : 'lesson-description__section--intro',
    section.tone !== 'default' ? `lesson-description__section--${section.tone}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const visibleTitle = section.title?.replace(/\s*🐾\s*$/, '') ?? '';
  const headingIcon = section.tone === 'note'
    ? createLessonDescriptionIcon('note')
    : '';
  const titleMarkup = section.title
    ? `<h2 class="lesson-description__heading">${headingIcon}<span>${escapeHtml(visibleTitle)}</span></h2>`
    : '';

  return `
    <section class="${sectionClass}">
      ${titleMarkup}
      ${createLessonDescriptionBlocksMarkup(section.lines, !section.title)}
    </section>
  `;
}

function createLessonDescriptionBlocksMarkup(
  lines: string[],
  emphasizeFirstParagraph = false,
): string {
  const blocks: LessonDescriptionBlock[] = [];
  let paragraphLines: string[] = [];
  let stepItems: Array<{ number: string; title: string; details: string[] }> = [];
  let bulletItems: string[] = [];
  let mistakeItems: string[] = [];

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

    if (line.startsWith('💬') || line.endsWith('💬')) {
      flushAll();
      blocks.push({
        type: 'callout',
        text: line.replace(/^(?:💬\s*)|(?:\s*💬)$/gu, '').trim(),
      });
      return;
    }

    if (line.startsWith('❌')) {
      flushParagraph();
      flushSteps();
      flushBullets();
      mistakeItems.push(line.replace(/^❌\s*/, ''));
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
          .map((item) => `<li>${createLessonDescriptionIcon('mistake')}<span>${renderEmojiText(item)}</span></li>`)
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
    return `
      <aside class="lesson-description__callout">
        <span class="lesson-description__callout-icon">${createLessonDescriptionIcon('message')}</span>
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
    return '<span class="lesson-description__icon lesson-description__icon--note" aria-hidden="true"></span>';
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
        <span class="video-card__description">${escapeHtml(video.description)}</span>
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
  imagePath: string,
  cardClass: string,
  action: { route?: AppRoute; feedback?: string },
): string {
  const cardClassAttr = action.route
    ? `class="program-card ${cardClass}"`
    : `class="program-card ${cardClass} js-feedback"`;
  const extraAttrs = action.route
    ? `data-route="${action.route}"`
    : `data-feedback="${escapeHtml(action.feedback ?? '')}"`;

  return `
    <button
      ${cardClassAttr}
      type="button"
      ${extraAttrs}
    >
      <span class="program-card__media">
        <img src="${imagePath}" alt="" />
      </span>
      <span class="program-card__body">
        <span class="program-card__title">${titleMarkup}</span>
        <span class="program-card__description">${description}</span>
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
      data-route="puppy-situation:${situation.slug}"
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
  const attrs = route
    ? `data-route="${route}"`
    : feedbackEntryPoint
      ? `data-feedback-open data-feedback-entry="${feedbackEntryPoint}"`
      : `data-feedback="${escapeHtml(feedback ?? `Раздел "${label}" пока в разработке`)}"`;
  const feedbackClass = route || feedbackEntryPoint ? '' : ' js-feedback';

  return `
    <button class="bottom-nav__tab${feedbackClass}${activeClass}" type="button" ${attrs}>
      <span class="bottom-nav__content">
        <span class="bottom-nav__icon bottom-nav__icon--${iconName}" aria-hidden="true"></span>
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

