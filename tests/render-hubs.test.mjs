import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFetch, loadHandler, render, rootOf, animeLinks, anime } from './helpers.mjs';

const handler = await loadHandler();

const LONG = 'x'.repeat(130);
const YEAR = new Date().getUTCFullYear();
/** A quality title of Fall 2015: a real synopsis and a score. */
const fall2015 = (id, extra) => anime(id, `Show ${id}`, { season: 'Fall', year: 2015, description: LONG, rating: 7, status: 'completed', ...extra });
const many = (count, extra) => Array.from({ length: count }, (_, i) => fall2015(i + 1, extra));

/** An AniList Page of ids; `more` is its hasNextPage. */
const media = (ids, more = false) => ({ pageInfo: { hasNextPage: more }, media: ids.map((id) => (typeof id === 'object' ? id : { id })) });
const noPage = media([]);
/** Answers a season query: list pages p1–p3, and whether the neighbours have shows. */
const seasonAnswer = (ids, { prev = [], next = [], more = false } = {}) => ({ p1: media(ids.slice(0, 50), more), p2: media(ids.slice(50, 100)), p3: media(ids.slice(100, 150)), prev: media(prev), next: media(next) });
/** AniList stand-in: `list` answers hub queries, `schedule` the airing schedule. */
const aniList = ({ list = {}, schedule = {} } = {}) => (body) => (body.query.includes('airingSchedules') ? schedule : list);

const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
const robotsOf = (html) => html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
const bootOf = (html) => JSON.parse(html.match(/<script id="rebyuu-boot" type="application\/json">(.*?)<\/script>/s)?.[1] ?? 'null');

const season = (key, extra = '') => render(handler, `route=hub&hub=season&key=${key}${extra}`);

test('a season page lists the season in AniList order, known titles only, under its own head', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([3, 999, 1, 2]) }) });

  const res = await season('fall-2015');

  assert.equal(res.statusCode, 200);
  assert.equal(titleOf(res.body), 'Fall 2015 Anime: Every Show of the Season · Rebyuu');
  assert.equal(canonicalOf(res.body), 'https://www.rebyuu.app/seasons/fall-2015');
  assert.match(rootOf(res.body), /<h1[^>]*>Fall 2015 Anime<\/h1>/);
  assert.match(rootOf(res.body), /The Fall 2015 anime season started in October 2015\. Its most popular shows are Show 3, Show 1 and Show 2\./);
  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-3', 'anilist-1', 'anilist-2']);
  const list = ldOf(res.body).find((node) => node['@type'] === 'ItemList');
  assert.deepEqual(list.itemListElement.map((i) => [i.position, i.url]), [
    [1, 'https://www.rebyuu.app/anime/3-show-3'],
    [2, 'https://www.rebyuu.app/anime/1-show-1'],
    [3, 'https://www.rebyuu.app/anime/2-show-2'],
  ]);
  assert.match(res.headers['cache-control'], /s-maxage=3600/);
});

test('a season with 12 quality titles is indexed; with fewer it is served noindex', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([1]) }) });
  assert.equal(robotsOf((await season('fall-2015')).body), 'max-image-preview:large');

  installFetch({ tables: { anime_index: many(11) }, anilist: aniList({ list: seasonAnswer([1]) }) });
  const thin = await season('fall-2015');
  assert.equal(thin.statusCode, 200);
  assert.equal(robotsOf(thin.body), 'noindex, follow');
});

test('December premieres count toward the season AniList files them under', async () => {
  const december = Array.from({ length: 12 }, (_, i) => anime(i + 1, `Show ${i + 1}`, { season: 'Winter', year: 2015, season_year: 2016, description: LONG, rating: 7 }));
  installFetch({ tables: { anime_index: december }, anilist: aniList({ list: seasonAnswer([1]) }) });

  const filed = await season('winter-2016');
  assert.equal(canonicalOf(filed.body), 'https://www.rebyuu.app/seasons/winter-2016');
  assert.equal(robotsOf(filed.body), 'max-image-preview:large');
  // The start year's Winter does not count them.
  assert.equal(robotsOf((await season('winter-2015')).body), 'noindex, follow');
});

test('the neighbouring seasons are linked only when they have shows', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([1], { prev: [7] }) }) });

  const root = rootOf((await season('fall-2015')).body);

  assert.match(root, /More seasons: <a href="\/seasons\/summer-2015">Summer 2015<\/a>/);
  assert.doesNotMatch(root, /winter-2016/);
});

test('the first page is handed to React, synopses cut to fit a card', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => fall2015(i + 1, { description: 'y'.repeat(800) }));
  installFetch({ tables: { anime_index: rows }, anilist: aniList({ list: seasonAnswer(rows.map((_, i) => i + 1), { more: true }) }) });

  const res = await season('fall-2015');
  const { list } = bootOf(res.body);

  assert.equal(animeLinks(rootOf(res.body)).length, 60);
  assert.equal(list.path, '/seasons/fall-2015');
  assert.equal(list.items.length, 50);
  assert.equal(list.items[0].id, 'anilist-1');
  assert.ok(list.items[0].description.length <= 301);
  assert.equal(list.hasMore, true);
  assert.equal(list.live, true);
  assert.equal(list.indexable, true);
  assert.deepEqual(list.links, []);
});

test('with AniList down, the season comes from the catalogue, best rated first', async () => {
  installFetch({
    tables: { anime_index: [fall2015(1, { rating: 7 }), fall2015(2, { rating: 9 }), fall2015(3, { rating: 8, genres: ['Hentai'] }), anime(4, 'Spring', { season: 'Spring', year: 2015, rating: 10 })] },
    anilist: null,
  });

  const res = await season('fall-2015');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-2', 'anilist-1']);
  assert.equal(bootOf(res.body).list.live, false);
});

test('a database outage is a 503 that still carries the app, so visitors get the page', async () => {
  installFetch({ tables: null, anilist: aniList({ list: seasonAnswer([1]) }) });

  const res = await season('fall-2015');

  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['retry-after'], '600');
  assert.match(res.body, /<div id="root">/);
});

test('an unknown season, an impossible year, or a season with no shows is a 404', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([]) }) });

  for (const key of ['monsoon-2015', 'fall-1899', `fall-${YEAR + 3}`, 'fall-2015']) {
    const res = await season(key);
    assert.equal(res.statusCode, 404, key);
    assert.equal(robotsOf(res.body), 'noindex, follow', key);
  }
});

test('another case or "autumn" redirects to the canonical season URL', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([1]) }) });

  for (const key of ['Fall-2015', 'autumn-2015']) {
    const res = await season(key);
    assert.equal(res.statusCode, 301, key);
    assert.equal(res.headers.location, 'https://www.rebyuu.app/seasons/fall-2015', key);
  }
});

test('a URL with a query string is served under the canonical URL', async () => {
  installFetch({ tables: { anime_index: many(12) }, anilist: aniList({ list: seasonAnswer([1]) }) });

  const res = await season('fall-2015', '&sort=trending&utm_source=x');

  assert.equal(res.statusCode, 200);
  assert.equal(canonicalOf(res.body), 'https://www.rebyuu.app/seasons/fall-2015');
});

test("the airing page shows the week's episodes of known titles, and is cached briefly", async () => {
  const soon = Math.floor(Date.now() / 1000) + 3600;
  const episode = (id, n, extra = {}) => ({ episode: n, airingAt: soon, media: { id, isAdult: false, genres: ['Action'], title: { english: `AniList ${id}`, romaji: null }, ...extra } });
  installFetch({
    tables: { anime_index: [anime(1, 'Airing One', { status: 'airing' }), anime(2, 'Airing Two', { status: 'airing' })] },
    anilist: aniList({
      list: { p1: media([1, 2]), p2: noPage },
      schedule: { s1: { airingSchedules: [episode(1, 5), episode(2, 3, { isAdult: true }), episode(999, 1)] }, s2: { airingSchedules: [] }, s3: { airingSchedules: [] }, s4: { airingSchedules: [] } },
    }),
  });

  const res = await render(handler, 'route=hub&hub=airing');
  const root = rootOf(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(titleOf(res.body), "Anime Airing Now & This Week's Episode Schedule · Rebyuu");
  assert.equal(robotsOf(res.body), 'max-image-preview:large');
  assert.match(res.headers['cache-control'], /s-maxage=900/);
  assert.match(root, /This week's episodes/);
  // Named as the catalogue names it, and only titles the catalogue has.
  assert.match(root, /UTC<\/time> <a href="\/anime\/1-airing-one">Airing One<\/a> · Episode 5/);
  assert.doesNotMatch(root, /Episode 3|AniList 999/);
  assert.deepEqual(bootOf(res.body).list.schedule.map((e) => [e.id, e.title, e.episode]), [['anilist-1', 'Airing One', 5]]);
});

test('the upcoming page links each season its shows are announced for', async () => {
  const shows = [{ id: 1, season: 'SPRING', seasonYear: YEAR + 1 }, { id: 2, season: null, seasonYear: null }, { id: 3, season: 'WINTER', seasonYear: YEAR + 1 }];
  installFetch({
    tables: { anime_index: [1, 2, 3].map((id) => anime(id, `Soon ${id}`, { status: 'upcoming' })) },
    anilist: aniList({ list: { p1: media(shows), p2: noPage } }),
  });

  const res = await render(handler, 'route=hub&hub=upcoming');

  assert.equal(res.statusCode, 200);
  assert.match(rootOf(res.body), new RegExp(`Upcoming seasons: <a href="/seasons/winter-${YEAR + 1}">Winter ${YEAR + 1}</a> · <a href="/seasons/spring-${YEAR + 1}">Spring ${YEAR + 1}</a>`));
  assert.deepEqual(animeLinks(rootOf(res.body)), ['anilist-1', 'anilist-2', 'anilist-3']);
});
