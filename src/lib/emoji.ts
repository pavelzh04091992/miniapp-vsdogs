const emojiAssetUrls: Readonly<Record<string, string>> = {
  '🛏️': '/assets/emoji/bed.svg',
  '🛏': '/assets/emoji/bed.svg',
  '🚶🏻': '/assets/emoji/walking.svg',
  '🚶': '/assets/emoji/walking.svg',
  '🚪': '/assets/emoji/door.svg',
  '😴': '/assets/emoji/sleeping-face.svg',
  '😊': '/assets/emoji/smiling-face.svg',
  '😅': '/assets/emoji/grinning-face-sweat.svg',
  '🧩': '/assets/emoji/puzzle-piece.svg',
  '🦴': '/assets/emoji/bone.svg',
  '🥣': '/assets/emoji/bowl-with-spoon.svg',
  '🤔': '/assets/emoji/thinking-face.svg',
  '🔹': '/assets/emoji/small-blue-diamond.svg',
  '🔑': '/assets/emoji/key.svg',
  '👀': '/assets/emoji/eyes.svg',
  '🐾': '/assets/emoji/paws.svg',
  '🐶': '/assets/emoji/dog-face.svg',
  '🐩': '/assets/emoji/poodle.svg',
  '🐕': '/assets/emoji/dog.svg',
  '🌿': '/assets/emoji/herb.svg',
  '🏠': '/assets/emoji/house.svg',
  '🏃‍♂️': '/assets/emoji/man-running.svg',
  '🏃‍♀️': '/assets/emoji/man-running.svg',
  '🏃': '/assets/emoji/man-running.svg',
  '🤍': '/assets/emoji/white-heart.svg',
  '♥️': '/assets/emoji/heart-suit.svg',
  '♥': '/assets/emoji/heart-suit.svg',
  '❤️': '/assets/emoji/heart-suit.svg',
  '❤': '/assets/emoji/heart-suit.svg',
  '❌': '/assets/emoji/cross-mark.svg',
  '✅': '/assets/emoji/check-mark-button.svg',
  '⚠️': '/assets/emoji/warning.svg',
  '⚠': '/assets/emoji/warning.svg',
  '💬': '/assets/emoji/speech-balloon.svg',
  '💡': '/assets/emoji/light-bulb.svg',
  '🤚': '/assets/emoji/raised-back-of-hand.svg',
};

// Bump this when an emoji SVG changes so immutable browser cache entries can be refreshed.
const emojiAssetVersion = '1';

export function getEmojiAssetUrl(assetUrl: string): string {
  return `${assetUrl}?v=${emojiAssetVersion}`;
}

const emojiPattern = new RegExp(
  Object.keys(emojiAssetUrls)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|'),
  'gu',
);

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
      markup += `<img class="app-emoji" src="${getEmojiAssetUrl(assetUrl)}" alt="${escapeEmojiText(emoji)}" draggable="false" />`;
    } else {
      markup += escapeEmojiText(emoji);
    }

    cursor = matchIndex + emoji.length;
  });

  return markup + escapeEmojiText(value.slice(cursor));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeEmojiText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
