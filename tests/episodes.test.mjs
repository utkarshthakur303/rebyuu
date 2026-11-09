import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lastEpisode, episodePath, isEpisodeIndexable, indexableEpisodes, episodeActivity,
  episodeTitleTag, episodeDescription, episodeRelease, episodeAnswers, MIN_EPISODE_RATINGS,
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
  assert.equal(isEpisodeIndexable(airing, 5, {}, new Date('2026-10-04T00:00:00Z')), true, 'aired nine hours ago, before the row caught up');
  assert.equal(isEpisodeIndexable(airing, 4, {}, new Date('2026-10-04T00:00:00Z')), false, 'no air date, and no longer the latest');
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

test('the next scheduled episode is billed for its release date; an episode with no date for rating and discussion', () => {
  assert.equal(episodeTitleTag(airing, 5, { now: NOW }), 'Airing Show Episode 5: Release Date, Time & Countdown · Rebyuu');
  assert.equal(episodeTitleTag(airing, 4, { now: NOW }), 'Airing Show Episode 4 — Rating & Discussion · Rebyuu');
});

test('an episode description says when it airs, or how it is rated and discussed', () => {
  assert.equal(
    episodeDescription(airing, 5, { count: 0, average: null, comments: 0 }, { now: NOW }),
    'Airing Show episode 5 comes out on Saturday 3 October 2026, 15:00 UTC: 8:30 PM IST, 11:00 AM EDT. See the countdown and the time where you are.'
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

// ── With the full airing schedule ─────────────────────────────────────

const weekly = (first, count, startIso) =>
  Array.from({ length: count }, (_, i) => ({ episode: first + i, at: new Date(Date.parse(startIso) + i * 7 * 86400000).toISOString() }));
// Overgeared as of 9 Nov 2026, 02:00 UTC: episode 7 aired yesterday, the row still says 7.
const LATE = new Date('2026-11-09T02:00:00Z');
const overgeared = anime(212888, 'Overgeared', {
  status: 'airing', episodes: 12, year: 2026,
  next_episode: 7, next_episode_at: '2026-11-08T14:30:00+00:00',
  airing_schedule: weekly(1, 12, '2026-09-27T14:30:00Z'),
  streaming: [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/overgeared' }],
});
const blueBox = anime(189123, 'Blue Box Season 2', {
  status: 'airing', episodes: 12, year: 2026,
  airing_schedule: [...weekly(1, 4, '2026-10-04T07:30:00Z'), ...weekly(5, 8, '2026-11-08T07:30:00Z')],
});
const BEFORE_BLUE_BOX_5 = new Date('2026-11-02T00:00:00Z');

test('a show with no episode count has pages for every episode on its schedule', () => {
  assert.equal(lastEpisode({ ...overgeared, episodes: null }), 12);
  assert.equal(lastEpisode({ ...overgeared, episodes: null, status: 'upcoming' }), 12);
});

test('recently aired episodes stay indexable for three weeks, so a page that earned its traffic keeps it', () => {
  assert.equal(isEpisodeIndexable(overgeared, 6, {}, LATE), true, 'aired 8 days ago');
  assert.equal(isEpisodeIndexable(overgeared, 5, {}, LATE), true, 'aired 15 days ago');
  assert.equal(isEpisodeIndexable(overgeared, 4, {}, LATE), false, 'aired 21.5 days ago');
});

test('episodes airing in the next two weeks are indexable, and the next one always is', () => {
  assert.equal(isEpisodeIndexable(overgeared, 8, {}, LATE), true);
  assert.equal(isEpisodeIndexable(overgeared, 9, {}, LATE), true, 'airs in 13.5 days');
  assert.equal(isEpisodeIndexable(overgeared, 10, {}, LATE), false, 'airs in 20.5 days');
  const longBreak = { ...overgeared, airing_schedule: [...weekly(1, 7, '2026-09-27T14:30:00Z'), { episode: 8, at: '2026-12-06T14:30:00.000Z' }] };
  assert.equal(isEpisodeIndexable(longBreak, 8, {}, LATE), true, 'next, four weeks out');
});

test('the indexable episodes of an airing show: the last three weeks and the next two', () => {
  assert.deepEqual(indexableEpisodes(overgeared, new Map(), LATE), [5, 6, 7, 8, 9]);
});

test('an upcoming episode is billed for its release date, time and countdown', () => {
  assert.equal(episodeTitleTag(overgeared, 8, { now: LATE }), 'Overgeared Episode 8: Release Date, Time & Countdown · Rebyuu');
  assert.equal(episodeTitleTag(overgeared, 9, { now: LATE }), 'Overgeared Episode 9: Release Date, Time & Countdown · Rebyuu', 'not only the next one');
});

test('a long name keeps the release date in the title and drops the rest', () => {
  const knight = { ...overgeared, title: 'The Exiled Heavy Knight Knows How to Game the System' };
  assert.equal(episodeTitleTag(knight, 8, { now: LATE }), 'The Exiled Heavy Knight Knows How to Game the System Episode 8: Release Date & Time · Rebyuu');
  assert.equal(episodeTitleTag(knight, 6, { now: LATE }), 'The Exiled Heavy Knight Knows How to Game the System Episode 6: Release Date & Rating · Rebyuu');
});

test('an aired episode is billed for its release date and where to watch it', () => {
  assert.equal(episodeTitleTag(overgeared, 6, { now: LATE }), 'Overgeared Episode 6: Release Date, Where to Watch & Rating · Rebyuu');
  assert.equal(episodeTitleTag({ ...overgeared, streaming: [] }, 6, { now: LATE }), 'Overgeared Episode 6: Release Date, Rating & Discussion · Rebyuu');
});

test("an upcoming episode's description gives the UTC time, then India's and New York's", () => {
  assert.equal(
    episodeDescription(overgeared, 8, {}, { now: LATE }),
    'Overgeared episode 8 comes out on Sunday 15 November 2026, 14:30 UTC: 8:00 PM IST, 9:30 AM EST. See the countdown, the time where you are and where to watch it.'
  );
  assert.equal(
    episodeDescription({ ...overgeared, streaming: [] }, 8, {}, { now: LATE }),
    'Overgeared episode 8 comes out on Sunday 15 November 2026, 14:30 UTC: 8:00 PM IST, 9:30 AM EST. See the countdown and the time where you are.'
  );
});

test('a skipped week is said up front: that is what "is episode 5 delayed" is asking', () => {
  assert.equal(
    episodeDescription({ ...blueBox, streaming: [] }, 5, {}, { now: BEFORE_BLUE_BOX_5 }),
    'Blue Box Season 2 episode 5 comes out a week later than usual, on Sunday 8 November 2026, 07:30 UTC: 1:00 PM IST, 2:30 AM EST. See the countdown and the time where you are.'
  );
});

test("an aired episode's description says when it came out and when the next one is", () => {
  assert.equal(
    episodeDescription(overgeared, 6, { count: 0, comments: 0 }, { now: LATE }),
    'Overgeared episode 6 came out on Sunday 1 November 2026, 14:30 UTC (8:00 PM IST). Episode 8 is next, on Sunday 15 November. Find where to watch it, rate it and join the discussion.'
  );
  assert.equal(
    episodeDescription({ ...overgeared, streaming: [] }, 12, { count: 4, average: 8.25, comments: 2 }, { now: new Date('2026-12-20T00:00:00Z') }),
    'Overgeared episode 12 came out on Sunday 13 December 2026, 14:30 UTC (8:00 PM IST). Rated 8.3/10 by 4 Rebyuu users, with 2 comments. Rate it and join the discussion.'
  );
});

test("an episode's release: upcoming or aired, when, any break before it, and what is next", () => {
  assert.deepEqual(episodeRelease(overgeared, 8, { now: LATE }), { state: 'upcoming', at: new Date('2026-11-15T14:30:00Z'), breakWeeks: 0, next: null });
  assert.deepEqual(episodeRelease(overgeared, 6, { now: LATE }), { state: 'aired', at: new Date('2026-11-01T14:30:00Z'), breakWeeks: 0, next: { episode: 8, at: new Date('2026-11-15T14:30:00Z') } });
  assert.equal(episodeRelease(blueBox, 5, { now: BEFORE_BLUE_BOX_5 }).breakWeeks, 1);
  assert.equal(episodeRelease(series, 3, { now: NOW }), null, 'nothing scheduled');
});

test('the questions an upcoming episode page answers: when, what time in India and the US, and where to watch', () => {
  assert.deepEqual(episodeAnswers(overgeared, 8, { now: LATE }), [
    { question: 'When does Overgeared episode 8 come out?', answer: 'Overgeared episode 8 comes out on Sunday 15 November 2026, 14:30 UTC.' },
    { question: 'What time does Overgeared episode 8 come out in India?', answer: '8:00 PM IST, on Sun 15 Nov.' },
    { question: 'What time does Overgeared episode 8 come out in the US?', answer: '9:30 AM EST on Sun 15 Nov in New York, and 6:30 AM PST on Sun 15 Nov in Los Angeles.' },
    { question: 'Where can I watch Overgeared episode 8?', answer: 'Overgeared streams on Crunchyroll. Availability varies by country.' },
  ]);
});

test('"is it delayed" is asked only when the schedule shows a break', () => {
  const answers = episodeAnswers(blueBox, 5, { now: BEFORE_BLUE_BOX_5 });
  assert.deepEqual(answers.find((qa) => /delayed/.test(qa.question)), {
    question: 'Is Blue Box Season 2 episode 5 delayed?',
    answer: 'It comes out a week later than usual: Blue Box Season 2 skips a week after episode 4, so episode 5 airs on Sunday 8 November 2026, 07:30 UTC.',
  });
  assert.ok(!episodeAnswers(overgeared, 8, { now: LATE }).some((qa) => /delayed/.test(qa.question)));
});

test('the questions an aired episode page answers: is it out, when is the next one', () => {
  assert.deepEqual(episodeAnswers({ ...overgeared, streaming: [] }, 6, { now: LATE }), [
    { question: 'Is Overgeared episode 6 out?', answer: 'Yes. Overgeared episode 6 came out on Sunday 1 November 2026, 14:30 UTC.' },
    { question: 'When is the next episode of Overgeared?', answer: 'Episode 8 comes out on Sunday 15 November 2026, 14:30 UTC.' },
  ]);
  assert.deepEqual(episodeAnswers(series, 3, { now: NOW }), [], 'nothing the data can back');
});
