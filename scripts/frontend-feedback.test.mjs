import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

test('wires the shared feedback form to home, chat navigation and described players', async () => {
  const [appSource, feedbackSource, styles] = await Promise.all([
    readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/feedback.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /data-feedback-entry="player"/);
  assert.match(appSource, /'useful-card--ask', undefined, 'home'/);
  assert.match(appSource, /'chat-nav'/);
  assert.match(appSource, /extractLessonFeedbackPrompt/);
  assert.match(appSource, /video\.description\s*\? createLessonDescriptionMarkup/);
  assert.match(feedbackSource, /POST', '\/api\/feedback'/);
  assert.match(feedbackSource, /feedback-main\.svg/);
  assert.match(feedbackSource, /feedback-sent\.svg/);
  assert.match(feedbackSource, /MAX_ATTACHMENTS = 5/);
  assert.match(feedbackSource, /feedback-sheet__chrome/);
  assert.match(feedbackSource, /feedback-sheet__scroll/);
  assert.match(feedbackSource, /feedback-sheet--success/);
  assert.match(feedbackSource, /feedback-sheet__visual/);
  assert.match(feedbackSource, /data-feedback-preview-fallback/);
  assert.match(feedbackSource, /window\.visualViewport/);
  assert.match(feedbackSource, /#feedback-title'\)\?\.focus\(\)/);
  assert.match(appSource, /class="brand-mark"[\s\S]*?data-route="home"/);
  assert.match(appSource, /subpage-header__logo-button[\s\S]*?data-route="home"/);
  assert.match(styles, /#d9e0ff 54%/);
  assert.match(styles, /--feedback-viewport-height/);
  assert.match(styles, /scrollbar-width: none/);
  assert.match(styles, /\.feedback-sheet\s*\{[\s\S]*?border-radius: 28px[\s\S]*?overflow: hidden/);
  const feedbackSheetRule = styles.match(/\.feedback-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.notEqual(feedbackSheetRule, '');
  assert.doesNotMatch(feedbackSheetRule, /height: 100dvh/);
  assert.match(styles, /\.feedback-sheet__chrome\s*\{[\s\S]*?position: absolute/);
  assert.match(styles, /\.feedback-sheet__scroll\s*\{[\s\S]*?overflow-y: auto[\s\S]*?scrollbar-width: none/);
  assert.match(styles, /--feedback-visual-height: clamp\(/);
  assert.match(styles, /--feedback-art-height: clamp\(/);
  assert.match(styles, /margin-top: calc\(-1 \* var\(--feedback-body-overlap\)\)/);
  assert.match(styles, /\.screen-content\s*\{[\s\S]*?padding: var\(--content-top-gap\) 0 20px/);
  assert.match(styles, /\.bottom-nav\s*\{[\s\S]*?flex: 0 0 auto[\s\S]*?position: relative/);
  assert.doesNotMatch(styles, /--bottom-nav-clearance|\.bottom-nav\s*\{[\s\S]*?position: fixed/);
  assert.match(styles, /\.home-header\s*\{[\s\S]*?margin-bottom: -18px[\s\S]*?padding:[\s\S]*?27px/);
  const headerGradient = styles.match(
    /\.home-header,\s*\n\.subpage-header\s*\{[\s\S]*?background: linear-gradient\(([\s\S]*?)\);/,
  )?.[1] || '';
  assert.match(headerGradient, /rgba\(255, 255, 255, 1\) 0%/);
  assert.match(headerGradient, /rgba\(255, 255, 255, 0\.88\) 28%/);
  assert.match(headerGradient, /rgba\(255, 255, 255, 0\.62\) 56%/);
  assert.match(headerGradient, /rgba\(255, 255, 255, 0\.28\) 80%/);
  assert.match(headerGradient, /rgba\(255, 255, 255, 0\) 100%/);
  assert.doesNotMatch(headerGradient, /#ffffff\s+\d+%/);
  assert.doesNotMatch(styles, /\.home-header::after|\.subpage-header::after/);
  const applicationHeaderRule = styles.match(/\.home-header,\s*\n\.subpage-header\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.notEqual(applicationHeaderRule, '');
  assert.doesNotMatch(applicationHeaderRule, /mask-image|backdrop-filter/);
  assert.match(styles, /\.lesson-feedback-cta\s*\{[\s\S]*?margin: 8px 0 12px/);
  assert.match(styles, /\.lesson-feedback-cta::before/);
  assert.match(appSource, /lesson-feedback-cta__question/);
  assert.match(appSource, /lesson-feedback-cta__guidance/);
  assert.match(appSource, /lesson-feedback-cta__message-icon/);
  assert.match(styles, /lesson-feedback-cta__message-icon[\s\S]*?icons\/message\.svg/);
  assert.match(styles, /lesson-description__icon--note[\s\S]*?icons\/lightbulb\.svg/);
  assert.match(styles, /feedback-attach__icon::before[\s\S]*?icons\/paperclip\.svg/);
  assert.match(styles, /feedback-success__clock[\s\S]*?icons\/clock\.svg/);
  assert.match(feedbackSource, /feedback-arrow-icon feedback-attach__arrow/);
  assert.equal((feedbackSource.match(/class="feedback-arrow-icon/g) ?? []).length, 3);
  assert.doesNotMatch(feedbackSource, />→<|>›</);
  assert.doesNotMatch(appSource, /icons\/message\.gif/);
  assert.match(styles, /icons\/arrow-right\.svg/);
});

test('ships interface icons as colorable SVG masks', async () => {
  const iconNames = ['paperclip.svg', 'clock.svg', 'message.svg', 'lightbulb.svg'];

  for (const iconName of iconNames) {
    const iconUrl = new URL(`../public/assets/icons/${iconName}`, import.meta.url);
    const [icon, iconBuffer] = await Promise.all([
      readFile(iconUrl, 'utf8'),
      readFile(iconUrl),
    ]);
    assert.match(icon, /<svg[^>]+viewBox="0 0 50 50"/);
    assert.match(icon, /<path /);
    assert.doesNotMatch(icon, /<image|data:image/);

    const { data, info } = await sharp(iconBuffer)
      .resize(50, 50)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaValues = Array.from({ length: info.width * info.height }, (_, index) => (
      data[index * info.channels + 3]
    ));
    assert.ok(alphaValues.some((alpha) => alpha > 0), `${iconName} must render visible pixels`);
    assert.ok(alphaValues.some((alpha) => alpha === 0), `${iconName} must preserve transparency`);
  }
});
