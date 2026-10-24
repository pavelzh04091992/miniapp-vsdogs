import crossEmojiUrl from '@twemoji/svg/274c.svg?url';
import heartEmojiUrl from '@twemoji/svg/2764.svg?url';
import herbEmojiUrl from '@twemoji/svg/1f33f.svg?url';
import runnerEmojiUrl from '@twemoji/svg/1f3c3-200d-2640-fe0f.svg?url';
import dogEmojiUrl from '@twemoji/svg/1f415.svg?url';
import dogFaceEmojiUrl from '@twemoji/svg/1f436.svg?url';
import pawsEmojiUrl from '@twemoji/svg/1f43e.svg?url';
import eyesEmojiUrl from '@twemoji/svg/1f440.svg?url';
import messageEmojiUrl from '@twemoji/svg/1f4ac.svg?url';
import sweatSmileEmojiUrl from '@twemoji/svg/1f605.svg?url';
import smileEmojiUrl from '@twemoji/svg/1f60a.svg?url';
import thinkingEmojiUrl from '@twemoji/svg/1f914.svg?url';
import raisedHandEmojiUrl from '@twemoji/svg/1f91a.svg?url';

const emojiAssetUrls: Readonly<Record<string, string>> = {
  '❌': crossEmojiUrl,
  '❤': heartEmojiUrl,
  '❤️': heartEmojiUrl,
  '🌿': herbEmojiUrl,
  '🏃‍♀️': runnerEmojiUrl,
  '🐕': dogEmojiUrl,
  '🐶': dogFaceEmojiUrl,
  '🐾': pawsEmojiUrl,
  '👀': eyesEmojiUrl,
  '💬': messageEmojiUrl,
  '😅': sweatSmileEmojiUrl,
  '😊': smileEmojiUrl,
  '🤔': thinkingEmojiUrl,
  '🤚': raisedHandEmojiUrl,
};

const emojiPattern = /🏃‍♀️|❤️|❌|❤|🌿|🐕|🐶|🐾|👀|💬|😅|😊|🤔|🤚/gu;

export function renderEmojiText(value: string): string {
  const matches = [...value.matchAll(emojiPattern)];

  if (matches.length === 0) {
    return escapeEmojiText(value);
  }

  let cursor = 0;
  let markup = '';

  matches.forEach((match) => {
    const matchIndex = match.index;
    const emoji = match[0];
    markup += escapeEmojiText(value.slice(cursor, matchIndex));
    const assetUrl = emojiAssetUrls[emoji];

    if (assetUrl) {
      markup += `<img class="app-emoji" src="${assetUrl}" alt="${escapeEmojiText(emoji)}" draggable="false" />`;
    } else {
      markup += escapeEmojiText(emoji);
    }

    cursor = matchIndex + emoji.length;
  });

  return markup + escapeEmojiText(value.slice(cursor));
}

function escapeEmojiText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
