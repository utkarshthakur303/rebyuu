import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, DETAIL_COLUMNS, SEASON_YEAR_COLUMNS } from '../scripts/animeRow.mjs';

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
