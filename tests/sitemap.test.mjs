import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFetch, anime } from './helpers.mjs';

const { default: sitemap, URLS_PER_SITEMAP } = await import('../api/sitemap.js');

const YEAR = new Date().getUTCFullYear();
const LONG = 'x'.repeat(130);

async function get(query) {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
  };
  await sitemap({ url: `/api/sitemap?${query}` }, res);
  return res;
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const ids = (xml) => locs(xml).map((l) => l.match(/\/anime\/(?:anilist-)?(\d+)/)?.[1]).filter(Boolean).map((n) => `anilist-${n}`);

const row = (id, extra) => anime(id, `Show ${id}`, { description: LONG, updated_at: '2026-09-01T10:00:00+00:00', ...extra });

test('rated, described, released titles are listed', async () => {
  installFetch({ tables: { anime_index: [row(1, { rating: 6, status: 'completed' }), row(2, { rating: 8.1, status: 'airing' })] } });

  const res = await get('kind=anime&page=1');

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /xml/);
  assert.deepEqual(ids(res.body), ['anilist-1', 'anilist-2']);
});

test('titles rated below 6 or with a synopsis under 130 characters are left out', async () => {
  installFetch({
    tables: {
      anime_index: [
        row(1, { rating: 5.9, status: 'completed' }),
        row(2, { rating: 9, status: 'completed', description: 'x'.repeat(129) }),
        row(3, { rating: 9, status: 'completed', description: null }),
        row(4, { rating: 7, status: 'completed' }),
      ],
    },
  });

  assert.deepEqual(ids((await get('kind=anime&page=1')).body), ['anilist-4']);
});

test('a show still airing is listed before it has a rating', async () => {
  installFetch({ tables: { anime_index: [row(1, { rating: null, status: 'airing' })] } });

  assert.deepEqual(ids((await get('kind=anime&page=1')).body), ['anilist-1']);
});

test('announced shows are listed for this year or later, not stale announcements', async () => {
  installFetch({
    tables: {
      anime_index: [
        row(1, { status: 'upcoming', year: YEAR }),
        row(2, { status: 'upcoming', year: YEAR + 1 }),
        row(3, { status: 'upcoming', year: YEAR - 3 }),
        row(4, { status: 'upcoming', year: null }),
      ],
    },
  });

  assert.deepEqual(ids((await get('kind=anime&page=1')).body), ['anilist-1', 'anilist-2']);
});

test('lastmod is the date the row last changed', async () => {
  installFetch({ tables: { anime_index: [row(1, { rating: 7, updated_at: '2026-09-27T23:10:00+00:00' })] } });

  assert.match((await get('kind=anime&page=1')).body, /<lastmod>2026-09-27<\/lastmod>/);
});

test('the index lists the static sitemap and one anime sitemap per URLS_PER_SITEMAP titles', async () => {
  const many = Array.from({ length: URLS_PER_SITEMAP + 1 }, (_, i) => row(i + 1, { rating: 7 }));
  installFetch({ tables: { anime_index: many } });

  const index = await get('kind=index');

  assert.equal(index.statusCode, 200);
  assert.deepEqual(locs(index.body), [
    'https://www.rebyuu.app/sitemap-static.xml',
    'https://www.rebyuu.app/sitemap-episodes.xml',
    'https://www.rebyuu.app/sitemap-anime-1.xml',
    'https://www.rebyuu.app/sitemap-anime-2.xml',
  ]);

  // Together the two pages list every title exactly once.
  const first = ids((await get('kind=anime&page=1')).body);
  const second = ids((await get('kind=anime&page=2')).body);
  assert.equal(first.length, URLS_PER_SITEMAP);
  assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second]).size, many.length);
});

test('a page past the end is a 404', async () => {
  installFetch({ tables: { anime_index: [row(1, { rating: 7 })] } });

  assert.equal((await get('kind=anime&page=2')).statusCode, 404);
  assert.equal((await get('kind=anime&page=0')).statusCode, 404);
  assert.equal((await get('kind=anime&page=abc')).statusCode, 404);
});

test('a database outage is a 503, never an empty sitemap', async () => {
  // An empty 200 would tell search engines every title page was withdrawn.
  installFetch({ tables: null });

  assert.equal((await get('kind=index')).statusCode, 503);
  assert.equal((await get('kind=anime&page=1')).statusCode, 503);
});

// ── episodes ──────────────────────────────────────────────────────────

const episodeLocs = (xml) => locs(xml).map((l) => l.replace('https://www.rebyuu.app', ''));

const epTables = (extra = {}) => ({
  anime_index: [
    row(1, { episodes: 12, status: 'completed' }),
    row(2, { episodes: 12, status: 'airing', next_episode: 5, next_episode_at: '2099-01-01T00:00:00+00:00' }),
    row(3, { episodes: 1, status: 'completed' }),
  ],
  episode_comments: [
    { anime_id: 'anilist-1', episode_number: 3 },
    { anime_id: 'anilist-1', episode_number: 40 },
    { anime_id: 'anilist-3', episode_number: 1 },
  ],
  episode_ratings: [
    ...[1, 2, 3].map(() => ({ anime_id: 'anilist-1', episode_number: 7 })),
    ...[1, 2].map(() => ({ anime_id: 'anilist-1', episode_number: 8 })),
  ],
  ...extra,
});

test('the episode sitemap lists discussed or rated episodes, and airing shows\' latest and next', async () => {
  installFetch({ tables: epTables() });

  const res = await get('kind=episodes');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(episodeLocs(res.body).sort(), [
    '/anime/anilist-1/episode/3',
    '/anime/anilist-1/episode/7',
    '/anime/anilist-2/episode/4',
    '/anime/anilist-2/episode/5',
  ]);
});

test('before the migration, the episode sitemap still lists discussed episodes', async () => {
  installFetch({ tables: epTables(), missingColumns: ['next_episode', 'next_episode_at'] });

  const res = await get('kind=episodes');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(episodeLocs(res.body).sort(), ['/anime/anilist-1/episode/3', '/anime/anilist-1/episode/7']);
});
