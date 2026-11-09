import { test, mock } from 'node:test';
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

  const res = await render(handler, 'route=episode&ref=1-target-show&ep=3');

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<title>Target Show Episode 3 — Rating &amp; Discussion · Rebyuu<\/title>/);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/www.rebyuu.app\/anime\/1-target-show\/episode\/3" \/>/);
  assert.match(rootOf(res.body), /<h1[^>]*>Target Show — Episode 3<\/h1>/);
  assert.match(rootOf(res.body), /<a href="\/anime\/1-target-show">Target Show<\/a>/);
});

test('an episode page shares the poster but preloads nothing, since it shows no image', async () => {
  installFetch({ tables: tables() });

  const { body } = await render(handler, 'route=episode&ref=1-target-show&ep=3');

  assert.match(body, /<meta property="og:image" content="https:\/\/img.test\/1.jpg" \/>/);
  assert.doesNotMatch(body, /rel="preload" as="image"/);
});

test('an episode page is marked up as a TVEpisode of its series', async () => {
  installFetch({ tables: tables() });

  const [episode, crumbs] = ldOf((await render(handler, 'route=episode&ref=1-target-show&ep=3')).body);

  assert.equal(episode['@type'], 'TVEpisode');
  assert.equal(episode.episodeNumber, 3);
  assert.deepEqual(episode.partOfSeries, { '@type': 'TVSeries', '@id': 'https://www.rebyuu.app/anime/1-target-show#work', name: 'Target Show', url: 'https://www.rebyuu.app/anime/1-target-show' });
  assert.equal(crumbs.itemListElement.length, 4);
});

test('an episode with nothing on it is served noindex, and becomes indexable with a comment', async () => {
  installFetch({ tables: tables() });
  assert.equal(robotsOf((await render(handler, 'route=episode&ref=1-target-show&ep=3')).body), 'noindex, follow');

  installFetch({ tables: tables({ episode_comments: [{ id: 'c1', anime_id: 'anilist-1', episode_number: 3, user_id: 'u1', content: 'That ending!', created_at: '2026-09-01T10:00:00Z' }] }) });
  assert.equal(robotsOf((await render(handler, 'route=episode&ref=1-target-show&ep=3')).body), 'max-image-preview:large');
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

  const discussion = section(rootOf((await render(handler, 'route=episode&ref=1-target-show&ep=3')).body), 'Discussion');

  assert.match(discussion, /kaori[\s\S]*Best &lt;b&gt;episode&lt;\/b&gt; so far[\s\S]*arima[\s\S]*Agreed/);
});

test('the Rebyuu rating is shown and marked up once three people have rated the episode', async () => {
  const ratings = [7, 8, 10].map((rating, i) => ({ id: `r${i}`, anime_id: 'anilist-1', episode_number: 3, user_id: `u${i}`, rating }));
  installFetch({ tables: tables({ episode_ratings: ratings }) });

  const { body } = await render(handler, 'route=episode&ref=1-target-show&ep=3');

  assert.match(rootOf(body), /8\.3\/10 from 3 ratings/);
  assert.deepEqual(ldOf(body)[0].aggregateRating, { '@type': 'AggregateRating', ratingValue: 8.3, ratingCount: 3, bestRating: 10, worstRating: 1 });
});

test('the next scheduled episode says when it airs, and is indexable', async () => {
  installFetch({ tables: tables() });

  const { body } = await render(handler, 'route=episode&ref=2-airing-show&ep=5');

  assert.match(body, /<title>Airing Show Episode 5: Release Date, Time &amp; Countdown · Rebyuu<\/title>/);
  assert.match(rootOf(body), /comes out on <time datetime="2099-01-02T15:00:00.000Z">Friday 2 January 2099, 15:00 UTC<\/time>/);
  assert.equal(robotsOf(body), 'max-image-preview:large');
});

test('previous and next episodes are linked only where indexable', async () => {
  installFetch({ tables: tables() });

  const root = rootOf((await render(handler, 'route=episode&ref=2-airing-show&ep=4')).body);

  assert.match(root, /<a href="\/anime\/2-airing-show\/episode\/5"[^>]*>Episode 5 →<\/a>/);
  assert.doesNotMatch(root, /href="\/anime\/2-airing-show\/episode\/3"/, 'episode 3 is noindex, so no crawlable link');
});

test('episode numbers outside the show, and films, are real 404s', async () => {
  installFetch({ tables: tables() });

  for (const q of ['route=episode&ref=1-target-show&ep=13', 'route=episode&ref=1-target-show&ep=0', 'route=episode&ref=1-target-show&ep=x', 'route=episode&ref=3-a-film&ep=1', 'route=episode&ref=999&ep=1']) {
    assert.equal((await render(handler, q)).statusCode, 404, q);
  }
});

test('an episode URL in an older form redirects to the canonical one', async () => {
  installFetch({ tables: tables() });

  for (const q of ['route=episode&id=anilist-1&ep=3', 'route=episode&ref=1&ep=3', 'route=episode&ref=1-old&ep=3']) {
    const res = await render(handler, q);
    assert.equal(res.statusCode, 301, q);
    assert.equal(res.headers.location, 'https://www.rebyuu.app/anime/1-target-show/episode/3', q);
  }
});

test('the title page lists its indexable episodes as links, and only those', async () => {
  installFetch({
    tables: tables({ episode_comments: [{ id: 'c1', anime_id: 'anilist-2', episode_number: 2, user_id: 'u1', content: 'x', created_at: '2026-09-01T10:00:00Z' }] }),
  });

  const guide = section(rootOf((await render(handler, 'route=anime&ref=2-airing-show')).body), 'Airing Show episodes');

  assert.deepEqual([...guide.matchAll(/href="\/anime\/2-airing-show\/episode\/(\d+)"/g)].map((m) => Number(m[1])), [2, 4, 5]);
});

// ── Release dates from the airing schedule ─────────────────────────────
//
// The clock is set to 9 November 2026, 02:00 UTC: Overgeared episode 7 aired
// 11.5 hours earlier and the stored row still names it as next.

const weekly = (first, count, startIso) =>
  Array.from({ length: count }, (_, i) => ({ episode: first + i, at: new Date(Date.parse(startIso) + i * 7 * 86400000).toISOString() }));
const overgeared = anime(212888, 'Overgeared', {
  status: 'airing', episodes: 12, year: 2026, genres: ['Action'],
  next_episode: 7, next_episode_at: '2026-11-08T14:30:00+00:00',
  airing_schedule: weekly(1, 12, '2026-09-27T14:30:00Z'),
  streaming: [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/overgeared' }],
});
const blueBox = anime(189123, 'Blue Box Season 2', {
  status: 'airing', episodes: 12, year: 2026,
  airing_schedule: [...weekly(1, 4, '2026-10-04T07:30:00Z'), ...weekly(5, 8, '2026-11-08T07:30:00Z')],
});
const scheduled = (extra = {}) => tables({ anime_index: [series, airing, film, overgeared, blueBox], ...extra });

/** Runs `fn` with the clock at `iso`. */
const at = (iso, fn) => async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
  try { await fn(); } finally { mock.timers.reset(); }
};
const LATE = '2026-11-09T02:00:00Z';

test('an upcoming episode leads with its release date and time, even before the sync has caught up', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const { body } = await render(handler, 'route=episode&ref=212888-overgeared&ep=8');

  assert.match(body, /<title>Overgeared Episode 8: Release Date, Time &amp; Countdown · Rebyuu<\/title>/);
  assert.match(body, /<meta name="description" content="Overgeared episode 8 comes out on Sunday 15 November 2026, 14:30 UTC: 8:00 PM IST, 9:30 AM EST\./);
  assert.match(rootOf(body), /<h1[^>]*>Overgeared Episode 8: Release Date &amp; Time<\/h1>/);
  assert.match(rootOf(body), /Overgeared episode 8 comes out on <time datetime="2026-11-15T14:30:00.000Z">Sunday 15 November 2026, 14:30 UTC<\/time>\./);
  assert.equal(robotsOf(body), 'max-image-preview:large');
}));

test('the release time is given where readers are, India first', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const times = section(rootOf((await render(handler, 'route=episode&ref=212888-overgeared&ep=8')).body), 'Overgeared episode 8 release time around the world');

  assert.match(times, /<tr><td>India<\/td><td>Sun 15 Nov<\/td><td>8:00 PM IST<\/td><\/tr>\s*<tr><td>US East \(New York\)<\/td><td>Sun 15 Nov<\/td><td>9:30 AM EST<\/td><\/tr>/);
  assert.match(times, /<td>Japan<\/td><td>Sun 15 Nov<\/td><td>11:30 PM JST<\/td>/);
  assert.match(times, /first airs/, 'says what the time is the time of');
}));

test('a skipped week is said in the first line, and asked about', at('2026-11-02T00:00:00Z', async () => {
  installFetch({ tables: scheduled() });

  const root = rootOf((await render(handler, 'route=episode&ref=189123-blue-box-season-2&ep=5')).body);

  assert.match(root, /Blue Box Season 2 episode 5 comes out a week later than usual, on <time datetime="2026-11-08T07:30:00.000Z">Sunday 8 November 2026, 07:30 UTC<\/time>\./);
  assert.match(root, /Is Blue Box Season 2 episode 5 delayed\?/);
}));

test('an episode that aired last week says when it came out, links the next one, and stays indexable', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const { body } = await render(handler, 'route=episode&ref=212888-overgeared&ep=6');
  const root = rootOf(body);

  assert.match(body, /<title>Overgeared Episode 6: Release Date, Where to Watch &amp; Rating · Rebyuu<\/title>/);
  assert.match(root, /<h1[^>]*>Overgeared — Episode 6<\/h1>/);
  assert.match(root, /Overgeared episode 6 came out on <time datetime="2026-11-01T14:30:00.000Z">Sunday 1 November 2026, 14:30 UTC<\/time>\./);
  assert.match(root, /The next episode, <a href="\/anime\/212888-overgeared\/episode\/8">episode 8<\/a>, comes out on <time datetime="2026-11-15T14:30:00.000Z">Sunday 15 November 2026, 14:30 UTC<\/time>\./);
  assert.doesNotMatch(root, /release time around the world/, 'the world clock is for episodes still to come');
  assert.equal(robotsOf(body), 'max-image-preview:large');
  assert.equal(ldOf(body)[0].datePublished, '2026-11-01T14:30:00.000Z');
}));

test('an episode that aired more than three weeks ago, with nothing on it, goes back to noindex', at(LATE, async () => {
  installFetch({ tables: scheduled() });
  assert.equal(robotsOf((await render(handler, 'route=episode&ref=212888-overgeared&ep=4')).body), 'noindex, follow');
}));

test('an episode page says where to watch it', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const watch = section(rootOf((await render(handler, 'route=episode&ref=212888-overgeared&ep=8')).body), 'Where to watch Overgeared episode 8');

  assert.match(watch, /<a href="https:\/\/www.crunchyroll.com\/series\/overgeared" rel="noopener">Crunchyroll<\/a>/);
}));

test('the schedule around an episode links the episodes worth indexing, and not the page itself', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const list = section(rootOf((await render(handler, 'route=episode&ref=212888-overgeared&ep=6')).body), 'Overgeared release schedule');

  assert.deepEqual([...list.matchAll(/<li>/g)].length, 8, 'episodes 3 to 10');
  assert.deepEqual([...list.matchAll(/href="\/anime\/212888-overgeared\/episode\/(\d+)"/g)].map((m) => Number(m[1])), [5, 7, 8, 9]);
  assert.match(list, /Episode 7<\/a> · <time datetime="2026-11-08T14:30:00.000Z">Sunday 8 November 2026, 14:30 UTC<\/time> · out/);
  assert.doesNotMatch(list, /<ol[^>]*style="[^"]*"[^>]*style=/, 'one style attribute');
  assert.match(list, /Episode 10 · <time datetime="2026-11-29T14:30:00.000Z">Sunday 29 November 2026, 14:30 UTC<\/time><\/li>/);
}));

test('the questions people search an upcoming episode with are answered on its page', at(LATE, async () => {
  installFetch({ tables: scheduled() });

  const answers = section(rootOf((await render(handler, 'route=episode&ref=212888-overgeared&ep=8')).body), 'Overgeared episode 8: quick answers');

  assert.match(answers, /What time does Overgeared episode 8 come out in India\?<\/h3>\s*<p[^>]*>8:00 PM IST, on Sun 15 Nov\.<\/p>/);
}));

test("an airing show's episode pages are cached for 15 minutes, since the release status changes on the hour", at(LATE, async () => {
  installFetch({ tables: scheduled() });

  assert.equal((await render(handler, 'route=episode&ref=212888-overgeared&ep=8')).headers['cache-control'], 'public, s-maxage=900, stale-while-revalidate=3600');
  assert.equal((await render(handler, 'route=episode&ref=1-target-show&ep=3')).headers['cache-control'], 'public, s-maxage=3600, stale-while-revalidate=86400');
}));
