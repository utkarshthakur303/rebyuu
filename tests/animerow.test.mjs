import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, mergeSchedule, DETAIL_COLUMNS, SEASON_YEAR_COLUMNS, SCHEDULE_COLUMNS } from '../scripts/animeRow.mjs';

// Trimmed from AniList's live response for Frieren (28 Sep 2026).
const frieren = {
  id: 154587,
  idMal: 52991,
  title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey’s End', native: '葬送のフリーレン' },
  synonyms: ['Frieren at the Funeral', '장송의 프리렌', 'Sōsō no Furīren'],
  format: 'TV',
  source: 'MANGA',
  duration: 24,
  averageScore: 91,
  genres: ['Adventure', 'Drama', 'Fantasy'],
  startDate: { year: 2023 },
  season: 'FALL',
  status: 'FINISHED',
  episodes: 28,
  description: 'The adventure is over<br> but life goes on.',
  coverImage: { large: 'https://s4.anilist.co/cover.jpg' },
  bannerImage: 'https://s4.anilist.co/banner.jpg',
  trailer: { id: 'qgQKf3MDZsA', site: 'youtube' },
  studios: { nodes: [{ name: 'MADHOUSE' }] },
  externalLinks: [
    { site: 'Official Site', url: 'https://frieren-anime.jp/', type: 'INFO' },
    { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4', type: 'STREAMING' },
    { site: 'Netflix', url: 'https://www.netflix.com/title/81726714', type: 'STREAMING' },
    { site: 'Netflix', url: 'https://www.netflix.com/title/99999999', type: 'STREAMING' },
    { site: 'Twitter', url: 'https://twitter.com/Anime_Frieren', type: 'SOCIAL' },
  ],
  nextAiringEpisode: null,
  relations: {
    edges: [
      { relationType: 'ADAPTATION', node: { id: 118586, type: 'MANGA', format: 'MANGA', title: { romaji: 'Sousou no Frieren', english: null }, startDate: { year: 2020 } } },
      { relationType: 'CHARACTER', node: { id: 169811, type: 'ANIME', format: 'MUSIC', title: { romaji: 'Yuusha', english: 'The Brave' }, startDate: { year: 2023 } } },
      { relationType: 'SIDE_STORY', node: { id: 170068, type: 'ANIME', format: 'ONA', title: { romaji: 'Sousou no Frieren: no Mahou', english: null }, startDate: { year: 2023 } } },
      { relationType: 'SEQUEL', node: { id: 182255, type: 'ANIME', format: 'TV', title: { romaji: 'Sousou no Frieren 2nd Season', english: 'Frieren: Beyond Journey’s End Season 2' }, startDate: { year: 2026 } } },
    ],
  },
};

test('the base columns are mapped exactly as the sync always has', () => {
  const row = toRow(frieren);

  assert.equal(row.id, 'anilist-154587');
  assert.equal(row.title, 'Frieren: Beyond Journey’s End');
  assert.equal(row.rating, 9.1);
  assert.equal(row.status, 'completed');
  assert.equal(row.season, 'Fall');
  assert.equal(row.description, 'The adventure is over but life goes on.');
  assert.equal(row.trailer, 'https://www.youtube.com/watch?v=qgQKf3MDZsA');
});

test('every name the title is searched by is kept', () => {
  const row = toRow(frieren);

  assert.equal(row.title_romaji, 'Sousou no Frieren');
  assert.equal(row.title_english, 'Frieren: Beyond Journey’s End');
  assert.equal(row.title_native, '葬送のフリーレン');
  assert.deepEqual(row.synonyms, ['Frieren at the Funeral', '장송의 프리렌', 'Sōsō no Furīren']);
});

test('format, source, length, studio and MAL id are kept', () => {
  const row = toRow(frieren);

  assert.equal(row.format, 'TV');
  assert.equal(row.source, 'MANGA');
  assert.equal(row.duration, 24);
  assert.deepEqual(row.studios, ['MADHOUSE']);
  assert.equal(row.mal_id, 52991);
});

test('streaming links are the STREAMING entries only, one per service', () => {
  assert.deepEqual(toRow(frieren).streaming, [
    { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4' },
    { site: 'Netflix', url: 'https://www.netflix.com/title/81726714' },
  ]);
});

test('a streaming link that is not an http(s) URL is dropped', () => {
  const row = toRow({
    ...frieren,
    externalLinks: [
      { site: 'Bad', url: 'javascript:alert(1)', type: 'STREAMING' },
      { site: 'Also bad', url: 'data:text/html,hi', type: 'STREAMING' },
      { site: 'Crunchyroll', url: 'http://www.crunchyroll.com/one-piece', type: 'STREAMING' },
    ],
  });
  assert.deepEqual(row.streaming, [{ site: 'Crunchyroll', url: 'http://www.crunchyroll.com/one-piece' }]);
});

test('relations keep anime seasons and side stories, not manga or music videos, sequels first', () => {
  assert.deepEqual(toRow(frieren).relations, [
    { id: 'anilist-182255', relation: 'SEQUEL', title: 'Frieren: Beyond Journey’s End Season 2', year: 2026, format: 'TV' },
    { id: 'anilist-170068', relation: 'SIDE_STORY', title: 'Sousou no Frieren: no Mahou', year: 2023, format: 'ONA' },
  ]);
});

test('side stories are capped so a long runner does not carry a hundred of them', () => {
  const edges = Array.from({ length: 30 }, (_, i) => ({
    relationType: 'SIDE_STORY',
    node: { id: 1000 + i, type: 'ANIME', format: 'SPECIAL', title: { romaji: `Special ${i}`, english: null }, startDate: { year: 2000 + i } },
  }));
  const row = toRow({ ...frieren, relations: { edges } });

  assert.equal(row.relations.length, 8);
  assert.equal(row.relations[0].year, 2029, 'newest first');
});

test('the next episode becomes a number and an ISO timestamp', () => {
  const row = toRow({ ...frieren, status: 'RELEASING', nextAiringEpisode: { airingAt: 1798985760, episode: 1181 } });

  assert.equal(row.next_episode, 1181);
  assert.equal(row.next_episode_at, new Date(1798985760 * 1000).toISOString());
  assert.equal(toRow(frieren).next_episode_at, null);
});

test("a December premiere is filed under the next year's Winter, as AniList files it", () => {
  const row = toRow({ ...frieren, startDate: { year: 2023 }, season: 'WINTER', seasonYear: 2024 });

  assert.equal(row.year, 2023);
  assert.equal(row.season, 'Winter');
  assert.equal(row.season_year, 2024);
});

test('season_year is written only once its own column exists', () => {
  const row = toRow({ ...frieren, seasonYear: 2023 }, { details: true, seasonYear: false });

  assert.ok(!('season_year' in row));
  assert.equal(row.title_romaji, 'Sousou no Frieren');
  assert.deepEqual(SEASON_YEAR_COLUMNS, ['season_year']);
  assert.ok(!DETAIL_COLUMNS.includes('season_year'));
});

test('without the migration, only the original columns are produced', () => {
  const row = toRow(frieren, { details: false });

  for (const column of DETAIL_COLUMNS) assert.ok(!(column in row), column);
  assert.equal(row.title, 'Frieren: Beyond Journey’s End');
});

// ── Airing schedule ──────────────────────────────────────────────────────

const iso = (seconds) => new Date(seconds * 1000).toISOString();
const SUN_1_NOV = 1793543400; // 2026-11-01T14:30:00Z
const WEEK = 7 * 86400;

test('the airing schedule joins the full list and the next few episodes, in episode order, as ISO times', () => {
  // A long runner: AniList's first 25 schedule entries are old ones; the
  // upcoming list is what is about to air.
  const row = toRow({
    ...frieren,
    status: 'RELEASING',
    airingSchedule: { nodes: [{ episode: 2, airingAt: SUN_1_NOV + WEEK }, { episode: 1, airingAt: SUN_1_NOV }] },
    upcomingSchedule: { nodes: [{ episode: 2, airingAt: SUN_1_NOV + WEEK }, { episode: 3, airingAt: SUN_1_NOV + 2 * WEEK }] },
  });

  assert.deepEqual(row.airing_schedule, [
    { episode: 1, at: '2026-11-01T14:30:00.000Z' },
    { episode: 2, at: '2026-11-08T14:30:00.000Z' },
    { episode: 3, at: '2026-11-15T14:30:00.000Z' },
  ]);
  assert.deepEqual(toRow(frieren).airing_schedule, [], 'no schedule from AniList');
});

test('the schedule is written only once its column exists', () => {
  assert.ok(!('airing_schedule' in toRow(frieren, { schedule: false })));
  assert.ok(!('airing_schedule' in toRow(frieren, { details: false })));
  assert.deepEqual(SCHEDULE_COLUMNS, ['airing_schedule']);
});

const entry = (episode, at) => ({ episode, at });
const NOW = new Date('2026-11-09T02:00:00Z');

test('episodes that have aired are kept from the stored schedule, so a long runner builds up its recent past', () => {
  const stored = [entry(1180, '2026-11-01T01:30:00.000Z'), entry(1181, '2026-11-08T01:30:00.000Z')];
  const fetched = [entry(1182, '2026-11-15T01:30:00.000Z'), entry(1183, '2026-11-22T01:30:00.000Z')];

  assert.deepEqual(mergeSchedule(stored, fetched, NOW).map((e) => e.episode), [1180, 1181, 1182, 1183]);
});

test('AniList wins for any episode it lists, and a future episode it no longer lists is dropped', () => {
  const stored = [entry(5, '2026-11-01T07:30:00.000Z'), entry(6, '2026-11-08T07:30:00.000Z'), entry(9, '2026-11-29T07:30:00.000Z')];
  // Episode 5 was moved back a week; episode 9 is no longer scheduled.
  const fetched = [entry(5, '2026-11-08T07:30:00.000Z'), entry(6, '2026-11-15T07:30:00.000Z')];

  assert.deepEqual(mergeSchedule(stored, fetched, NOW), [entry(5, '2026-11-08T07:30:00.000Z'), entry(6, '2026-11-15T07:30:00.000Z')]);
});

test('the stored schedule is capped to the latest 40 episodes', () => {
  const stored = Array.from({ length: 60 }, (_, i) => entry(i + 1, new Date(Date.parse('2026-01-01T00:00:00Z') + i * 4 * 86400000).toISOString()));

  const merged = mergeSchedule(stored, [], new Date('2026-09-20T00:00:00Z'));
  assert.equal(merged.length, 40);
  assert.equal(merged[0].episode, 21);
});

test('a show whose last episode aired more than 60 days ago keeps no schedule', () => {
  const stored = [entry(11, '2026-08-01T00:00:00.000Z'), entry(12, '2026-08-08T00:00:00.000Z')];

  assert.deepEqual(mergeSchedule(stored, [], new Date('2026-10-08T00:00:00Z')), [], '61 days after the finale');
  assert.equal(mergeSchedule(stored, [], new Date('2026-10-06T00:00:00Z')).length, 2, '59 days after');
});

test('stored values that are not schedule entries are ignored', () => {
  assert.deepEqual(mergeSchedule(null, [entry(1, '2026-11-15T00:00:00.000Z')], NOW), [entry(1, '2026-11-15T00:00:00.000Z')]);
  assert.deepEqual(mergeSchedule([{ episode: 'x' }, null, entry(2, 'bad')], [], NOW), []);
});
