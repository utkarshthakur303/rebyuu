import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFetch, anime, SUPABASE_URL } from './helpers.mjs';
import { MIN_HUB_TITLES, hubCountPath, isIndexable, hubFallbackPath, censusPath, indexedHubPaths } from '../api/_hubdb.js';
import { parseHubPath } from '../api/_hubs.js';

const NOW = new Date('2026-09-29T12:00:00Z');
const LONG = 'x'.repeat(130);
const quality = (id, extra) => anime(id, `Show ${id}`, { description: LONG, rating: 7, status: 'completed', ...extra });
const many = (from, count, extra) => Array.from({ length: count }, (_, i) => quality(from + i, extra));

async function rows(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`);
  return res.json();
}

test('a season counts its quality titles, by the season AniList files them under', async () => {
  installFetch({
    tables: {
      anime_index: [
        ...many(1, 3, { season: 'Fall', year: 2015 }),
        quality(10, { season: 'Fall', year: 2015, description: 'Too short.' }),
        quality(11, { season: 'Fall', year: 2015, genres: ['Hentai'] }),
        quality(12, { season: 'Winter', year: 2015, season_year: 2016 }), // December 2015 premiere
        quality(13, { season: 'Winter', year: 2016, season_year: null }), // not yet backfilled
        quality(14, { season: 'Winter', year: 2016, season_year: 2016 }),
      ],
    },
  });

  assert.equal((await rows(hubCountPath({ kind: 'season', season: 'Fall', year: 2015 }, NOW))).length, 3);
  assert.equal((await rows(hubCountPath({ kind: 'season', season: 'Winter', year: 2016 }, NOW))).length, 3);
  assert.equal((await rows(hubCountPath({ kind: 'season', season: 'Winter', year: 2015 }, NOW))).length, 0);
});

test('airing and upcoming are always indexed; a season from 12 quality titles', () => {
  assert.equal(hubCountPath({ kind: 'airing' }, NOW), null);
  assert.equal(hubCountPath({ kind: 'upcoming' }, NOW), null);
  assert.equal(isIndexable({ kind: 'airing' }, 0), true);
  assert.equal(isIndexable({ kind: 'season', season: 'Fall', year: 2015 }, MIN_HUB_TITLES - 1), false);
  assert.equal(isIndexable({ kind: 'season', season: 'Fall', year: 2015 }, MIN_HUB_TITLES), true);
});

test('with AniList down, a season lists its titles best rated first, excluded genres left out', async () => {
  installFetch({
    tables: {
      anime_index: [
        quality(1, { season: 'Fall', year: 2015, rating: 7 }),
        quality(2, { season: 'Fall', year: 2015, rating: 9 }),
        quality(3, { season: 'Fall', year: 2015, rating: null, description: null }),
        quality(4, { season: 'Fall', year: 2015, rating: 8, genres: ['Hentai'] }),
        quality(5, { season: 'Spring', year: 2015, rating: 10 }),
      ],
    },
  });

  const listed = await rows(hubFallbackPath({ kind: 'season', season: 'Fall', year: 2015 }, { columns: 'id,title', limit: 150 }));

  assert.deepEqual(listed.map((r) => r.id), ['anilist-2', 'anilist-1', 'anilist-3']);
});

test('with AniList down, airing lists airing titles and upcoming lists the soonest first', async () => {
  installFetch({
    tables: {
      anime_index: [
        quality(1, { status: 'airing', rating: 6 }),
        quality(2, { status: 'airing', rating: 8 }),
        quality(3, { status: 'upcoming', year: 2028 }),
        quality(4, { status: 'upcoming', year: 2027 }),
      ],
    },
  });

  assert.deepEqual((await rows(hubFallbackPath({ kind: 'airing' }, { columns: 'id', limit: 100 }))).map((r) => r.id), ['anilist-2', 'anilist-1']);
  assert.deepEqual((await rows(hubFallbackPath({ kind: 'upcoming' }, { columns: 'id', limit: 100 }))).map((r) => r.id), ['anilist-4', 'anilist-3']);
});

test('the census lists airing, upcoming, top and every season with 12 quality titles, oldest first', async () => {
  installFetch({
    tables: {
      anime_index: [
        ...many(100, 12, { season: 'Fall', year: 2015 }),
        ...many(200, 11, { season: 'Spring', year: 2015 }),
        ...many(300, 12, { season: 'Winter', year: 2015, season_year: 2016 }),
        ...many(400, 12, { season: 'Summer', year: 2015, genres: ['Hentai'] }),
        ...many(500, 12, { season: 'Fall', year: 2035, status: 'upcoming' }), // beyond two years ahead
      ],
    },
  });

  const paths = indexedHubPaths(await rows(censusPath(NOW)), NOW);

  // Its 35 titles from 2015 also make that year's page.
  assert.deepEqual(paths, ['/airing', '/upcoming', '/top', '/top/2015', '/seasons/fall-2015', '/seasons/winter-2016']);
});

test('the census and each page count the same titles, so the sitemap never lists a noindex page', async () => {
  const catalogue = [
    ...many(100, 12, { season: 'Fall', year: 2015 }),
    ...many(200, 11, { season: 'Spring', year: 2015 }),
    ...many(300, 6, { season: 'Winter', year: 2015, season_year: 2016 }),
    ...many(400, 6, { season: 'Winter', year: 2016 }),
    quality(500, { season: 'Summer', year: 2015, description: 'Too short.' }),
  ];
  installFetch({ tables: { anime_index: catalogue } });

  const listed = new Set(indexedHubPaths(await rows(censusPath(NOW)), NOW));
  for (const path of ['/seasons/fall-2015', '/seasons/spring-2015', '/seasons/winter-2016', '/seasons/summer-2015', '/seasons/winter-2015']) {
    const hub = parseHubPath(path, NOW);
    const indexed = isIndexable(hub, (await rows(hubCountPath(hub, NOW))).length);
    assert.equal(listed.has(path), indexed, path);
  }
  assert.ok(listed.has('/seasons/winter-2016'));
});

test('a year counts quality titles that started in it; a genre, those tagged with it', async () => {
  installFetch({
    tables: {
      anime_index: [
        ...many(1, 3, { year: 2025, genres: ['Slice of Life'] }),
        quality(10, { year: 2024, season: 'Winter', season_year: 2025, genres: ['Slice of Life', 'Hentai'] }),
        quality(11, { year: 2025, genres: ['Comedy'] }),
      ],
    },
  });

  // A year is the start year, as Browse's year filter is.
  assert.equal((await rows(hubCountPath({ kind: 'year', year: 2025 }, NOW))).length, 4);
  assert.equal((await rows(hubCountPath({ kind: 'genre', genre: 'Slice of Life' }, NOW))).length, 3);
  assert.equal(hubCountPath({ kind: 'top' }, NOW), null);
  assert.equal(isIndexable({ kind: 'top' }, 0), true);
});

test('with AniList down, a genre lists its titles best rated first', async () => {
  installFetch({
    tables: {
      anime_index: [
        quality(1, { genres: ['Slice of Life'], rating: 7 }),
        quality(2, { genres: ['Comedy', 'Slice of Life'], rating: 8 }),
        quality(3, { genres: ['Comedy'], rating: 9 }),
      ],
    },
  });

  const listed = await rows(hubFallbackPath({ kind: 'genre', genre: 'Slice of Life' }, { columns: 'id', limit: 100 }));

  assert.deepEqual(listed.map((r) => r.id), ['anilist-2', 'anilist-1']);
});

test('the census adds top rated, each genre and each past year with 12 quality titles', async () => {
  installFetch({
    tables: {
      anime_index: [
        ...many(100, 12, { year: 2015, genres: ['Romance'] }),
        ...many(200, 11, { year: 2016, genres: ['Mecha'] }),
        ...many(300, 12, { year: 2027, status: 'upcoming', genres: ['Romance'] }), // a year still to come
      ],
    },
  });

  const paths = indexedHubPaths(await rows(censusPath(NOW)), NOW);

  assert.deepEqual(paths, ['/airing', '/upcoming', '/top', '/genres/romance', '/top/2015']);
});

test('the census and each year or genre page count the same titles', async () => {
  installFetch({
    tables: {
      anime_index: [
        ...many(100, 12, { year: 2015, genres: ['Romance'] }),
        ...many(200, 11, { year: 2016, genres: ['Mecha'] }),
        ...many(300, 6, { year: 2017, genres: ['Slice of Life', 'Hentai'] }),
        ...many(400, 12, { year: 2017, genres: ['Slice of Life'] }),
      ],
    },
  });

  const listed = new Set(indexedHubPaths(await rows(censusPath(NOW)), NOW));
  for (const path of ['/top/2015', '/top/2016', '/top/2017', '/genres/romance', '/genres/mecha', '/genres/slice-of-life']) {
    const hub = parseHubPath(path, NOW);
    assert.equal(listed.has(path), isIndexable(hub, (await rows(hubCountPath(hub, NOW))).length), path);
  }
});
