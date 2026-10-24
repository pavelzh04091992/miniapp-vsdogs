import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdtemp, open, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import Busboy from 'busboy';
import { RequestError } from './http-utils.mjs';

export const FEEDBACK_MAX_FILES = 5;
export const FEEDBACK_MAX_QUESTION_LENGTH = 1000;
export const FEEDBACK_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const FEEDBACK_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const FEEDBACK_MAX_TOTAL_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MEDIA = new Map([
  ['image/jpeg', { kind: 'photo', telegramMethod: 'photo' }],
  ['image/png', { kind: 'photo', telegramMethod: 'photo' }],
  ['image/webp', { kind: 'photo', telegramMethod: 'document' }],
  ['image/heic', { kind: 'photo', telegramMethod: 'document' }],
  ['image/heif', { kind: 'photo', telegramMethod: 'document' }],
  ['video/mp4', { kind: 'video', telegramMethod: 'video' }],
  ['video/quicktime', { kind: 'video', telegramMethod: 'document' }],
  ['video/webm', { kind: 'video', telegramMethod: 'document' }],
]);

const ENTRY_POINT_LABELS = {
  home: 'Главная',
  player: 'Плеер урока',
  'chat-nav': 'Вкладка «Чат»',
};

export async function readFeedbackForm(request) {
  let temporaryDirectory;

  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'puppy-feedback-'));
    await chmod(temporaryDirectory, 0o700);
    const result = await parseMultipartRequest(request, temporaryDirectory);
    await validateUploadedFiles(result.attachments);
    return { ...result, temporaryDirectory };
  } catch (error) {
    if (temporaryDirectory) {
      await removeFeedbackFiles(temporaryDirectory);
    }
    throw error;
  }
}

export async function removeFeedbackFiles(temporaryDirectory) {
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export async function cleanupOrphanedFeedbackFiles(maxAgeMs = 60 * 60 * 1000) {
  const directory = tmpdir();
  const entries = await readdir(directory, { withFileTypes: true });
  const cutoff = Date.now() - maxAgeMs;

  await Promise.allSettled(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('puppy-feedback-'))
    .map(async (entry) => {
      const path = join(directory, entry.name);
      const metadata = await stat(path);
      if (metadata.mtimeMs <= cutoff) await removeFeedbackFiles(path);
    }));
}

export async function deliverFeedback({ api, adminTelegramId, submission, user }) {
  const submissionId = randomUUID();
  const sentMessageIds = [];

  try {
    const rootMessage = await api.sendMessage(
      adminTelegramId,
      formatFeedbackMessage(submissionId, submission, user),
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    );
    const rootMessageId = requireTelegramMessageId(rootMessage);
    sentMessageIds.push(rootMessageId);

    for (let index = 0; index < submission.attachments.length; index += 1) {
      const attachment = submission.attachments[index];
      const extra = {
        caption: `Вложение ${index + 1} из ${submission.attachments.length}: ${attachment.originalName}`,
        reply_parameters: { message_id: rootMessageId },
      };
      let sentAttachment;

      if (attachment.telegramMethod === 'photo') {
        sentAttachment = await api.sendPhotoFile(adminTelegramId, attachment, extra);
      } else if (attachment.telegramMethod === 'video') {
        sentAttachment = await api.sendVideoFile(adminTelegramId, attachment, extra);
      } else {
        sentAttachment = await api.sendDocumentFile(adminTelegramId, attachment, extra);
      }

      sentMessageIds.push(requireTelegramMessageId(sentAttachment));
    }

    return { submissionId };
  } catch (error) {
    await Promise.allSettled(
      sentMessageIds.reverse().map((messageId) => api.deleteMessage(adminTelegramId, messageId)),
    );
    throw error;
  }
}

export function formatFeedbackMessage(submissionId, submission, user) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Без имени';
  const profileLabel = user.username ? `@${user.username}` : displayName;
  const profileLink = `<a href="tg://user?id=${escapeHtml(user.telegramId)}">${escapeHtml(profileLabel)}</a>`;
  const sourceLabel = ENTRY_POINT_LABELS[submission.entryPoint] || submission.entryPoint;
  const lessonLines = submission.entryPoint === 'player'
    ? [
        submission.lessonTitle ? `Урок: ${escapeHtml(submission.lessonTitle)}` : '',
        submission.lessonId ? `ID урока: <code>${escapeHtml(submission.lessonId)}</code>` : '',
      ].filter(Boolean)
    : [];

  return [
    '<b>Новый вопрос кинологу</b>',
    `Заявка: <code>${escapeHtml(submissionId)}</code>`,
    `Пользователь: ${profileLink}`,
    `Telegram ID: <code>${escapeHtml(user.telegramId)}</code>`,
    `Источник: ${escapeHtml(sourceLabel)}`,
    ...lessonLines,
    '',
    '<b>Вопрос</b>',
    escapeHtml(submission.question),
  ].join('\n');
}

async function parseMultipartRequest(request, temporaryDirectory) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();

  if (!contentType.startsWith('multipart/form-data;')) {
    request.resume();
    throw new RequestError(415, 'unsupported_media_type');
  }

  return new Promise((resolve, reject) => {
    let parser;

    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          files: FEEDBACK_MAX_FILES,
          fields: 4,
          parts: FEEDBACK_MAX_FILES + 4,
          fieldSize: 4096,
          fileSize: FEEDBACK_MAX_VIDEO_BYTES,
        },
      });
    } catch {
      request.resume();
      reject(new RequestError(400, 'invalid_multipart'));
      return;
    }

    const fields = new Map();
    const attachments = [];
    const writes = [];
    const fileStreams = new Set();
    let totalFileBytes = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      request.unpipe(parser);
      request.resume();
      fileStreams.forEach((stream) => stream.destroy());
      reject(error instanceof RequestError ? error : new RequestError(400, 'invalid_multipart'));
    };

    parser.on('field', (name, value, info) => {
      if (
        info.valueTruncated ||
        fields.has(name) ||
        !['question', 'entryPoint', 'lessonId', 'lessonTitle'].includes(name)
      ) {
        fail(new RequestError(422, 'invalid_fields'));
        return;
      }
      fields.set(name, value);
    });

    parser.on('file', (name, stream, info) => {
      if (settled) {
        stream.resume();
        return;
      }

      const media = ALLOWED_MEDIA.get(String(info.mimeType || '').toLowerCase());

      if (name !== 'attachments' || !media) {
        stream.resume();
        fail(new RequestError(415, 'unsupported_attachment_type'));
        return;
      }

      const originalName = sanitizeFilename(info.filename, attachments.length);
      const path = join(temporaryDirectory, `${String(attachments.length + 1).padStart(2, '0')}-${randomUUID()}`);
      const attachment = {
        path,
        originalName,
        mimeType: String(info.mimeType).toLowerCase(),
        kind: media.kind,
        telegramMethod: media.telegramMethod,
        size: 0,
      };
      attachments.push(attachment);
      fileStreams.add(stream);
      stream.once('close', () => fileStreams.delete(stream));

      stream.on('data', (chunk) => {
        attachment.size += chunk.length;
        totalFileBytes += chunk.length;

        if (totalFileBytes > FEEDBACK_MAX_TOTAL_FILE_BYTES) {
          fail(new RequestError(413, 'feedback_too_large'));
        }
      });
      stream.on('limit', () => fail(new RequestError(413, 'attachment_too_large')));
      writes.push(
        pipeline(stream, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
          .catch((error) => {
            if (!settled) fail(error);
          }),
      );
    });

    parser.on('filesLimit', () => fail(new RequestError(413, 'too_many_attachments')));
    parser.on('fieldsLimit', () => fail(new RequestError(422, 'invalid_fields')));
    parser.on('partsLimit', () => fail(new RequestError(413, 'too_many_parts')));
    parser.on('error', fail);
    request.on('aborted', () => fail(new RequestError(400, 'request_aborted')));

    parser.on('close', async () => {
      if (settled) return;

      try {
        await Promise.all(writes);
        const question = String(fields.get('question') || '').trim();
        const entryPoint = String(fields.get('entryPoint') || '');
        const lessonId = cleanOptionalField(fields.get('lessonId'), 200);
        const lessonTitle = cleanOptionalField(fields.get('lessonTitle'), 300);

        if (!question || question.length > FEEDBACK_MAX_QUESTION_LENGTH) {
          throw new RequestError(422, 'invalid_question');
        }

        if (!Object.hasOwn(ENTRY_POINT_LABELS, entryPoint)) {
          throw new RequestError(422, 'invalid_entry_point');
        }

        if (entryPoint === 'player' && (!lessonId || !lessonTitle)) {
          throw new RequestError(422, 'missing_lesson_context');
        }

        settled = true;
        resolve({ question, entryPoint, lessonId, lessonTitle, attachments });
      } catch (error) {
        fail(error);
      }
    });

    request.pipe(parser);
  });
}

async function validateUploadedFiles(attachments) {
  for (const attachment of attachments) {
    const maximumSize = attachment.kind === 'photo'
      ? FEEDBACK_MAX_PHOTO_BYTES
      : FEEDBACK_MAX_VIDEO_BYTES;

    if (attachment.size === 0 || attachment.size > maximumSize) {
      throw new RequestError(413, 'attachment_too_large');
    }

    const handle = await open(attachment.path, 'r');
    const signature = Buffer.alloc(Math.min(32, attachment.size));

    try {
      await handle.read(signature, 0, signature.length, 0);
    } finally {
      await handle.close();
    }

    if (!matchesMediaSignature(attachment.mimeType, signature)) {
      throw new RequestError(415, 'attachment_signature_mismatch');
    }
  }
}

export function matchesMediaSignature(mimeType, bytes) {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'video/webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

  const isIsoMedia = bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  const brand = bytes.subarray(8, 12).toString('ascii').toLowerCase();

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return isIsoMedia && ['heic', 'heix', 'heif', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand);
  }

  if (mimeType === 'video/mp4') {
    return isIsoMedia && [
      'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6',
      'avc1', 'mp41', 'mp42', 'm4v ', 'dash',
    ].includes(brand);
  }

  if (mimeType === 'video/quicktime') {
    return isIsoMedia && brand === 'qt  ';
  }

  return false;
}

function cleanOptionalField(value, maximumLength) {
  const cleaned = String(value || '').trim();
  return cleaned ? cleaned.slice(0, maximumLength) : null;
}

function sanitizeFilename(value, index) {
  const filename = basename(String(value || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (filename || `media-${index + 1}`).slice(0, 180);
}

function requireTelegramMessageId(message) {
  const messageId = Number(message?.message_id);

  if (!Number.isSafeInteger(messageId) || messageId <= 0) {
    throw new Error('Telegram did not return a message ID');
  }

  return messageId;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
