import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENRES, SEASONS, EXCLUDED_GENRES, seasonYearOf, seasonFromAniList, genreSlug, genreFromSlug } from '../api/_catalog.js';

test('the genre vocabulary is the 18 Browse genres, without the excluded ones', () => {
  assert.equal(GENRES.length, 18);
  assert.ok(GENRES.includes('Slice of Life'));
  for (const genre of EXCLUDED_GENRES) assert.ok(!GENRES.includes(genre), genre);
});

test('seasons are in calendar order', () => {
  assert.deepEqual(SEASONS, ['Winter', 'Spring', 'Summer', 'Fall']);
});

test("AniList's season enum maps to the stored season name", () => {
  assert.equal(seasonFromAniList('FALL'), 'Fall');
  assert.equal(seasonFromAniList('WINTER'), 'Winter');
  assert.equal(seasonFromAniList(null), null);
  assert.equal(seasonFromAniList('MONSOON'), null);
});

test("a title's season year is AniList's once synced, and its start year until then", () => {
  // A December 2023 premiere is Winter 2024 on AniList.
  assert.equal(seasonYearOf({ year: 2023, season_year: 2024 }), 2024);
  assert.equal(seasonYearOf({ year: 2023, season_year: null }), 2023);
  assert.equal(seasonYearOf({ year: 2023 }), 2023);
  assert.equal(seasonYearOf({ year: null }), null);
});

test('each genre has a URL slug, read back case-insensitively', () => {
  assert.equal(genreSlug('Slice of Life'), 'slice-of-life');
  assert.equal(genreSlug('Sci-Fi'), 'sci-fi');
  assert.equal(genreSlug('Mahou Shoujo'), 'mahou-shoujo');
  assert.equal(genreFromSlug('slice-of-life'), 'Slice of Life');
  assert.equal(genreFromSlug('Sci-Fi'), 'Sci-Fi');
  assert.equal(genreFromSlug('hentai'), null);
  assert.equal(genreFromSlug('isekai'), null);
  assert.equal(new Set(GENRES.map(genreSlug)).size, GENRES.length);
});
