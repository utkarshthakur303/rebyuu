/**
 * Test doubles for the two network dependencies of api/render.js: Supabase's
 * PostgREST endpoint and AniList's GraphQL endpoint.
 *
 * The Supabase fake is a small in-memory PostgREST — it evaluates the filters
 * the renderer actually sends (eq, neq, in, gte, lte, ov, order, limit)
 * against a fixture table — so tests assert on what the page renders for a
 * given catalogue, not on the exact URL string a query happened to use.
 */

export const SUPABASE_URL = 'https://sb.test';

process.env.VITE_SUPABASE_URL = SUPABASE_URL;
process.env.VITE_SUPABASE_KEY = 'test-key';

/** Imported after the env is set, because render.js reads it at load time. */
export async function loadHandler() {
  const mod = await import('../api/render.js');
  return mod.default;
}

export function anime(id, title, extra = {}) {
  return {
    id: `anilist-${id}`,
    title,
    rating: null,
    genres: [],
    year: null,
    season: null,
    status: 'completed',
    episodes: 12,
    description: null,
    cover_image: `https://img.test/${id}.jpg`,
    banner_image: null,
    trailer: null,
    anilist_id: id,
    ...extra,
  };
}

function parseList(raw) {
  // "{a,\"b c\"}" or "(a,b)" -> ["a", "b c"]
  const inner = raw.slice(1, -1);
  if (!inner) return [];
  return inner.match(/"[^"]*"|[^,]+/g).map((s) => s.replace(/^"|"$/g, ''));
}

function coerce(value, sample) {
  return typeof sample === 'number' ? Number(value) : value;
}

function applyFilter(rows, column, expr) {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  return rows.filter((row) => {
    const v = row[column];
    switch (op) {
      case 'eq': return v != null && String(v) === arg;
      case 'neq': return v == null || String(v) !== arg;
      case 'in': return parseList(arg).includes(String(v));
      case 'gte': return v != null && v >= coerce(arg, v);
      case 'lte': return v != null && v <= coerce(arg, v);
      case 'ov': {
        const wanted = parseList(arg);
        return Array.isArray(v) && v.some((g) => wanted.includes(g));
      }
      default: throw new Error(`fake PostgREST: unsupported operator ${op}`);
    }
  });
}

function applyOrder(rows, spec) {
  const [column, dir = 'asc', nulls] = spec.split('.');
  const nullsLast = nulls === 'nullslast' || (nulls !== 'nullsfirst' && dir === 'asc');
  return [...rows].sort((a, b) => {
    const x = a[column];
    const y = b[column];
    if (x == null && y == null) return 0;
    if (x == null) return nullsLast ? 1 : -1;
    if (y == null) return nullsLast ? -1 : 1;
    return dir === 'desc' ? (y > x ? 1 : y < x ? -1 : 0) : (x > y ? 1 : x < y ? -1 : 0);
  });
}

/** Evaluates one PostgREST GET against `tables`. */
function postgrest(tables, url) {
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = tables[table];
  if (!rows) throw new Error(`fake PostgREST: no fixture table ${table}`);
  let order = null;
  let limit = null;
  for (const [key, value] of url.searchParams) {
    if (key === 'select') continue;
    if (key === 'order') order = value;
    else if (key === 'limit') limit = Number(value);
    else rows = applyFilter(rows, key, value);
  }
  if (order) rows = applyOrder(rows, order);
  if (limit != null) rows = rows.slice(0, limit);
  return rows;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Installs a fake global fetch.
 *
 *   tables   — { anime_index: [...], ratings: [...] }, or null to simulate a
 *              Supabase outage (every request fails).
 *   anilist  — the `data` object an AniList GraphQL request resolves to, or
 *              null to simulate AniList being down.
 *
 * Returns the list of requests made, for the few tests that care.
 */
export function installFetch({ tables = { anime_index: [], ratings: [] }, anilist = null } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init });
    if (url.origin === SUPABASE_URL) {
      if (!tables) return json({ message: 'down' }, 503);
      return json(postgrest(tables, url));
    }
    if (url.hostname === 'graphql.anilist.co') {
      if (!anilist) return json({ errors: [{ message: 'down' }] }, 500);
      return json({ data: anilist });
    }
    throw new Error(`unexpected fetch to ${url}`);
  };
  return calls;
}

/** AniList `Page { media { id } }` shape for a list of numeric ids. */
export const page = (ids) => ({ media: ids.map((id) => ({ id })) });

export async function render(handler, query) {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
  };
  await handler({ url: `/api/render?${query}` }, res);
  return res;
}

/** The HTML inside #root, i.e. what was injected for this route. */
export function rootOf(html) {
  const start = html.indexOf('<div id="root">');
  const end = html.lastIndexOf('</div>');
  return html.slice(start, end);
}

/** hrefs of every /anime/ link inside `html`, in document order. */
export function animeLinks(html) {
  return [...html.matchAll(/href="\/anime\/(anilist-\d+)"/g)].map((m) => m[1]);
}

/** The slice of `html` from the heading containing `label` to the next <h2>. */
export function section(html, label) {
  const at = html.indexOf(label);
  if (at === -1) return '';
  const next = html.indexOf('<h2', at + label.length);
  return html.slice(at, next === -1 ? undefined : next);
}
