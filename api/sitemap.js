import { animePath } from './_paths.js';

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

export const MIN_SYNOPSIS_CHARS = 130;
export const MIN_RATING = 6;

/**
 * Which titles are submitted. Every title page stays crawlable; this is only
 * the set we actively vouch for.
 *
 *   - a synopsis of at least MIN_SYNOPSIS_CHARS — below that the page is
 *     little more than a title and a poster; and then either
 *   - released and rated at least MIN_RATING, or
 *   - airing now, rated or not — new shows have no score for their first
 *     weeks, which is exactly when people search for them, or
 *   - announced for this year or later. An "upcoming" row from years ago is
 *     an announcement that went nowhere.
 *
 * PostgREST has no length() filter, so the synopsis rule is a LIKE pattern:
 * MIN_SYNOPSIS_CHARS single-character wildcards then "anything" matches
 * exactly the strings at least that long.
 */
function gate() {
  const year = new Date().getUTCFullYear();
  return [
    `description=like.${'_'.repeat(MIN_SYNOPSIS_CHARS)}*`,
    `or=(and(rating.gte.${MIN_RATING},status.neq.upcoming),status.eq.airing,and(status.eq.upcoming,year.gte.${year}))`,
  ].join('&');
}

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
  const { contentRange } = await query(`anime_index?select=id&${gate()}`, { from: 0, to: 0, count: true });
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
      query(`anime_index?select=id,title,updated_at&${gate()}&order=id.asc`, { from, to: from + ROWS_PER_REQUEST - 1 })
    );
  }
  return (await Promise.all(chunks)).flatMap((c) => c.rows);
}

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const day = (timestamp) => (/^\d{4}-\d{2}-\d{2}/.test(timestamp || '') ? timestamp.slice(0, 10) : null);

function urlset(rows) {
  const urls = rows.map((row) => {
    const lastmod = day(row.updated_at);
    return `  <url>\n    <loc>${xmlEscape(ORIGIN + animePath(row))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function sitemapIndex(pages) {
  const entries = ['sitemap-static.xml', ...Array.from({ length: pages }, (_, i) => `sitemap-anime-${i + 1}.xml`)];
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
      return rows.length ? send(res, 200, urlset(rows)) : send(res, 404, '');
    }
    return send(res, 404, '');
  } catch {
    // Never an empty 200: that would tell search engines every title page had
    // been withdrawn. A 503 says "come back later", which is the truth.
    res.setHeader('Retry-After', '600');
    return send(res, 503, '');
  }
}
