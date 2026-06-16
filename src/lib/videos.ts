export type SituationSlug = 'puppy-toilet-home';

export interface SituationVideo {
  id: string;
  situationSlug: SituationSlug;
  telegramMessageId: number;
  telegramChatId: string;
  order: number;
  label: string;
  title: string;
  description: string;
  durationSeconds: number;
  durationLabel: string;
  sourceLabel: string;
  thumbnailUrl: string;
  telegramUrl: string;
  createdAt: string;
}

interface VideoCatalogResponse {
  updatedAt: string;
  videos: StoredSituationVideo[];
}

interface StoredSituationVideo {
  id: string;
  situationSlug: SituationSlug;
  telegramMessageId: number;
  telegramChatId: string;
  title: string;
  description: string;
  durationSeconds: number;
  sourceLabel?: string;
  thumbnailUrl: string;
  telegramUrl: string;
  createdAt: string;
}

const VIDEO_CATALOG_URL = '/data/videos.json';

export async function fetchSituationVideos(slug: SituationSlug): Promise<SituationVideo[]> {
  const response = await fetch(`${VIDEO_CATALOG_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Video catalog request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<VideoCatalogResponse>;
  const rawVideos = Array.isArray(payload.videos) ? payload.videos : [];

  return rawVideos
    .filter((video): video is StoredSituationVideo => video?.situationSlug === slug)
    .sort(sortByCreatedAtDesc)
    .map((video, index) => ({
      ...video,
      order: index + 1,
      label: `Видео ${index + 1}`,
      durationLabel: formatDurationLabel(video.durationSeconds),
      sourceLabel: video.sourceLabel || 'Telegram',
    }));
}

function sortByCreatedAtDesc(a: StoredSituationVideo, b: StoredSituationVideo): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function formatDurationLabel(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'Без длительности';
  }

  const roundedMinutes = Math.max(1, Math.round(durationSeconds / 60));

  if (roundedMinutes % 10 === 1 && roundedMinutes % 100 !== 11) {
    return `${roundedMinutes} минута`;
  }

  if (
    roundedMinutes % 10 >= 2 &&
    roundedMinutes % 10 <= 4 &&
    (roundedMinutes % 100 < 12 || roundedMinutes % 100 > 14)
  ) {
    return `${roundedMinutes} минуты`;
  }

  return `${roundedMinutes} минут`;
}
