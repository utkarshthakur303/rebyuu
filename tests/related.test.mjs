import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relatedPools, rankRelated, YEAR_WINDOW } from '../api/_related.js';
import { anime } from './helpers.mjs';

const target = anime(1, 'Target', { genres: ['Action', 'Fantasy', 'Drama'], year: 2020 });

test('a title with no genres has no pools, so no related section', () => {
  assert.deepEqual(relatedPools(anime(1, 'Bare', { genres: [], year: 2020 })), []);
});

test('a dated title searches its own era first, then any year', () => {
  assert.deepEqual(relatedPools(target), [
    { genres: target.genres, yearFrom: 2020 - YEAR_WINDOW, yearTo: 2020 + YEAR_WINDOW },
    { genres: target.genres },
  ]);
});

test('an undated title searches any year only', () => {
  assert.deepEqual(relatedPools({ ...target, year: null }), [{ genres: target.genres }]);
});

test('within a pool, more shared genres rank ahead of a higher rating', () => {
  const pool = [
    anime(2, 'One shared, top rated', { genres: ['Action'], rating: 9.5 }),
    anime(3, 'Three shared', { genres: ['Action', 'Fantasy', 'Drama'], rating: 7 }),
    anime(4, 'Two shared', { genres: ['Action', 'Drama'], rating: 8 }),
  ];

  assert.deepEqual(rankRelated(target, [pool]).map((a) => a.id), ['anilist-3', 'anilist-4', 'anilist-2']);
});

test('equal genre overlap falls back to rating, unrated last', () => {
  const pool = [
    anime(2, 'Unrated', { genres: ['Action'], rating: null }),
    anime(3, 'Low', { genres: ['Action'], rating: 6 }),
    anime(4, 'High', { genres: ['Action'], rating: 8 }),
  ];

  assert.deepEqual(rankRelated(target, [pool]).map((a) => a.id), ['anilist-4', 'anilist-3', 'anilist-2']);
});

test('the first pool fills first; later pools only top it up', () => {
  const era = [anime(2, 'Same era, weak match', { genres: ['Drama'], rating: 6 })];
  const anyYear = [anime(3, 'Classic, strong match', { genres: ['Action', 'Fantasy', 'Drama'], rating: 9 })];

  assert.deepEqual(rankRelated(target, [era, anyYear]).map((a) => a.id), ['anilist-2', 'anilist-3']);
});

test('the title itself, duplicates across pools and Hentai are never listed', () => {
  const era = [target, anime(2, 'Shared', { genres: ['Action'] })];
  const anyYear = [anime(2, 'Shared', { genres: ['Action'] }), anime(3, 'Adult', { genres: ['Action', 'Hentai'] })];

  assert.deepEqual(rankRelated(target, [era, anyYear]).map((a) => a.id), ['anilist-2']);
});

test('stops at the limit', () => {
  const pool = Array.from({ length: 20 }, (_, i) => anime(i + 2, `S${i}`, { genres: ['Action'] }));

  assert.equal(rankRelated(target, [pool], 8).length, 8);
});
