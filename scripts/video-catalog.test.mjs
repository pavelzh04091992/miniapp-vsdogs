import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedTelegramChannel } from './video-catalog.mjs';

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
