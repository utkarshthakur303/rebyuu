import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hubPath, seasonPath, parseHubPath, seasonOf, shiftSeason, seasonTense,
  hubPreset, browseSearch, hubChangeTarget, hubNavLinks, genrePath,
} from '../api/_hubs.js';

const NOW = new Date('2026-09-29T12:00:00Z');
const fall2026 = { kind: 'season', season: 'Fall', year: 2026 };

/** Browse's state after a change; everything not given is at its default. */
const state = (extra = {}) => ({ genres: [], year: null, season: null, status: 'all', query: '', sort: 'trending', page: 1, ...extra });

test('each hub has one path', () => {
  assert.equal(hubPath(fall2026), '/seasons/fall-2026');
  assert.equal(seasonPath({ season: 'Winter', year: 2027 }), '/seasons/winter-2027');
  assert.equal(hubPath({ kind: 'airing' }), '/airing');
  assert.equal(hubPath({ kind: 'upcoming' }), '/upcoming');
});

test('a path is read back into its hub', () => {
  assert.deepEqual(parseHubPath('/seasons/fall-2026', NOW), fall2026);
  assert.deepEqual(parseHubPath('/airing', NOW), { kind: 'airing' });
  assert.deepEqual(parseHubPath('/upcoming', NOW), { kind: 'upcoming' });
});

test('another case or "autumn" still names the season, so the caller can redirect', () => {
  const hub = parseHubPath('/seasons/Autumn-2026', NOW);
  assert.deepEqual(hub, fall2026);
  assert.notEqual(hubPath(hub), '/seasons/Autumn-2026');
  assert.deepEqual(parseHubPath('/seasons/FALL-2026', NOW), fall2026);
});

test('paths that name no hub are null', () => {
  for (const path of ['/seasons/monsoon-2026', '/seasons/fall-1899', '/seasons/fall-2029', '/seasons/fall', '/seasons/fall-26', '/airing/', '/browse', '', null]) {
    assert.equal(parseHubPath(path, NOW), null, String(path));
  }
  // Two years ahead is as far as shows are announced, and as far as Browse's year filter goes.
  assert.deepEqual(parseHubPath('/seasons/winter-2028', NOW), { kind: 'season', season: 'Winter', year: 2028 });
});

test('calendar seasons: Winter is January to March, Fall October to December (UTC)', () => {
  assert.deepEqual(seasonOf(new Date('2026-01-01T00:00:00Z')), { season: 'Winter', year: 2026 });
  assert.deepEqual(seasonOf(new Date('2026-03-31T23:59:59Z')), { season: 'Winter', year: 2026 });
  assert.deepEqual(seasonOf(new Date('2026-04-01T00:00:00Z')), { season: 'Spring', year: 2026 });
  assert.deepEqual(seasonOf(NOW), { season: 'Summer', year: 2026 });
  assert.deepEqual(seasonOf(new Date('2026-12-31T23:59:59Z')), { season: 'Fall', year: 2026 });
});

test('seasons step across years in both directions', () => {
  assert.deepEqual(shiftSeason(fall2026, 1), { season: 'Winter', year: 2027 });
  assert.deepEqual(shiftSeason({ season: 'Winter', year: 2027 }, -1), { season: 'Fall', year: 2026 });
  assert.deepEqual(shiftSeason({ season: 'Spring', year: 2026 }, -6), { season: 'Fall', year: 2024 });
});

test('a season is past, current or upcoming relative to now', () => {
  assert.equal(seasonTense({ season: 'Summer', year: 2026 }, NOW), 'current');
  assert.equal(seasonTense(fall2026, NOW), 'upcoming');
  assert.equal(seasonTense({ season: 'Spring', year: 2026 }, NOW), 'past');
});

test('each hub opens Browse on its filters, in the order people arrive expecting', () => {
  assert.deepEqual(hubPreset(fall2026), {
    filters: { genres: [], year: 2026, season: 'Fall', status: 'all', query: '' },
    sort: 'popularity',
  });
  // The homepage's Airing rail is trending and its Upcoming rail most popular:
  // their "View More" lands here, and the list should continue, not reshuffle.
  assert.equal(hubPreset({ kind: 'airing' }).sort, 'trending');
  assert.equal(hubPreset({ kind: 'airing' }).filters.status, 'airing');
  assert.equal(hubPreset({ kind: 'upcoming' }).sort, 'popularity');
  assert.equal(hubPreset({ kind: 'upcoming' }).filters.status, 'upcoming');
});

test("Browse's query string leaves out everything at its default", () => {
  assert.equal(browseSearch(state(), 'trending'), '');
  assert.equal(
    browseSearch(state({ genres: ['Action', 'Slice of Life'], year: 2026, season: 'Fall', status: 'airing', sort: 'score', page: 3, query: 'frieren' }), 'trending'),
    '?q=frieren&genre=Action%2CSlice+of+Life&year=2026&season=Fall&status=airing&sort=score&page=3'
  );
});

test('on a hub, a new order or page stays on the hub', () => {
  const filters = hubPreset(fall2026).filters;
  assert.equal(hubChangeTarget(fall2026, state({ ...filters, sort: 'trending' }), 'trending'), '/seasons/fall-2026?sort=trending');
  assert.equal(hubChangeTarget(fall2026, state({ ...filters, sort: 'popularity', page: 2 }), 'trending'), '/seasons/fall-2026?page=2');
  assert.equal(hubChangeTarget(fall2026, state({ ...filters, sort: 'popularity' }), 'trending'), '/seasons/fall-2026');
});

test('on a hub, a filter change opens Browse with the order carried over', () => {
  const filters = hubPreset(fall2026).filters;
  // Adding a genre: the grid keeps its order (most popular), so it is spelled out.
  assert.equal(
    hubChangeTarget(fall2026, state({ ...filters, genres: ['Action'], sort: 'popularity' }), 'trending'),
    '/browse?genre=Action&year=2026&season=Fall&sort=popularity'
  );
  // Clearing the filters.
  assert.equal(hubChangeTarget(fall2026, state({ sort: 'popularity' }), 'trending'), '/browse?sort=popularity');
  // Airing opens trending, which is also Browse's default, so no sort is spelled out.
  assert.equal(
    hubChangeTarget({ kind: 'airing' }, state({ status: 'airing', genres: ['Comedy'] }), 'trending'),
    '/browse?genre=Comedy&status=airing'
  );
  // Picking another season leaves the hub too; the season links move between hubs.
  assert.equal(
    hubChangeTarget(fall2026, state({ ...filters, season: 'Summer', sort: 'popularity' }), 'trending'),
    '/browse?year=2026&season=Summer&sort=popularity'
  );
});

test('every page links this season, next season, the airing schedule, upcoming and top rated', () => {
  assert.deepEqual(hubNavLinks(NOW), [
    { label: 'Summer 2026 anime', path: '/seasons/summer-2026' },
    { label: 'Fall 2026 anime', path: '/seasons/fall-2026' },
    { label: 'Airing schedule', path: '/airing' },
    { label: 'Upcoming anime', path: '/upcoming' },
    { label: 'Top rated anime', path: '/top' },
  ]);
  // In December the next season is next year's Winter.
  assert.equal(hubNavLinks(new Date('2026-12-15T00:00:00Z'))[1].path, '/seasons/winter-2027');
});

test('top rated, a year and a genre each have one path', () => {
  assert.equal(hubPath({ kind: 'top' }), '/top');
  assert.equal(hubPath({ kind: 'year', year: 2025 }), '/top/2025');
  assert.equal(hubPath({ kind: 'genre', genre: 'Slice of Life' }), '/genres/slice-of-life');
  assert.equal(genrePath('Sci-Fi'), '/genres/sci-fi');
});

test('their paths are read back; years up to this one, genres in any case', () => {
  assert.deepEqual(parseHubPath('/top', NOW), { kind: 'top' });
  assert.deepEqual(parseHubPath('/top/2025', NOW), { kind: 'year', year: 2025 });
  assert.deepEqual(parseHubPath('/top/2026', NOW), { kind: 'year', year: 2026 });
  assert.deepEqual(parseHubPath('/genres/romance', NOW), { kind: 'genre', genre: 'Romance' });
  assert.deepEqual(parseHubPath('/genres/Slice-Of-Life', NOW), { kind: 'genre', genre: 'Slice of Life' });
  for (const path of ['/top/2027', '/top/1899', '/top/', '/genres/hentai', '/genres/isekai', '/genres/']) {
    assert.equal(parseHubPath(path, NOW), null, path);
  }
});

test('top and years open top rated first; genres most popular first', () => {
  const none = { genres: [], year: null, season: null, status: 'all', query: '' };
  assert.deepEqual(hubPreset({ kind: 'top' }), { filters: none, sort: 'score' });
  assert.deepEqual(hubPreset({ kind: 'year', year: 2025 }), { filters: { ...none, year: 2025 }, sort: 'score' });
  // By score, Comedy and Action open on a run of Gintama seasons.
  assert.deepEqual(hubPreset({ kind: 'genre', genre: 'Romance' }), { filters: { ...none, genres: ['Romance'] }, sort: 'popularity' });
});

test('on /top the order is the page, so changing it opens Browse', () => {
  assert.equal(hubChangeTarget({ kind: 'top' }, state({ sort: 'trending' }), 'trending'), '/browse');
  assert.equal(hubChangeTarget({ kind: 'top' }, state({ sort: 'popularity' }), 'trending'), '/browse?sort=popularity');
  assert.equal(hubChangeTarget({ kind: 'top' }, state({ sort: 'score', page: 2 }), 'trending'), '/top?page=2');
  // A year and a genre keep their pages when the order changes.
  assert.equal(hubChangeTarget({ kind: 'year', year: 2025 }, state({ year: 2025, sort: 'trending' }), 'trending'), '/top/2025?sort=trending');
  assert.equal(hubChangeTarget({ kind: 'genre', genre: 'Romance' }, state({ genres: ['Romance'], sort: 'score' }), 'trending'), '/genres/romance?sort=score');
  assert.equal(
    hubChangeTarget({ kind: 'genre', genre: 'Romance' }, state({ genres: ['Romance', 'Comedy'], sort: 'popularity' }), 'trending'),
    '/browse?genre=Romance%2CComedy&sort=popularity'
  );
});
