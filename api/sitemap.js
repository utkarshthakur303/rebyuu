import { animePath } from './_paths.js';
import { episodePath, episodeActivity, indexableEpisodes } from './_episodes.js';
import { qualityFilter } from './_quality.js';
import { censusPath, indexedHubPaths } from './_hubdb.js';

/**
 * XML sitemaps for title pages, generated from anime_index on request.
 *
 * These used to be a static file written once, on 24 August, from the
 * catalogue as it stood that day. The nightly sync kept adding titles and the
 * sitemap never heard about them: when this replaced it, none of the 65
 * titles of the Fall 2026 season were in it — and a new season's shows are
 * where competition in search is thinnest, for the few weeks it matters.
 *
 *   /sitemap-index.xml     -> ?kind=index      the static sitemap + every anime page
 *   /sitemap-anime-N.xml   -> ?kind=anime&page=N
 *   /sitemap-episodes.xml  -> ?kind=episodes   indexable episode pages (_episodes.js)
 *   /sitemap-hubs.xml      -> ?kind=hubs       season, airing and upcoming pages (_hubdb.js)
 *
 * lastmod comes from anime_index.updated_at. That is only meaningful because
 * the sync writes a row only when something in it changed; before that, every
 * nightly upsert bumped it whether or not anything had.
 */

const ORIGIN = 'https://www.rebyuu.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

/** The protocol allows 50,000; smaller files keep each response quick. */
export const URLS_PER_SITEMAP = 10_000;

/** PostgREST's default cap on rows in one response. */
const ROWS_PER_REQUEST = 1000;

async function query(path, { from, to, count = false } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured');
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  if (from != null) headers.Range = `${from}-${to}`;
  if (count) headers.Prefer = 'count=exact';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  // PostgREST answers a range past the last row with 416; that is "no rows".
  if (res.status === 416) return { rows: [], contentRange: res.headers.get('content-range') };
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
  return { rows: await res.json(), contentRange: res.headers.get('content-range') };
}

async function countTitles() {
  const { contentRange } = await query(`anime_index?select=id&${qualityFilter()}`, { from: 0, to: 0, count: true });
  const total = Number(contentRange?.split('/')[1]);
  if (!Number.isFinite(total)) throw new Error('Supabase returned no count');
  return total;
}

/** The titles on sitemap page `page` (1-based), in a stable order. */
async function titlesOnPage(page) {
  const first = (page - 1) * URLS_PER_SITEMAP;
  const chunks = [];
  for (let from = first; from < first + URLS_PER_SITEMAP; from += ROWS_PER_REQUEST) {
    chunks.push(
      query(`anime_index?select=id,title,updated_at&${qualityFilter()}&order=id.asc`, { from, to: from + ROWS_PER_REQUEST - 1 })
    );
  }
  return (await Promise.all(chunks)).flatMap((c) => c.rows);
}

/** Every row of a query, a page of ROWS_PER_REQUEST at a time. */
async function allRows(path) {
  const rows = [];
  for (let from = 0; ; from += ROWS_PER_REQUEST) {
    const page = await query(path, { from, to: from + ROWS_PER_REQUEST - 1 });
    rows.push(...page.rows);
    if (page.rows.length < ROWS_PER_REQUEST) return rows;
  }
}

/**
 * The indexable episode pages: those with comments or enough ratings, plus
 * each airing show's latest and next episode. The airing half needs the
 * next-episode columns; before their migration runs that query fails, and
 * the sitemap lists the discussed episodes alone.
 */
async function episodePaths() {
  const [comments, ratings] = await Promise.all([
    allRows('episode_comments?select=anime_id,episode_number&order=id.asc'),
    allRows('episode_ratings?select=anime_id,episode_number&order=id.asc'),
  ]);
  const airing = await allRows('anime_index?select=*&status=eq.airing&next_episode=not.is.null&order=id.asc').catch(() => []);

  const byTitle = new Map();
  const add = (row, key) => {
    if (!byTitle.has(row.anime_id)) byTitle.set(row.anime_id, { comments: [], ratings: [] });
    byTitle.get(row.anime_id)[key].push(row);
  };
  comments.forEach((c) => add(c, 'comments'));
  ratings.forEach((r) => add(r, 'ratings'));

  const rows = new Map(airing.map((row) => [row.id, row]));
  const missing = [...byTitle.keys()].filter((id) => !rows.has(id));
  for (let i = 0; i < missing.length; i += 200) {
    const chunk = missing.slice(i, i + 200).map(encodeURIComponent).join(',');
    for (const row of (await query(`anime_index?select=*&id=in.(${chunk})`)).rows) rows.set(row.id, row);
  }

  const paths = [];
  for (const row of rows.values()) {
    const activity = byTitle.get(row.id);
    for (const n of indexableEpisodes(row, episodeActivity(activity?.comments, activity?.ratings))) {
      paths.push(episodePath(row, n));
    }
  }
  return paths;
}

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const day = (timestamp) => (/^\d{4}-\d{2}-\d{2}/.test(timestamp || '') ? timestamp.slice(0, 10) : null);

/** entries: [{ path, lastmod? }] */
function urlset(entries) {
  const urls = entries.map(({ path, lastmod }) =>
    `  <url>\n    <loc>${xmlEscape(ORIGIN + path)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function sitemapIndex(pages) {
  const entries = ['sitemap-static.xml', 'sitemap-hubs.xml', 'sitemap-episodes.xml', ...Array.from({ length: pages }, (_, i) => `sitemap-anime-${i + 1}.xml`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((file) => `  <sitemap>\n    <loc>${ORIGIN}/${file}</loc>\n  </sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;
}

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    status === 200 ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store'
  );
  res.status(status).send(body);
}

export default async function handler(req, res) {
  const url = new URL(req.url, ORIGIN);
  const kind = url.searchParams.get('kind');
  try {
    if (kind === 'index') {
      return send(res, 200, sitemapIndex(Math.ceil((await countTitles()) / URLS_PER_SITEMAP)));
    }
    if (kind === 'anime') {
      const page = Number(url.searchParams.get('page'));
      if (!Number.isInteger(page) || page < 1) return send(res, 404, '');
      const rows = await titlesOnPage(page);
      return rows.length
        ? send(res, 200, urlset(rows.map((row) => ({ path: animePath(row), lastmod: day(row.updated_at) }))))
        : send(res, 404, '');
    }
    if (kind === 'hubs') {
      // A season is listed the day the sync brings it 12 quality titles. The
      // same count decides each page's robots tag, so nothing listed says noindex.
      return send(res, 200, urlset(indexedHubPaths(await allRows(censusPath())).map((path) => ({ path }))));
    }
    if (kind === 'episodes') {
      // An empty list is a valid answer here: no episode has earned a page yet.
      return send(res, 200, urlset((await episodePaths()).map((path) => ({ path }))));
    }
    return send(res, 404, '');
  } catch {
    // Never an empty 200: that would tell search engines every title page had
    // been withdrawn. A 503 says "come back later", which is the truth.
    res.setHeader('Retry-After', '600');
    return send(res, 503, '');
  }
}
