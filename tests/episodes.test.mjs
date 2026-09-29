import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lastEpisode, episodePath, isEpisodeIndexable, indexableEpisodes, episodeActivity,
  episodeTitleTag, episodeDescription, MIN_EPISODE_RATINGS,
} from '../api/_episodes.js';
import { anime } from './helpers.mjs';

const NOW = new Date('2026-09-28T12:00:00Z');
const series = anime(1, 'Target Show', { episodes: 12, year: 2020, status: 'completed' });
const airing = anime(2, 'Airing Show', { episodes: 12, year: 2026, status: 'airing', next_episode: 5, next_episode_at: '2026-10-03T15:00:00+00:00' });

test('a series has pages for each of its episodes; a film or an unknown count has none', () => {
  assert.equal(lastEpisode(series), 12);
  assert.equal(lastEpisode(anime(3, 'Film', { episodes: 1 })), null);
  assert.equal(lastEpisode(anime(4, 'Unknown', { episodes: null, status: 'completed' })), null);
});

test('an airing show with no announced count has pages up to its next episode', () => {
  assert.equal(lastEpisode({ ...airing, episodes: null }), 5);
});

test('episode pages live under their title page', () => {
  assert.equal(episodePath(series, 3), '/anime/1-target-show/episode/3');
});

test('an episode is indexable once it has a comment, or enough ratings', () => {
  assert.equal(isEpisodeIndexable(series, 3, { comments: 1, ratings: 0 }, NOW), true);
  assert.equal(isEpisodeIndexable(series, 3, { comments: 0, ratings: MIN_EPISODE_RATINGS - 1 }, NOW), false);
  assert.equal(isEpisodeIndexable(series, 3, { comments: 0, ratings: MIN_EPISODE_RATINGS }, NOW), true);
  assert.equal(isEpisodeIndexable(series, 3, undefined, NOW), false);
});

test('while a show airs, its latest and next episodes are indexable — that is when people search them', () => {
  assert.equal(isEpisodeIndexable(airing, 4, {}, NOW), true, 'latest aired');
  assert.equal(isEpisodeIndexable(airing, 5, {}, NOW), true, 'next scheduled');
  assert.equal(isEpisodeIndexable(airing, 3, {}, NOW), false);
  assert.equal(isEpisodeIndexable(airing, 5, {}, new Date('2026-10-04T00:00:00Z')), false, 'schedule has gone stale');
});

test('activity is counted per episode from comment and rating rows', () => {
  const activity = episodeActivity(
    [{ episode_number: 2 }, { episode_number: 2 }, { episode_number: 7 }],
    [{ episode_number: 2 }, { episode_number: 9 }, { episode_number: 9 }, { episode_number: 9 }]
  );
  assert.deepEqual(activity.get(2), { comments: 2, ratings: 1 });
  assert.deepEqual(activity.get(9), { comments: 0, ratings: 3 });
});

test('the indexable episodes of a title, in order, within its episode count', () => {
  const activity = episodeActivity([{ episode_number: 2 }, { episode_number: 40 }], []);
  assert.deepEqual(indexableEpisodes(airing, activity, NOW), [2, 4, 5]);
});

test('the next scheduled episode is billed for its release date; others for rating and discussion', () => {
  assert.equal(episodeTitleTag(airing, 5, { now: NOW }), 'Airing Show Episode 5: Release Date & Time · Rebyuu');
  assert.equal(episodeTitleTag(airing, 4, { now: NOW }), 'Airing Show Episode 4 — Rating & Discussion · Rebyuu');
});

test('an episode description says when it airs, or how it is rated and discussed', () => {
  assert.equal(
    episodeDescription(airing, 5, { count: 0, average: null, comments: 0 }, { now: NOW, timeZone: 'UTC' }),
    'Episode 5 of Airing Show airs on Saturday 3 October 2026, 15:00 UTC. Rate it and join the discussion on Rebyuu once it is out.'
  );
  assert.equal(
    episodeDescription(series, 3, { count: 4, average: 8.25, comments: 2 }, { now: NOW }),
    'Episode 3 of 12 of Target Show (2020). Rated 8.3/10 by 4 Rebyuu users, with 2 comments. Rate it and join the discussion.'
  );
  assert.equal(
    episodeDescription(series, 3, { count: 1, average: 9, comments: 1 }, { now: NOW }),
    'Episode 3 of 12 of Target Show (2020), with 1 comment. Rate it and join the discussion.'
  );
});
