import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSituationVideos } from '../src/lib/videos.ts';

test('filters malformed catalog records and preserves the abort signal', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let receivedSignal = null;

  globalThis.fetch = async (_url, options) => {
    receivedSignal = options.signal;
    return response(200, {
      videos: [
        { situationSlug: 'puppy-toilet-home', title: 'incomplete' },
        {
          id: 'valid',
          situationSlug: 'puppy-toilet-home',
          telegramMessageId: 5,
          telegramChatId: '-1001',
          title: 'Valid',
          description: 'Description',
          durationSeconds: 90,
          thumbnailUrl: '/assets/hero-dog.webp',
          telegramUrl: 'https://t.me/example/5',
          createdAt: '2026-10-10T00:00:00.000Z',
        },
      ],
    });
  };

  try {
    const videos = await fetchSituationVideos('puppy-toilet-home', {
      signal: controller.signal,
    });
    assert.equal(receivedSignal, controller.signal);
    assert.equal(videos.length, 1);
    assert.equal(videos[0].durationLabel, '2 минуты');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
