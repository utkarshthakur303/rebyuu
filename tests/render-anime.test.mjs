import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHandler, installFetch, anime, render, rootOf, animeLinks, section } from './helpers.mjs';

const handler = await loadHandler();

const target = anime(1, 'Target Show', { genres: ['Action', 'Fantasy'], year: 2020, rating: 8 });

test('a title page links related titles under "More like this", same era first', async () => {
  installFetch({
    tables: {
      anime_index: [
        target,
        anime(2, 'Same era', { genres: ['Action'], year: 2021, rating: 7 }),
        anime(3, 'Old classic', { genres: ['Action', 'Fantasy'], year: 1998, rating: 9 }),
        anime(4, 'Unrelated', { genres: ['Romance'], year: 2020, rating: 9 }),
      ],
      ratings: [],
    },
  });

  const res = await render(handler, 'route=anime&id=anilist-1');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(animeLinks(section(rootOf(res.body), 'More like this')), ['anilist-2', 'anilist-3']);
});

test('equally rated candidates are ordered by id, so server and browser pick the same set', async () => {
  // Ten same-era titles tied on rating, fixture order scrambled. Without a
  // tiebreaker the database may return ties in any order, and the eight the
  // served HTML links could differ from the eight cards React then shows.
  const tied = [9, 3, 11, 5, 2, 10, 7, 4, 8, 6].map((n) =>
    anime(n, `Tied ${n}`, { genres: ['Action'], year: 2020, rating: 7 })
  );
  installFetch({ tables: { anime_index: [target, ...tied], ratings: [] } });

  const res = await render(handler, 'route=anime&id=anilist-1');

  assert.deepEqual(
    animeLinks(section(rootOf(res.body), 'More like this')),
    ['anilist-10', 'anilist-11', 'anilist-2', 'anilist-3', 'anilist-4', 'anilist-5', 'anilist-6', 'anilist-7']
  );
});

test('a title with no genres renders no "More like this" section', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'Bare', { genres: [] }), anime(2, 'Other', { genres: ['Action'] })], ratings: [] },
  });

  const res = await render(handler, 'route=anime&id=anilist-1');

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(rootOf(res.body), /More like this/);
});

test('a title page is served with the data-built title tag and description', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const { body } = await render(handler, 'route=anime&id=anilist-1');

  assert.match(body, /<title>Target Show \(2020\) — Reviews &amp; Ratings · Rebyuu<\/title>/);
  assert.match(body, /<meta name="description" content="Target Show is a 2020 action and fantasy anime series with 12 episodes\. Rated 8.0\/10 by AniList users\." \/>/);
});

test('the stored score is labelled as AniList\'s, which is where the sync reads it from', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const root = rootOf((await render(handler, 'route=anime&id=anilist-1')).body);

  assert.match(root, /AniList score: <\/dt><dd[^>]*>8.0\/10/);
  assert.doesNotMatch(root, /MyAnimeList score/);
});

test('an unknown title id is still a real 404', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const res = await render(handler, 'route=anime&id=anilist-999');

  assert.equal(res.statusCode, 404);
});
