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
