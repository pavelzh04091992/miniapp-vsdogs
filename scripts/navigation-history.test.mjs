import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  canUseBrowserBack,
  createFallbackHistoryState,
  createForwardHistoryState,
  normalizeInitialHistoryState,
} from '../src/lib/navigation-history.ts';

test('uses browser history for a complete forward navigation chain', () => {
  const home = normalizeInitialHistoryState({}, 'home');
  const adult = createForwardHistoryState(home, 'home', 'adult-large');
  const situation = createForwardHistoryState(
    adult,
    'adult-large',
    'adult-large-situation:adult-large-fitness',
  );
  const topic = createForwardHistoryState(
    situation,
    'adult-large-situation:adult-large-fitness',
    'adult-large-topic:adult-large-eight',
  );
  const player = createForwardHistoryState(
    topic,
    'adult-large-topic:adult-large-eight',
    'lesson-video:map-adult-large-fitness-eight',
  );

  assert.equal(player.appNavigationDepth, 4);
  assert.equal(canUseBrowserBack(
    player,
    'lesson-video:map-adult-large-fitness-eight',
    'adult-large-topic:adult-large-eight',
  ), true);
  assert.equal(canUseBrowserBack(
    topic,
    'adult-large-topic:adult-large-eight',
    'adult-large-situation:adult-large-fitness',
  ), true);
  assert.equal(canUseBrowserBack(
    situation,
    'adult-large-situation:adult-large-fitness',
    'adult-large',
  ), true);
  assert.equal(canUseBrowserBack(adult, 'adult-large', 'home'), true);
});

test('replaces direct deep links instead of creating a player and parent loop', () => {
  const player = normalizeInitialHistoryState({}, 'lesson-video:adult-video');

  assert.equal(canUseBrowserBack(
    player,
    'lesson-video:adult-video',
    'adult-large-topic:adult-topic',
  ), false);

  const topic = createFallbackHistoryState(player, 'adult-large-topic:adult-topic');
  assert.deepEqual(topic, {
    appRoute: 'adult-large-topic:adult-topic',
    appNavigationDepth: 0,
  });
  assert.equal(canUseBrowserBack(
    topic,
    'adult-large-topic:adult-topic',
    'adult-large-situation:adult-situation',
  ), false);

  const situation = createFallbackHistoryState(
    topic,
    'adult-large-situation:adult-situation',
  );
  assert.equal(situation.appRoute, 'adult-large-situation:adult-situation');
  assert.equal(situation.appParentRoute, undefined);
  assert.equal(situation.appNavigationDepth, 0);
});

test('does not use a stale or wrong branch as the browser-history parent', () => {
  const stalePlayerState = {
    appRoute: 'lesson-video:shared-video',
    appParentRoute: 'puppy-topic:fitness-bow',
    appNavigationDepth: 3,
    feedbackModal: true,
  };

  assert.equal(canUseBrowserBack(
    stalePlayerState,
    'lesson-video:shared-video',
    'adult-large-topic:adult-large-bow',
  ), false);

  const adultTopic = createFallbackHistoryState(
    stalePlayerState,
    'adult-large-topic:adult-large-bow',
  );
  assert.equal(adultTopic.appParentRoute, undefined);
  assert.equal(adultTopic.feedbackModal, undefined);
  assert.equal(adultTopic.appNavigationDepth, 0);
});

test('keeps every back-button family on an acyclic parent route', async () => {
  const source = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');

  assert.match(
    source,
    /createAdultLargeSituationTopicsMarkup[\s\S]*?createSubpageHeaderMarkup\(situation\.title, 'adult-large'\)/u,
  );
  assert.match(
    source,
    /createAdultLargeTopicLessonsMarkup[\s\S]*?`adult-large-situation:\$\{topic\.parentSlug\}`/u,
  );
  assert.match(
    source,
    /createSituationTopicsMarkup\([\s\S]*?backRoute: AppRoute = 'puppies'[\s\S]*?createSubpageHeaderMarkup\(situation\.title, backRoute\)/u,
  );
  assert.match(
    source,
    /createTopicLessonsMarkup[\s\S]*?`puppy-situation:\$\{topic\.parentSlug\}`/u,
  );
  assert.match(source, /createSituationTopicsMarkup\('fitness', 'home', true\)/u);
  assert.match(source, /data-route="\$\{video\.backRoute\}"/u);
  assert.match(source, /complex-screen__back[\s\S]*?data-route="home"/u);
  assert.match(source, /complex-levels__back[\s\S]*?data-route="complex"/u);
});
