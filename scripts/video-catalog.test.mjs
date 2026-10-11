import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedTelegramChannel, parseVideoCatalog } from './video-catalog.mjs';

test('accepts channel posts only from the configured Telegram channel', () => {
  const channel = { id: -1001234567890, username: 'PuppysSchool' };

  assert.equal(isAllowedTelegramChannel(channel, {
    publicChannelId: '-1001234567890',
    publicChannelUsername: 'another_name',
  }), true);
  assert.equal(isAllowedTelegramChannel(channel, {
    publicChannelId: '-1009999999999',
    publicChannelUsername: 'PuppysSchool',
  }), false);
  assert.equal(isAllowedTelegramChannel(channel, {
    publicChannelUsername: '@puppysschool',
  }), true);
  assert.equal(isAllowedTelegramChannel(channel, {
    publicChannelUsername: 'other_channel',
  }), false);
  assert.equal(isAllowedTelegramChannel(channel), false);
});

test('rejects malformed catalog data instead of silently erasing it', () => {
  const valid = parseVideoCatalog({
    updatedAt: '2026-10-10T00:00:00.000Z',
    videos: [{
      id: 'video-1',
      situationSlug: 'puppy-toilet-home',
      telegramMessageId: 1,
      telegramChatId: '-1001',
      title: 'Title',
      description: 'Description',
      durationSeconds: 30,
      sourceLabel: 'Telegram',
      thumbnailUrl: '/assets/hero-dog.webp',
      telegramUrl: 'https://t.me/example/1',
      createdAt: '2026-10-10T00:00:00.000Z',
    }],
  });

  assert.equal(valid.videos.length, 1);
  assert.throws(
    () => parseVideoCatalog({ updatedAt: 'invalid', videos: [] }),
    /updatedAt/,
  );
  assert.throws(
    () => parseVideoCatalog({ updatedAt: '2026-10-10T00:00:00.000Z', videos: [{}] }),
    /videos\[0\]\.id/,
  );
});
