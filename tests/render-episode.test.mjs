import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHandler, installFetch, anime, render, rootOf, section } from './helpers.mjs';

const handler = await loadHandler();

const series = anime(1, 'Target Show', { episodes: 12, year: 2020, genres: ['Action'], status: 'completed' });
const airing = anime(2, 'Airing Show', { episodes: 12, year: 2026, genres: ['Action'], status: 'airing', next_episode: 5, next_episode_at: '2099-01-02T15:00:00+00:00' });
const film = anime(3, 'A Film', { episodes: 1, format: 'MOVIE' });

const tables = (extra = {}) => ({
  anime_index: [series, airing, film],
  ratings: [],
  episode_ratings: [],
  episode_comments: [],
  users: [{ id: 'u1', username: 'kaori' }, { id: 'u2', username: 'arima' }],
  ...extra,
});

const ldOf = (body) =>
  JSON.parse(body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))['@graph'];
const robotsOf = (body) => body.match(/<meta name="robots" content="([^"]*)"/)?.[1];

test('an episode page has its own title, canonical, heading and a link back to the show', async () => {
  installFetch({ tables: tables() });

  const res = await render(handler, 'route=episode&id=anilist-1&ep=3');

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<title>Target Show Episode 3 — Rating &amp; Discussion · Rebyuu<\/title>/);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/www.rebyuu.app\/anime\/anilist-1\/episode\/3" \/>/);
  assert.match(rootOf(res.body), /<h1[^>]*>Target Show — Episode 3<\/h1>/);
  assert.match(rootOf(res.body), /<a href="\/anime\/anilist-1">Target Show<\/a>/);
});

test('an episode page is marked up as a TVEpisode of its series', async () => {
  installFetch({ tables: tables() });

  const [episode, crumbs] = ldOf((await render(handler, 'route=episode&id=anilist-1&ep=3')).body);

  assert.equal(episode['@type'], 'TVEpisode');
  assert.equal(episode.episodeNumber, 3);
  assert.deepEqual(episode.partOfSeries, { '@type': 'TVSeries', '@id': 'https://www.rebyuu.app/anime/anilist-1#work', name: 'Target Show', url: 'https://www.rebyuu.app/anime/anilist-1' });
  assert.equal(crumbs.itemListElement.length, 4);
});

test('an episode with nothing on it is served noindex, and becomes indexable with a comment', async () => {
  installFetch({ tables: tables() });
  assert.equal(robotsOf((await render(handler, 'route=episode&id=anilist-1&ep=3')).body), 'noindex, follow');

  installFetch({ tables: tables({ episode_comments: [{ id: 'c1', anime_id: 'anilist-1', episode_number: 3, user_id: 'u1', content: 'That ending!', created_at: '2026-09-01T10:00:00Z' }] }) });
  assert.equal(robotsOf((await render(handler, 'route=episode&id=anilist-1&ep=3')).body), 'max-image-preview:large');
});

test('comments are served with their author and escaped', async () => {
  installFetch({
    tables: tables({
      episode_comments: [
        { id: 'c1', anime_id: 'anilist-1', episode_number: 3, user_id: 'u1', content: 'Best <b>episode</b> so far', created_at: '2026-09-02T10:00:00Z' },
        { id: 'c2', anime_id: 'anilist-1', episode_number: 3, user_id: 'u2', content: 'Agreed', created_at: '2026-09-01T10:00:00Z' },
      ],
    }),
  });

  const discussion = section(rootOf((await render(handler, 'route=episode&id=anilist-1&ep=3')).body), 'Discussion');

  assert.match(discussion, /kaori[\s\S]*Best &lt;b&gt;episode&lt;\/b&gt; so far[\s\S]*arima[\s\S]*Agreed/);
});

test('the Rebyuu rating is shown and marked up once three people have rated the episode', async () => {
  const ratings = [7, 8, 10].map((rating, i) => ({ id: `r${i}`, anime_id: 'anilist-1', episode_number: 3, user_id: `u${i}`, rating }));
  installFetch({ tables: tables({ episode_ratings: ratings }) });

  const { body } = await render(handler, 'route=episode&id=anilist-1&ep=3');

  assert.match(rootOf(body), /8\.3\/10 from 3 ratings/);
  assert.deepEqual(ldOf(body)[0].aggregateRating, { '@type': 'AggregateRating', ratingValue: 8.3, ratingCount: 3, bestRating: 10, worstRating: 1 });
});

test('the next scheduled episode says when it airs, and is indexable', async () => {
  installFetch({ tables: tables() });

  const { body } = await render(handler, 'route=episode&id=anilist-2&ep=5');

  assert.match(body, /<title>Airing Show Episode 5: Release Date &amp; Time · Rebyuu<\/title>/);
  assert.match(rootOf(body), /airs on <time datetime="2099-01-02T15:00:00.000Z">Friday 2 January 2099, 15:00 UTC<\/time>/);
  assert.equal(robotsOf(body), 'max-image-preview:large');
});

test('previous and next episodes are linked only where indexable', async () => {
  installFetch({ tables: tables() });

  const root = rootOf((await render(handler, 'route=episode&id=anilist-2&ep=4')).body);

  assert.match(root, /<a href="\/anime\/anilist-2\/episode\/5"[^>]*>Episode 5 →<\/a>/);
  assert.doesNotMatch(root, /href="\/anime\/anilist-2\/episode\/3"/, 'episode 3 is noindex, so no crawlable link');
});

test('episode numbers outside the show, and films, are real 404s', async () => {
  installFetch({ tables: tables() });

  for (const q of ['route=episode&id=anilist-1&ep=13', 'route=episode&id=anilist-1&ep=0', 'route=episode&id=anilist-1&ep=x', 'route=episode&id=anilist-3&ep=1', 'route=episode&id=anilist-999&ep=1']) {
    assert.equal((await render(handler, q)).statusCode, 404, q);
  }
});

test('the title page lists its indexable episodes as links, and only those', async () => {
  installFetch({
    tables: tables({ episode_comments: [{ id: 'c1', anime_id: 'anilist-2', episode_number: 2, user_id: 'u1', content: 'x', created_at: '2026-09-01T10:00:00Z' }] }),
  });

  const guide = section(rootOf((await render(handler, 'route=anime&id=anilist-2')).body), 'Airing Show episodes');

  assert.deepEqual([...guide.matchAll(/href="\/anime\/anilist-2\/episode\/(\d+)"/g)].map((m) => Number(m[1])), [2, 4, 5]);
});
