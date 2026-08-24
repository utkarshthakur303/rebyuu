import { SHELL } from './_shell.js';

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

const ORIGIN = 'https://www.rebyuu.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

/** Minimum first-party ratings before a community score is real enough to publish. */
const MIN_RATINGS_FOR_SCORE = 3;

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** AniList synopses carry HTML. Strip it, collapse whitespace, keep the words. */
const stripTags = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s, n) => {
  const t = stripTags(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
};

/**
 * JSON-LD is injected inside a <script> tag, so the one character that must
 * never survive is the sequence that could close it early.
 */
const jsonLd = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

async function sb(path) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Replaces the shell's single shared title/description with this route's. */
function injectHead(html, { title, description, canonical, image, ld, robots }) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Rebyuu" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
    // Lets the browser start the LCP fetch during head parse, before the
    // bundle has run — impossible while the URL was only knowable in JS.
    tags.push(`<link rel="preload" as="image" href="${escapeHtml(image)}" fetchpriority="high" />`);
  }
  if (robots) tags.push(`<meta name="robots" content="${escapeHtml(robots)}" />`);
  if (ld) tags.push(`<script type="application/ld+json">${jsonLd(ld)}</script>`);

  // Drop the shell's generic tags so the document never carries two of any.
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:title"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:title"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:card"[^>]*>/gi, '');

  return out.replace('</head>', `${tags.join('\n    ')}\n  </head>`);
}

/** Injected into #root. React clears this on mount. */
function injectBody(html, content) {
  return html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

function send(res, status, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Rendered HTML is cached at the edge so a crawl of 6,165 URLs does not
  // become 6,165 database round trips. Content changes only when the nightly
  // sync runs, so an hour of freshness is generous.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(status).send(html);
}

function renderHome() {
  const title = 'Rebyuu — Anime discovery, tracking and reviews';
  const description =
    'Browse roughly 22,000 anime by genre, season and status, with live trending and currently-airing rankings. Track what you have watched and rate what you finish. No account needed to browse.';

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

  // Deliberately compact. The homepage's live rails are genuinely dynamic and
  // React owns them; what a non-JS crawler needs from this page is a plain
  // statement of what the site is, which it previously had nowhere.
  const content = `
    <main class="mx-auto max-w-3xl px-4 py-16">
      <h1 class="uppercase" style="font-family:Anton,Impact,sans-serif;font-size:clamp(34px,7vw,60px);line-height:0.95">Rebyuu</h1>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:18px;line-height:1.7;margin-top:16px">${escapeHtml(description)}</p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7;margin-top:14px">
        Catalogue data, including synopses, genre tags and artwork, comes from AniList; the numeric score shown on each title page is MyAnimeList's community aggregate, read via the Jikan API. Rebyuu's own community score is calculated from ratings left by Rebyuu accounts.
      </p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:18px">
        <a href="/browse">Browse the catalogue</a> · <a href="/about">About Rebyuu and its sources</a>
      </p>
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

function renderAnime(row, community) {
  const title = String(row.title || 'Untitled');
  const synopsis = stripTags(row.description);
  const year = row.year ? String(row.year) : null;
  const genres = Array.isArray(row.genres) ? row.genres.filter(Boolean) : [];
  const image = row.banner_image || row.cover_image || null;

  const statusWord =
    row.status === 'airing' ? 'Currently airing'
    : row.status === 'upcoming' ? 'Upcoming'
    : 'Completed';

  const descBits = [
    year ? `${year}` : null,
    row.episodes ? `${row.episodes} episode${row.episodes === 1 ? '' : 's'}` : null,
    genres.length ? genres.slice(0, 3).join(', ') : null,
  ].filter(Boolean).join(' · ');

  const pageTitle = `${title}${year ? ` (${year})` : ''} — synopsis, score and episodes · Rebyuu`;
  const description = synopsis
    ? truncate(synopsis, 155)
    : `${title}. ${descBits}. ${statusWord}. Details, score and episode list on Rebyuu.`;

  /**
   * anime_index has no `format` column, so a series and a film are not
   * directly distinguishable. Defaulting everything to TVSeries would
   * misclassify every anime movie, so the type is only ever claimed where
   * something in the data actually proves it:
   *
   *   episodes > 1                -> TVSeries. More than one episode is a series.
   *   episodes null + airing      -> TVSeries. AniList leaves the count null
   *                                  while a show is still running, which is
   *                                  why One Piece arrives here with no episode
   *                                  count at all. A film does not "air".
   *   everything else             -> CreativeWork, the honest supertype.
   *
   * That last bucket is mostly episodes === 1, which is a film or a one-shot
   * OVA and genuinely ambiguous. 799 of 22,078 rows carry a null count.
   */
  const type =
    (row.episodes && row.episodes > 1) || (!row.episodes && row.status === 'airing')
      ? 'TVSeries'
      : 'CreativeWork';

  const work = {
    '@type': type,
    '@id': `${ORIGIN}/anime/${row.id}#work`,
    url: `${ORIGIN}/anime/${row.id}`,
    name: title,
    inLanguage: 'en',
  };
  if (synopsis) work.description = truncate(synopsis, 5000);
  if (row.cover_image) work.image = row.cover_image;
  if (genres.length) work.genre = genres;
  if (type === 'TVSeries' && row.episodes) work.numberOfEpisodes = row.episodes;
  if (year) work.startDate = year;

  /**
   * Only Rebyuu's own ratings are ever marked up. The MAL score displayed on
   * the page is another platform's aggregate of its own users and carries no
   * vote count we hold, so publishing it as this page's aggregateRating would
   * be both unverifiable and exactly what review-snippet spam guidance
   * targets. Below the threshold nothing is emitted at all.
   */
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
        '@id': `${ORIGIN}/anime/${row.id}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Rebyuu', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${ORIGIN}/browse` },
          { '@type': 'ListItem', position: 3, name: title, item: `${ORIGIN}/anime/${row.id}` },
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
      ${genres.length ? `<div><dt style="display:inline;font-weight:600">Genres: </dt><dd style="display:inline;margin:0">${escapeHtml(genres.join(', '))}</dd></div>` : ''}
      ${row.rating ? `<div><dt style="display:inline;font-weight:600">MyAnimeList score: </dt><dd style="display:inline;margin:0">${escapeHtml(String(row.rating))}/10</dd></div>` : ''}
      ${community && community.count >= MIN_RATINGS_FOR_SCORE
        ? `<div><dt style="display:inline;font-weight:600">Rebyuu community score: </dt><dd style="display:inline;margin:0">${escapeHtml(String(community.average))}/10 from ${escapeHtml(String(community.count))} ratings</dd></div>`
        : ''}
    </dl>`;

  const content = `
    ${bannerHtml}
    <main class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="uppercase" style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,52px);line-height:0.95">${escapeHtml(title)}</h1>
      ${factsHtml}
      ${synopsis ? `<h2 style="font-family:Anton,Impact,sans-serif;font-size:22px;margin-top:24px">Synopsis</h2>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7">${escapeHtml(synopsis)}</p>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:13px;opacity:.7;margin-top:10px">Synopsis and artwork via <a href="https://anilist.co">AniList</a>. Score via MyAnimeList. See <a href="/about">About</a> for full sourcing.</p>` : ''}
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;margin-top:20px"><a href="/browse">Browse more anime</a></p>
    </main>`;

  let html = injectHead(SHELL, {
    title: pageTitle,
    description,
    canonical: `${ORIGIN}/anime/${row.id}`,
    image: row.cover_image || image,
    ld,
  });
  return injectBody(html, content);
}

/** A well-formed id with no row behind it is a genuine 404, not a soft one. */
function renderMissing() {
  return injectHead(
    injectBody(SHELL, `
      <main class="mx-auto max-w-3xl px-4 py-16" style="text-align:center">
        <h1 style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,48px)">Not in the archive</h1>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif">This title is not in the Rebyuu catalogue.</p>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif"><a href="/browse">Browse the catalogue</a></p>
      </main>`),
    {
      title: 'Not in the archive · Rebyuu',
      description: 'This title is not in the Rebyuu catalogue.',
      canonical: `${ORIGIN}/browse`,
      robots: 'noindex, follow',
    }
  );
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, ORIGIN);
    const route = url.searchParams.get('route');

    if (route === 'anime') {
      const id = url.searchParams.get('id') || '';
      if (!/^anilist-\d+$/.test(id)) return send(res, 404, renderMissing());

      const [rows, ratings] = await Promise.all([
        sb(`anime_index?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
        sb(`ratings?anime_id=eq.${encodeURIComponent(id)}&select=rating`),
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

      return send(res, 200, renderAnime(rows[0], community));
    }

    return send(res, 200, renderHome());
  } catch {
    // Never let this function be the reason the site is down. The shell alone
    // is exactly what the site served before this existed.
    return send(res, 200, SHELL);
  }
}
