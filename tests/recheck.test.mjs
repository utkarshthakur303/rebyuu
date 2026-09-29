import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recheckBatches, RECHECK_BATCH } from '../scripts/recheck.mjs';

test('stored airing and upcoming rows this run did not fetch are rechecked by AniList id', () => {
  const stored = [{ id: 'anilist-1' }, { id: 'anilist-2' }, { id: 'anilist-3' }];

  assert.deepEqual(recheckBatches(stored, new Set(['anilist-2'])), [[1, 3]]);
});

test('nothing is rechecked when every stored row was fetched', () => {
  assert.deepEqual(recheckBatches([{ id: 'anilist-1' }], new Set(['anilist-1'])), []);
});

test('ids go in batches of one AniList page', () => {
  const stored = Array.from({ length: RECHECK_BATCH * 2 + 1 }, (_, i) => ({ id: `anilist-${i + 1}` }));

  const batches = recheckBatches(stored, new Set());

  assert.deepEqual(batches.map((b) => b.length), [RECHECK_BATCH, RECHECK_BATCH, 1]);
  assert.equal(batches[2][0], RECHECK_BATCH * 2 + 1);
});

test('an id that is not an AniList id is skipped, not sent', () => {
  const stored = [{ id: 'anilist-0' }, { id: 'mal-5' }, { id: 'anilist-7' }];

  assert.deepEqual(recheckBatches(stored, new Set()), [[7]]);
});
