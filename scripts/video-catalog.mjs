import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const VIDEO_CATALOG_PATH = resolve(process.cwd(), 'data', 'videos.json');
const MAX_CATALOG_BYTES = 10 * 1024 * 1024;
const FALLBACK_THUMBNAILS = {
  'puppy-toilet-home': '/assets/images/situations/puppy-toilet-home.webp',
};

export function loadVideoCatalog() {
  ensureVideoCatalogFile();
  const { size } = statSync(VIDEO_CATALOG_PATH);

  if (size > MAX_CATALOG_BYTES) {
    throw new Error(`Video catalog exceeds ${MAX_CATALOG_BYTES} bytes`);
  }

  const raw = readFileSync(VIDEO_CATALOG_PATH, 'utf8');

  try {
    return parseVideoCatalog(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Invalid video catalog at ${VIDEO_CATALOG_PATH}: ${error.message}`);
  }
}

export function saveVideoCatalog(videos) {
  ensureVideoCatalogFile();

  const payload = {
    updatedAt: new Date().toISOString(),
    videos,
  };
  parseVideoCatalog(payload);

  const temporaryPath = `${VIDEO_CATALOG_PATH}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    renameSync(temporaryPath, VIDEO_CATALOG_PATH);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
  }
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
    title: title.slice(0, 160),
    description: description.slice(0, 1_000),
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
  const seconds = Number(unixTimestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }

  const milliseconds = seconds * 1000;
  const date = new Date(milliseconds);
  return Number.isFinite(milliseconds) && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : new Date().toISOString();
}

export function parseVideoCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('root value must be an object');
  }

  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) {
    throw new Error('updatedAt must be an ISO date string');
  }

  if (!Array.isArray(value.videos)) {
    throw new Error('videos must be an array');
  }

  if (value.videos.length > 10_000) {
    throw new Error('videos exceeds the maximum supported size');
  }

  return {
    updatedAt: value.updatedAt,
    videos: value.videos.map((entry, index) => validateVideoEntry(entry, index)),
  };
}

function validateVideoEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`videos[${index}] must be an object`);
  }

  const requiredStrings = [
    'id',
    'situationSlug',
    'telegramChatId',
    'title',
    'description',
    'sourceLabel',
    'thumbnailUrl',
    'telegramUrl',
    'createdAt',
  ];

  for (const key of requiredStrings) {
    if (typeof entry[key] !== 'string') {
      throw new Error(`videos[${index}].${key} must be a string`);
    }

    if (entry[key].length > 4_096) {
      throw new Error(`videos[${index}].${key} is too long`);
    }
  }

  if (!Number.isSafeInteger(entry.telegramMessageId) || entry.telegramMessageId <= 0) {
    throw new Error(`videos[${index}].telegramMessageId must be a positive integer`);
  }

  if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0) {
    throw new Error(`videos[${index}].durationSeconds must be a non-negative number`);
  }

  if (Number.isNaN(Date.parse(entry.createdAt))) {
    throw new Error(`videos[${index}].createdAt must be an ISO date string`);
  }

  return { ...entry };
}
