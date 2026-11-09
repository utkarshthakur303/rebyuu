import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleOf, airingOf, breakWeeks, releaseTimes, zoneTime, scheduleWindow, countdown } from '../api/_schedule.js';
import { nextEpisode, formatAiring } from '../api/_titlepage.js';
import { anime } from './helpers.mjs';

// Overgeared's real schedule (AniList, 9 Nov 2026): Sundays 14:30 UTC from 27 Sep.
const weekly = (first, count, startIso) =>
  Array.from({ length: count }, (_, i) => ({ episode: first + i, at: new Date(Date.parse(startIso) + i * 7 * 86400000).toISOString() }));
const overgeared = anime(212888, 'Overgeared', {
  status: 'airing', episodes: 12, year: 2026,
  // The row as the last sync left it: episode 7 was next, and has since aired.
  next_episode: 7, next_episode_at: '2026-11-08T14:30:00+00:00',
  airing_schedule: weekly(1, 12, '2026-09-27T14:30:00Z'),
});

test('the schedule is read from the row, in episode order, skipping malformed entries', () => {
  const row = anime(1, 'Show', {
    airing_schedule: [
      { episode: 3, at: '2026-11-15T14:30:00.000Z' },
      { episode: 'x', at: '2026-11-01T14:30:00.000Z' },
      { episode: 2, at: 'not a date' },
      { episode: 1, at: '2026-11-01T14:30:00.000Z' },
      null,
    ],
  });
  assert.deepEqual(scheduleOf(row).map((e) => [e.episode, e.at.toISOString()]), [
    [1, '2026-11-01T14:30:00.000Z'],
    [3, '2026-11-15T14:30:00.000Z'],
  ]);
});

test('a row synced before the schedule column existed still has its next episode', () => {
  const row = anime(1, 'Show', { status: 'airing', next_episode: 5, next_episode_at: '2026-10-03T15:00:00+00:00' });
  assert.deepEqual(scheduleOf(row).map((e) => [e.episode, e.at.toISOString()]), [[5, '2026-10-03T15:00:00.000Z']]);
  assert.deepEqual(scheduleOf(anime(2, 'No data')), []);
});

test('the air time of any scheduled episode, past or future', () => {
  assert.equal(airingOf(overgeared, 6).toISOString(), '2026-11-01T14:30:00.000Z');
  assert.equal(airingOf(overgeared, 8).toISOString(), '2026-11-15T14:30:00.000Z');
  assert.equal(airingOf(overgeared, 13), null);
});

test('the next episode comes from the schedule, so it is right the moment the last one airs, not after the next sync', () => {
  const now = new Date('2026-11-09T02:00:00Z'); // episode 7 aired 11.5 hours ago; the row still says 7
  assert.deepEqual(nextEpisode(overgeared, now), { episode: 8, at: new Date('2026-11-15T14:30:00Z') });
  assert.equal(nextEpisode(overgeared, new Date('2026-12-14T00:00:00Z')), null, 'after the finale');
});

test('a week with no episode in a weekly show is a break before the next one', () => {
  // Blue Box Season 2 (AniList, 9 Nov 2026): no episode on 1 November.
  const blueBox = anime(189123, 'Blue Box Season 2', {
    status: 'airing',
    airing_schedule: [
      ...weekly(1, 4, '2026-10-04T07:30:00Z'),
      ...weekly(5, 8, '2026-11-08T07:30:00Z'),
    ],
  });
  assert.equal(breakWeeks(blueBox, 5), 1);
  assert.equal(breakWeeks(blueBox, 4), 0);
  assert.equal(breakWeeks(blueBox, 6), 0);
  assert.equal(breakWeeks(blueBox, 1), 0, 'nothing before the first episode to compare with');
  assert.equal(breakWeeks(overgeared, 8), 0);
});

test('a show that airs daily has no breaks measured in weeks', () => {
  const daily = anime(5, 'Daily', {
    airing_schedule: Array.from({ length: 10 }, (_, i) => ({ episode: i + 1, at: new Date(Date.parse('2026-11-01T10:00:00Z') + i * 86400000).toISOString() })),
  });
  assert.equal(breakWeeks(daily, 6), 0);
});

test('the release time where Rebyuu readers are: India first, then the US, with daylight saving applied', () => {
  const at = new Date('2026-11-15T14:30:00Z');
  const times = releaseTimes(at);
  assert.deepEqual(times.slice(0, 3), [
    { place: 'India', day: 'Sun 15 Nov', time: '8:00 PM', zone: 'IST' },
    { place: 'US East (New York)', day: 'Sun 15 Nov', time: '9:30 AM', zone: 'EST' },
    { place: 'US West (Los Angeles)', day: 'Sun 15 Nov', time: '6:30 AM', zone: 'PST' },
  ]);
  assert.ok(times.some((t) => t.place === 'Japan' && t.time === '11:30 PM' && t.zone === 'JST'));
  assert.ok(times.some((t) => t.place === 'Philippines' && t.time === '10:30 PM' && t.zone === 'PHT'));
  assert.equal(releaseTimes(new Date('2026-07-12T14:30:00Z'))[1].zone, 'EDT', 'summer time in New York');
});

test('a local time can fall on the day before the UTC one', () => {
  assert.deepEqual(zoneTime(new Date('2026-11-15T03:00:00Z'), 'America/Los_Angeles'), { day: 'Sat 14 Nov', time: '7:00 PM', zone: 'PST' });
});

test('the schedule around an episode: a few before, a few after', () => {
  assert.deepEqual(scheduleWindow(overgeared, 8).map((e) => e.episode), [5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(scheduleWindow(overgeared, 2).map((e) => e.episode), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(scheduleWindow(anime(9, 'None'), 2), []);
});

test('a countdown in days, hours, minutes and seconds, and none once the time has come', () => {
  const at = new Date('2026-11-15T14:30:00Z');
  assert.deepEqual(countdown(at, new Date('2026-11-09T02:00:00Z')), { days: 6, hours: 12, minutes: 30, seconds: 0 });
  assert.deepEqual(countdown(at, new Date('2026-11-15T14:29:58.500Z')), { days: 0, hours: 0, minutes: 0, seconds: 2 }, 'rounds up, never shows 0 before it is out');
  assert.equal(countdown(at, at), null);
  assert.equal(countdown(at, new Date('2026-11-16T00:00:00Z')), null);
});

test("a zone is named the way its people name it, whatever name the browser reports it under", () => {
  const at = new Date('2026-11-15T14:30:00Z');
  assert.equal(zoneTime(at, 'Asia/Calcutta').zone, 'IST', 'the older name some browsers report for India');
  assert.equal(formatAiring(at, { timeZone: 'Asia/Calcutta' }), 'Sunday 15 November 2026, 20:00 IST');
  assert.equal(formatAiring(at, { timeZone: 'America/New_York' }), 'Sunday 15 November 2026, 09:30 EST');
  assert.equal(formatAiring(at, { timeZone: 'Europe/Berlin' }), 'Sunday 15 November 2026, 15:30 CET');
  assert.equal(formatAiring(at, { timeZone: 'Australia/Sydney' }), 'Monday 16 November 2026, 01:30 GMT+11', 'no abbreviation to give');
});
