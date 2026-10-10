import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const VIDEO_CATALOG_PATH = resolve(process.cwd(), 'data', 'videos.json');
const FALLBACK_THUMBNAILS = {
  'puppy-toilet-home': '/assets/images/situations/puppy-toilet-home.webp',
};

export function loadVideoCatalog() {
  ensureVideoCatalogFile();

  try {
    const raw = readFileSync(VIDEO_CATALOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
    };
  } catch {
    return {
      updatedAt: new Date(0).toISOString(),
      videos: [],
    };
  }
}

export function saveVideoCatalog(videos) {
  ensureVideoCatalogFile();

  const payload = {
    updatedAt: new Date().toISOString(),
    videos,
  };

  writeFileSync(VIDEO_CATALOG_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function upsertChannelVideo(message, options = {}) {
  const videoMeta = getTelegramVideoMeta(message);

  if (!videoMeta) {
    return { changed: false, reason: 'message_has_no_video' };
  }

  const chat = message.chat ?? {};

  if (!isAllowedTelegramChannel(chat, options)) {
    return { changed: false, reason: 'untrusted_channel' };
  }

  const telegramUrl = buildTelegramPostUrl(chat, message.message_id, options.publicChannelUsername);

  if (!telegramUrl) {
    return { changed: false, reason: 'missing_public_channel_username' };
  }

  const catalog = loadVideoCatalog();
  const situationSlug = resolveSituationSlug(message, options);
  const preparedEntry = createVideoEntry({
    existingEntry: catalog.videos.find(
      (entry) =>
        entry.telegramMessageId === message.message_id &&
        String(entry.telegramChatId) === String(chat.id),
    ),
    message,
    situationSlug,
    telegramUrl,
    durationSeconds: videoMeta.durationSeconds,
  });

  const nextVideos = catalog.videos.filter(
    (entry) =>
      !(
        entry.telegramMessageId === message.message_id &&
        String(entry.telegramChatId) === String(chat.id)
      ),
  );

  nextVideos.unshift(preparedEntry);
  nextVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  saveVideoCatalog(nextVideos);

  return {
    changed: true,
    situationSlug,
    entry: preparedEntry,
  };
}

export function isAllowedTelegramChannel(chat, options = {}) {
  const expectedChatId = String(options.publicChannelId || '').trim();

  if (expectedChatId) {
    return String(chat?.id ?? '') === expectedChatId;
  }

  const expectedUsername = normalizeChannelUsername(options.publicChannelUsername);
  const actualUsername = normalizeChannelUsername(chat?.username);
  return Boolean(expectedUsername && actualUsername && expectedUsername === actualUsername);
}

export function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  try {
    const content = readFileSync(envPath, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function ensureVideoCatalogFile() {
  const dirPath = dirname(VIDEO_CATALOG_PATH);

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  if (!existsSync(VIDEO_CATALOG_PATH)) {
    const emptyPayload = {
      updatedAt: new Date(0).toISOString(),
      videos: [],
    };

    writeFileSync(VIDEO_CATALOG_PATH, `${JSON.stringify(emptyPayload, null, 2)}\n`, 'utf8');
  }
}

function getTelegramVideoMeta(message) {
  if (message.video) {
    return {
      durationSeconds: Number(message.video.duration) || 0,
    };
  }

  if (message.document && typeof message.document.mime_type === 'string' && message.document.mime_type.startsWith('video/')) {
    return {
      durationSeconds: 0,
    };
  }

  if (message.animation) {
    return {
      durationSeconds: Number(message.animation.duration) || 0,
    };
  }

  return null;
}

function resolveSituationSlug(message, options) {
  const knownSlugs = (options.knownSlugs?.length ? options.knownSlugs : ['puppy-toilet-home']).map((slug) =>
    String(slug).trim(),
  );
  const text = [message.caption, message.text].filter(Boolean).join('\n');
  const hashtags = [...text.matchAll(/#([a-z0-9-_]+)/gi)].map((match) => match[1].toLowerCase());

  for (const hashtag of hashtags) {
    if (knownSlugs.includes(hashtag)) {
      return hashtag;
    }
  }

  return options.defaultSituationSlug || knownSlugs[0] || 'puppy-toilet-home';
}

function buildTelegramPostUrl(chat, messageId, publicChannelUsername) {
  const username = normalizeChannelUsername(chat.username || publicChannelUsername);
  const normalizedMessageId = Number(messageId);

  if (
    !/^[A-Za-z\d_]{5,32}$/.test(username) ||
    !Number.isSafeInteger(normalizedMessageId) ||
    normalizedMessageId <= 0
  ) {
    return null;
  }

  return `https://t.me/${username}/${normalizedMessageId}`;
}

function normalizeChannelUsername(value) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function createVideoEntry({ existingEntry, message, situationSlug, telegramUrl, durationSeconds }) {
  const normalizedCaption = normalizeCaption(message.caption || message.text || '');
  const title = getTitleFromCaption(normalizedCaption);
  const description = getDescriptionFromCaption(normalizedCaption, title);
  const chatId = String(message.chat?.id ?? '');

  return {
    id: existingEntry?.id || `video-${chatId}-${message.message_id}`,
    situationSlug,
    telegramMessageId: message.message_id,
    telegramChatId: chatId,
    title,
    description,
    durationSeconds,
    sourceLabel: 'Telegram',
    thumbnailUrl: existingEntry?.thumbnailUrl || FALLBACK_THUMBNAILS[situationSlug] || '/assets/hero-dog.webp',
    telegramUrl,
    createdAt: toIsoString(message.date),
  };
}

function normalizeCaption(value) {
  return String(value)
    .replace(/#[a-z0-9-_]+/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getTitleFromCaption(value) {
  if (!value) {
    return 'Новое видео';
  }

  const title = value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return title || 'Новое видео';
}

function getDescriptionFromCaption(value, title) {
  if (!value) {
    return 'Новый разбор уже доступен в Telegram';
  }

  const description = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1)
    .join(' ');

  if (!description || description === title) {
    return 'Новый разбор уже доступен в Telegram';
  }

  return description;
}

function toIsoString(unixTimestamp) {
  if (!unixTimestamp) {
    return new Date().toISOString();
  }

  return new Date(Number(unixTimestamp) * 1000).toISOString();
}
