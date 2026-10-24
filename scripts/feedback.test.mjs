import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  deliverFeedback,
  formatFeedbackMessage,
  matchesMediaSignature,
  readFeedbackForm,
  removeFeedbackFiles,
} from './feedback.mjs';

test('recognizes supported media signatures and rejects mismatches', () => {
  assert.equal(matchesMediaSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(matchesMediaSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesMediaSignature('image/webp', Buffer.from('RIFF0000WEBP')), true);
  assert.equal(matchesMediaSignature('video/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), true);
  assert.equal(matchesMediaSignature('video/mp4', Buffer.from('0000ftypisom')), true);
  assert.equal(matchesMediaSignature('video/quicktime', Buffer.from('0000ftypqt  ')), true);
  assert.equal(matchesMediaSignature('image/jpeg', Buffer.from('not-a-jpeg')), false);
});

test('parses a feedback multipart body and stores attachments temporarily', async () => {
  const boundary = 'feedback-test-boundary';
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
  const body = createMultipartBody(boundary, [
    { name: 'question', value: '  Как помочь собаке?  ' },
    { name: 'entryPoint', value: 'player' },
    { name: 'lessonId', value: 'lesson-12' },
    { name: 'lessonTitle', value: 'Спокойная прогулка' },
    { name: 'attachments', filename: 'dog.jpg', contentType: 'image/jpeg', value: jpeg },
  ]);
  const request = Readable.from(body);
  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  };
  const result = await readFeedbackForm(request);

  try {
    assert.equal(result.question, 'Как помочь собаке?');
    assert.equal(result.entryPoint, 'player');
    assert.equal(result.lessonId, 'lesson-12');
    assert.equal(result.attachments.length, 1);
    assert.equal(result.attachments[0].telegramMethod, 'photo');
    assert.equal(result.attachments[0].size, jpeg.length);
  } finally {
    await removeFeedbackFiles(result.temporaryDirectory);
  }
});

test('rejects an empty question and removes its temporary upload directory', async () => {
  const before = new Set((await readdir(tmpdir())).filter((name) => name.startsWith('puppy-feedback-')));
  const boundary = 'feedback-invalid-boundary';
  const body = createMultipartBody(boundary, [
    { name: 'question', value: '   ' },
    { name: 'entryPoint', value: 'home' },
  ]);
  const request = Readable.from(body);
  request.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };

  await assert.rejects(
    () => readFeedbackForm(request),
    (error) => error.statusCode === 422 && error.publicCode === 'invalid_question',
  );
  const after = (await readdir(tmpdir())).filter((name) => name.startsWith('puppy-feedback-'));
  assert.deepEqual(after.filter((name) => !before.has(name)), []);
});

test('rejects questions over 1000 characters and removes temporary files', async () => {
  await assertRejectedFormIsClean([
    { name: 'question', value: 'а'.repeat(1001) },
    { name: 'entryPoint', value: 'home' },
  ], 422, 'invalid_question');
});

test('rejects unsupported MIME types and mismatched file signatures', async () => {
  await assertRejectedFormIsClean([
    { name: 'question', value: 'Вопрос' },
    { name: 'entryPoint', value: 'home' },
    { name: 'attachments', filename: 'note.txt', contentType: 'text/plain', value: Buffer.from('hello') },
  ], 415, 'unsupported_attachment_type');

  await assertRejectedFormIsClean([
    { name: 'question', value: 'Вопрос' },
    { name: 'entryPoint', value: 'home' },
    { name: 'attachments', filename: 'fake.jpg', contentType: 'image/jpeg', value: Buffer.from('not-a-jpeg') },
  ], 415, 'attachment_signature_mismatch');
});

test('rejects more than five attachments and removes every temporary file', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
  await assertRejectedFormIsClean([
    { name: 'question', value: 'Вопрос' },
    { name: 'entryPoint', value: 'home' },
    ...Array.from({ length: 6 }, (_, index) => ({
      name: 'attachments',
      filename: `${index + 1}.jpg`,
      contentType: 'image/jpeg',
      value: jpeg,
    })),
  ], 413, 'too_many_attachments');
});

test('enforces the 10 MiB limit for photos', async () => {
  const oversizedJpeg = Buffer.alloc(10 * 1024 * 1024 + 1);
  oversizedJpeg.set([0xff, 0xd8, 0xff], 0);
  await assertRejectedFormIsClean([
    { name: 'question', value: 'Вопрос' },
    { name: 'entryPoint', value: 'home' },
    { name: 'attachments', filename: 'large.jpg', contentType: 'image/jpeg', value: oversizedJpeg },
  ], 413, 'attachment_too_large');
});

test('formats identity and lesson context without allowing Telegram HTML injection', () => {
  const text = formatFeedbackMessage(
    'request-1',
    {
      question: '<b>Помогите</b>',
      entryPoint: 'player',
      lessonId: 'lesson<&>',
      lessonTitle: 'Урок <тест>',
      attachments: [],
    },
    {
      telegramId: '20002',
      username: 'puppy_user',
      firstName: 'Иван',
      lastName: null,
    },
  );

  assert.match(text, /tg:\/\/user\?id=20002/);
  assert.match(text, /@puppy_user/);
  assert.match(text, /Урок &lt;тест&gt;/);
  assert.match(text, /&lt;b&gt;Помогите&lt;\/b&gt;/);
  assert.doesNotMatch(text, /<b>Помогите<\/b>/);
});

test('rolls back every sent Telegram message when an attachment fails', async () => {
  const deleted = [];
  const api = {
    sendMessage: async () => ({ message_id: 101 }),
    sendPhotoFile: async () => ({ message_id: 102 }),
    sendVideoFile: async () => { throw new Error('upload failed'); },
    sendDocumentFile: async () => ({ message_id: 103 }),
    deleteMessage: async (_chatId, messageId) => { deleted.push(messageId); },
  };
  const submission = {
    question: 'Вопрос',
    entryPoint: 'home',
    lessonId: null,
    lessonTitle: null,
    attachments: [
      { telegramMethod: 'photo', originalName: 'one.jpg' },
      { telegramMethod: 'video', originalName: 'two.mp4' },
    ],
  };

  await assert.rejects(() => deliverFeedback({
    api,
    adminTelegramId: '10001',
    submission,
    user: { telegramId: '20002', firstName: 'Иван', lastName: null, username: null },
  }), /upload failed/);
  assert.deepEqual(deleted, [102, 101]);
});

test('delivers JPEG and MP4 as media and falls back to document for other allowed formats', async () => {
  const calls = [];
  let nextMessageId = 200;
  const api = {
    sendMessage: async (...args) => { calls.push(['message', ...args]); return { message_id: nextMessageId++ }; },
    sendPhotoFile: async (...args) => { calls.push(['photo', ...args]); return { message_id: nextMessageId++ }; },
    sendVideoFile: async (...args) => { calls.push(['video', ...args]); return { message_id: nextMessageId++ }; },
    sendDocumentFile: async (...args) => { calls.push(['document', ...args]); return { message_id: nextMessageId++ }; },
    deleteMessage: async () => {},
  };
  const attachments = [
    { telegramMethod: 'photo', originalName: 'one.jpg' },
    { telegramMethod: 'video', originalName: 'two.mp4' },
    { telegramMethod: 'document', originalName: 'three.webp' },
  ];

  await deliverFeedback({
    api,
    adminTelegramId: '10001',
    submission: { question: 'Вопрос', entryPoint: 'home', attachments },
    user: { telegramId: '20002', firstName: 'Иван', lastName: null, username: null },
  });

  assert.deepEqual(calls.map(([method]) => method), ['message', 'photo', 'video', 'document']);
  for (const call of calls.slice(1)) {
    assert.equal(call[3].reply_parameters.message_id, 200);
  }
});

async function assertRejectedFormIsClean(parts, statusCode, publicCode) {
  const before = new Set((await readdir(tmpdir())).filter((name) => name.startsWith('puppy-feedback-')));
  const boundary = `feedback-rejected-${Date.now()}-${Math.random()}`;
  const body = createMultipartBody(boundary, parts);
  const request = Readable.from(body);
  request.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };

  await assert.rejects(
    () => readFeedbackForm(request),
    (error) => error.statusCode === statusCode && error.publicCode === publicCode,
  );
  const after = (await readdir(tmpdir())).filter((name) => name.startsWith('puppy-feedback-'));
  assert.deepEqual(after.filter((name) => !before.has(name)), []);
}

function createMultipartBody(boundary, parts) {
  const chunks = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n\r\n`));
      chunks.push(part.value);
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`));
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}
