import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hubPath, seasonPath, parseHubPath, seasonOf, shiftSeason, seasonTense,
  hubPreset, browseSearch, hubChangeTarget, hubNavLinks,
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

test('every page links this season, next season, the airing schedule and upcoming', () => {
  assert.deepEqual(hubNavLinks(NOW), [
    { label: 'Summer 2026 anime', path: '/seasons/summer-2026' },
    { label: 'Fall 2026 anime', path: '/seasons/fall-2026' },
    { label: 'Airing schedule', path: '/airing' },
    { label: 'Upcoming anime', path: '/upcoming' },
  ]);
  // In December the next season is next year's Winter.
  assert.equal(hubNavLinks(new Date('2026-12-15T00:00:00Z'))[1].path, '/seasons/winter-2027');
});
