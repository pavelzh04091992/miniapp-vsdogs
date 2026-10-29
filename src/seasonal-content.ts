import seasonalVideoDescriptions from './seasonal-video-descriptions.json';

export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn';
export type SeasonalSection = 'walks' | 'tips';

export interface SeasonTheme {
  id: SeasonId;
  label: string;
  heroTitle: string;
  heroDescription: string;
  heroImagePath: string;
  iconImagePath: string;
  accent: string;
  softBackground: string;
}

export interface SeasonalVideo {
  id: keyof typeof seasonalVideoDescriptions;
  mediaId: keyof typeof seasonalVideoDescriptions;
  posterPath: string;
  title: string;
  description: string;
  seasons: readonly SeasonId[];
  section: SeasonalSection;
  category: string;
  duration: string;
  durationSeconds: number;
  order: number;
  published: true;
}

export const seasonThemes = [
  {
    id: 'winter',
    label: 'Зима',
    heroTitle: 'Зимние видео',
    heroDescription: 'Полезные советы для комфортной зимы с вашим питомцем.',
    heroImagePath: '/assets/images/seasons/winter-pug.webp',
    iconImagePath: '/assets/images/seasons/winter-icon.webp',
    accent: '#4C97EB',
    softBackground: '#EDF6FF',
  },
  {
    id: 'spring',
    label: 'Весна',
    heroTitle: 'Весенние видео',
    heroDescription: 'Идеи для активной весны и радостных прогулок вместе.',
    heroImagePath: '/assets/images/seasons/spring-pug.webp',
    iconImagePath: '/assets/images/seasons/spring-icon.webp',
    accent: '#E66EA3',
    softBackground: '#FFF0F6',
  },
  {
    id: 'summer',
    label: 'Лето',
    heroTitle: 'Летние видео',
    heroDescription: 'Полезные советы для безопасного и яркого лета с собакой.',
    heroImagePath: '/assets/images/seasons/summer-pug.webp',
    iconImagePath: '/assets/images/seasons/summer-icon.webp',
    accent: '#E5A321',
    softBackground: '#FFF8E8',
  },
  {
    id: 'autumn',
    label: 'Осень',
    heroTitle: 'Осенние видео',
    heroDescription: 'Полезные советы для уютной осени с вашим питомцем.',
    heroImagePath: '/assets/images/seasons/autumn-pug.webp',
    iconImagePath: '/assets/images/seasons/autumn-icon.webp',
    accent: '#FF7847',
    softBackground: '#FFF3EA',
  },
] as const satisfies readonly SeasonTheme[];

export const seasonalSectionDefinitions = [
  { id: 'walks', title: 'Прогулки' },
  { id: 'tips', title: 'Советы' },
] as const satisfies readonly { id: SeasonalSection; title: string }[];

export const seasonalVideos: readonly SeasonalVideo[] = [
  {
    id: 'night-walk-safety',
    mediaId: 'night-walk-safety',
    posterPath: '/assets/covers/seasonal/night-walk-safety.webp',
    title: 'Как безопасно гулять с собакой в тёмное время суток?',
    description: seasonalVideoDescriptions['night-walk-safety'],
    seasons: ['autumn'],
    section: 'walks',
    category: 'Прогулки',
    duration: '6:59',
    durationSeconds: 419,
    order: 1,
    published: true,
  },
  {
    id: 'walk-motivation',
    mediaId: 'walk-motivation',
    posterPath: '/assets/covers/seasonal/walk-motivation.webp',
    title: 'Как мотивировать собаку на прогулку?',
    description: seasonalVideoDescriptions['walk-motivation'],
    seasons: ['autumn'],
    section: 'walks',
    category: 'Прогулки',
    duration: '7:04',
    durationSeconds: 424,
    order: 2,
    published: true,
  },
  {
    id: 'walk-enrichment',
    mediaId: 'walk-enrichment',
    posterPath: '/assets/covers/seasonal/walk-enrichment.webp',
    title: 'Чем разнообразить прогулки в холодное время года',
    description: seasonalVideoDescriptions['walk-enrichment'],
    seasons: ['autumn'],
    section: 'walks',
    category: 'Прогулки',
    duration: '4:56',
    durationSeconds: 296,
    order: 3,
    published: true,
  },
  {
    id: 'autumn-wardrobe',
    mediaId: 'autumn-wardrobe',
    posterPath: '/assets/covers/seasonal/autumn-wardrobe.webp',
    title: 'Осенний гардероб',
    description: seasonalVideoDescriptions['autumn-wardrobe'],
    seasons: ['autumn'],
    section: 'tips',
    category: 'Советы',
    duration: '10:36',
    durationSeconds: 636,
    order: 1,
    published: true,
  },
  {
    id: 'paw-protection',
    mediaId: 'paw-protection',
    posterPath: '/assets/covers/seasonal/paw-protection.webp',
    title: 'Уход за лапами в холодное время года',
    description: seasonalVideoDescriptions['paw-protection'],
    seasons: ['autumn'],
    section: 'tips',
    category: 'Советы',
    duration: '2:29',
    durationSeconds: 149,
    order: 2,
    published: true,
  },
  {
    id: 'stop-putting-paws',
    mediaId: 'stop-putting-paws',
    posterPath: '/assets/covers/seasonal/stop-putting-paws.webp',
    title: 'Как отучить собаку ставить грязные лапы',
    description: seasonalVideoDescriptions['stop-putting-paws'],
    seasons: ['autumn'],
    section: 'tips',
    category: 'Советы',
    duration: '2:50',
    durationSeconds: 170,
    order: 3,
    published: true,
  },
];

export function isSeasonId(value: string): value is SeasonId {
  return seasonThemes.some((season) => season.id === value);
}

export function isSeasonalSection(value: string): value is SeasonalSection {
  return seasonalSectionDefinitions.some((section) => section.id === value);
}

export function getSeasonTheme(seasonId: SeasonId): SeasonTheme {
  return seasonThemes.find((season) => season.id === seasonId) ?? seasonThemes[3];
}

export function getSeasonalVideos(
  seasonId: SeasonId,
  section?: SeasonalSection,
): readonly SeasonalVideo[] {
  return seasonalVideos
    .filter((video) => video.published && video.seasons.includes(seasonId))
    .filter((video) => !section || video.section === section)
    .sort((left, right) => left.order - right.order);
}

export function getSeasonalVideo(videoId: string): SeasonalVideo | null {
  return seasonalVideos.find((video) => video.id === videoId) ?? null;
}
