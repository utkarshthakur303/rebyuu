import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHandler, installFetch, anime, page, render, rootOf, animeLinks } from './helpers.mjs';
import { PAGES } from '../api/_pages.js';

const handler = await loadHandler();

const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/g);
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
const descriptionOf = (html) => html.match(/<meta name="description" content="([^"]*)"/)?.[1];
const unescape = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

for (const key of ['about', 'terms', 'privacy']) {
  test(`/${key} is served with its own title, description, canonical and heading`, async () => {
    installFetch();
    const meta = PAGES[key];

    const res = await render(handler, `route=${key}`);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(titleOf(res.body).map(unescape), [`<title>${meta.title}</title>`]);
    assert.equal(unescape(descriptionOf(res.body)), meta.description);
    assert.equal(canonicalOf(res.body), `https://www.rebyuu.app${meta.path}`);
    assert.match(unescape(rootOf(res.body)), new RegExp(`<h1[^>]*>${meta.heading}</h1>`));
    assert.match(unescape(rootOf(res.body)), new RegExp(meta.standfirst.slice(0, 40)));
  });
}

test('/browse is served with its own title and canonical', async () => {
  installFetch({ anilist: null });

  const res = await render(handler, 'route=browse');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(titleOf(res.body).map(unescape), [`<title>${PAGES.browse.title}</title>`]);
  assert.equal(canonicalOf(res.body), 'https://www.rebyuu.app/browse');
  assert.match(rootOf(res.body), new RegExp(`<h1[^>]*>${PAGES.browse.heading}</h1>`));
});

test('/browse links the first page of the default view: live trending, in order, known titles only', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'One'), anime(2, 'Two'), anime(3, 'Three')], ratings: [] },
    anilist: { browse: page([3, 999, 1]) },
  });

  const res = await render(handler, 'route=browse');

  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-3', 'anilist-1']);
});

test('a filtered /browse URL gets its head and heading without waiting on the live list', async () => {
  const calls = installFetch({
    tables: { anime_index: [anime(1, 'One')], ratings: [] },
    anilist: { browse: page([1]) },
  });

  const res = await render(handler, 'route=browse&genre=action&sort=score');

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 0);
  assert.deepEqual(titleOf(res.body).map(unescape), [`<title>${PAGES.browse.title}</title>`]);
  assert.equal(canonicalOf(res.body), 'https://www.rebyuu.app/browse');
});

test('/browse falls back to the archive ordered by stored rating when AniList is down', async () => {
  installFetch({
    tables: {
      anime_index: [anime(1, 'Low', { rating: 6 }), anime(2, 'High', { rating: 9 }), anime(3, 'Mid', { rating: 7 })],
      ratings: [],
    },
    anilist: null,
  });

  const res = await render(handler, 'route=browse');

  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-2', 'anilist-3', 'anilist-1']);
});

const bootOf = (html) => JSON.parse(html.match(/<script id="rebyuu-boot" type="application\/json">(.*?)<\/script>/s)?.[1] ?? 'null');

test('/browse hands its first page to React, synopses cut to fit a card', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'One', { description: 'y'.repeat(800) }), anime(3, 'Three')], ratings: [] },
    anilist: { browse: page([3, 999, 1]) },
  });

  const { list } = bootOf((await render(handler, 'route=browse')).body);

  assert.equal(list.path, '/browse');
  assert.deepEqual(list.items.map((item) => item.id), ['anilist-3', 'anilist-1']);
  assert.ok(list.items[1].description.length <= 301);
  assert.equal(list.live, true);
  assert.equal(list.hasMore, true);
});

test('a filtered /browse URL hands React nothing, since its grid is a different list', async () => {
  installFetch({ tables: { anime_index: [anime(1, 'One')], ratings: [] }, anilist: { browse: page([1]) } });

  assert.equal(bootOf((await render(handler, 'route=browse&genre=action')).body), null);
});

test('/browse links the season, airing and upcoming pages', async () => {
  installFetch({ tables: { anime_index: [], ratings: [] }, anilist: null });

  const root = rootOf((await render(handler, 'route=browse')).body);

  assert.match(root, /<a href="\/airing">Airing schedule<\/a>/);
  assert.match(root, /<a href="\/upcoming">Upcoming anime<\/a>/);
});

test('with AniList down, /browse lists the best rated titles, Hentai left out, and React fetches its own', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'Good', { rating: 8 }), anime(2, 'Adult', { rating: 9, genres: ['Hentai'] })], ratings: [] },
    anilist: null,
  });

  const res = await render(handler, 'route=browse');

  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-1']);
  assert.equal(bootOf(res.body), null);
});
