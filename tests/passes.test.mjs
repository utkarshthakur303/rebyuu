import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonPasses } from '../scripts/passes.mjs';

test('the nightly sync fetches the current and the next season in full', () => {
  assert.deepEqual(seasonPasses(new Date('2026-09-29T12:00:00Z')), [
    { label: 'season Summer 2026', sort: 'POPULARITY_DESC', season: 'SUMMER', seasonYear: 2026, maxPages: 6 },
    { label: 'season Fall 2026', sort: 'POPULARITY_DESC', season: 'FALL', seasonYear: 2026, maxPages: 6 },
  ]);
});

test("in December the next season is next year's Winter", () => {
  const [, next] = seasonPasses(new Date('2026-12-20T00:00:00Z'));
  assert.equal(next.season, 'WINTER');
  assert.equal(next.seasonYear, 2027);
});
