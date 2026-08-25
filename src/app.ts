import { SituationSlug, SituationVideo } from './lib/videos';

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

export type AdultSmallSituationSlug =
  | 'adult-small-ideal-walk'
  | 'adult-small-calm-home'
  | 'adult-small-aggression-conflicts'
  | 'adult-small-fears-anxiety'
  | 'adult-small-care-without-fight'
  | 'adult-small-fitness';

export type AdultSmallTopicSlug =
  | 'adult-small-leash'
  | 'adult-small-food-pickup'
  | 'adult-small-muzzle'
  | 'adult-small-recall'
  | 'adult-small-ignore-triggers'
  | 'adult-small-games-contact'
  | 'adult-small-dog-to-everyone'
  | 'adult-small-barking'
  | 'adult-small-loneliness'
  | 'adult-small-jumping-on-guests'
  | 'adult-small-begging'
  | 'adult-small-feeding'
  | 'adult-small-toilet'
  | 'adult-small-overaroused-play'
  | 'adult-small-resource-guarding'
  | 'adult-small-barks-at-people'
  | 'adult-small-neutering'
  | 'adult-small-scooters-bikes'
  | 'adult-small-place-space'
  | 'adult-small-follows-tail'
  | 'adult-small-sounds'
  | 'adult-small-cars'
  | 'adult-small-new-places'
  | 'adult-small-claws'
  | 'adult-small-paws'
  | 'adult-small-grooming'
  | 'adult-small-go-around'
  | 'adult-small-wipe-muzzle';

export type AppRoute =
  | 'home'
  | 'complex'
  | 'complex-levels:timed'
  | 'complex-levels:self-check'
  | 'puppies'
  | 'adult-large'
  | 'adult-small'
  | `lesson-video:${string}`
  | `puppy-situation:${PuppySituationSlug}`
  | `puppy-topic:${PuppyTopicSlug}`
  | `adult-large-situation:${AdultLargeSituationSlug}`
  | `adult-large-topic:${AdultLargeTopicSlug}`
  | `adult-small-situation:${AdultSmallSituationSlug}`
  | `adult-small-topic:${AdultSmallTopicSlug}`;

export type PuppyFilter = 'all' | 'home' | 'walk' | 'behavior' | 'commands';

export type SituationVideosState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; videos: SituationVideo[] }
  | { status: 'error'; message: string };

interface PuppyLessonItem {
  title: string;
  description: string;
  coverPath?: string;
  video?: {
    id: string;
    rutubeUrl?: string;
    youtubeUrl?: string;
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
  cardClass: string;
  lessons: PuppyLessonItem[];
  videoSourceSlug?: SituationSlug;
}

interface PuppySituation {
  slug: PuppySituationSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  category: Exclude<PuppyFilter, 'all'>;
  topics: PuppyTopic[];
}

interface AdultLargeTopic {
  slug: AdultLargeTopicSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  lessons: PuppyLessonItem[];
}

interface AdultLargeSituation {
  slug: AdultLargeSituationSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  topics: AdultLargeTopic[];
}

interface AdultSmallTopic {
  slug: AdultSmallTopicSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  lessons: PuppyLessonItem[];
}

interface AdultSmallSituation {
  slug: AdultSmallSituationSlug;
  title: string;
  description: string;
  meta: string;
  imagePath: string;
  cardClass: string;
  topics: AdultSmallTopic[];
}

const legacyPuppySituations: PuppySituation[] = [
  {
    slug: 'ideal-walk',
    title: 'Идеальная прогулка',
    description: 'Базовые навыки прогулки, контакт и спокойная работа с раздражителями',
    meta: '4 раздела',
    imagePath: '/assets/icons/leash.webp',
    cardClass: 'situation-card--blue',
    category: 'walk',
    topics: [
      {
        slug: 'walk-leash',
        title: 'Поводок',
        description: 'Поводок, амуниция, команда рядом и контроль движения',
        meta: '4 видео',
        imagePath: '/assets/icons/leash.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Ошейник или шлейка?',
            description: 'Разбираем, как выбрать амуницию под щенка и прогулочный сценарий',
          },
          {
            title: 'Техника владения поводком и экстренный разворот',
            description: 'Почему щенок тянет и как спокойно перехватывать внимание на улице',
          },
          {
            title: 'Обычный поводок или рулетка и команда рядом',
            description: 'Когда рулетка мешает обучению и как начать аккуратную работу рядом',
          },
          {
            title: 'Дорога и стоп',
            description: 'Учимся безопасно останавливаться и проходить сложные участки маршрута',
          },
        ],
      },
      {
        slug: 'walk-food-pickup',
        title: 'Подбор еды',
        description: 'Профилактика подбора и экологичный импульс-контроль',
        meta: '2 видео',
        imagePath: '/assets/useful-warning.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Фокус на кусок, пинцетик и импульс-контроль',
            description: 'Один блок упражнений для переключения внимания на прогулке',
          },
          {
            title: 'Намордник и природные инстинкты',
            description: 'Почему важно закрывать базовые потребности, а не только запрещать',
          },
        ],
      },
      {
        slug: 'walk-recall',
        title: 'Подзыв',
        description: 'Сильный отклик на кличку и движение к человеку без давления',
        meta: '2 видео',
        imagePath: '/assets/images/programs/puppy.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Ко мне и кличка',
            description: 'Строим понятный маркер возврата и закрепляем его в быту',
          },
          {
            title: 'Контакт',
            description: 'Отворотики, йо-йо и подкрепление за взгляд на улице',
          },
        ],
      },
      {
        slug: 'walk-ignore-triggers',
        title: 'Игнорирование раздражителей',
        description: 'Контакт, игры и навыки прохождения сложных стимулов',
        meta: '4 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: '1-2-3',
            description: 'Ритмичное упражнение, которое помогает вернуть собаку в контакт',
          },
          {
            title: 'Импульс-контроль',
            description: 'Спокойная выдержка и управление возбуждением на прогулке',
          },
          {
            title: 'Игры для контакта на прогулке',
            description: 'Подбор коротких активностей, которые делают человека интереснее улицы',
          },
          {
            title: 'Моя собака ко всем лезет',
            description: 'Работаем с кошками, птицами, велосипедами и случайными прохожими',
          },
        ],
      },
    ],
  },
  {
    slug: 'calm-home',
    title: 'Спокойный дом',
    description: 'Домашний режим, уверенность, правила и бытовые сценарии без хаоса',
    meta: '5 разделов',
    imagePath: '/assets/icons/home.webp',
    cardClass: 'situation-card--rose',
    category: 'home',
    topics: [
      {
        slug: 'home-barking',
        title: 'Лай',
        description: 'Спокойная работа с возбуждением, звуками и закреплённым лаем',
        meta: '2 видео',
        imagePath: '/assets/useful-warning.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Команда тише',
            description: 'Закладываем понятный бытовой сигнал без наказаний',
          },
          {
            title: 'Приучаем к звукам',
            description: 'Работаем с бытовыми шумами и помогаем щенку не перегружаться',
          },
        ],
      },
      {
        slug: 'home-loneliness',
        title: 'Одиночество',
        description: 'Уверенность в себе, безопасное пространство и мягкое увеличение дистанции',
        meta: '3 видео',
        imagePath: '/assets/images/situations/puppy-whines-night.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Повышаем уверенность в себе',
            description: 'Учим щенка проживать паузы без постоянного контроля человека',
          },
          {
            title: 'Правильная организация пространства',
            description: 'Собираем дома зону, в которой щенок умеет успокаиваться',
          },
          {
            title: 'Постепенно остаёмся одному',
            description: 'Пошагово увеличиваем время отсутствия без резких скачков',
          },
        ],
      },
      {
        slug: 'home-jumping-on-guests',
        title: 'Прыжки на гостей',
        description: 'Правильный приход, ожидание и сценарии встречи без перевозбуждения',
        meta: '1 видео',
        imagePath: '/assets/images/programs/teen_dog.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Правильный приход и выход',
            description: 'Собираем сценарий сидеть и ждать при встрече гостей',
          },
        ],
      },
      {
        slug: 'home-begging',
        title: 'Попрошайничество',
        description: 'Место, насыщение и полезные бытовые активности вместо попрошайничества',
        meta: '3 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Место',
            description: 'Формируем удобную точку отдыха во время еды и бытовой суеты',
          },
          {
            title: 'Долгоиграющие лакомства и умные девайсы',
            description: 'Конг, лизательные и нюхательные коврики как часть ежедневного ритуала',
          },
          {
            title: 'Питание',
            description: 'Как режим и рацион влияют на бытовое поведение щенка',
          },
        ],
      },
      {
        slug: 'home-toilet',
        title: 'Туалет',
        description: 'Пелёнка, улица, режим и работа с запахом без наказаний',
        meta: '3 видео',
        imagePath: '/assets/images/situations/puppy-toilet-home.webp',
        cardClass: 'topic-card--rose',
        videoSourceSlug: 'puppy-toilet-home',
        lessons: [
          {
            title: 'Приучение к пелёнке и средства от запаха',
            description: 'Разбираем рабочую схему дома и средства, которые реально помогают',
          },
          {
            title: 'Приучение к улице и режим',
            description: 'Как выстроить ритм прогулок, чтобы щенку было проще попасть в успех',
          },
          {
            title: 'Метки дома',
            description: 'Когда это норма, когда повод проверить контекст и как реагировать спокойно',
          },
        ],
      },
    ],
  },
  {
    slug: 'aggression-conflicts',
    title: 'Агрессия и конфликты',
    description: 'Сложное поведение, охрана ресурсов и экологичная профилактика эскалации',
    meta: '5 разделов',
    imagePath: '/assets/icons/alarm.webp',
    cardClass: 'situation-card--blue',
    category: 'behavior',
    topics: [
      {
        slug: 'conflicts-biting-hands',
        title: 'Грызёт руки и ноги',
        description: 'Правильная игра, самоконтроль и снижение перегруза',
        meta: '1 видео',
        imagePath: '/assets/images/situations/puppy-bites.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Спокойная и правильная игра',
            description: 'Как не усиливать кусание и чем заменить хаотичное возбуждение',
          },
        ],
      },
      {
        slug: 'conflicts-vandal',
        title: 'Мой щенок вандалит',
        description: 'Разносит квартиру, портит вещи и не умеет сам успокаиваться',
        meta: '1 видео',
        imagePath: '/assets/images/situations/puppy-chews-things.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Щенок вандалит дома',
            description: 'Смотрим на причины разрушительного поведения и собираем бытовую профилактику',
          },
        ],
      },
      {
        slug: 'conflicts-resource-guarding',
        title: 'Охраняет чашку, вещи, игрушки',
        description: 'Профилактика ресурсной охраны и безопасная работа рядом с ценными объектами',
        meta: '1 видео',
        imagePath: '/assets/images/programs/adult_dog.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Охрана ресурсов',
            description: 'Как не усиливать напряжение вокруг еды, игрушек и предметов',
          },
        ],
      },
      {
        slug: 'conflicts-barks-at-people',
        title: 'Лает на людей и собак',
        description: 'Дистанция, безопасность и управляемый контакт без давления',
        meta: '1 видео',
        imagePath: '/assets/useful-warning.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Лай на людей и собак',
            description: 'Разбираем причины и первые шаги к более устойчивому поведению',
          },
        ],
      },
      {
        slug: 'conflicts-neutering',
        title: 'Кастрировать или стерилизовать',
        description: 'Контекст, возраст и поведенческие ожидания от решения',
        meta: '1 видео',
        imagePath: '/assets/useful-heart.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Кастрация и стерилизация',
            description: 'Что реально меняет операция и какие вопросы стоит обсудить заранее',
          },
        ],
      },
    ],
  },
  {
    slug: 'fears-anxiety',
    title: 'Страхи и тревожность',
    description: 'Постепенное привыкание, безопасность и снижение тревоги в новых сценариях',
    meta: '9 разделов',
    imagePath: '/assets/icons/sad_puppy.webp',
    cardClass: 'situation-card--rose',
    category: 'behavior',
    topics: [
      {
        slug: 'fears-sounds',
        title: 'Звуки',
        description: 'КО на звуки и постепенное привыкание без перегруза',
        meta: '1 видео',
        imagePath: '/assets/useful-warning.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Контробусловливание на звуки',
            description: 'Помогаем щенку безопасно переживать неожиданные и резкие шумы',
          },
        ],
      },
      {
        slug: 'fears-cars',
        title: 'Машины',
        description: 'Постепенное привыкание к машине и полезные девайсы в дороге',
        meta: '1 видео',
        imagePath: '/assets/images/programs/teen_dog.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Привыкаем к машине',
            description: 'Пошагово снижаем тревогу и собираем комфортный сценарий поездки',
          },
        ],
      },
      {
        slug: 'fears-new-places',
        title: 'Новые места',
        description: 'Лестницы, лифты и базовая техника безопасности в незнакомой среде',
        meta: '1 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Страх новых мест',
            description: 'Как вводить лестницы, лифты и новые локации в комфортном темпе',
          },
        ],
      },
      {
        slug: 'fears-place-command',
        title: 'Команда место',
        description: 'Организация пространства и понятная точка отдыха',
        meta: '1 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Место и организация пространства',
            description: 'Собираем бытовой якорь, который помогает щенку успокаиваться',
          },
        ],
      },
      {
        slug: 'fears-follows-tail',
        title: 'Ходит хвостиком',
        description: 'Как снизить тревожность и научить спокойно оставаться в другой комнате',
        meta: '1 видео',
        imagePath: '/assets/images/situations/puppy-whines-night.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Минимизируем тревожность',
            description: 'Упражнения с оставлением в комнатах и работа с зависанием на человеке',
          },
        ],
      },
    ],
  },
  {
    slug: 'care-without-fight',
    title: 'Уход без борьбы',
    description: 'Гигиена, лапы и груминг через согласие и предсказуемые ритуалы',
    meta: '3 раздела',
    imagePath: '/assets/icons/puppy_hand.webp',
    cardClass: 'situation-card--blue',
    category: 'home',
    topics: [
      {
        slug: 'care-claws',
        title: 'Когти',
        description: 'Анатомия когтя и мягкое приучение к стрижке',
        meta: '1 видео',
        imagePath: '/assets/useful-warning.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Стрижка когтей',
            description: 'Разбираем анатомию когтя и безопасную механику процедуры',
          },
        ],
      },
      {
        slug: 'care-paws',
        title: 'Лапы',
        description: 'Пять свобод, ванная и право отказаться',
        meta: '1 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Работа с лапами',
            description: 'Готовим пространство ванной и учим щенка доверять процессу',
          },
        ],
      },
      {
        slug: 'care-grooming',
        title: 'Груминг',
        description: 'Как часто мыть и какие средства использовать',
        meta: '1 видео',
        imagePath: '/assets/useful-heart.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Груминг без борьбы',
            description: 'Собираем базовый домашний уход и ритм процедур',
          },
        ],
      },
    ],
  },
  {
    slug: 'fitness',
    title: 'Фитнес',
    description: 'Небольшие упражнения на контроль тела, координацию и совместную работу',
    meta: '6 разделов',
    imagePath: '/assets/icons/fitness.webp',
    cardClass: 'situation-card--rose',
    category: 'commands',
    topics: [
      {
        slug: 'fitness-bow',
        title: 'Поклон',
        description: 'Простое упражнение на контроль корпуса и концентрацию',
        meta: '1 видео',
        imagePath: '/assets/images/programs/puppy.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Поклон',
            description: 'Шаг за шагом собираем красивое и безопасное положение',
          },
        ],
      },
      {
        slug: 'fitness-crawl',
        title: 'Ползи',
        description: 'Работаем с низкой позой и вниманием к движению',
        meta: '1 видео',
        imagePath: '/assets/images/programs/puppy-hero.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Ползи',
            description: 'Учимся двигаться низко и мягко без избыточного возбуждения',
          },
        ],
      },
      {
        slug: 'fitness-bunny',
        title: 'Зайка',
        description: 'Контроль баланса и аккуратное удержание позиции',
        meta: '1 видео',
        imagePath: '/assets/useful-heart.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Зайка',
            description: 'Разбираем технику и ограничения, чтобы упражнение было безопасным',
          },
        ],
      },
      {
        slug: 'fitness-house',
        title: 'Домик',
        description: 'Координация, наведение и внимательная работа с позой',
        meta: '1 видео',
        imagePath: '/assets/useful-home.svg',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Домик',
            description: 'Собираем упражнение через понятные короткие шаги',
          },
        ],
      },
      {
        slug: 'fitness-paw',
        title: 'Дай лапу',
        description: 'Небольшой трюк для контакта и контроля импульса',
        meta: '1 видео',
        imagePath: '/assets/images/programs/adult_dog.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Дай лапу',
            description: 'Формируем упражнение без навязчивого махания лапами',
          },
        ],
      },
      {
        slug: 'fitness-back',
        title: 'Назад',
        description: 'Осознанное движение назад и работа с телом',
        meta: '1 видео',
        imagePath: '/assets/useful-leash.svg',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Назад',
            description: 'Учимся двигаться задним ходом через узкий коридор и наведение',
          },
        ],
      },
    ],
  },
];

void legacyPuppySituations;

const puppySituations: PuppySituation[] = [
  {
    slug: 'ideal-walk',
    title: 'Идеальная прогулка',
    description: 'Поводок, подзыв, контакт и спокойная прогулка без перегруза',
    meta: '4 раздела',
    imagePath: '/assets/icons/leash.webp',
    cardClass: 'situation-card--blue',
    category: 'walk',
    topics: [
      {
        slug: 'walk-leash',
        title: 'Поводок',
        description: 'Амуниция, движение рядом и безопасные остановки на улице',
        meta: '5 видео',
        imagePath: '/assets/icons/povodok.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Ошейник или шлейка?',
            description: 'Разбираем, какая амуниция подойдёт щенку в разных прогулочных сценариях',
            coverPath: '/assets/covers/ideal_prog.jpg',
            video: {
              id: 'puppy-leash-collar-harness',
              rutubeUrl: 'https://rutube.ru/video/private/d443968096289bc361898c707da0ee58/?p=tsIxAoB1riBx9xb8_6iZCQ',
            },
          },
          {
            title: 'Как отучить тянуть поводок?',
            description: 'Собираем базу для спокойного движения рядом без рывков и борьбы',
            coverPath: '/assets/covers/tech_vlad.jpg',
            video: {
              id: 'puppy-leash-stop-pulling',
              rutubeUrl: 'https://rutube.ru/video/private/50f87645b23d81233e282e6db2ea51c3/?p=-8xq2f8b9mCJEzBaMEJHyQ',
            },
          },
          {
            title: 'Поводок или рулетка? часть 1',
            description: 'Разбираем преимущества обычного поводка и подходящую длину для прогулки',
            coverPath: '/assets/covers/povod_rulet.jpg',
            video: {
              id: 'puppy-leash-or-retractable-part-1',
              rutubeUrl: 'https://rutube.ru/video/private/9b59314f3a0b3d4b7fa4cade3f33d3fe/?p=oINNpDLyhvs9EDcgNJqPRw',
            },
          },
          {
            title: 'Команда «рядом»',
            description: 'Закладываем понятное положение рядом и первые шаги в спокойном темпе',
          },
          {
            title: '«Стоп» перед дорогой',
            description: 'Учим щенка останавливаться перед дорогой и не вылетать вперёд',
            coverPath: '/assets/covers/stop_dor.jpg',
            video: {
              id: 'puppy-leash-stop-road',
              rutubeUrl: 'https://rutube.ru/video/private/7dc91c3b638a827929fa1694ddf0ea42/?p=UvF-NSJWeRelw8ztu2-9xA',
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
        cardClass: 'topic-card--rose',
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
        imagePath: '/assets/images/programs/puppy.webp',
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Упражнение против отвлечений (1-2-3)',
            description: 'Используем ритмичное упражнение 1-2-3, чтобы вернуть щенка в контакт',
            coverPath: '/assets/covers/1-2-3.jpg',
            video: {
              id: 'puppy-ignore-123',
              youtubeUrl: 'https://www.youtube.com/watch?v=TKXEGLmGbqg',
            },
          },
          {
            title: 'Выдержка: не срываемся на всё подряд',
            description: 'Собираем спокойное ожидание и уменьшаем импульсивные срывы на прогулке',
          },
          {
            title: 'Топ интересных игр на прогулке, или как наладить контакт',
            description: 'Подбираем короткие игры, которые делают человека интереснее улицы',
            coverPath: '/assets/covers/igri.jpg',
            video: {
              id: 'puppy-ignore-walk-games',
              rutubeUrl: 'https://rutube.ru/video/private/46783a74b756796dde6772ce8a236676/?p=qeRSB2nkWdolROO7DQBPAw',
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
    cardClass: 'situation-card--rose',
    category: 'home',
    topics: [
      {
        slug: 'home-barking',
        title: 'Лай',
        description: 'Снижаем перегруз от бытовых звуков и учим щенка быстрее успокаиваться',
        meta: '2 видео',
        imagePath: '/assets/icons/lai_puppy.webp',
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Правильный приход/выход из дома',
            description: 'Собираем спокойный ритуал входа и выхода без суеты и скачков возбуждения',
          },
          {
            title: 'Прыжки на гостей',
            description: 'Показываем, как заменить прыжки на более удобный и управляемый сценарий встречи',
            coverPath: '/assets/covers/gosti.jpg',
            video: {
              id: 'puppy-home-jumping-guests',
              rutubeUrl: 'https://rutube.ru/video/private/99c4bd449c359a3a468ee8a15952a754/?p=hwkZUtVsMO7qhs5PDW4E-Q',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Команда «место»',
            description: 'Формируем удобную точку отдыха на время еды и бытовой суеты',
            coverPath: '/assets/covers/mesto.jpg',
            video: {
              id: 'puppy-home-begging-place',
              rutubeUrl: 'https://rutube.ru/video/private/4ac32dd398d8501818454a1ff838af80/?p=VeSOJpWF9cYLy7g_voY4-Q',
            },
          },
          {
            title: 'Топ долгоиграющих лакомств и умных девайсов',
            description: 'Подбираем конг, лизательные и нюхательные коврики под повседневный ритм',
            coverPath: '/assets/covers/pogriz.jpg',
            video: {
              id: 'puppy-home-begging-enrichment',
              rutubeUrl: 'https://rutube.ru/video/private/c2313be833d702352d502ce8594a4e90/?p=RKaOJQl0742iR5Af36Gp-g',
            },
          },
          {
            title: 'Питание',
            description: 'Смотрим, как режим и рацион влияют на бытовое поведение щенка',
            coverPath: '/assets/covers/korm.jpg',
            video: {
              id: 'puppy-home-begging-feeding',
              rutubeUrl: 'https://rutube.ru/video/private/1dee214d6aa2ec5a35d35389e86d127f/?p=NChTWvCdLikdyEm-E47EwQ',
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
        cardClass: 'topic-card--rose',
        videoSourceSlug: 'puppy-toilet-home',
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
    cardClass: 'situation-card--blue',
    category: 'behavior',
    topics: [
      {
        slug: 'conflicts-biting-hands',
        title: 'Грызёт руки и ноги',
        description: 'Правильная игра, снижение перегруза и более безопасный контакт со щенком',
        meta: '1 видео',
        imagePath: '/assets/icons/kus_puppy.webp',
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Охраняет чашку, вещи и игрушки',
            description: 'Снижаем напряжение вокруг еды, игрушек и предметов без давления на щенка',
          },
        ],
      },
      {
        slug: 'conflicts-barks-at-people',
        title: 'Лает на людей и собак',
        description: 'Разбираем причины поведения и первые шаги к более устойчивой реакции',
        meta: '1 видео',
        imagePath: '/assets/icons/lai_puppy.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Лает на людей и собак',
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
        cardClass: 'topic-card--blue',
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
    cardClass: 'situation-card--rose',
    category: 'behavior',
    topics: [
      {
        slug: 'fears-sounds',
        title: 'Боязнь звуков',
        description: 'Салюты, пылесос, фен и другие звуки, которые могут перегружать щенка',
        meta: '1 видео',
        imagePath: '/assets/icons/earphones_puppy.webp',
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Приучаем постепенно к машине',
            description: 'Пошагово снижаем тревогу и делаем поездки более предсказуемыми',
            coverPath: '/assets/covers/maschin.jpg',
            video: {
              id: 'puppy-fears-car',
              rutubeUrl: 'https://rutube.ru/video/private/a10fcc7797462420bc6df53b0f4e4bd3/?p=7Tb-gnfzFNrMMWlsPHk7Hg',
            },
          },
        ],
      },
      {
        slug: 'fears-new-places',
        title: 'Страх лестницы/лифта',
        description: 'Новые места, незнакомые поверхности и базовая техника безопасности',
        meta: '1 видео',
        imagePath: '/assets/icons/stair_puppy.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Страх лестницы/лифта',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Команда «место»',
            description: 'Формируем понятное место, куда щенок может вернуться и расслабиться',
            coverPath: '/assets/covers/mesto.jpg',
            video: {
              id: 'puppy-fears-place',
              rutubeUrl: 'https://rutube.ru/video/private/4ac32dd398d8501818454a1ff838af80/?p=VeSOJpWF9cYLy7g_voY4-Q',
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
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--rose',
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
    cardClass: 'situation-card--blue',
    category: 'home',
    topics: [
      {
        slug: 'care-claws',
        title: 'Когти',
        description: 'Анатомия когтя и мягкое приучение к стрижке без лишнего напряжения',
        meta: '1 видео',
        imagePath: '/assets/icons/nails_puppy.webp',
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Лапы',
            description: 'Готовим пространство ванной и учим щенка больше доверять процессу ухода',
            coverPath: '/assets/covers/lapi-shen.jpg',
            video: {
              id: 'puppy-care-paws',
              rutubeUrl: 'https://rutube.ru/video/private/8aec062db1e4fd15c437e3f4f22ea885/?p=Gu_YqW37pvxe99-67Ru10A',
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
        cardClass: 'topic-card--rose',
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
    cardClass: 'situation-card--rose',
    category: 'commands',
    topics: [
      {
        slug: 'fitness-bow',
        title: 'Поклон',
        description: 'Простое упражнение на контроль корпуса и концентрацию',
        meta: '1 видео',
        imagePath: '/assets/icons/poklon__puppy.webp.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Поклон',
            description: 'Шаг за шагом собираем красивое и безопасное положение',
          },
        ],
      },
      {
        slug: 'fitness-crawl',
        title: 'Ползи',
        description: 'Низкая позиция, координация и более внимательная работа с телом',
        meta: '1 видео',
        imagePath: '/assets/icons/polzi_puppy.webp.webp',
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Ползи',
            description: 'Учимся двигаться низко и мягко без лишнего перевозбуждения',
          },
        ],
      },
      {
        slug: 'fitness-bunny',
        title: 'Зайка',
        description: 'Баланс, аккуратное удержание позиции и контроль центра тела',
        meta: '1 видео',
        imagePath: '/assets/icons/bunny_puppy.webp',
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Вытри морду (тач на тряпочку)',
            description: 'Формируем спокойное касание тряпочки и переносим навык в бытовой уход',
            video: {
              id: 'map-puppy-fitness-wipe-muzzle',
              rutubeUrl: 'https://rutube.ru/video/private/c9caf85e9ba8ed92e50c06cd77f1692a/?p=iz8RFE3RJuv83b-ndOnXzw',
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
        cardClass: 'topic-card--rose',
        lessons: [
          {
            title: 'Круть-верть',
            description: 'Собираем плавный поворот в обе стороны через короткие понятные шаги',
            video: {
              id: 'map-puppy-fitness-spin',
              rutubeUrl: 'https://rutube.ru/video/private/29c74ef1bfdfa3b8361de0c2aec609f4/?p=XcZ34ONVjBS_bZuEJnQrKA',
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
        cardClass: 'topic-card--blue',
        lessons: [
          {
            title: 'Влево-вправо',
            description: 'Учимся двигаться в стороны по понятному сигналу без спешки',
            video: {
              id: 'map-puppy-fitness-left-right',
              rutubeUrl: 'https://rutube.ru/video/private/5bf27d649cc9f76de2164b8739bbd064/?p=gdIg22RLS7B4nJ0B_V_UXQ',
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
    cardClass: 'situation-card--blue',
    topics: [
      {
        slug: 'adult-large-leash',
        title: 'Поводок',
        description: 'Поводок, команда «рядом», остановки и усложнение в обычной жизни',
        meta: '5 видео',
        imagePath: '/assets/icons/leash.webp',
        cardClass: 'topic-card--blue',
        lessons: [
          { title: 'Как отучить тянуть поводок?', description: 'Разбираем причины натяжения поводка и собираем спокойную механику прогулки' },
          { title: 'Ошейник или шлейка?', description: 'Как подобрать амуницию под сценарии прогулки и особенности собаки', coverPath: '/assets/covers/ideal_prog.jpg' },
          { title: 'Поводок или рулетка?', description: 'Сравниваем варианты амуниции и выбираем подходящий формат прогулки', coverPath: '/assets/covers/povod_rulet.jpg' },
          { title: 'Команда «рядом»', description: 'Собираем базовый навык движения рядом с человеком' },
          {
            title: '«Дорога» и «стоп»',
            description: 'Учимся останавливаться и безопасно проходить сложные участки маршрута',
            coverPath: '/assets/covers/stop_dor.jpg',
            video: {
              id: 'adult-large-leash-road-stop',
              rutubeUrl: 'https://rutube.ru/video/private/7dc91c3b638a827929fa1694ddf0ea42/?p=UvF-NSJWeRelw8ztu2-9xA',
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
        cardClass: 'topic-card--rose',
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
        cardClass: 'topic-card--blue',
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
        cardClass: 'topic-card--rose',
        lessons: [
          { title: 'Упражнение против отвлечений (1-2-3)', description: 'Возвращаем собаку в понятный ритм при сильных отвлечениях', coverPath: '/assets/covers/1-2-3.jpg' },
          { title: 'Выдержка: не срываемся на всё подряд', description: 'Развиваем импульс-контроль на фоне раздражителей' },
          { title: 'Топ интересных игр на прогулке, или как наладить контакт', description: 'Подбираем игры, которые усиливают ценность человека на улице', coverPath: '/assets/covers/igri.jpg' },
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
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-large-barking', title: 'Лай', description: 'Команда «тише» и спокойное привыкание к звукам', meta: '2 видео', imagePath: '/assets/icons/big_lai.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Команда «тише»', description: 'Формируем бытовой сигнал без давления и наказаний' },
        { title: 'Приучаем к звукам: домофон и хлопки', description: 'Постепенно снижаем реакцию на домофон, хлопки и другие бытовые шумы' },
      ]},
      { slug: 'adult-large-loneliness', title: 'Одиночество', description: 'Уверенность, пространство и постепенное обучение оставаться одному', meta: '3 видео', imagePath: '/assets/icons/big_kreslo.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Убираем страх и повышаем уверенность в себе', description: 'Собираем бытовые сценарии, где собака справляется без постоянной помощи' },
        { title: 'Правильная организация пространства', description: 'Подготавливаем дома среду, в которой собаке проще расслабляться' },
        { title: 'Учим постепенно оставаться одному', description: 'Пошагово увеличиваем дистанцию и время без резких скачков' },
      ]},
      { slug: 'adult-large-jumping-on-guests', title: 'Прыжки на гостей', description: 'Спокойная встреча гостей и понятный сценарий прихода домой', meta: '2 видео', imagePath: '/assets/icons/big_prig.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Правильный приход/выход из дома', description: 'Формируем предсказуемый сценарий входа и выхода без лишнего возбуждения' },
        {
          title: 'Прыжки на гостей',
          description: 'Заменяем прыжки на более спокойный и управляемый сценарий встречи',
          coverPath: '/assets/covers/gosti.jpg',
          video: {
            id: 'adult-large-jumping-guests',
            rutubeUrl: 'https://rutube.ru/video/private/99c4bd449c359a3a468ee8a15952a754/?p=hwkZUtVsMO7qhs5PDW4E-Q',
          },
        },
      ]},
      { slug: 'adult-large-begging', title: 'Попрошайничество', description: 'Команда «место», полезные занятия и питание', meta: '3 видео', imagePath: '/assets/icons/big_please.webp', cardClass: 'topic-card--blue', lessons: [
        {
          title: 'Команда «место»',
          description: 'Формируем удобную бытовую точку отдыха во время еды',
          coverPath: '/assets/covers/mesto.jpg',
          video: {
            id: 'adult-large-begging-place',
            rutubeUrl: 'https://rutube.ru/video/private/4ac32dd398d8501818454a1ff838af80/?p=VeSOJpWF9cYLy7g_voY4-Q',
          },
        },
        {
          title: 'Топ долгоиграющих лакомств и умных девайсов',
          description: 'Подбираем конг, лизательные и нюхательные коврики',
          coverPath: '/assets/covers/pogriz.jpg',
          video: {
            id: 'adult-large-begging-enrichment',
            rutubeUrl: 'https://rutube.ru/video/private/c2313be833d702352d502ce8594a4e90/?p=RKaOJQl0742iR5Af36Gp-g',
          },
        },
        { title: 'Питание', description: 'Разбираем режим, логику выдачи еды и бытовые рамки', coverPath: '/assets/covers/korm.jpg' },
      ]},
      { slug: 'adult-large-toilet', title: 'Туалет', description: 'Улица, режим и метки дома у взрослой собаки', meta: '2 видео', imagePath: '/assets/icons/big_toilet.webp', cardClass: 'topic-card--rose', lessons: [
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
    cardClass: 'situation-card--blue',
    topics: [
      { slug: 'adult-large-overaroused-play', title: 'Перевозбуждается при игре', description: 'Работа с чрезмерным возбуждением во время совместной игры', meta: '1 видео', imagePath: '/assets/icons/big_vozbud.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Перевозбуждается при игре', description: 'Учимся вовремя замечать перегруз и возвращать собаке спокойное состояние' },
      ]},
      { slug: 'adult-large-resource-guarding', title: 'Охраняет чашку/вещи/игрушки', description: 'Безопасная работа с охраной ценных ресурсов', meta: '1 видео', imagePath: '/assets/icons/big_ohran.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Охраняет чашку/вещи/игрушки', description: 'Снижаем напряжение вокруг еды, вещей и игрушек' },
      ]},
      { slug: 'adult-large-barks-at-people', title: 'Лает на людей/собак', description: 'Причины поведения и работа с реакцией', meta: '1 видео', imagePath: '/assets/icons/big_bark.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Лает на людей/собак', description: 'Определяем причины реакции и собираем безопасный протокол работы' },
      ]},
      { slug: 'adult-large-neutering', title: 'Кастрировать/стерилизовать или нет?', description: 'Реальные ожидания и ограничения такого решения', meta: '1 видео', imagePath: '/assets/icons/voprox_puppy.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Кастрировать/стерилизовать или нет?', description: 'Разбираем ожидания, ограничения и вопросы к специалистам' },
      ]},
      { slug: 'adult-large-scooters-bikes', title: 'Бросается на самокаты/велосипеды', description: 'Работа со страхом, напряжением и погоней за движущимися объектами', meta: '1 видео', imagePath: '/assets/icons/big_velo.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Бросается на самокаты/велосипеды', description: 'Учимся отличать мотивацию и выбирать корректную стратегию работы' },
      ]},
    ],
  },
  {
    slug: 'adult-large-fears-anxiety',
    title: 'Страхи и тревожность',
    description: 'Пространство, хвостик, звуки, машины и новые места',
    meta: '5 разделов',
    imagePath: '/assets/icons/big_fear.webp',
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-large-place-space', title: 'Команда «место»', description: 'Понятная и спокойная точка отдыха для собаки', meta: '1 видео', imagePath: '/assets/icons/big_sidit.webp', cardClass: 'topic-card--blue', lessons: [
        {
          title: 'Команда «место»',
          description: 'Делаем точку отдыха понятной и полезной для собаки',
          coverPath: '/assets/covers/mesto.jpg',
          video: {
            id: 'adult-large-fears-place',
            rutubeUrl: 'https://rutube.ru/video/private/4ac32dd398d8501818454a1ff838af80/?p=VeSOJpWF9cYLy7g_voY4-Q',
          },
        },
      ]},
      { slug: 'adult-large-follows-tail', title: 'Ходит хвостиком + Как минимизировать тревожность?', description: 'Снижаем тревожность и учим собаку оставаться отдельно', meta: '1 видео', imagePath: '/assets/icons/big_hvost.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Ходит хвостиком + Как минимизировать тревожность?', description: 'Постепенно учим собаку выдерживать разлуку в пределах дома' },
      ]},
      { slug: 'adult-large-sounds', title: 'Боязнь звуков', description: 'Работа с неожиданными и неприятными шумами', meta: '1 видео', imagePath: '/assets/icons/big_headphones.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Боязнь звуков', description: 'Пошагово меняем эмоциональную реакцию на шумы' },
      ]},
      { slug: 'adult-large-cars', title: 'Приучаем постепенно к машине', description: 'Постепенное знакомство с машиной и поездками', meta: '1 видео', imagePath: '/assets/icons/big_car.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Приучаем постепенно к машине', description: 'Двигаемся от знакомства к коротким безопасным поездкам' },
      ]},
      { slug: 'adult-large-new-places', title: 'Страх лестницы/лифта', description: 'Постепенное знакомство с лестницей и лифтом', meta: '1 видео', imagePath: '/assets/icons/big_lift.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Страх лестницы/лифта', description: 'Знакомим собаку с лестницей и лифтом в комфортном темпе' },
      ]},
    ],
  },
  {
    slug: 'adult-large-care-without-fight',
    title: 'Уход без борьбы',
    description: 'Когти, лапы и груминг через предсказуемость и согласие',
    meta: '3 раздела',
    imagePath: '/assets/icons/big_bath.webp',
    cardClass: 'situation-card--blue',
    topics: [
      { slug: 'adult-large-claws', title: 'Когти', description: 'Спокойный и предсказуемый уход за когтями', meta: '1 видео', imagePath: '/assets/icons/big_kogot.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Когти', description: 'Собираем аккуратную процедуру ухода шаг за шагом' },
      ]},
      { slug: 'adult-large-paws', title: 'Лапы', description: 'Спокойный уход за лапами без борьбы', meta: '1 видео', imagePath: '/assets/icons/big_lapi.webp', cardClass: 'topic-card--blue', lessons: [
        {
          title: 'Лапы',
          description: 'Собираем понятный и комфортный сценарий ухода за лапами',
          coverPath: '/assets/covers/lapi-bolsh.jpg',
          video: {
            id: 'adult-large-care-paws',
            rutubeUrl: 'https://rutube.ru/video/private/545e5a20d076a8b631fc8dd92fb0e393/?p=lfksp_Rh_AZRgkwDHOI42Q',
          },
        },
      ]},
      { slug: 'adult-large-grooming', title: 'Груминг', description: 'Понятный и спокойный сценарий домашнего ухода', meta: '1 видео', imagePath: '/assets/icons/big_grum.webp', cardClass: 'topic-card--rose', lessons: [
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
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-large-eight', title: 'Восемь', description: 'Контроль движения вокруг ног человека', meta: '1 видео', imagePath: '/assets/icons/big_vosem.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Восемь', description: 'Собираем плавное движение по траектории вокруг ног без спешки' },
      ]},
      { slug: 'adult-large-go-around', title: 'Обойди', description: 'Координация движения вокруг человека или предмета', meta: '1 видео', imagePath: '/assets/icons/big_oboidi.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Обойди', description: 'Собираем понятное движение вокруг человека или предмета' },
      ]},
      { slug: 'adult-large-wipe-muzzle', title: 'Вытри морду', description: 'Полезный бытовой навык через работу с мишенью', meta: '1 видео', imagePath: '/assets/icons/big_lapananose.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Вытри морду', description: 'Формируем аккуратное касание мордой подготовленной поверхности' },
      ]},
      { slug: 'adult-large-jump-over-leg', title: 'Прыг', description: 'Аккуратный прыжок с контролем импульса и траектории', meta: '1 видео', imagePath: '/assets/icons/big_jump.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Прыг', description: 'Учимся безопасному прыжку через понятную и короткую механику' },
      ]},
      { slug: 'adult-large-bow', title: 'Поклон', description: 'Упражнение на координацию, контроль корпуса и концентрацию', meta: '1 видео', imagePath: '/assets/icons/big_poklon.webp', cardClass: 'topic-card--blue', lessons: [
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
  rutubeUrl: string,
];

const plannedLessonVideos = [
  [
    'walk-food-pickup',
    'Намордник без драмы',
    'map-puppy-food-pickup-muzzle',
    'https://rutube.ru/video/private/cf5bdbbf73f7abdbff8b67d3d5368ae7/?p=QWbEYvLL8XhVbQN6hR64jw',
  ],
  [
    'walk-recall',
    'Команда «Ко мне!» и «кличка»',
    'map-puppy-recall-name',
    'https://rutube.ru/video/private/17278544222abdb2cc421ec860b31fc2/?p=PxpOjanY2cM-lginl8UXBA',
  ],
  [
    'walk-recall',
    'Собака слушает вас, а не улицу',
    'map-puppy-recall-contact',
    'https://rutube.ru/video/private/456841dcf884c73963bf8234b1a02193/?p=aqeNgR_1dUsvLQ8BtI5Xiw',
  ],
  [
    'walk-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    'map-puppy-ignore-impulse',
    'https://rutube.ru/video/private/c5139d68dc7670e4f31a25a6ff764406/?p=B5tC6gDGO7q_Vt0WllN5Pw',
  ],
  [
    'home-barking',
    'Команда «тише»',
    'map-puppy-home-quiet',
    'https://rutube.ru/video/private/7f185fc2ff5df093277d09f300475d6b/?p=GXwDA1DO1e8vRgK5jBWk-g',
  ],
  [
    'home-barking',
    'Приучаем к звукам дома',
    'map-puppy-home-sounds',
    'https://rutube.ru/video/private/e501d1b145969703e3de68e2a36820d1/?p=jkE-lFhpUCp_3IFSLMABhA',
  ],
  [
    'home-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    'map-puppy-loneliness-confidence',
    'https://rutube.ru/video/private/faa2212d0a78e8ce7090cbed1ff096c4/?p=5EQPL2Mns74gPhnftcztig',
  ],
  [
    'home-loneliness',
    'Учим постепенно оставаться одному',
    'map-puppy-loneliness-alone',
    'https://rutube.ru/video/private/59f6c0c6262bb1ee4ac0a2f096566e20/?p=y0PH7hQYJ6Dr80Y27cFHkA',
  ],
  [
    'home-jumping-on-guests',
    'Правильный приход/выход из дома',
    'map-puppy-guests-arrival',
    'https://rutube.ru/video/private/f9488776f89cf7018d117fd47c3b1f59/?p=hByo1lSHeSUT9RR1VWSLbA',
  ],
  [
    'home-toilet',
    'Приучение к пелёнке и средства от запаха',
    'map-puppy-toilet-pad',
    'https://rutube.ru/video/private/0a54b61a591485acf663ac90ec17b18e/?p=RNwssQk5npbDN_CatzYXcQ',
  ],
  [
    'home-toilet',
    'Приучение к улице и режим',
    'map-puppy-toilet-outside',
    'https://rutube.ru/video/private/f64f0e97a7d9a5a0b5eedf1d67b7b939/?p=IOgf4mSC2Pec3g82G1qSlw',
  ],
  [
    'home-toilet',
    'Метки дома',
    'map-puppy-toilet-marking',
    'https://rutube.ru/video/private/db97d2632ae782185a907d017575cc9c/?p=chkUlQ_NXso5dPwl-I1n3Q',
  ],
  [
    'conflicts-biting-hands',
    'Грызёт руки и ноги: спокойная и правильная игра',
    'map-puppy-conflicts-biting',
    'https://rutube.ru/video/private/5f9b127377cd1a043cab44b56d98df55/?p=NiyXnCpum9bLFkWAUaioRg',
  ],
  [
    'conflicts-vandal',
    'Мой щенок вандалит и разносит квартиру',
    'map-puppy-conflicts-vandal',
    'https://rutube.ru/video/private/c5e830c0def596d41344661ecd0e9995/?p=CoFmTZ2pALMmx2eYhWSRZA',
  ],
  [
    'conflicts-resource-guarding',
    'Охраняет чашку, вещи и игрушки',
    'map-puppy-conflicts-guarding',
    'https://rutube.ru/video/private/1766c0e2df0912aceebb1a0c2911cb73/?p=F1FMgnaJ4INALu2J7AsSqA',
  ],
  [
    'conflicts-barks-at-people',
    'Лает на людей и собак',
    'map-puppy-conflicts-barking',
    'https://rutube.ru/video/private/1a8799f89386b1025522c28b19d6206b/?p=FjyZ6bt_uMfxOSW72OLjqg',
  ],
  [
    'conflicts-neutering',
    'Кастрировать или стерилизовать?',
    'map-puppy-conflicts-neutering',
    'https://rutube.ru/video/private/1a9ba87049f2837eff85f2216d5504ec/?p=F-qJcAhquirvHo5hdmCS5Q',
  ],
  [
    'fears-sounds',
    'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)',
    'map-puppy-fears-sounds',
    'https://rutube.ru/video/private/e501d1b145969703e3de68e2a36820d1/?p=jkE-lFhpUCp_3IFSLMABhA',
  ],
  [
    'fears-new-places',
    'Страх лестницы/лифта',
    'map-puppy-fears-stairs-lift',
    'https://rutube.ru/video/private/9c8c48c06b6328e8a72b75f3df3ade84/?p=CQP2BUTwo0BD04P2GcFgnA',
  ],
  [
    'fears-space-organization',
    'Щенок дома',
    'map-puppy-fears-space',
    'https://rutube.ru/video/private/8c78568d20f5cfaa21a85680d6256caa/?p=q0gmTeAB_ZCEv0i2WHarIg',
  ],
  [
    'care-claws',
    'Когти: анатомия когтя и стрижка',
    'map-puppy-care-claws',
    'https://rutube.ru/video/private/fb291b9372cc8cde0b9bfe74ffb3280e/?p=v4xfRGW_V1ZRF-BYYPTZpA',
  ],
  [
    'fitness-bow',
    'Поклон',
    'map-puppy-fitness-bow',
    'https://rutube.ru/video/private/b67278e1b0e316cf36a9eb54ec0ccdb9/?p=t0wNGiVBZN0mG3eTWqi9_Q',
  ],
  [
    'fitness-bunny',
    'Зайка',
    'map-puppy-fitness-bunny',
    'https://rutube.ru/video/private/942176b07180ca6ffd4d32c7d4ab74b9/?p=M2wePflL4R7VCgAJyq3aUQ',
  ],
  [
    'fitness-house',
    'Домик',
    'map-puppy-fitness-house',
    'https://rutube.ru/video/private/d56219b18cc1bb2116ce3ccbf51fa09b/?p=8nsyQLKls6pIL92KCnZgqA',
  ],
  [
    'fitness-paw',
    '«Дай лапу»',
    'map-puppy-fitness-paw',
    'https://rutube.ru/video/private/9b92e46e194cdea5bb5d64011c27f23d/?p=e55CiwRfECm5ybbSfbB-Tg',
  ],
  [
    'adult-large-leash',
    'Как отучить тянуть поводок?',
    'map-adult-large-leash-pulling',
    'https://rutube.ru/video/private/f3feaa722dae449718e1d7e2df717e84/?p=lUnLrVJeTXQNguoa4yG3pQ',
  ],
  [
    'adult-large-food-pickup',
    'Импульс-контроль + Выдержка',
    'map-adult-large-food-impulse',
    'https://rutube.ru/video/private/e9f0cb8baf40516cadca88b23554c21c/?p=GBim4zrE2s8wgi9bBdOjEA',
  ],
  [
    'adult-large-food-pickup',
    'Намордник без драмы',
    'map-adult-large-food-muzzle',
    'https://rutube.ru/video/private/cf5bdbbf73f7abdbff8b67d3d5368ae7/?p=QWbEYvLL8XhVbQN6hR64jw',
  ],
  [
    'adult-large-recall',
    'Контакт',
    'map-adult-large-recall-contact',
    'https://rutube.ru/video/private/80b9e9e2a2c94f9ca9aeaca297b5520b/?p=_PRlDTIbyOKILgkOlnGEpw',
  ],
  [
    'adult-large-recall',
    'Ко мне',
    'map-adult-large-recall-come',
    'https://rutube.ru/video/private/3428535014c3c6ae9fb6ea5d671e5a4b/?p=acADR77e4AKTYgTXrMq6aQ',
  ],
  [
    'adult-large-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    'map-adult-large-ignore-impulse',
    'https://rutube.ru/video/private/1072ba3cecb33406ff1c5395f7ba5c4e/?p=0kHwy8AO5ar2Dh8Z6XSuDw',
  ],
  [
    'adult-large-ignore-triggers',
    'Топ интересных игр на прогулке, или как наладить контакт',
    'map-adult-large-ignore-games',
    'https://rutube.ru/video/private/d0f206ab4aa8d3428ca3005f7ea3b08f/?p=8x5B3neNBu5KumvPL4A_0g',
  ],
  [
    'adult-large-barking',
    'Команда «тише»',
    'map-adult-large-home-quiet',
    'https://rutube.ru/video/private/7f185fc2ff5df093277d09f300475d6b/?p=GXwDA1DO1e8vRgK5jBWk-g',
  ],
  [
    'adult-large-barking',
    'Приучаем к звукам: домофон и хлопки',
    'map-adult-large-home-sounds',
    'https://rutube.ru/video/private/eda5f0d567ce37786790c95483c93c0a/?p=m0zIkK3NsPdt15blAfhaqQ',
  ],
  [
    'adult-large-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    'map-adult-large-loneliness-confidence',
    'https://rutube.ru/video/private/3e528d87f03d10cf39ae815836a81801/?p=xAcUHghevfMxkBlpEDtjBQ',
  ],
  [
    'adult-large-loneliness',
    'Правильная организация пространства',
    'map-adult-large-loneliness-space',
    'https://rutube.ru/video/private/345417b4748cd2d89c722cc68e083afb/?p=kfGT15gXe_gkLyI9qYROZw',
  ],
  [
    'adult-large-loneliness',
    'Учим постепенно оставаться одному',
    'map-adult-large-loneliness-alone',
    'https://rutube.ru/video/private/c99413cbde6cb274beba12eb7f91f6a8/?p=tfaL-TQ-lufGdN9E3JPLUQ',
  ],
  [
    'adult-large-jumping-on-guests',
    'Правильный приход/выход из дома',
    'map-adult-large-guests-arrival',
    'https://rutube.ru/video/private/6090f451b068583caee69fb900ad90af/?p=eMmHU56z3Q0u0A3K8DiDqA',
  ],
  [
    'adult-large-begging',
    'Питание',
    'map-adult-large-begging-feeding',
    'https://rutube.ru/video/private/63eb473499712d8feaa0656be9688c67/?p=nKspthZal_AUVn6OUFAivg',
  ],
  [
    'adult-large-toilet',
    'Приучение к улице + режим',
    'map-adult-large-toilet-outside',
    'https://rutube.ru/video/private/f64f0e97a7d9a5a0b5eedf1d67b7b939/?p=IOgf4mSC2Pec3g82G1qSlw',
  ],
  [
    'adult-large-toilet',
    'Метки дома',
    'map-adult-large-toilet-marking',
    'https://rutube.ru/video/private/db97d2632ae782185a907d017575cc9c/?p=chkUlQ_NXso5dPwl-I1n3Q',
  ],
  [
    'adult-large-overaroused-play',
    'Перевозбуждается при игре',
    'map-adult-large-conflicts-overaroused',
    'https://rutube.ru/video/private/aa71e29d8bed85e57a01056d8f6cc981/?p=OdB9-lJxqAUhCHWl1sKrng',
  ],
  [
    'adult-large-resource-guarding',
    'Охраняет чашку/вещи/игрушки',
    'map-adult-large-conflicts-guarding',
    'https://rutube.ru/video/private/43d5dfef50ab41c7003d1ba892bfa690/?p=YUCmBYXbXsInQ0QeRGe73Q',
  ],
  [
    'adult-large-barks-at-people',
    'Лает на людей/собак',
    'map-adult-large-conflicts-barking',
    'https://rutube.ru/video/private/c5139d68dc7670e4f31a25a6ff764406/?p=B5tC6gDGO7q_Vt0WllN5Pw',
  ],
  [
    'adult-large-neutering',
    'Кастрировать/стерилизовать или нет?',
    'map-adult-large-conflicts-neutering',
    'https://rutube.ru/video/private/1a9ba87049f2837eff85f2216d5504ec/?p=F-qJcAhquirvHo5hdmCS5Q',
  ],
  [
    'adult-large-scooters-bikes',
    'Бросается на самокаты/велосипеды',
    'map-adult-large-conflicts-scooters',
    'https://rutube.ru/video/private/967d40d46cbecebe9ed0898bd970c024/?p=N8F3EGw7nilRLR4JXyRiEQ',
  ],
  [
    'adult-large-follows-tail',
    'Ходит хвостиком + Как минимизировать тревожность?',
    'map-adult-large-fears-follows-tail',
    'https://rutube.ru/video/private/4d82acbd403f39be5d32d63b9f96d07d/?p=8K0_FThbr1FhIWSqSD7_Qw',
  ],
  [
    'adult-large-sounds',
    'Боязнь звуков',
    'map-adult-large-fears-sounds',
    'https://rutube.ru/video/private/eda5f0d567ce37786790c95483c93c0a/?p=m0zIkK3NsPdt15blAfhaqQ',
  ],
  [
    'adult-large-cars',
    'Приучаем постепенно к машине',
    'map-adult-large-fears-cars',
    'https://rutube.ru/video/private/a10fcc7797462420bc6df53b0f4e4bd3/?p=7Tb-gnfzFNrMMWlsPHk7Hg',
  ],
  [
    'adult-large-new-places',
    'Страх лестницы/лифта',
    'map-adult-large-fears-stairs-lift',
    'https://rutube.ru/video/private/3e9e2373cc789291b830870e7795fdf4/?p=6cDLWYLiDw-0tUP5rdWDyQ',
  ],
  [
    'adult-large-claws',
    'Когти',
    'map-adult-large-care-claws',
    'https://rutube.ru/video/db778ac8388f60e888fcb4c67b9a2400/',
  ],
  [
    'adult-large-eight',
    'Восемь',
    'map-adult-large-fitness-eight',
    'https://rutube.ru/video/private/ffebb9a2b318a43e3b06bfc3aec6acc9/?p=1tCevmSiJ6w-WF6BwaFNBw',
  ],
  [
    'adult-large-go-around',
    'Обойди',
    'map-adult-large-fitness-go-around',
    'https://rutube.ru/video/private/bf3d560106670dff9eab6d64c364a877/?p=2dRDPB4PvUoY6LPFU35fTQ',
  ],
  [
    'adult-large-wipe-muzzle',
    'Вытри морду',
    'map-adult-large-fitness-wipe-muzzle',
    'https://rutube.ru/video/private/c9caf85e9ba8ed92e50c06cd77f1692a/?p=iz8RFE3RJuv83b-ndOnXzw',
  ],
  [
    'adult-large-bow',
    'Поклон',
    'map-adult-large-fitness-bow',
    'https://rutube.ru/video/private/b67278e1b0e316cf36a9eb54ec0ccdb9/?p=t0wNGiVBZN0mG3eTWqi9_Q',
  ],
] as const satisfies readonly PlannedLessonVideo[];

type PlannedLessonCover = readonly [
  topicSlug: PlannedVideoTopicSlug,
  lessonTitle: string,
  coverPath: string,
];

const plannedLessonCovers = [
  ['conflicts-vandal', 'Мой щенок вандалит и разносит квартиру', '/assets/covers/puppy-vandal.jpg'],
  ['walk-food-pickup', 'Намордник без драмы', '/assets/covers/muzzle.jpg'],
  ['walk-recall', 'Команда «Ко мне!» и «кличка»', '/assets/covers/puppy-recall-come.jpg'],
  ['walk-recall', 'Собака слушает вас, а не улицу', '/assets/covers/puppy-recall-contact.jpg'],
  ['walk-ignore-triggers', 'Выдержка: не срываемся на всё подряд', '/assets/covers/puppy-ignore-impulse.jpg'],
  ['home-barking', 'Команда «тише»', '/assets/covers/quiet.jpg'],
  ['home-barking', 'Приучаем к звукам дома', '/assets/covers/puppy-fears-sounds.jpg'],
  ['home-loneliness', 'Убираем страх и повышаем уверенность в себе', '/assets/covers/puppy-confidence.jpg'],
  ['home-loneliness', 'Учим постепенно оставаться одному', '/assets/covers/puppy-alone.jpg'],
  ['home-jumping-on-guests', 'Правильный приход/выход из дома', '/assets/covers/puppy-arrival.jpg'],
  [
    'home-toilet',
    'Приучение к пелёнке и средства от запаха',
    '/assets/covers/puppy-toilet-pad.jpg',
  ],
  ['home-toilet', 'Приучение к улице и режим', '/assets/covers/toilet-outside.jpg'],
  ['home-toilet', 'Метки дома', '/assets/covers/toilet-marking.jpg'],
  [
    'conflicts-biting-hands',
    'Грызёт руки и ноги: спокойная и правильная игра',
    '/assets/covers/puppy-biting.jpg',
  ],
  [
    'conflicts-resource-guarding',
    'Охраняет чашку, вещи и игрушки',
    '/assets/covers/puppy-resource-guarding.jpg',
  ],
  ['conflicts-barks-at-people', 'Лает на людей и собак', '/assets/covers/barking-triggers.jpg'],
  ['conflicts-neutering', 'Кастрировать или стерилизовать?', '/assets/covers/neutering.jpg'],
  [
    'fears-sounds',
    'Боязнь звуков (собака боится салютов, пылесосов, лая других собак и звука фена)',
    '/assets/covers/puppy-fears-sounds.jpg',
  ],
  ['fears-new-places', 'Страх лестницы/лифта', '/assets/covers/puppy-stairs-lift.jpg'],
  ['fears-space-organization', 'Щенок дома', '/assets/covers/puppy-home.jpg'],
  ['care-claws', 'Когти: анатомия когтя и стрижка', '/assets/covers/kogti.jpg'],
  ['fitness-bow', 'Поклон', '/assets/covers/bow.jpg'],
  ['fitness-bunny', 'Зайка', '/assets/covers/puppy-bunny.jpg'],
  ['fitness-house', 'Домик', '/assets/covers/puppy-house.jpg'],
  ['fitness-paw', '«Дай лапу»', '/assets/covers/puppy-give-paw.jpg'],
  ['fitness-wipe-muzzle', 'Вытри морду (тач на тряпочку)', '/assets/covers/wipe-muzzle.jpg'],
  ['fitness-spin', 'Круть-верть', '/assets/covers/puppy-spin.jpg'],
  ['fitness-left-right', 'Влево-вправо', '/assets/covers/puppy-left-right.jpg'],
  ['adult-large-leash', 'Как отучить тянуть поводок?', '/assets/covers/adult-leash-technique.jpg'],
  ['adult-large-food-pickup', 'Импульс-контроль + Выдержка', '/assets/covers/adult-food-impulse.jpg'],
  ['adult-large-food-pickup', 'Намордник без драмы', '/assets/covers/muzzle.jpg'],
  ['adult-large-recall', 'Контакт', '/assets/covers/adult-recall-contact.jpg'],
  ['adult-large-recall', 'Ко мне', '/assets/covers/adult-recall-come.jpg'],
  [
    'adult-large-ignore-triggers',
    'Топ интересных игр на прогулке, или как наладить контакт',
    '/assets/covers/adult-walk-games.jpg',
  ],
  [
    'adult-large-ignore-triggers',
    'Выдержка: не срываемся на всё подряд',
    '/assets/covers/adult-food-impulse.jpg',
  ],
  ['adult-large-barking', 'Команда «тише»', '/assets/covers/quiet.jpg'],
  [
    'adult-large-barking',
    'Приучаем к звукам: домофон и хлопки',
    '/assets/covers/adult-home-sounds.jpg',
  ],
  [
    'adult-large-loneliness',
    'Убираем страх и повышаем уверенность в себе',
    '/assets/covers/adult-confidence.jpg',
  ],
  ['adult-large-loneliness', 'Учим постепенно оставаться одному', '/assets/covers/adult-alone.jpg'],
  [
    'adult-large-loneliness',
    'Правильная организация пространства',
    '/assets/covers/adult-space.jpg',
  ],
  [
    'adult-large-jumping-on-guests',
    'Правильный приход/выход из дома',
    '/assets/covers/adult-arrival.jpg',
  ],
  ['adult-large-begging', 'Питание', '/assets/covers/adult-feeding.jpg'],
  ['adult-large-toilet', 'Приучение к улице + режим', '/assets/covers/toilet-outside.jpg'],
  ['adult-large-toilet', 'Метки дома', '/assets/covers/toilet-marking.jpg'],
  [
    'adult-large-overaroused-play',
    'Перевозбуждается при игре',
    '/assets/covers/adult-overaroused.jpg',
  ],
  [
    'adult-large-resource-guarding',
    'Охраняет чашку/вещи/игрушки',
    '/assets/covers/adult-resource-guarding.jpg',
  ],
  [
    'adult-large-barks-at-people',
    'Лает на людей/собак',
    '/assets/covers/barking-triggers.jpg',
  ],
  [
    'adult-large-neutering',
    'Кастрировать/стерилизовать или нет?',
    '/assets/covers/neutering.jpg',
  ],
  [
    'adult-large-scooters-bikes',
    'Бросается на самокаты/велосипеды',
    '/assets/covers/adult-scooters.jpg',
  ],
  [
    'adult-large-follows-tail',
    'Ходит хвостиком + Как минимизировать тревожность?',
    '/assets/covers/adult-anxiety.jpg',
  ],
  ['adult-large-sounds', 'Боязнь звуков', '/assets/covers/adult-fears-sounds.jpg'],
  ['adult-large-cars', 'Приучаем постепенно к машине', '/assets/covers/maschin.jpg'],
  ['adult-large-new-places', 'Страх лестницы/лифта', '/assets/covers/adult-stairs-lift.jpg'],
  ['adult-large-claws', 'Когти', '/assets/covers/kogti-bolsh.jpg'],
  ['adult-large-eight', 'Восемь', '/assets/covers/adult-eight.jpg'],
  ['adult-large-go-around', 'Обойди', '/assets/covers/adult-go-around.jpg'],
  ['adult-large-wipe-muzzle', 'Вытри морду', '/assets/covers/wipe-muzzle.jpg'],
  ['adult-large-bow', 'Поклон', '/assets/covers/bow.jpg'],
] as const satisfies readonly PlannedLessonCover[];

function applyPlannedLessonVideos(): void {
  const topics: Array<{ slug: PlannedVideoTopicSlug; lessons: PuppyLessonItem[] }> = [
    ...puppySituations.flatMap((situation) => situation.topics),
    ...adultLargeSituations.flatMap((situation) => situation.topics),
  ];
  const topicsBySlug = new Map<string, { lessons: PuppyLessonItem[] }>(
    topics.map((topic) => [topic.slug, topic]),
  );

  plannedLessonVideos.forEach(([topicSlug, lessonTitle, videoId, rutubeUrl]) => {
    const topic = topicsBySlug.get(topicSlug);
    const lesson = topic?.lessons.find((item) => item.title === lessonTitle);

    if (!lesson) {
      throw new Error(`Planned lesson video target not found: ${topicSlug} / ${lessonTitle}`);
    }

    lesson.video = { id: videoId, rutubeUrl };
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

const adultSmallSituations: AdultSmallSituation[] = [
  {
    slug: 'adult-small-ideal-walk',
    title: 'Идеальная прогулка',
    description: 'Поводок, подбор, подзыв и спокойный контакт в прогулочной среде',
    meta: '7 разделов',
    imagePath: '/assets/icons/leash.webp',
    cardClass: 'situation-card--blue',
    topics: [
      { slug: 'adult-small-leash', title: 'Поводок', description: 'Амуниция, рядом, остановки и управляемое движение на прогулке', meta: '7 видео', imagePath: '/assets/icons/leash.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Ошейник или шлейка?', description: 'Выбираем амуницию под формат прогулок и особенности маленькой собаки' },
        { title: 'Техника владения поводком', description: 'Собираем спокойную механику рук и длины поводка' },
        { title: 'Экстренный разворот', description: 'Быстро и мягко уводим собаку из сложной ситуации' },
        { title: 'Почему собака тянет?', description: 'Разбираем причины натяжения и как на них влиять' },
        { title: 'Обычный поводок или рулетка?', description: 'Сравниваем варианты и их влияние на обучение' },
        { title: 'Команда «рядом»', description: 'Формируем понятный навык движения рядом с человеком' },
        { title: 'Команда «дорога» / «стоп»', description: 'Учимся безопасным остановкам и прохождению сложных точек маршрута' },
      ]},
      { slug: 'adult-small-food-pickup', title: 'Подбор еды', description: 'Контроль импульса, выдержка и запрет брать еду без сигнала', meta: '6 видео', imagePath: '/assets/useful-warning.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Импульс-контроль', description: 'Снижаем срыв к еде и формируем управляемую паузу' },
        { title: 'Выдержка', description: 'Учим спокойно ждать рядом с сильным стимулом' },
        { title: 'Фокус на кусок', description: 'Переводим внимание с подбора на задачу с человеком' },
        { title: 'Брать еду у незнакомых запрещено', description: 'Формируем понятное правило и безопасный бытовой сценарий' },
        { title: 'Хождение между сосисок', description: 'Тренируем самоконтроль рядом с доступной едой' },
        { title: 'Без взгляда и контроля хозяина', description: 'Усложняем навык, убирая лишние подсказки' },
      ]},
      { slug: 'adult-small-muzzle', title: 'Намордник', description: 'Приучение к наморднику и работа с природными инстинктами', meta: '2 видео', imagePath: '/assets/useful-home.svg', cardClass: 'topic-card--blue', lessons: [
        { title: 'Приучение к наморднику', description: 'Пошагово формируем спокойное отношение к наморднику' },
        { title: 'Почему важно закрывать природные инстинкты?', description: 'Разбираем, почему одной коррекции недостаточно' },
      ]},
      { slug: 'adult-small-recall', title: 'Подзыв', description: 'Контакт, кличка и надёжное возвращение к человеку', meta: '3 видео', imagePath: '/assets/images/programs/puppy.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Контакт', description: 'Усиливаем ценность человека и стабильность внимания на улице' },
        { title: 'Команда «ко мне»', description: 'Формируем рабочий и понятный сигнал возвращения' },
        { title: 'Кличка', description: 'Делаем имя маркером внимания, а не фоном' },
      ]},
      { slug: 'adult-small-ignore-triggers', title: 'Игнорирование раздражителей', description: 'Управляемое внимание и спокойствие рядом с триггерами', meta: '2 видео', imagePath: '/assets/useful-heart.svg', cardClass: 'topic-card--rose', lessons: [
        { title: '1-2-3', description: 'Задаём ритм, который помогает вернуться в контакт' },
        { title: 'Импульс-контроль', description: 'Учим выдерживать встречу с раздражителем без срыва' },
      ]},
      { slug: 'adult-small-games-contact', title: 'Игры и контакт на прогулке', description: 'Игры для контакта, нюха и вовлечённости в человека', meta: '5 видео', imagePath: '/assets/images/programs/teen_dog.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Топ интересных игр на прогулке', description: 'Подбираем короткие активности для улицы' },
        { title: 'Как наладить контакт', description: 'Строим прогулочный сценарий, где человек становится интереснее среды' },
        { title: 'Нюхательные игры', description: 'Добавляем спокойную поисковую нагрузку' },
        { title: 'Прячем в траве', description: 'Учимся использовать среду как часть игры и поиска' },
        { title: 'Прячем по всему периметру дерева', description: 'Усложняем задачи на поиск и внимание' },
      ]},
      { slug: 'adult-small-dog-to-everyone', title: 'Собака ко всем лезет', description: 'Работаем с сильным интересом к движущимся объектам и животным', meta: '3 видео', imagePath: '/assets/images/programs/adult_dog.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Велосипеды', description: 'Снижаем фиксацию на быстрых объектах и сохраняем контакт' },
        { title: 'Кошки', description: 'Работаем с переключением и безопасной дистанцией' },
        { title: 'Птички', description: 'Учимся спокойно переживать быстрые и хаотичные движения' },
      ]},
    ],
  },
  {
    slug: 'adult-small-calm-home',
    title: 'Спокойный дом',
    description: 'Тишина, одиночество, бытовые правила и туалетные сценарии дома',
    meta: '6 разделов',
    imagePath: '/assets/icons/home.webp',
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-small-barking', title: 'Лай', description: 'Команда «тише» и работа со звуками', meta: '2 видео', imagePath: '/assets/useful-warning.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Команда «тише»', description: 'Формируем спокойный бытовой сигнал' },
        { title: 'Приучаем к звукам', description: 'Постепенно уменьшаем напряжение от шумов' },
      ]},
      { slug: 'adult-small-loneliness', title: 'Одиночество', description: 'Уверенность, сложные активности, пространство и постепенное оставление', meta: '4 видео', imagePath: '/assets/images/situations/puppy-whines-night.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Повышаем уверенность в себе', description: 'Собираем опыт, в котором собака справляется сама' },
        { title: 'Страшные и сложные штуки', description: 'Аккуратно вводим пещеры, игры с водой и другие новые задачи' },
        { title: 'Правильная организация пространства', description: 'Подготавливаем среду для спокойствия и отдыха' },
        { title: 'Учим постепенно оставаться одному', description: 'Пошагово увеличиваем время без человека' },
      ]},
      { slug: 'adult-small-jumping-on-guests', title: 'Прыжки на гостей', description: 'Спокойная встреча, ожидание и безопасность в лифте', meta: '3 видео', imagePath: '/assets/images/programs/teen_dog.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Сидеть при приходе', description: 'Формируем понятный ритуал встречи без прыжков' },
        { title: 'Ждать при входе и выходе', description: 'Добавляем паузу в возбуждающих бытовых моментах' },
        { title: 'Техника безопасности в лифте', description: 'Собираем спокойный и безопасный сценарий поездки' },
      ]},
      { slug: 'adult-small-begging', title: 'Попрошайничество', description: 'Место и бытовые девайсы вместо выпрашивания', meta: '4 видео', imagePath: '/assets/useful-home.svg', cardClass: 'topic-card--blue', lessons: [
        { title: 'Команда «место»', description: 'Создаём понятную точку отдыха во время еды людей' },
        { title: 'Конг', description: 'Используем долгоиграющее лакомство как часть ритуала' },
        { title: 'Лизательные коврики', description: 'Добавляем спокойную занятость вместо контроля стола' },
        { title: 'Нюхательные коврики', description: 'Снижаем напряжение через поиск и нюхание' },
      ]},
      { slug: 'adult-small-feeding', title: 'Питание', description: 'Базовые правила питания для стабильного быта', meta: '1 видео', imagePath: '/assets/useful-heart.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Базовые правила питания', description: 'Выстраиваем режим, рамки и понятные ожидания' },
      ]},
      { slug: 'adult-small-toilet', title: 'Туалет', description: 'Пелёнка, улица, запах и режим у маленькой собаки', meta: '5 видео', imagePath: '/assets/images/situations/puppy-toilet-home.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Приучение к пелёнке', description: 'Собираем рабочую домашнюю схему без хаоса' },
        { title: 'Средства, которые реально убирают запах', description: 'Подбираем бытовые средства, чтобы не поддерживать повторение' },
        { title: 'Приучение к улице', description: 'Переносим туалетный навык на улицу постепенно' },
        { title: 'Режим', description: 'Подстраиваем ритм прогулок и быта под успешный туалетный сценарий' },
        { title: 'Метки дома', description: 'Разбираем причины и первые шаги по изменению ситуации' },
      ]},
    ],
  },
  {
    slug: 'adult-small-aggression-conflicts',
    title: 'Агрессия и конфликты',
    description: 'Перевозбуждение, охрана ресурсов, реакция на людей и транспорт',
    meta: '5 разделов',
    imagePath: '/assets/icons/alarm.webp',
    cardClass: 'situation-card--blue',
    topics: [
      { slug: 'adult-small-overaroused-play', title: 'Перевозбуждается при игре', description: 'Кусает руки и теряет контроль в игре', meta: '1 видео', imagePath: '/assets/images/situations/puppy-bites.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Кусает руки', description: 'Учимся вовремя останавливать разгон и менять механику игры' },
      ]},
      { slug: 'adult-small-resource-guarding', title: 'Охрана ресурсов', description: 'Чашка, вещи и игрушки как причины напряжения', meta: '3 видео', imagePath: '/assets/images/programs/adult_dog.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Охраняет чашку', description: 'Снижаем напряжение рядом с едой' },
        { title: 'Охраняет вещи', description: 'Разбираем работу с бытовыми предметами' },
        { title: 'Охраняет игрушки', description: 'Строим безопасное взаимодействие с ценными объектами' },
      ]},
      { slug: 'adult-small-barks-at-people', title: 'Лает на людей / собак', description: 'Причины поведения и коррекция реакции', meta: '2 видео', imagePath: '/assets/useful-warning.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Причины поведения', description: 'Определяем, что лежит под реакцией' },
        { title: 'Работа с реакцией', description: 'Собираем первые шаги к более спокойному поведению' },
      ]},
      { slug: 'adult-small-neutering', title: 'Кастрация / стерилизация', description: 'Что ожидать от решения и что оно не решает само по себе', meta: '1 видео', imagePath: '/assets/useful-heart.svg', cardClass: 'topic-card--blue', lessons: [
        { title: 'Кастрировать / стерилизовать или нет?', description: 'Разбираем ожидания и контекст решения' },
      ]},
      { slug: 'adult-small-scooters-bikes', title: 'Бросается на самокаты / велосипеды', description: 'Страх, возбуждение или желание догнать как основа реакции', meta: '2 видео', imagePath: '/assets/images/programs/teen_dog.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Разбор причин поведения', description: 'Учимся отличать мотивацию под реакцией' },
        { title: 'Работа со страхом / возбуждением / желанием догнать', description: 'Подбираем стратегию под конкретный сценарий' },
      ]},
    ],
  },
  {
    slug: 'adult-small-fears-anxiety',
    title: 'Страхи и тревожность',
    description: 'Место, хвостик, звуки, машина и новые пространства',
    meta: '5 разделов',
    imagePath: '/assets/icons/sad_puppy.webp',
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-small-place-space', title: 'Команда «место» и организация пространства', description: 'Точка отдыха и понятная организация домашней среды', meta: '2 видео', imagePath: '/assets/useful-home.svg', cardClass: 'topic-card--blue', lessons: [
        { title: 'Команда «место»', description: 'Формируем точку отдыха как понятную бытовую опору' },
        { title: 'Организация пространства', description: 'Собираем спокойную и предсказуемую среду дома' },
      ]},
      { slug: 'adult-small-follows-tail', title: 'Ходит хвостиком', description: 'Как снизить тревожность и учить собаку оставаться отдельно', meta: '2 видео', imagePath: '/assets/images/situations/puppy-whines-night.webp', cardClass: 'topic-card--rose', lessons: [
        { title: 'Как минимизировать тревожность?', description: 'Добавляем бытовые опоры и снижаем зависание на человеке' },
        { title: 'Упражнения с оставлением собаки в комнатах', description: 'Постепенно учим выдерживать разлуку в пределах дома' },
      ]},
      { slug: 'adult-small-sounds', title: 'Звуки', description: 'Контробусловливание на звуки без перегруза', meta: '1 видео', imagePath: '/assets/useful-warning.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Контробусловливание на звуки', description: 'Меняем эмоциональную реакцию на шум шаг за шагом' },
      ]},
      { slug: 'adult-small-cars', title: 'Машины', description: 'Постепенное приучение к машине и девайсы для поездок', meta: '2 видео', imagePath: '/assets/images/programs/teen_dog.webp', cardClass: 'topic-card--blue', lessons: [
        { title: 'Приучаем постепенно к машине', description: 'Двигаемся от знакомства к спокойным коротким поездкам' },
        { title: 'Девайсы для поездок', description: 'Подбираем бытовые решения, которые делают поездку стабильнее' },
      ]},
      { slug: 'adult-small-new-places', title: 'Новые места', description: 'Лестницы, лифт и безопасное освоение новых точек', meta: '3 видео', imagePath: '/assets/useful-heart.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Страх лестницы', description: 'Постепенно знакомим собаку с подъёмом и спуском' },
        { title: 'Страх лифта', description: 'Снижаем напряжение вокруг лифта и маленького пространства' },
        { title: 'Техника безопасности', description: 'Собираем бытовые правила для безопасного прохождения сложных мест' },
      ]},
    ],
  },
  {
    slug: 'adult-small-care-without-fight',
    title: 'Уход без борьбы',
    description: 'Когти, лапы и груминг через предсказуемость и согласие',
    meta: '3 раздела',
    imagePath: '/assets/icons/puppy_hand.webp',
    cardClass: 'situation-card--blue',
    topics: [
      { slug: 'adult-small-claws', title: 'Когти', description: 'Анатомия когтя и базовая стрижка когтей', meta: '2 видео', imagePath: '/assets/useful-warning.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Анатомия когтя', description: 'Понимаем безопасную длину и зону риска' },
        { title: 'Стрижка когтей', description: 'Собираем спокойную процедуру шаг за шагом' },
      ]},
      { slug: 'adult-small-paws', title: 'Лапы', description: 'Пять свобод, право отказаться и организация ванной', meta: '3 видео', imagePath: '/assets/useful-home.svg', cardClass: 'topic-card--blue', lessons: [
        { title: '5 свобод', description: 'Разбираем основу комфортных манипуляций' },
        { title: 'Возможность отказаться', description: 'Строим взаимодействие без жёсткой фиксации' },
        { title: 'Организация пространства ванной', description: 'Подготавливаем среду, в которой проще сотрудничать' },
      ]},
      { slug: 'adult-small-grooming', title: 'Груминг', description: 'Частота мытья и подходящие средства', meta: '2 видео', imagePath: '/assets/useful-heart.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Как часто мыть?', description: 'Подбираем разумный ритм ухода' },
        { title: 'Что использовать?', description: 'Собираем минимальный понятный набор средств' },
      ]},
    ],
  },
  {
    slug: 'adult-small-fitness',
    title: 'Фитнес для взрослых',
    description: 'Небольшие трюки на координацию, контакт и бытовую включённость',
    meta: '2 раздела',
    imagePath: '/assets/icons/fitness.webp',
    cardClass: 'situation-card--rose',
    topics: [
      { slug: 'adult-small-go-around', title: 'Обойди', description: 'Движение вокруг объекта или человека по понятной траектории', meta: '1 видео', imagePath: '/assets/useful-leash.svg', cardClass: 'topic-card--blue', lessons: [
        { title: 'Обойди', description: 'Собираем чистую и аккуратную траекторию вокруг объекта' },
      ]},
      { slug: 'adult-small-wipe-muzzle', title: 'Вытри морду, тач на тряпочку', description: 'Полезный трюк на контакт и бытовое взаимодействие', meta: '1 видео', imagePath: '/assets/useful-home.svg', cardClass: 'topic-card--rose', lessons: [
        { title: 'Тач на тряпочку', description: 'Формируем спокойное касание предмета по сигналу' },
        { title: 'Вытри морду', description: 'Переносим трюк в полезный бытовой сценарий' },
      ]},
    ],
  },
];

const adultSmallSituationsBySlug = new Map<AdultSmallSituationSlug, AdultSmallSituation>(
  adultSmallSituations.map((situation) => [situation.slug, situation]),
);

const adultSmallTopics = adultSmallSituations.flatMap((situation) =>
  situation.topics.map((topic) => ({
    ...topic,
    parentSlug: situation.slug,
    parentTitle: situation.title,
  })),
);

const adultSmallTopicsBySlug = new Map<
  AdultSmallTopicSlug,
  AdultSmallTopic & { parentSlug: AdultSmallSituationSlug; parentTitle: string }
>(adultSmallTopics.map((topic) => [topic.slug, topic]));

interface LessonVideoEntry {
  id: string;
  title: string;
  rutubeUrl?: string;
  youtubeUrl?: string;
  backRoute: AppRoute;
}

const lessonVideosById = new Map<string, LessonVideoEntry>();

function registerLessonVideo(lesson: PuppyLessonItem, backRoute: AppRoute): void {
  if (!lesson.video) {
    return;
  }

  if (lessonVideosById.has(lesson.video.id)) {
    throw new Error(`Duplicate lesson video id: ${lesson.video.id}`);
  }

  lessonVideosById.set(lesson.video.id, {
    id: lesson.video.id,
    title: lesson.title,
    rutubeUrl: lesson.video.rutubeUrl,
    youtubeUrl: lesson.video.youtubeUrl,
    backRoute,
  });
}

puppyTopics.forEach((topic) => {
  topic.lessons.forEach((lesson) => registerLessonVideo(lesson, `puppy-topic:${topic.slug}`));
});

adultLargeTopics.forEach((topic) => {
  topic.lessons.forEach((lesson) => registerLessonVideo(lesson, `adult-large-topic:${topic.slug}`));
});

adultSmallTopics.forEach((topic) => {
  topic.lessons.forEach((lesson) => registerLessonVideo(lesson, `adult-small-topic:${topic.slug}`));
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
    return createRutubePlayerMarkup(lessonVideo);
  }

  if (route === 'complex') {
    return createComplexMarkup();
  }

  if (route === 'complex-levels:timed') {
    return createComplexLevelsMarkup('timed');
  }

  if (route === 'complex-levels:self-check') {
    return createComplexLevelsMarkup('self-check');
  }

  if (route === 'adult-small') {
    return createAdultSmallMarkup();
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

  if (route.startsWith('adult-small-situation:')) {
    const slug = getAdultSmallSituationSlugFromRoute(route);

    if (slug) {
      return createAdultSmallSituationTopicsMarkup(slug);
    }
  }

  if (route.startsWith('adult-small-topic:')) {
    const slug = getAdultSmallTopicSlugFromRoute(route);

    if (slug) {
      return createAdultSmallTopicLessonsMarkup(slug);
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

export function createUnsupportedEnvironmentMarkup(): string {
  const miniAppLink = getMiniAppLink();

  return `
    <main class="unsupported-shell">
      <section class="unsupported-card">
        <h1>Пожалуйста, откройте MiniApp</h1>
        <a class="unsupported-link" href="${miniAppLink}" rel="noreferrer">
          Открыть MiniApp
        </a>
      </section>
    </main>
  `;
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

export function getAdultSmallSituationSlugFromRoute(route: AppRoute): AdultSmallSituationSlug | null {
  if (!route.startsWith('adult-small-situation:')) {
    return null;
  }

  return route.replace('adult-small-situation:', '') as AdultSmallSituationSlug;
}

export function getAdultSmallTopicSlugFromRoute(route: AppRoute): AdultSmallTopicSlug | null {
  if (!route.startsWith('adult-small-topic:')) {
    return null;
  }

  return route.replace('adult-small-topic:', '') as AdultSmallTopicSlug;
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
            class="brand-mark js-feedback"
            type="button"
            aria-label="Высшая школа собак"
            data-feedback="Логотип школы собак"
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
              ${createUsefulCard('Первый день дома', '/assets/useful-home.svg', 'useful-card--blue')}
              ${createUsefulCard('Комплекс', '/assets/icons/fitness.webp', 'useful-card--blue', 'complex')}
              ${createUsefulCard('Ошибки воспитания', '/assets/useful-warning.svg', 'useful-card--rose')}
              ${createUsefulCard('Поводок', '/assets/icons/leash.webp', 'useful-card--blue')}
              ${createUsefulCard('Адаптация', '/assets/useful-heart.svg', 'useful-card--rose')}
              ${createUsefulCard('ТЕСТ', '', 'useful-card--gray')}
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

function createPuppiesMarkup(activeFilter: PuppyFilter): string {
  const visibleSituations =
    activeFilter === 'all'
      ? puppySituations
      : puppySituations.filter((situation) => situation.category === activeFilter);

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="home" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">Щенки</h1>
          </div>
        </div>
      </header>

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
              ${visibleSituations.map((situation) => createSituationCard(situation)).join('')}
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
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="home" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">Большие собаки</h1>
          </div>
        </div>
      </header>

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
              ${adultLargeSituations.map((situation) => createAdultLargeSituationCard(situation)).join('')}
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
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="adult-large" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${situation.title}</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Подразделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic) => createAdultLargeTopicCard(topic)).join('')}
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

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button
              class="back-button"
              type="button"
              data-route="adult-large-situation:${topic.parentSlug}"
              aria-label="Назад"
            >
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${topic.title}</h1>
          </div>
        </div>
      </header>

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

function createAdultSmallMarkup(): string {
  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="home" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">Маленькие собаки</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="puppy-hero" aria-labelledby="adult-small-hero-title">
            <div class="puppy-hero__content">
              <h2 id="adult-small-hero-title">Программа<br />для маленьких собак</h2>
              <p class="puppy-hero__description">
                Контакт, спокойный дом и управляемая прогулка в удобном бытовом ритме
              </p>
            </div>

            <div class="puppy-hero__media" aria-hidden="true">
              <span class="puppy-hero__decor puppy-hero__decor--top"></span>
              <span class="puppy-hero__decor puppy-hero__decor--bottom"></span>
              <img class="puppy-hero__image" src="/assets/images/programs/teen_dog.webp" alt="" />
            </div>
          </section>

          <section class="section-block section-block--tight" aria-labelledby="adult-small-title">
            <div class="section-heading section-heading--solo">
              <h2 id="adult-small-title">Разделы</h2>
            </div>

            <div class="situation-list">
              ${adultSmallSituations.map((situation) => createAdultSmallSituationCard(situation)).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createAdultSmallSituationTopicsMarkup(slug: AdultSmallSituationSlug): string {
  const situation = adultSmallSituationsBySlug.get(slug);

  if (!situation) {
    return createAdultSmallMarkup();
  }

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="adult-small" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${situation.title}</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Подразделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic) => createAdultSmallTopicCard(topic)).join('')}
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
  `;
}

function createAdultSmallTopicLessonsMarkup(slug: AdultSmallTopicSlug): string {
  const topic = adultSmallTopicsBySlug.get(slug);

  if (!topic) {
    return createAdultSmallMarkup();
  }

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button
              class="back-button"
              type="button"
              data-route="adult-small-situation:${topic.parentSlug}"
              aria-label="Назад"
            >
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${topic.title}</h1>
          </div>
        </div>
      </header>

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

function createSituationTopicsMarkup(slug: PuppySituationSlug): string {
  const situation = puppySituationsBySlug.get(slug);

  if (!situation) {
    return createPuppiesMarkup('all');
  }

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="puppies" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${situation.title}</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame">
          <section class="section-block section-block--detail-first">
            <div class="section-heading section-heading--solo">
              <h2>Разделы</h2>
            </div>
            <div class="topic-list">
              ${situation.topics.map((topic) => createTopicCard(topic)).join('')}
            </div>
          </section>
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
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button
              class="back-button"
              type="button"
              data-route="puppy-situation:${topic.parentSlug}"
              aria-label="Назад"
            >
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${topic.title}</h1>
          </div>
        </div>
      </header>

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

function createRutubePlayerMarkup(video: LessonVideoEntry): string {
  const youtubeEmbedUrl = getYoutubeEmbedUrl(video.youtubeUrl);
  const rutubeEmbedUrl = youtubeEmbedUrl ? '' : getRutubeEmbedUrl(video.rutubeUrl);
  const embedUrl = youtubeEmbedUrl || rutubeEmbedUrl;
  const escapedTitle = escapeHtml(video.title);
  const providerLabel = youtubeEmbedUrl ? 'YouTube' : 'Rutube';

  return `
    <div class="app-shell">
      <header class="subpage-header">
        <div class="content-frame">
          <div class="subpage-header__inner">
            <button class="back-button" type="button" data-route="${video.backRoute}" aria-label="Назад">
              <span class="back-button__icon" aria-hidden="true"></span>
            </button>
            <h1 class="subpage-title">${escapedTitle}</h1>
          </div>
        </div>
      </header>

      <main class="screen-content">
        <div class="content-frame content-frame--player">
          <section class="section-block section-block--detail-first">
            <div class="rutube-player-card">
              <div class="rutube-player-card__frame">
                ${
                  embedUrl
                    ? `<iframe
                        src="${escapeHtml(embedUrl)}"
                        title="${escapedTitle}"
                        frameborder="0"
                        allow="autoplay; clipboard-write; fullscreen; picture-in-picture"
                        referrerpolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        webkitallowfullscreen
                        mozallowfullscreen
                        allowfullscreen
                      ></iframe>`
                    : `<div class="rutube-player-card__empty">
                        <h2>Видео временно недоступно</h2>
                        <p>Не удалось подготовить безопасную ссылку на ${providerLabel}</p>
                      </div>`
                }
                <button
                  class="rutube-player-card__collapse"
                  type="button"
                  data-rutube-expand="false"
                  aria-label="Свернуть плеер"
                >
                  Свернуть
                </button>
              </div>
              <div class="rutube-player-card__details">
                <p>Тестовый текст</p>
                <button
                  class="rutube-player-card__expand-icon"
                  type="button"
                  data-rutube-expand="true"
                  aria-label="Открыть в полный экран"
                >
                  <span class="rutube-player-card__expand-symbol" aria-hidden="true"></span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      ${createBottomNav('lessons')}
    </div>
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
  const route = lesson.video ? `lesson-video:${lesson.video.id}` : lesson.route;
  const routeAttr = route ? `data-route="${route}"` : '';
  const buttonClass = lesson.externalUrl || route ? 'lesson-card' : 'lesson-card lesson-card--placeholder js-feedback';
  const buttonFeedback = lesson.externalUrl || route ? '' : `data-feedback="${escapeHtml(feedback)}"`;
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
        ${lesson.video || lesson.externalUrl ? '' : '<span class="lesson-card__status">Материал готовится</span>'}
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

  return `
    <div class="app-shell app-shell--complex-levels app-shell--complex-levels--${modeClass}">
      <main class="screen-content complex-levels">
        <button class="back-button complex-levels__back" type="button" data-route="complex" aria-label="Назад">
          <span class="back-button__icon" aria-hidden="true"></span>
        </button>

        <div class="content-frame complex-levels__frame">
          <header class="complex-levels__header">
            <span class="complex-levels__mode">${modeTitle}</span>
            <h1>Выберите уровень</h1>
            <p>Начните с комфортной сложности — повысить её можно в любой момент.</p>
          </header>

          <div class="complex-levels__list" role="list" aria-label="Уровни сложности">
            ${createComplexLevelCard('Начальный', '01', 'Базовые задания в спокойном темпе', modeTitle)}
            ${createComplexLevelCard('Средний', '02', 'Больше темпа и концентрации', modeTitle)}
            ${createComplexLevelCard('Сложный', '03', 'Максимальная сложность заданий', modeTitle)}
          </div>
        </div>
      </main>
    </div>
  `;
}

function createComplexLevelCard(
  title: string,
  number: string,
  description: string,
  modeTitle: string,
): string {
  return `
    <button
      class="complex-level-card js-feedback"
      type="button"
      role="listitem"
      data-feedback="${escapeHtml(`${modeTitle}: уровень «${title}» пока в разработке`)}"
    >
      <span class="complex-level-card__number" aria-hidden="true">${number}</span>
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
): string {
  const resolvedTitle = title === 'Ошибки воспитания' ? 'Спросить у кинолога' : title;
  const resolvedModifierClass = title === 'Ошибки воспитания' ? 'useful-card--ask' : modifierClass;
  const resolvedIconPath = title === 'Первый день дома' ? iconPath : resolveCardImagePath(iconPath);
  const actionClass = route ? '' : ' js-feedback';
  const actionAttribute = route
    ? `data-route="${route}"`
    : `data-feedback="Материал &quot;${escapeHtml(resolvedTitle)}&quot; пока в разработке"`;
  const iconMarkup =
    modifierClass === 'useful-card--gray'
      ? '<span class="useful-card__test-icon" aria-hidden="true"></span>'
      : `<img src="${resolvedIconPath}" alt="" />`;

  return `
    <button
      class="useful-card ${resolvedModifierClass}${actionClass}"
      type="button"
      ${actionAttribute}
    >
      <span class="useful-card__icon">
        ${iconMarkup}
      </span>
      <span class="useful-card__title">${resolvedTitle}</span>
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

function createSituationCard(situation: PuppySituation): string {
  return `
    <button
      class="situation-card ${situation.cardClass}"
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

function createAdultLargeSituationCard(situation: AdultLargeSituation): string {
  return `
    <button
      class="situation-card ${situation.cardClass}"
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

function createAdultSmallSituationCard(situation: AdultSmallSituation): string {
  return `
    <button
      class="situation-card ${situation.cardClass}"
      type="button"
      data-route="adult-small-situation:${situation.slug}"
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

function createTopicCard(topic: PuppyTopic): string {
  const imagePath = resolveCardImagePath(topic.imagePath);
  const mediaClass = imagePath.startsWith('/assets/icons/') ? ' topic-card__media--transparent' : '';

  return `
    <button
      class="topic-card ${topic.cardClass}"
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

function createAdultLargeTopicCard(topic: AdultLargeTopic): string {
  const imagePath = resolveCardImagePath(topic.imagePath);
  const mediaClass = imagePath.startsWith('/assets/icons/') ? ' topic-card__media--transparent' : '';

  return `
    <button
      class="topic-card ${topic.cardClass}"
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

function createAdultSmallTopicCard(topic: AdultSmallTopic): string {
  const imagePath = resolveCardImagePath(topic.imagePath);
  const mediaClass = imagePath.startsWith('/assets/icons/') ? ' topic-card__media--transparent' : '';

  return `
    <button
      class="topic-card ${topic.cardClass}"
      type="button"
      data-route="adult-small-topic:${topic.slug}"
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
          'Раздел "Чат с кинологом" пока в разработке',
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
): string {
  const activeClass = isActive ? ' bottom-nav__tab--active' : '';
  const attrs = route
    ? `data-route="${route}"`
    : `data-feedback="${escapeHtml(feedback ?? `Раздел "${label}" пока в разработке`)}"`;
  const feedbackClass = route ? '' : ' js-feedback';

  return `
    <button class="bottom-nav__tab${feedbackClass}${activeClass}" type="button" ${attrs}>
      <span class="bottom-nav__content">
        <span class="bottom-nav__icon bottom-nav__icon--${iconName}" aria-hidden="true"></span>
        <span class="bottom-nav__label">${label}</span>
      </span>
    </button>
  `;
}

function getMiniAppLink(): string {
  const configuredLink = import.meta.env.VITE_MINI_APP_LINK;

  if (!configuredLink) {
    return 'https://t.me/testpuppybot/navigation';
  }

  if (configuredLink.startsWith('https://t.me/')) {
    return configuredLink;
  }

  return `https://t.me/${configuredLink.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^\/+/, '')}`;
}

function getRutubeEmbedUrl(sourceUrl?: string): string {
  const configuredUrl = sourceUrl?.trim() ?? '';

  if (!configuredUrl) {
    return '';
  }

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    if (url.protocol !== 'https:' || hostname !== 'rutube.ru') {
      return '';
    }

    const videoMatch = url.pathname.match(/^\/(?:play\/embed\/|video\/(?:private\/)?)([a-f0-9]{32})(?:\/|$)/i);

    if (videoMatch) {
      const embedUrl = new URL(`https://rutube.ru/play/embed/${videoMatch[1]}/`);
      embedUrl.search = url.search;
      return embedUrl.toString();
    }
  } catch {
    return '';
  }

  return '';
}

function getYoutubeEmbedUrl(sourceUrl?: string): string {
  const configuredUrl = sourceUrl?.trim() ?? '';

  if (!configuredUrl) {
    return '';
  }

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';

    if (url.protocol !== 'https:') {
      return '';
    }

    if (hostname === 'youtube.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') ?? '';
      } else {
        videoId = url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})\/?$/)?.[1] ?? '';
      }
    } else if (hostname === 'youtu.be') {
      videoId = url.pathname.match(/^\/([a-zA-Z0-9_-]{11})\/?$/)?.[1] ?? '';
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return '';
    }

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set('rel', '0');
    embedUrl.searchParams.set('playsinline', '1');
    return embedUrl.toString();
  } catch {
    return '';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

