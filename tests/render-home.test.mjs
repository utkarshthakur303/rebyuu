import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubNavLinks } from '../api/_hubs.js';
import { loadHandler, installFetch, anime, page, render, rootOf, animeLinks, section } from './helpers.mjs';

const handler = await loadHandler();

// Twelve titles, ids 1–12, rated so the archive fallback order is predictable.
const catalogue = Array.from({ length: 12 }, (_, i) =>
  anime(i + 1, `Show ${i + 1}`, { rating: 5 + i / 4, year: 2020 + (i % 5) })
);

test('homepage links every title in the Trending rail, in AniList ranking order', async () => {
  installFetch({
    tables: { anime_index: catalogue, ratings: [] },
    anilist: { trending: page([3, 1, 2]), favourites: page([]), airing: page([]), upcoming: page([]) },
  });

  const res = await render(handler, 'route=home');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(animeLinks(section(rootOf(res.body), 'Trending')), ['anilist-3', 'anilist-1', 'anilist-2']);
});

test('homepage renders all four rails the React homepage shows', async () => {
  installFetch({
    tables: { anime_index: catalogue, ratings: [] },
    anilist: {
      trending: page([1, 2]),
      favourites: page([3, 4]),
      airing: page([5, 6]),
      upcoming: page([7, 8]),
    },
  });

  const root = rootOf((await render(handler, 'route=home')).body);

  assert.deepEqual(animeLinks(section(root, 'Trending')), ['anilist-1', 'anilist-2']);
  assert.deepEqual(animeLinks(section(root, 'Fan Favorites')), ['anilist-3', 'anilist-4']);
  assert.deepEqual(animeLinks(section(root, 'Airing Now')), ['anilist-5', 'anilist-6']);
  assert.deepEqual(animeLinks(section(root, 'Upcoming')), ['anilist-7', 'anilist-8']);
});

test('a rail stops at eight titles, matching the React rail size', async () => {
  installFetch({
    tables: { anime_index: catalogue, ratings: [] },
    anilist: { trending: page([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), favourites: page([]), airing: page([]), upcoming: page([]) },
  });

  const root = rootOf((await render(handler, 'route=home')).body);

  assert.equal(animeLinks(section(root, 'Trending')).length, 8);
});

test('ranked titles missing from anime_index are skipped rather than linked to a 404', async () => {
  installFetch({
    tables: { anime_index: catalogue, ratings: [] },
    anilist: { trending: page([999, 2, 998, 4]), favourites: page([]), airing: page([]), upcoming: page([]) },
  });

  const root = rootOf((await render(handler, 'route=home')).body);

  assert.deepEqual(animeLinks(section(root, 'Trending')), ['anilist-2', 'anilist-4']);
});

test('when AniList is down, Trending falls back to the archive ordered by stored rating', async () => {
  installFetch({ tables: { anime_index: catalogue, ratings: [] }, anilist: null });

  const root = rootOf((await render(handler, 'route=home')).body);

  // Highest stored rating first: ids 12, 11, 10 ...
  assert.deepEqual(animeLinks(section(root, 'Trending')).slice(0, 3), ['anilist-12', 'anilist-11', 'anilist-10']);
});

test('titles are HTML-escaped inside rail links', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'Tom & <Jerry>')], ratings: [] },
    anilist: { trending: page([1]), favourites: page([]), airing: page([]), upcoming: page([]) },
  });

  const root = rootOf((await render(handler, 'route=home')).body);

  assert.match(root, /Tom &amp; &lt;Jerry&gt;/);
  assert.doesNotMatch(root, /<Jerry>/);
});

test('a homepage URL carrying tracking parameters does not wait on AniList or Supabase', async () => {
  // Every fbclid/gclid/utm variant is its own edge-cache key, so each one is a
  // cache miss. They canonicalise to "/", so they get the page without rails.
  const calls = installFetch({
    tables: { anime_index: catalogue, ratings: [] },
    anilist: { trending: page([1]), favourites: page([]), airing: page([]), upcoming: page([]) },
  });

  const res = await render(handler, 'route=home&fbclid=IwAR0abc&utm_source=facebook');

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 0);
  assert.match(rootOf(res.body), /<h1[^>]*>Rebyuu<\/h1>/);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/www.rebyuu.app\/" \/>/);
});

test('with Supabase down the homepage still renders its heading and description', async () => {
  installFetch({ tables: null, anilist: null });

  const res = await render(handler, 'route=home');

  assert.equal(res.statusCode, 200);
  assert.match(rootOf(res.body), /<h1[^>]*>Rebyuu<\/h1>/);
  assert.deepEqual(animeLinks(rootOf(res.body)), []);
});

test('the homepage links this season, next season, airing, upcoming and top rated, after its rails', async () => {
  installFetch({ tables: { anime_index: [], ratings: [] }, anilist: null });

  const root = rootOf((await render(handler, 'route=home')).body);
  const links = hubNavLinks(new Date());

  assert.equal(links.length, 5);
  for (const { path, label } of links) assert.match(root, new RegExp(`<a href="${path}">${label}</a>`), path);
  assert.ok(root.indexOf('Seasons and charts') > root.lastIndexOf('Upcoming</h2>'));
});
