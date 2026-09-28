import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { changedIds, planWrite, submitToIndexNow, INDEXNOW_KEY } from '../scripts/indexNow.mjs';
import { anime } from './helpers.mjs';

const stored = anime(1, 'Show', { rating: 8.5, genres: ['Action', 'Drama'], year: 2024, status: 'airing', episodes: 12 });

test('a title not yet in the table counts as changed', () => {
  assert.deepEqual(changedIds([], [anime(2, 'New')]), ['anilist-2']);
});

test('a title whose synced fields are identical does not', () => {
  assert.deepEqual(changedIds([stored], [{ ...stored, genres: [...stored.genres] }]), []);
});

test('a rating, status or episode change counts as changed', () => {
  for (const patch of [{ rating: 8.6 }, { status: 'completed' }, { episodes: 13 }]) {
    assert.deepEqual(changedIds([stored], [{ ...stored, ...patch }]), ['anilist-1'], JSON.stringify(patch));
  }
});

test('a numeric rating read back as a string is not a change', () => {
  // numeric columns can round-trip as strings depending on the client.
  assert.deepEqual(changedIds([{ ...stored, rating: '8.5' }], [stored]), []);
});

test('columns the sync does not write are ignored', () => {
  assert.deepEqual(changedIds([{ ...stored, updated_at: 'yesterday' }], [stored]), []);
});

test('only new or changed rows are written, stamped with when they changed', () => {
  // Every UPDATE bumps updated_at, which the sitemap publishes as lastmod —
  // so rewriting an unchanged row would claim a change that never happened.
  const now = new Date('2026-09-28T03:20:00Z');
  const incoming = [{ ...stored }, { ...stored, id: 'anilist-2', rating: 9 }, anime(3, 'New')];
  const existing = [stored, { ...stored, id: 'anilist-2', rating: 8 }];

  const { write, changed } = planWrite(existing, incoming, { now });

  assert.deepEqual(changed, ['anilist-2', 'anilist-3']);
  assert.deepEqual(write.map((r) => r.id), ['anilist-2', 'anilist-3']);
  assert.ok(write.every((r) => r.updated_at === now.toISOString()));
});

test('when the stored rows could not be read, every row is written and none reported', () => {
  const incoming = [stored, anime(3, 'New')];

  const { write, changed } = planWrite(null, incoming);

  assert.deepEqual(write, incoming);
  assert.deepEqual(changed, []);
});

test('the key file served from public/ holds the key being submitted', () => {
  const served = readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), 'utf8').trim();
  assert.equal(served, INDEXNOW_KEY);
});

function recorder(status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), method: init.method });
    return new Response(null, { status });
  };
  return { calls, fetchImpl };
}

test('changed titles are submitted as their page URLs with the site key', async () => {
  const { calls, fetchImpl } = recorder();

  await submitToIndexNow(['anilist-1', 'anilist-2'], { fetchImpl, log: () => {} });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.indexnow.org/indexnow');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, {
    host: 'www.rebyuu.app',
    key: INDEXNOW_KEY,
    keyLocation: `https://www.rebyuu.app/${INDEXNOW_KEY}.txt`,
    urlList: ['https://www.rebyuu.app/anime/anilist-1', 'https://www.rebyuu.app/anime/anilist-2'],
  });
});

test('nothing is sent when nothing changed', async () => {
  const { calls, fetchImpl } = recorder();

  await submitToIndexNow([], { fetchImpl, log: () => {} });

  assert.equal(calls.length, 0);
});

test('more than 10,000 URLs are split across requests', async () => {
  const { calls, fetchImpl } = recorder();
  const ids = Array.from({ length: 10_001 }, (_, i) => `anilist-${i + 1}`);

  await submitToIndexNow(ids, { fetchImpl, log: () => {} });

  assert.deepEqual(calls.map((c) => c.body.urlList.length), [10_000, 1]);
});

test('a rejected or failed submission is logged, never thrown', async () => {
  const lines = [];
  const failing = async () => { throw new Error('network down'); };

  await submitToIndexNow(['anilist-1'], { fetchImpl: recorder(403).fetchImpl, log: (l) => lines.push(l) });
  await submitToIndexNow(['anilist-1'], { fetchImpl: failing, log: (l) => lines.push(l) });

  assert.equal(lines.length, 2);
  assert.match(lines[0], /403/);
  assert.match(lines[1], /network down/);
});
