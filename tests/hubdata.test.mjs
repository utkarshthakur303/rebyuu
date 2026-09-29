import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_PAGE_SIZE, servedLimit, hubQuery, hubLinksQuery, readHubIds, readHubHasMore, readHubLinks,
  scheduleRange, scheduleQuery, readSchedule, scheduleTime, groupSchedule,
} from '../api/_hubdata.js';

const NOW = new Date('2026-09-29T12:00:00Z');
const fall2026 = { kind: 'season', season: 'Fall', year: 2026 };
const ids = (...list) => ({ media: list.map((id) => ({ id })) });

test('a season query asks for the whole season, most popular first, as Browse does', () => {
  const q = hubQuery(fall2026);
  assert.equal(servedLimit(fall2026), 3 * HUB_PAGE_SIZE);
  for (const page of [1, 2, 3]) assert.match(q, new RegExp(`p${page}: Page\\(page: ${page}, perPage: ${HUB_PAGE_SIZE}\\)`));
  assert.match(q, /sort: \[POPULARITY_DESC\]/);
  assert.match(q, /season: FALL, seasonYear: 2026/);
  assert.match(q, /genre_not_in: \["Hentai"\]/);
  assert.match(q, /isAdult: false/);
  // Whether the neighbouring seasons have shows, in the same request.
  assert.match(q, /prev: Page\(page: 1, perPage: 1\) \{ media\([^)]*season: SUMMER, seasonYear: 2026/);
  assert.match(q, /next: Page\(page: 1, perPage: 1\) \{ media\([^)]*season: WINTER, seasonYear: 2027/);
});

test('airing is trending and releasing; upcoming is most popular, not yet released, with its seasons', () => {
  const airing = hubQuery({ kind: 'airing' });
  assert.match(airing, /sort: \[TRENDING_DESC\]/);
  assert.match(airing, /status: RELEASING/);
  assert.doesNotMatch(airing, /prev:|next:/);
  const upcoming = hubQuery({ kind: 'upcoming' });
  assert.match(upcoming, /sort: \[POPULARITY_DESC\]/);
  assert.match(upcoming, /status: NOT_YET_RELEASED/);
  assert.match(upcoming, /\{ id season seasonYear \}/);
});

test('ids come back in page order, each once', () => {
  const data = { p2: ids(4, 1), p1: { pageInfo: { hasNextPage: true }, ...ids(3, 1, 2) }, prev: ids(99) };
  assert.deepEqual(readHubIds(data), ['anilist-3', 'anilist-1', 'anilist-2', 'anilist-4']);
  assert.equal(readHubHasMore(data), true);
  assert.deepEqual(readHubIds(null), []);
  assert.equal(readHubHasMore(null), false);
});

test('a season links its neighbours only when they have shows', () => {
  assert.deepEqual(readHubLinks(fall2026, { prev: ids(1), next: ids() }, NOW), [{ label: 'Summer 2026', path: '/seasons/summer-2026' }]);
  assert.deepEqual(readHubLinks(fall2026, { prev: ids(1), next: ids(2) }, NOW), [
    { label: 'Summer 2026', path: '/seasons/summer-2026' },
    { label: 'Winter 2027', path: '/seasons/winter-2027' },
  ]);
  // Nothing before 1900 has a page, whatever AniList says.
  assert.deepEqual(readHubLinks({ kind: 'season', season: 'Winter', year: 1900 }, { prev: ids(1), next: ids() }, NOW), []);
  assert.deepEqual(readHubLinks(fall2026, null, NOW), []);
});

test('upcoming links each season its shows are announced for, in order, once', () => {
  const data = {
    p1: { media: [
      { id: 1, season: 'SPRING', seasonYear: 2027 },
      { id: 2, season: null, seasonYear: null },
      { id: 3, season: 'WINTER', seasonYear: 2027 },
      { id: 4, season: 'SPRING', seasonYear: 2027 },
      { id: 5, season: 'FALL', seasonYear: 2031 }, // beyond two years ahead: no page
    ] },
  };
  assert.deepEqual(readHubLinks({ kind: 'upcoming' }, data, NOW), [
    { label: 'Winter 2027', path: '/seasons/winter-2027' },
    { label: 'Spring 2027', path: '/seasons/spring-2027' },
  ]);
});

test('links for a page React opens without the served data: neighbours only, or none', () => {
  const q = hubLinksQuery(fall2026);
  assert.match(q, /prev: Page/);
  assert.doesNotMatch(q, /p1: Page/);
  assert.match(hubLinksQuery({ kind: 'upcoming' }), /p1: Page/);
  assert.equal(hubLinksQuery({ kind: 'airing' }), null);
});

test("the schedule covers today in any time zone and the week after it", () => {
  const { from, to } = scheduleRange(NOW);
  const now = NOW.getTime() / 1000;
  assert.equal(from, now - 86400);
  assert.equal(to, now + 8 * 86400);
  const q = scheduleQuery({ from, to });
  assert.match(q, new RegExp(`airingAt_greater: ${from}, airingAt_lesser: ${to}`));
  assert.match(q, /s4: Page\(page: 4, perPage: 50\)/);
});

test('schedule entries: adult and excluded titles dropped, each episode once, in time order', () => {
  const entry = (id, episode, at, media = {}) => ({ episode, airingAt: at, media: { id, isAdult: false, genres: ['Action'], title: { english: `Show ${id}`, romaji: `Romaji ${id}` }, ...media } });
  const data = {
    s1: { airingSchedules: [entry(1, 5, 2000), entry(2, 1, 1000, { isAdult: true }), entry(3, 7, 1500, { genres: ['Hentai'] })] },
    s2: { airingSchedules: [entry(4, 2, 500, { title: { english: null, romaji: 'Only Romaji' } }), entry(1, 5, 2000)] },
  };
  assert.deepEqual(readSchedule(data), [
    { id: 'anilist-4', title: 'Only Romaji', episode: 2, at: 500000 },
    { id: 'anilist-1', title: 'Show 1', episode: 5, at: 2000000 },
  ]);
  assert.deepEqual(readSchedule(null), []);
});

test('episode times read in the given zone, 24-hour', () => {
  const at = Date.parse('2026-09-29T15:05:00Z');
  assert.equal(scheduleTime(at, 'UTC'), '15:05');
  assert.equal(scheduleTime(at, 'Asia/Kolkata'), '20:35');
});

test("a week of days from today in the reader's zone, each episode on its local day", () => {
  const now = new Date('2026-09-29T20:00:00Z'); // 30 Sep 01:30 in Kolkata
  const entries = [
    { id: 'anilist-1', title: 'Late', episode: 1, at: Date.parse('2026-09-29T18:00:00Z') }, // 29 Sep 23:30 IST
    { id: 'anilist-2', title: 'Early', episode: 1, at: Date.parse('2026-09-29T19:00:00Z') }, // 30 Sep 00:30 IST
  ];
  const kolkata = groupSchedule(entries, { now, timeZone: 'Asia/Kolkata' });
  assert.equal(kolkata.length, 7);
  assert.equal(kolkata[0].key, '2026-09-30');
  assert.equal(kolkata[0].label, 'Wednesday 30 September');
  assert.equal(kolkata[0].short, 'Wed 30');
  // Yesterday's episode (in Kolkata) is not on this week's schedule.
  assert.deepEqual(kolkata[0].entries.map((e) => e.title), ['Early']);

  const utc = groupSchedule(entries, { now, timeZone: 'UTC' });
  assert.equal(utc[0].key, '2026-09-29');
  assert.deepEqual(utc[0].entries.map((e) => e.title), ['Late', 'Early']);
});

test('a week across the end of daylight saving still has seven different days', () => {
  const days = groupSchedule([], { now: new Date('2026-10-31T12:00:00Z'), timeZone: 'America/New_York' });
  assert.deepEqual(days.map((d) => d.key), ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
});

test('top rated, a year and a genre ask for what Browse shows for them', () => {
  const top = hubQuery({ kind: 'top' });
  assert.match(top, /sort: \[SCORE_DESC\]/);
  assert.match(top, /p2: Page/);
  assert.doesNotMatch(top, /p3: Page/);
  // A year is a start-date range, as Browse's year filter is: seasonYear is
  // empty for films and specials.
  const year = hubQuery({ kind: 'year', year: 2025 });
  assert.match(year, /sort: \[SCORE_DESC\].*startDate_greater: 20249999, startDate_lesser: 20260000/);
  // And whether each of its seasons has shows.
  for (const s of ['winter', 'spring', 'summer', 'fall']) {
    assert.match(year, new RegExp(`${s}: Page\\(page: 1, perPage: 1\\) \\{ media\\([^)]*season: ${s.toUpperCase()}, seasonYear: 2025`));
  }
  const genre = hubQuery({ kind: 'genre', genre: 'Slice of Life' });
  assert.match(genre, /sort: \[POPULARITY_DESC\].*genre_in: \["Slice of Life"\]/);
});

test('/top links every year from this one back to 1980', () => {
  const links = readHubLinks({ kind: 'top' }, null, NOW);
  assert.equal(links.length, 2026 - 1980 + 1);
  assert.deepEqual(links[0], { label: '2026', path: '/top/2026' });
  assert.deepEqual(links.at(-1), { label: '1980', path: '/top/1980' });
});

test('a year links the seasons of it that have shows', () => {
  const data = { winter: ids(1), spring: ids(), summer: ids(2), fall: ids(3) };
  assert.deepEqual(readHubLinks({ kind: 'year', year: 2025 }, data, NOW), [
    { label: 'Winter 2025', path: '/seasons/winter-2025' },
    { label: 'Summer 2025', path: '/seasons/summer-2025' },
    { label: 'Fall 2025', path: '/seasons/fall-2025' },
  ]);
  assert.deepEqual(readHubLinks({ kind: 'year', year: 2025 }, null, NOW), []);
});

test('a genre links the other seventeen', () => {
  const links = readHubLinks({ kind: 'genre', genre: 'Romance' }, null, NOW);
  assert.equal(links.length, 17);
  assert.ok(!links.some((l) => l.label === 'Romance'));
  assert.deepEqual(links.find((l) => l.label === 'Slice of Life'), { label: 'Slice of Life', path: '/genres/slice-of-life' });
});

test('React asks AniList only for the links it cannot know', () => {
  assert.match(hubLinksQuery({ kind: 'year', year: 2025 }), /fall: Page/);
  assert.doesNotMatch(hubLinksQuery({ kind: 'year', year: 2025 }), /p1: Page/);
  assert.equal(hubLinksQuery({ kind: 'top' }), null);
  assert.equal(hubLinksQuery({ kind: 'genre', genre: 'Romance' }), null);
});
