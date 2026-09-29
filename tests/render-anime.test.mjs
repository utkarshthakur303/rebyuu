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

  const res = await render(handler, 'route=anime&ref=1-target-show');

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

  const res = await render(handler, 'route=anime&ref=1-target-show');

  assert.deepEqual(
    animeLinks(section(rootOf(res.body), 'More like this')),
    ['anilist-10', 'anilist-11', 'anilist-2', 'anilist-3', 'anilist-4', 'anilist-5', 'anilist-6', 'anilist-7']
  );
});

test('a title with no genres renders no "More like this" section', async () => {
  installFetch({
    tables: { anime_index: [anime(1, 'Bare', { genres: [] }), anime(2, 'Other', { genres: ['Action'] })], ratings: [] },
  });

  const res = await render(handler, 'route=anime&ref=1-bare');

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(rootOf(res.body), /More like this/);
});

test('a title page is served with the data-built title tag and description', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.match(body, /<title>Target Show \(2020\) — Reviews &amp; Ratings · Rebyuu<\/title>/);
  assert.match(body, /<meta name="description" content="Target Show is a 2020 action and fantasy anime series with 12 episodes\. Rated 8.0\/10 by AniList users\." \/>/);
});

test('the stored score is labelled as AniList\'s, which is where the sync reads it from', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const root = rootOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  assert.match(root, /AniList score: <\/dt><dd[^>]*>8.0\/10/);
  assert.doesNotMatch(root, /MyAnimeList score/);
});

test('a title page shows the other names it goes by, and marks them up as alternateName', async () => {
  const named = { ...target, title_romaji: 'Taagetto Shou', title_native: 'ターゲット・ショー', synonyms: ['The Target'] };
  installFetch({ tables: { anime_index: [named], ratings: [] } });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.match(rootOf(body), /Also known as <span>Taagetto Shou<\/span> · <span lang="ja">ターゲット・ショー<\/span> · <span>The Target<\/span>/);
  const ld = JSON.parse(body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
  assert.deepEqual(ld['@graph'][0].alternateName, ['Taagetto Shou', 'ターゲット・ショー', 'The Target']);
});

test('before the migration, a title page renders without the name line', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.doesNotMatch(body, /Also known as/);
  assert.doesNotMatch(body, /alternateName/);
});

const ldOf = (body) =>
  JSON.parse(body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))['@graph'][0];

const detailed = {
  ...target,
  format: 'TV',
  source: 'MANGA',
  duration: 24,
  studios: ['MADHOUSE'],
  mal_id: 5114,
  season: 'Fall',
  streaming: [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/x' }, { site: 'Netflix', url: 'https://www.netflix.com/title/1' }],
  relations: [
    { id: 'anilist-2', relation: 'SEQUEL', title: 'Target Show Season 2', year: 2022, format: 'TV' },
    { id: 'anilist-777', relation: 'SIDE_STORY', title: 'Target Show Special', year: 2021, format: 'SPECIAL' },
  ],
};
const sequelRow = anime(2, 'Target Show Season 2', { genres: ['Action'], year: 2022 });

test('a title page lists the services it streams on, linked', async () => {
  installFetch({ tables: { anime_index: [detailed], ratings: [] } });

  const root = rootOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  const where = section(root, 'Where to watch Target Show');
  assert.match(where, /<a href="https:\/\/www.crunchyroll.com\/series\/x" rel="noopener">Crunchyroll<\/a>/);
  assert.match(where, /<a href="https:\/\/www.netflix.com\/title\/1" rel="noopener">Netflix<\/a>/);
});

test('extra facts appear in the fact list', async () => {
  installFetch({ tables: { anime_index: [detailed], ratings: [] } });

  const root = rootOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  for (const [label, value] of [['Format', 'TV series'], ['Season', 'Fall 2020'], ['Studio', 'MADHOUSE'], ['Source', 'Manga'], ['Episode length', '24 min']]) {
    assert.match(root, new RegExp(`${label}: </dt><dd[^>]*>${value}</dd>`), label);
  }
});

test('an airing title shows when its next episode airs, in UTC', async () => {
  const airing = { ...detailed, status: 'airing', next_episode: 5, next_episode_at: '2099-01-02T15:00:00+00:00' };
  installFetch({ tables: { anime_index: [airing], ratings: [] } });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.match(rootOf(body), /When is the next episode of Target Show\?<\/h2>\s*<p[^>]*>Episode 5 airs on <time datetime="2099-01-02T15:00:00.000Z">Friday 2 January 2099, 15:00 UTC<\/time>\.<\/p>/);
  assert.match(body, /<title>Target Show \(2020\) — Next Episode, Reviews &amp; Where to Watch · Rebyuu<\/title>/);
});

test('a next-episode date already in the past is not shown', async () => {
  const stale = { ...detailed, status: 'airing', next_episode: 5, next_episode_at: '2020-01-01T00:00:00+00:00' };
  installFetch({ tables: { anime_index: [stale], ratings: [] } });

  assert.doesNotMatch(rootOf((await render(handler, 'route=anime&ref=1-target-show')).body), /next episode/i);
});

test('seasons and related anime: linked when in the catalogue, named when not', async () => {
  installFetch({ tables: { anime_index: [detailed, sequelRow], ratings: [] } });

  const related = section(rootOf((await render(handler, 'route=anime&ref=1-target-show')).body), 'Target Show seasons and related anime');

  assert.match(related, /Sequel: <\/dt><dd[^>]*><a href="\/anime\/2-target-show-season-2">Target Show Season 2<\/a> \(2022\)<\/dd>/);
  assert.match(related, /Side story: <\/dt><dd[^>]*>Target Show Special \(2021\)<\/dd>/);
});

test('quick answers are served as questions and answers', async () => {
  installFetch({ tables: { anime_index: [detailed, sequelRow], ratings: [] } });

  const answers = section(rootOf((await render(handler, 'route=anime&ref=1-target-show')).body), 'Target Show: quick answers');

  assert.match(answers, /<h3[^>]*>How many episodes does Target Show have\?<\/h3>\s*<p[^>]*>Target Show has 12 episodes, each about 24 minutes long\.<\/p>/);
  assert.match(answers, /<h3[^>]*>Who made Target Show\?<\/h3>\s*<p[^>]*>Target Show was animated by MADHOUSE, adapted from the manga\.<\/p>/);
});

test('structured data names the studio and the same title on AniList and MyAnimeList', async () => {
  installFetch({ tables: { anime_index: [detailed], ratings: [] } });

  const work = ldOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  assert.equal(work['@type'], 'TVSeries');
  assert.deepEqual(work.productionCompany, [{ '@type': 'Organization', name: 'MADHOUSE' }]);
  assert.deepEqual(work.sameAs, ['https://anilist.co/anime/1', 'https://myanimelist.net/anime/5114']);
});

test('a film is marked up as a Movie, with its running time', async () => {
  const film = { ...detailed, format: 'MOVIE', episodes: 1, duration: 106 };
  installFetch({ tables: { anime_index: [film], ratings: [] } });

  const work = ldOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  assert.equal(work['@type'], 'Movie');
  assert.equal(work.duration, 'PT106M');
  assert.equal(work.numberOfEpisodes, undefined);
});

test('before the migration none of the detail sections render, and sameAs still names AniList', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.doesNotMatch(rootOf(body), /Where to watch|seasons and related|next episode/);
  assert.deepEqual(ldOf(body).sameAs, ['https://anilist.co/anime/1']);
});

const reviewTables = (extra = {}) => ({
  anime_index: [target],
  ratings: [
    { anime_id: 'anilist-1', user_id: 'u1', rating: 9 },
    { anime_id: 'anilist-1', user_id: 'u3', rating: 4 },
  ],
  comments: [
    { id: 'c1', anime_id: 'anilist-1', user_id: 'u1', content: 'A <i>masterpiece</i> of pacing.', created_at: '2026-09-20T10:00:00Z' },
    { id: 'c2', anime_id: 'anilist-1', user_id: 'u2', content: 'Slow start, great finish.', created_at: '2026-09-25T10:00:00Z' },
  ],
  users: [{ id: 'u1', username: 'kaori' }, { id: 'u2', username: 'arima' }],
  ...extra,
});

test('a title page serves its Rebyuu reviews, newest first, with each reviewer\'s score', async () => {
  installFetch({ tables: reviewTables() });

  const reviews = section(rootOf((await render(handler, 'route=anime&ref=1-target-show')).body), 'Target Show reviews');

  assert.match(reviews, /arima[\s\S]*Slow start, great finish\.[\s\S]*kaori[\s\S]*9\/10[\s\S]*A &lt;i&gt;masterpiece&lt;\/i&gt; of pacing\./);
});

test('reviews are marked up as Review, rated where the reviewer rated', async () => {
  installFetch({ tables: reviewTables() });

  const work = ldOf((await render(handler, 'route=anime&ref=1-target-show')).body);

  assert.deepEqual(work.review, [
    { '@type': 'Review', author: { '@type': 'Person', name: 'arima' }, datePublished: '2026-09-25', reviewBody: 'Slow start, great finish.' },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'kaori' },
      datePublished: '2026-09-20',
      reviewBody: 'A <i>masterpiece</i> of pacing.',
      reviewRating: { '@type': 'Rating', ratingValue: 9, bestRating: 10, worstRating: 1 },
    },
  ]);
});

test('a title with no reviews has no review section or markup', async () => {
  installFetch({ tables: reviewTables({ comments: [] }) });

  const { body } = await render(handler, 'route=anime&ref=1-target-show');

  assert.doesNotMatch(rootOf(body), /Target Show reviews/);
  assert.equal(ldOf(body).review, undefined);
});

test('every older or shorter form of a title URL is a permanent redirect to the canonical one', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  for (const q of ['route=anime&id=anilist-1', 'route=anime&ref=1', 'route=anime&ref=1-old-name', 'route=anime&ref=1-Target-Show']) {
    const res = await render(handler, q);
    assert.equal(res.statusCode, 301, q);
    assert.equal(res.headers.location, 'https://www.rebyuu.app/anime/1-target-show', q);
  }
});

test('the canonical title URL is served, not redirected', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const res = await render(handler, 'route=anime&ref=1-target-show');

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/www.rebyuu.app\/anime\/1-target-show" \/>/);
});

test('a path segment that is not a title reference is a 404', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  assert.equal((await render(handler, 'route=anime&ref=target-show')).statusCode, 404);
});

test('an unknown title id is still a real 404', async () => {
  installFetch({ tables: { anime_index: [target], ratings: [] } });

  const res = await render(handler, 'route=anime&ref=999');

  assert.equal(res.statusCode, 404);
});
