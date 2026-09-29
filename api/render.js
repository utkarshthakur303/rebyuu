import { SHELL } from './_shell.js';
import { ORIGIN, escapeHtml, stripTags, truncate, renderTitleList, injectHead, injectBody } from './_html.js';
import { sb, anilist, rankedIds, rowsById } from './_upstream.js';
import { parseHubPath, hubPath, genrePath } from './_hubs.js';
import { HUB_MISSING } from './_hubcopy.js';
import { loadHub, renderHub, renderHubLinks, HubDataError, LIST_COLUMNS, bootItem } from './_hubpage.js';
import { EXCLUDED_GENRES, GENRES } from './_catalog.js';
import { relatedPools, rankRelated, RELATED_SIZE, RELATED_POOL_SIZE } from './_related.js';
import { PAGES } from './_pages.js';
import { animePath, parseAnimeRef } from './_paths.js';
import {
  lastEpisode, episodePath, episodeActivity, isEpisodeIndexable, indexableEpisodes,
  episodeTitleTag, episodeDescription, MIN_EPISODE_RATINGS,
} from './_episodes.js';
import {
  titleTag, metaDescription, otherNames, nameLang,
  titleFacts, nextEpisode, formatAiring, relationGroups, quickAnswers, streamingLinks,
} from './_titlepage.js';

/**
 * Server-rendered metadata and content for the two routes that matter to
 * search and answer engines: / and /anime/:id.
 *
 * This is the fix for C2 and C5. The site is a client-side React app, so
 * every crawler that does not execute JavaScript previously received the same
 * 1,631-byte empty shell on every URL, with one title and one description
 * shared across ~22,000 pages. Googlebot renders JS and coped; GPTBot,
 * ClaudeBot, PerplexityBot and CCBot do not, and saw nothing at all.
 *
 * What this is NOT: it is not SSR of the React tree, and it does not
 * hydrate. It serves the real shell with per-route <title>, description,
 * canonical, Open Graph tags and JSON-LD injected into <head>, plus a plain
 * HTML rendering of the page's actual content inside #root. React mounts as
 * usual and replaces that content. The injected markup reuses the same
 * Tailwind classes as the real components so the pre-mount and post-mount
 * renders line up and the swap does not shift layout.
 *
 * Identical bytes are served to every user agent — there is no bot branch and
 * no sniffing. That matters: serving crawlers different content from humans
 * is cloaking, and the point here is to stop lying to crawlers, not to start.
 *
 * Side benefit, and a large one: the hero image URL is in the served HTML, so
 * the browser can start fetching it during parse. Previously it could not be
 * known until the bundle had run and the anime row had been fetched, which is
 * why the detail page could not preload its own LCP element.
 */

/** Minimum first-party ratings before a community score is real enough to publish. */
const MIN_RATINGS_FOR_SCORE = 3;

/** Titles per homepage rail. Mirrors SECTION_SIZE in LandingPage.tsx. */
const RAIL_SIZE = 8;

/**
 * The homepage's four rails, defined exactly as LandingPage builds them in
 * services/anime.ts: the same AniList sort, status filter and over-fetch,
 * hydrated from anime_index in ranking order, and the same archive query when
 * the live ranking yields nothing. Keeping them identical is the point — the
 * served HTML lists the titles a visitor then sees as cards, so the links a
 * crawler follows from "/" are the page's real content, not a crawler-only
 * index.
 *
 * Before this, the served homepage linked to /browse and /about and nothing
 * else, and /browse is client-rendered, so none of the ~6,000 title pages in
 * the sitemap had a single crawlable internal link pointing at it.
 */
const HOME_RAILS = [
  { key: 'trending', heading: 'Trending', subtitle: 'Trending on AniList right now', sort: 'TRENDING_DESC', perPage: 24, fallback: 'order=rating.desc.nullslast' },
  { key: 'favourites', heading: 'Fan Favorites', subtitle: 'Beloved by the community', sort: 'FAVOURITES_DESC', perPage: 24, fallback: 'order=rating.desc.nullslast' },
  { key: 'airing', heading: 'Airing Now', subtitle: 'Currently broadcasting', sort: 'TRENDING_DESC', status: 'RELEASING', perPage: 50, fallback: 'status=eq.airing&order=rating.desc.nullslast' },
  { key: 'upcoming', heading: 'Upcoming', subtitle: 'Anticipated releases', sort: 'POPULARITY_DESC', status: 'NOT_YET_RELEASED', perPage: 50, fallback: 'status=eq.upcoming&order=year.asc' },
];

/** Titles on the first page of /browse. Mirrors PAGE_SIZE in BrowsePage.tsx. */
const BROWSE_PAGE_SIZE = 24;

/** Written pages rendered from their shared copy in _pages.js. */
const PROSE_ROUTES = ['about', 'terms', 'privacy'];

/**
 * True when the request carries query parameters the renderer does not read:
 * fbclid, gclid, utm_*, or a /browse filter. The query string rides along on
 * the rewrite and is part of the edge-cache key, so every such variant is a
 * cache miss — and a click from a social post or an ad carries a unique id,
 * so it always is one. Those variants canonicalise to the bare path, so they
 * get the page's head and heading without the live title lists, rather than
 * waiting on AniList for links no crawler should be collecting from them.
 */
const INTERNAL_PARAMS = new Set(['route', 'id', 'ref', 'ep', 'hub', 'key']);
const isVariant = (url) => [...url.searchParams.keys()].some((k) => !INTERNAL_PARAMS.has(k));

/** Comments shown on an episode page, newest first. */
const THREAD_SIZE = 20;

/** Reviews served on a title page, newest first. React shows them all. */
const REVIEWS_SHOWN = 10;

/** user id -> username, for the authors of reviews and comments. */
async function loadUsernames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const users = await sb(`users?id=in.(${unique.map(encodeURIComponent).join(',')})&select=id,username`);
  return new Map((Array.isArray(users) ? users : []).map((u) => [u.id, u.username]));
}

/** Comment and rating counts per episode of one title. */
async function loadEpisodeActivity(id) {
  const key = encodeURIComponent(id);
  const [comments, ratings] = await Promise.all([
    sb(`episode_comments?anime_id=eq.${key}&select=episode_number`),
    sb(`episode_ratings?anime_id=eq.${key}&select=episode_number`),
  ]);
  return episodeActivity(Array.isArray(comments) ? comments : [], Array.isArray(ratings) ? ratings : []);
}

/**
 * The first page of /browse as it opens with no filters: live AniList
 * trending, 24 titles (PAGE_SIZE in BrowsePage.tsx), Hentai excluded as
 * EXCLUDED_GENRES does there. Unlike the React page, which renders AniList's
 * own records, ids missing from anime_index are dropped here — a served link
 * to one of those would be a link to a 404. Falls back to the archive ordered
 * by stored rating, as fetchArchiveBrowsePage does. `live` says which it is:
 * only the live list is the one React would show, and so handed to it.
 */
async function loadBrowseFirstPage() {
  const ranked = await anilist(`query {
  browse: Page(page: 1, perPage: ${BROWSE_PAGE_SIZE}) { media(type: ANIME, sort: [TRENDING_DESC], genre_not_in: ${JSON.stringify(EXCLUDED_GENRES)}, isAdult: false) { id } }
}`);
  const ids = rankedIds(ranked?.browse);
  const byId = await rowsById(ids, LIST_COLUMNS);
  const items = ids.map((id) => byId.get(id)).filter(Boolean);
  if (items.length) return { items, live: true };

  const fallback = await sb(
    `anime_index?select=${LIST_COLUMNS}&genres=not.ov.{${EXCLUDED_GENRES.join(',')}}&order=rating.desc.nullslast,id.asc&limit=${BROWSE_PAGE_SIZE}`
  );
  return { items: Array.isArray(fallback) ? fallback : [], live: false };
}

/**
 * All four rails in one AniList request (one aliased Page per rail), then one
 * anime_index read to turn the ranked ids into titles. Each rail keeps its
 * ranking order and drops ids the snapshot does not have — linking those
 * would send a crawler to a 404.
 */
async function loadHomeRails() {
  const query = `query {\n${HOME_RAILS.map((r) =>
    `  ${r.key}: Page(page: 1, perPage: ${r.perPage}) { media(type: ANIME, sort: [${r.sort}]${r.status ? `, status: ${r.status}` : ''}, isAdult: false) { id } }`
  ).join('\n')}\n}`;

  const ranked = await anilist(query);
  const idsByRail = HOME_RAILS.map((r) => rankedIds(ranked?.[r.key]));
  const byId = await rowsById(idsByRail.flat());

  return Promise.all(
    HOME_RAILS.map(async (rail, i) => {
      let items = idsByRail[i].map((id) => byId.get(id)).filter(Boolean).slice(0, RAIL_SIZE);
      if (!items.length) {
        const fallback = await sb(`anime_index?select=id,title,year&${rail.fallback}&limit=${RAIL_SIZE}`);
        items = Array.isArray(fallback) ? fallback : [];
      }
      return { ...rail, items };
    })
  );
}

/**
 * "More like this" for a title page — see _related.js. Pools are fetched one
 * at a time because the any-year pool is only needed when the era pool comes
 * up short, which for most titles it does not.
 */
async function loadRelated(row) {
  const fetched = [];
  let picked = [];
  for (const pool of relatedPools(row)) {
    const genres = `{${pool.genres.map((g) => `"${g.replace(/"/g, '')}"`).join(',')}}`;
    const years = pool.yearFrom ? `&year=gte.${pool.yearFrom}&year=lte.${pool.yearTo}` : '';
    const rows = await sb(
      `anime_index?select=id,title,year,rating,genres,cover_image&id=neq.${encodeURIComponent(row.id)}` +
      `&genres=ov.${encodeURIComponent(genres)}${years}&order=rating.desc.nullslast,id.asc&limit=${RELATED_POOL_SIZE}`
    );
    fetched.push(Array.isArray(rows) ? rows : []);
    picked = rankRelated(row, fetched);
    if (picked.length === RELATED_SIZE) break;
  }
  return picked;
}

/**
 * The title reference the request was made with: `ref` from the canonical
 * route (/anime/154587-frieren-…), or `id` from the original one
 * (/anime/anilist-154587). Compared against the canonical path to decide
 * whether to redirect.
 */
const requestedRef = (url) => url.searchParams.get('ref') ?? url.searchParams.get('id') ?? '';

/**
 * 301 to the canonical URL of a title or episode page. Any older or shorter
 * form — the original anilist- URLs, a bare id, a slug from before a title
 * was renamed — lands here, so links to it keep working and pass their
 * weight to the one URL that is indexed.
 */
function redirect(res, path) {
  res.setHeader('Location', `${ORIGIN}${path}`);
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(301).send('');
}

/**
 * Rendered HTML is cached at the edge so a crawl of 6,165 URLs does not
 * become 6,165 database round trips. Content changes only when the nightly
 * sync runs, so an hour of freshness is generous.
 */
const PAGE_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';

/** The airing schedule goes out of date by the hour, so /airing is served fresher. */
const AIRING_CACHE = 'public, s-maxage=900, stale-while-revalidate=3600';

function send(res, status, html, cache = PAGE_CACHE) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.status(status).send(html);
}

function renderHome(rails = []) {
  const title = 'Rebyuu — Anime tracker, ratings and reviews';
  const description =
    "Track the anime you watch, rate and review what you finish, and keep your own lists. See what's trending and airing now across 22,000 titles.";

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${ORIGIN}/#organization`,
        name: 'Rebyuu',
        url: ORIGIN,
        description:
          'An anime discovery and review site built on AniList and MyAnimeList catalogue data.',
        logo: { '@type': 'ImageObject', url: `${ORIGIN}/rebyuu-logo.webp`, width: 288, height: 192 },
      },
      {
        '@type': 'WebSite',
        '@id': `${ORIGIN}/#website`,
        url: ORIGIN,
        name: 'Rebyuu',
        description,
        publisher: { '@id': `${ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${ORIGIN}/browse?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  // A plain statement of what the site is, then the same four rails React
  // renders as cards, as plain title links. React replaces all of it on mount.
  const content = `
    <main class="mx-auto max-w-3xl px-4 py-16">
      <h1 class="uppercase" style="font-family:Anton,Impact,sans-serif;font-size:clamp(34px,7vw,60px);line-height:0.95">Rebyuu</h1>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:18px;line-height:1.7;margin-top:16px">${escapeHtml(description)}</p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7;margin-top:14px">
        Catalogue data, including synopses, genre tags and artwork, comes from AniList; the numeric score shown on each title page is the average score of AniList users. Rebyuu's own community score is calculated from ratings left by Rebyuu accounts.
      </p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:18px">
        <a href="/browse">Browse the catalogue</a> · <a href="/about">About Rebyuu and its sources</a>
      </p>
      ${rails.map(renderTitleList).join('')}
      ${renderHubLinks()}
    </main>`;

  let html = injectHead(SHELL, {
    title,
    description,
    canonical: `${ORIGIN}/`,
    image: `${ORIGIN}/rebyuu-logo.webp`,
    ld,
  });
  return injectBody(html, content);
}

function renderAnime(row, community, related = [], known = new Map(), activity = new Map(), reviews = []) {
  const title = String(row.title || 'Untitled');
  const pageUrl = `${ORIGIN}${animePath(row)}`;
  const synopsis = stripTags(row.description);
  const year = row.year ? String(row.year) : null;
  const genres = Array.isArray(row.genres) ? row.genres.filter(Boolean) : [];
  const image = row.banner_image || row.cover_image || null;

  const statusWord =
    row.status === 'airing' ? 'Currently airing'
    : row.status === 'upcoming' ? 'Upcoming'
    : 'Completed';

  const published = community && community.count >= MIN_RATINGS_FOR_SCORE ? community : null;
  const pageTitle = titleTag(row);
  const description = metaDescription(row, { community: published });

  /**
   * AniList's `format` says outright what a title is, once the detail columns
   * are synced: MOVIE is a Movie; TV, TV_SHORT and ONA are series; OVA,
   * SPECIAL and MUSIC stay CreativeWork, the honest supertype.
   *
   * Rows synced before that have no format, so the type is only claimed where
   * something in the data proves it — defaulting everything to TVSeries would
   * misclassify every film:
   *
   *   episodes > 1                -> TVSeries. More than one episode is a series.
   *   episodes null + airing      -> TVSeries. AniList leaves the count null
   *                                  while a show is still running, which is
   *                                  why One Piece arrives here with no episode
   *                                  count at all. A film does not "air".
   *   everything else             -> CreativeWork. Mostly episodes === 1: a
   *                                  film or a one-shot OVA, genuinely ambiguous.
   */
  const type =
    row.format === 'MOVIE' ? 'Movie'
    : ['TV', 'TV_SHORT', 'ONA'].includes(row.format) ? 'TVSeries'
    : row.format ? 'CreativeWork'
    : (row.episodes && row.episodes > 1) || (!row.episodes && row.status === 'airing') ? 'TVSeries'
    : 'CreativeWork';

  const work = {
    '@type': type,
    '@id': `${pageUrl}#work`,
    url: pageUrl,
    name: title,
    inLanguage: 'en',
  };
  const aliases = otherNames(row);
  if (aliases.length) work.alternateName = aliases;
  if (synopsis) work.description = truncate(synopsis, 5000);
  if (row.cover_image) work.image = row.cover_image;
  if (genres.length) work.genre = genres;
  if (type === 'TVSeries' && row.episodes) work.numberOfEpisodes = row.episodes;
  if (type === 'Movie' && row.duration) work.duration = `PT${row.duration}M`;
  if (year) work.startDate = year;
  if (row.studios?.length) work.productionCompany = row.studios.map((name) => ({ '@type': 'Organization', name }));
  // The same work on the two databases search engines already know it from,
  // so this page is understood as that entity rather than a lookalike.
  const anilistId = row.anilist_id || Number(String(row.id).replace(/^anilist-/, ''));
  work.sameAs = [
    `https://anilist.co/anime/${anilistId}`,
    row.mal_id ? `https://myanimelist.net/anime/${row.mal_id}` : null,
  ].filter(Boolean);

  /**
   * Only Rebyuu's own ratings are ever marked up. The AniList score displayed
   * on the page is another platform's aggregate of its own users and carries no
   * vote count we hold, so publishing it as this page's aggregateRating would
   * be both unverifiable and exactly what review-snippet spam guidance
   * targets. Below the threshold nothing is emitted at all.
   */
  /**
   * Reviews written by Rebyuu accounts, the same ones printed on the page —
   * review markup must describe reviews a reader can see. Each carries its
   * author's own score of the title when they left one. The body is the text
   * exactly as the page prints it — reviews are plain text, so anything that
   * looks like markup in one is what its author typed.
   */
  if (reviews.length) {
    work.review = reviews.map((r) => {
      const review = { '@type': 'Review', author: { '@type': 'Person', name: r.author }, datePublished: r.date, reviewBody: String(r.content ?? '').slice(0, 5000) };
      if (r.rating != null) review.reviewRating = { '@type': 'Rating', ratingValue: r.rating, bestRating: 10, worstRating: 1 };
      return review;
    });
  }

  if (community && community.count >= MIN_RATINGS_FOR_SCORE) {
    work.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: community.average,
      ratingCount: community.count,
      bestRating: 10,
      worstRating: 1,
    };
  }

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      work,
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Rebyuu', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${ORIGIN}/browse` },
          { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  };

  // Mirrors AnimeDetailPage's own banner classes so React's takeover does not
  // move anything on screen.
  const bannerHtml = image
    ? `<div class="relative h-[35vh] min-h-[250px] sm:h-[40vh] sm:min-h-[300px] md:h-[50vh] md:min-h-[380px] lg:h-[55vh] lg:min-h-[440px] w-full overflow-hidden">
         <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="h-full w-full object-cover" fetchpriority="high" />
       </div>`
    : '';

  const factsHtml = `
    <dl style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:15px;line-height:1.8">
      ${year ? `<div><dt style="display:inline;font-weight:600">Year: </dt><dd style="display:inline;margin:0">${escapeHtml(year)}</dd></div>` : ''}
      <div><dt style="display:inline;font-weight:600">Status: </dt><dd style="display:inline;margin:0">${escapeHtml(statusWord)}</dd></div>
      ${row.episodes ? `<div><dt style="display:inline;font-weight:600">Episodes: </dt><dd style="display:inline;margin:0">${escapeHtml(String(row.episodes))}</dd></div>` : ''}
      ${titleFacts(row).map((f) => `<div><dt style="display:inline;font-weight:600">${escapeHtml(f.label)}: </dt><dd style="display:inline;margin:0">${f.path ? `<a href="${escapeHtml(f.path)}">${escapeHtml(f.value)}</a>` : escapeHtml(f.value)}</dd></div>`).join('\n      ')}
      ${genres.length ? `<div><dt style="display:inline;font-weight:600">Genres: </dt><dd style="display:inline;margin:0">${genres.map((g) => (GENRES.includes(g) ? `<a href="${escapeHtml(genrePath(g))}">${escapeHtml(g)}</a>` : escapeHtml(g))).join(', ')}</dd></div>` : ''}
      ${row.rating != null ? `<div><dt style="display:inline;font-weight:600">AniList score: </dt><dd style="display:inline;margin:0">${escapeHtml(Number(row.rating).toFixed(1))}/10</dd></div>` : ''}
      ${community && community.count >= MIN_RATINGS_FOR_SCORE
        ? `<div><dt style="display:inline;font-weight:600">Rebyuu community score: </dt><dd style="display:inline;margin:0">${escapeHtml(String(community.average))}/10 from ${escapeHtml(String(community.count))} ratings</dd></div>`
        : ''}
    </dl>`;

  const content = `
    ${bannerHtml}
    <main class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="uppercase" style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,52px);line-height:0.95">${escapeHtml(title)}</h1>
      ${aliases.length ? `<p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:14px;opacity:.75;margin-top:8px">Also known as ${aliases.map((a) => `<span${nameLang(a) ? ` lang="${nameLang(a)}"` : ''}>${escapeHtml(a)}</span>`).join(' · ')}</p>` : ''}
      ${factsHtml}
      ${synopsis ? `<h2 style="font-family:Anton,Impact,sans-serif;font-size:22px;margin-top:24px">Synopsis</h2>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7">${escapeHtml(synopsis)}</p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:13px;opacity:.7;margin-top:10px">Synopsis, artwork and score via <a href="https://anilist.co">AniList</a>. See <a href="/about">About</a> for full sourcing.</p>` : ''}
      ${renderWhereToWatch(row)}
      ${renderNextEpisode(row)}
      ${renderQuickAnswers(row)}
      ${renderRelations(row, known)}
      ${renderEpisodeGuide(row, activity)}
      ${renderReviews(row, reviews)}
      ${renderTitleList({ heading: 'More like this', items: related })}
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:20px"><a href="/browse">Browse more anime</a></p>
    </main>`;

  let html = injectHead(SHELL, {
    title: pageTitle,
    description,
    canonical: pageUrl,
    image: row.cover_image || image,
    // The banner is the LCP element. Preloading the poster instead — as this
    // did — spent the first ~40 KB of a slow connection on an image that is
    // not the one being waited for; measured on a throttled mobile profile,
    // Frieren's banner painted at 3.6 s with the poster preloaded.
    preload: image,
    ld,
  });
  /*
   * React's detail page used to mount, wipe this markup for a spinner, fetch
   * the same row again, then draw the banner: measured on a throttled mobile
   * profile, the banner painted ~1 s after the bundle ran. With the row handed
   * over, React's first render already has it.
   */
  return injectBody(html, content, { anime: row });
}

/**
 * /browse: its heading, what it does, and the titles its unfiltered first page
 * shows. Filtered variants (/browse?genre=…) reach this too — the query string
 * rides along on the rewrite — and get the same unfiltered HTML, which is
 * correct for them: they canonicalise to /browse and robots.txt keeps
 * crawlers out of them. React renders the filtered grid on mount.
 */
function renderBrowse({ items, live }) {
  const meta = PAGES.browse;
  const content = `
    <main class="mx-auto max-w-3xl px-4 py-16">
      <h1 style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,44px);line-height:1">${escapeHtml(meta.heading)}</h1>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:17px;line-height:1.7;margin-top:14px">${escapeHtml(meta.description)}</p>
      ${renderTitleList({ heading: 'Trending now', items })}
      ${renderHubLinks()}
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:24px"><a href="/">Home</a> · <a href="/about">About Rebyuu and its sources</a></p>
    </main>`;

  return injectBody(
    injectHead(SHELL, {
      title: meta.title,
      description: meta.description,
      canonical: `${ORIGIN}${meta.path}`,
    }),
    content,
    // The unfiltered trending list is the one React's /browse opens on, so it
    // is handed over (readBootList); trending always has another page.
    live && items.length ? { list: { path: meta.path, items: items.map(bootItem), hasMore: true, live: true } } : null
  );
}


/**
 * About, Terms and Privacy: the header block ProsePage renders — eyebrow,
 * heading, standfirst, date — from the same copy the React pages use. The
 * body prose stays client-rendered; what a non-JS crawler needed was a real
 * title and description instead of the shell's shared ones.
 */
function renderProse(meta) {
  const content = `
    <article class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:16px">${escapeHtml(meta.eyebrow)}</p>
      <h1 class="uppercase" style="font-family:Anton,Impact,sans-serif;font-size:clamp(34px,7vw,60px);font-weight:400;line-height:0.95;margin-bottom:20px">${escapeHtml(meta.heading)}</h1>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:18px;line-height:1.7;margin-bottom:32px">${escapeHtml(meta.standfirst)}</p>
      <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.7">Last updated ${escapeHtml(meta.updated)}</p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:24px"><a href="/about">About</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/browse">Browse anime</a></p>
    </article>`;

  return injectBody(
    injectHead(SHELL, {
      title: meta.title,
      description: meta.description,
      canonical: `${ORIGIN}${meta.path}`,
    }),
    content
  );
}

const H2 = 'style="font-family:Anton,Impact,sans-serif;font-size:22px;margin-top:28px"';
const P = 'style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7"';
const NOTE = 'style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:13px;opacity:.7;margin-top:6px"';
const DT = 'style="display:inline;font-weight:600"';
const DD = 'style="display:inline;margin:0"';

/** "Where to watch <title>": the streaming services AniList lists, linked. */
function renderWhereToWatch(row) {
  const links = streamingLinks(row);
  if (!links.length) return '';
  const title = escapeHtml(row.title || 'Untitled');
  return `
      <section>
        <h2 ${H2}>Where to watch ${title}</h2>
        <p ${P}>${links.map((l) => `<a href="${escapeHtml(l.url)}" rel="noopener">${escapeHtml(l.site)}</a>`).join(' · ')}</p>
        <p ${NOTE}>Availability varies by country. Services as listed on AniList.</p>
      </section>`;
}

/** When the next episode airs, while that is still in the future. */
function renderNextEpisode(row) {
  const next = nextEpisode(row);
  if (!next || row.status !== 'airing') return '';
  return `
      <section>
        <h2 ${H2}>When is the next episode of ${escapeHtml(row.title || 'Untitled')}?</h2>
        <p ${P}>Episode ${next.episode} airs on <time datetime="${next.at.toISOString()}">${escapeHtml(formatAiring(next.at, { timeZone: 'UTC' }))}</time>.</p>
      </section>`;
}

/** The questions people search a title with, answered from its data. */
function renderQuickAnswers(row) {
  const answers = quickAnswers(row, { timeZone: 'UTC' });
  if (!answers.length) return '';
  return `
      <section>
        <h2 ${H2}>${escapeHtml(row.title || 'Untitled')}: quick answers</h2>
        ${answers.map((qa) => `<h3 style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;font-weight:600;margin-top:14px">${escapeHtml(qa.question)}</h3>
        <p ${P}>${escapeHtml(qa.answer)}</p>`).join('\n        ')}
      </section>`;
}

/** Prequels, sequels and side stories — the watch order people search for. */
function renderRelations(row, known) {
  const groups = relationGroups(row, known);
  if (!groups.length) return '';
  const item = (it) => {
    const name = it.path ? `<a href="${escapeHtml(it.path)}">${escapeHtml(it.title)}</a>` : escapeHtml(it.title);
    return `${name}${it.year ? ` (${escapeHtml(String(it.year))})` : ''}`;
  };
  return `
      <section>
        <h2 ${H2}>${escapeHtml(row.title || 'Untitled')} seasons and related anime</h2>
        <dl ${P}>
          ${groups.map((g) => `<div><dt ${DT}>${escapeHtml(g.label)}: </dt><dd ${DD}>${g.items.map(item).join(' · ')}</dd></div>`).join('\n          ')}
        </dl>
      </section>`;
}

/** Rebyuu reviews of the title — first-party writing, the page's own text. */
function renderReviews(row, reviews) {
  if (!reviews.length) return '';
  return `
      <section>
        <h2 ${H2}>${escapeHtml(row.title || 'Untitled')} reviews</h2>
        ${reviews.map((r) => `<article style="margin-top:16px">
          <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:13px;opacity:.75"><strong>${escapeHtml(r.author)}</strong>${r.rating != null ? ` · ${escapeHtml(String(r.rating))}/10` : ''} · <time datetime="${escapeHtml(r.date)}">${escapeHtml(r.date)}</time></p>
          <p ${P}>${escapeHtml(r.content)}</p>
        </article>`).join('\n        ')}
      </section>`;
}

/**
 * The title page's episode guide: its indexable episodes only (see
 * _episodes.js), so crawlers are led to the episode pages worth indexing.
 */
function renderEpisodeGuide(row, activity) {
  const episodes = indexableEpisodes(row, activity);
  if (!episodes.length) return '';
  const next = row.status === 'airing' ? nextEpisode(row) : null;
  const note = (n) =>
    next && n === next.episode ? ' (next)' : next && n === next.episode - 1 ? ' (latest)' : '';
  return `
      <section>
        <h2 ${H2}>${escapeHtml(row.title || 'Untitled')} episodes</h2>
        <p ${P}>${episodes.map((n) => `<a href="${escapeHtml(episodePath(row, n))}">Episode ${n}</a>${note(n)}`).join(' · ')}</p>
      </section>`;
}

/**
 * One episode's page. `ratings` and `comments` hold the title's rows (for
 * which neighbours are indexable); `thread` is this episode's comments with
 * their text; `authors` maps user ids to usernames.
 */
function renderEpisode(row, n, { ratings, comments, thread, authors }) {
  const title = String(row.title || 'Untitled');
  const seriesUrl = `${ORIGIN}${animePath(row)}`;
  const url = `${ORIGIN}${episodePath(row, n)}`;
  const last = lastEpisode(row);
  const activity = episodeActivity(comments, ratings);
  const own = ratings.filter((r) => r.episode_number === n);
  const average = own.length ? Math.round((own.reduce((sum, r) => sum + (r.rating ?? 0), 0) / own.length) * 10) / 10 : null;
  const stats = { average, count: own.length, comments: thread.length };
  const indexable = isEpisodeIndexable(row, n, activity.get(n));
  const next = row.status === 'airing' ? nextEpisode(row) : null;

  const episode = {
    '@type': 'TVEpisode',
    '@id': `${url}#episode`,
    url,
    name: `${title} — Episode ${n}`,
    episodeNumber: n,
    partOfSeries: { '@type': 'TVSeries', '@id': `${seriesUrl}#work`, name: title, url: seriesUrl },
  };
  if (own.length >= MIN_EPISODE_RATINGS) {
    episode.aggregateRating = { '@type': 'AggregateRating', ratingValue: average, ratingCount: own.length, bestRating: 10, worstRating: 1 };
  }
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      episode,
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Rebyuu', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${ORIGIN}/browse` },
          { '@type': 'ListItem', position: 3, name: title, item: seriesUrl },
          { '@type': 'ListItem', position: 4, name: `Episode ${n}`, item: url },
        ],
      },
    ],
  };

  const neighbour = (m, label) => {
    if (m < 1 || m > last) return '';
    return isEpisodeIndexable(row, m, activity.get(m))
      ? `<a href="${escapeHtml(episodePath(row, m))}" rel="${m < n ? 'prev' : 'next'}">${label}</a>`
      : `<span>${label}</span>`;
  };
  const airs = next && next.episode === n
    ? `<p ${P}>Episode ${n} airs on <time datetime="${next.at.toISOString()}">${escapeHtml(formatAiring(next.at, { timeZone: 'UTC' }))}</time>.</p>`
    : '';
  const score = own.length >= MIN_EPISODE_RATINGS
    ? `<p ${P}><strong>Rebyuu rating:</strong> ${escapeHtml(average.toFixed(1))}/10 from ${own.length} ratings</p>`
    : '';
  const discussion = thread.length
    ? thread.map((c) => `<article style="margin-top:14px">
          <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:13px;opacity:.7"><strong>${escapeHtml(authors.get(c.user_id) || 'Anonymous')}</strong> · <time datetime="${escapeHtml(c.created_at)}">${escapeHtml(String(c.created_at).slice(0, 10))}</time></p>
          <p ${P}>${escapeHtml(c.content)}</p>
        </article>`).join('\n        ')
    : `<p ${P}>No comments yet. Be the first to say what you thought of episode ${n}.</p>`;

  const content = `
    <main class="mx-auto max-w-3xl px-4 py-12">
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:14px"><a href="${escapeHtml(animePath(row))}">${escapeHtml(title)}</a> · Episode ${n}${row.episodes ? ` of ${row.episodes}` : ''}</p>
      <h1 style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,48px);line-height:1;margin-top:8px">${escapeHtml(title)} — Episode ${n}</h1>
      ${airs}
      ${score}
      <section>
        <h2 ${H2}>Discussion</h2>
        ${discussion}
      </section>
      <nav style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:28px;display:flex;gap:24px">
        ${neighbour(n - 1, `← Episode ${n - 1}`)}
        ${neighbour(n + 1, `Episode ${n + 1} →`)}
      </nav>
    </main>`;

  return injectBody(
    injectHead(SHELL, {
      title: episodeTitleTag(row, n),
      description: episodeDescription(row, n, stats, { timeZone: 'UTC' }),
      canonical: url,
      image: row.cover_image || null,
      preload: null, // an episode page shows no image; nothing to wait for
      ld,
      robots: indexable ? null : 'noindex, follow',
    }),
    content
  );
}

/** A well-formed id with no row behind it is a genuine 404, not a soft one. */
function renderMissing({ heading = 'Not in the archive', text = 'This title is not in the Rebyuu catalogue.' } = {}) {
  return injectHead(
    injectBody(SHELL, `
      <main class="mx-auto max-w-3xl px-4 py-16" style="text-align:center">
        <h1 style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,48px)">${escapeHtml(heading)}</h1>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif">${escapeHtml(text)}</p>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif"><a href="/browse">Browse the catalogue</a></p>
      </main>`),
    {
      title: `${heading} · Rebyuu`,
      description: text,
      canonical: `${ORIGIN}/browse`,
      robots: 'noindex, follow',
    }
  );
}

/**
 * The catalogue can't be read right now. 503 tells crawlers to come back
 * rather than record an empty page; the body is the app shell, so a visitor
 * still gets the page, rendered in the browser.
 */
function unavailable(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '600');
  res.status(503).send(SHELL);
}

/** The path a hub rewrite came from; vercel.json passes the hub's kind and key. */
const HUB_PATHS = {
  season: (key) => `/seasons/${key}`,
  airing: () => '/airing',
  upcoming: () => '/upcoming',
  top: (key) => (key ? `/top/${key}` : '/top'),
  genre: (key) => `/genres/${key}`,
};
const hubPathname = (kind, key) => HUB_PATHS[kind]?.(key ?? '') ?? null;

/** /seasons/fall-2026, /airing, /upcoming, /top, /top/2025, /genres/romance — see _hubs.js and _hubpage.js. */
async function serveHub(res, url) {
  const pathname = hubPathname(url.searchParams.get('hub'), url.searchParams.get('key'));
  const hub = pathname ? parseHubPath(pathname) : null;
  if (!hub) return send(res, 404, renderMissing(HUB_MISSING));
  if (hubPath(hub) !== pathname) return redirect(res, hubPath(hub));

  let data;
  try {
    data = await loadHub(hub);
  } catch (err) {
    if (err instanceof HubDataError) return unavailable(res);
    throw err;
  }
  if (!data.items.length) return send(res, 404, renderMissing(HUB_MISSING));
  return send(res, 200, renderHub(hub, data), hub.kind === 'airing' ? AIRING_CACHE : PAGE_CACHE);
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, ORIGIN);
    const route = url.searchParams.get('route');

    if (route === 'hub') return await serveHub(res, url);

    if (route === 'anime') {
      const requested = requestedRef(url);
      const id = parseAnimeRef(requested)?.id;
      if (!id) return send(res, 404, renderMissing());

      const [rows, ratings, posts] = await Promise.all([
        sb(`anime_index?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
        sb(`ratings?anime_id=eq.${encodeURIComponent(id)}&select=user_id,rating`),
        sb(`comments?anime_id=eq.${encodeURIComponent(id)}&select=id,user_id,content,created_at&order=created_at.desc&limit=${REVIEWS_SHOWN}`),
      ]);

      // A Supabase outage must not turn every title page into a 404. Falling
      // back to the plain shell means the client-side app still renders it.
      if (rows === null) return send(res, 200, SHELL);
      if (!Array.isArray(rows) || rows.length === 0) return send(res, 404, renderMissing());

      let community = null;
      if (Array.isArray(ratings) && ratings.length >= MIN_RATINGS_FOR_SCORE) {
        const total = ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0);
        community = { average: Math.round((total / ratings.length) * 10) / 10, count: ratings.length };
      }

      const row = rows[0];
      const canonical = animePath(row);
      if (`/anime/${requested}` !== canonical) return redirect(res, canonical);

      const relationIds = (Array.isArray(row.relations) ? row.relations : []).map((r) => r.id);
      const reviewPosts = Array.isArray(posts) ? posts : [];
      const [related, known, activity, authors] = await Promise.all([
        loadRelated(row),
        rowsById(relationIds),
        lastEpisode(row) ? loadEpisodeActivity(row.id) : new Map(),
        loadUsernames(reviewPosts.map((p) => p.user_id)),
      ]);
      // A reviewer's score is their rating of the title, if they left one.
      const scoreBy = new Map((Array.isArray(ratings) ? ratings : []).map((r) => [r.user_id, r.rating]));
      const reviews = reviewPosts.map((p) => ({
        author: authors.get(p.user_id) || 'Anonymous',
        rating: scoreBy.get(p.user_id) ?? null,
        content: p.content,
        date: String(p.created_at || '').slice(0, 10),
      }));
      return send(res, 200, renderAnime(row, community, related, known, activity, reviews));
    }

    if (route === 'episode') {
      const requested = requestedRef(url);
      const id = parseAnimeRef(requested)?.id;
      const ep = url.searchParams.get('ep') || '';
      if (!id || !/^\d+$/.test(ep)) return send(res, 404, renderMissing());
      const n = Number(ep);
      const key = encodeURIComponent(id);
      const [rows, ratings, comments, thread] = await Promise.all([
        sb(`anime_index?id=eq.${key}&select=*&limit=1`),
        sb(`episode_ratings?anime_id=eq.${key}&select=episode_number,rating`),
        sb(`episode_comments?anime_id=eq.${key}&select=episode_number`),
        sb(`episode_comments?anime_id=eq.${key}&episode_number=eq.${n}&select=id,user_id,content,created_at&order=created_at.desc&limit=${THREAD_SIZE}`),
      ]);
      if (rows === null) return send(res, 200, SHELL);
      const row = Array.isArray(rows) ? rows[0] : null;
      const last = row ? lastEpisode(row) : null;
      if (!row || !last || n < 1 || n > last) return send(res, 404, renderMissing());
      const canonical = episodePath(row, n);
      if (`/anime/${requested}/episode/${n}` !== canonical) return redirect(res, canonical);

      const posts = Array.isArray(thread) ? thread : [];
      const authors = await loadUsernames(posts.map((c) => c.user_id));
      return send(res, 200, renderEpisode(row, n, {
        ratings: Array.isArray(ratings) ? ratings : [],
        comments: Array.isArray(comments) ? comments : [],
        thread: posts,
        authors,
      }));
    }

    const variant = isVariant(url);
    if (route === 'browse') return send(res, 200, renderBrowse(variant ? { items: [], live: false } : await loadBrowseFirstPage()));
    if (PROSE_ROUTES.includes(route)) return send(res, 200, renderProse(PAGES[route]));

    return send(res, 200, renderHome(variant ? [] : await loadHomeRails()));
  } catch {
    // Never let this function be the reason the site is down. The shell alone
    // is exactly what the site served before this existed.
    return send(res, 200, SHELL);
  }
}
