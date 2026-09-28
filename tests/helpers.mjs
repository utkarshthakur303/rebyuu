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

/** PostgREST `like` pattern ("*" or "%" = any run, "_" = one char) as a RegExp. */
function likeToRegExp(pattern) {
  const body = pattern
    .split('')
    .map((c) => (c === '*' || c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`, 's');
}

/** Does `row` satisfy `column=op.arg`? */
function matches(row, column, expr) {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  const v = row[column];
  switch (op) {
    case 'eq': return v != null && String(v) === arg;
    case 'neq': return v == null || String(v) !== arg;
    case 'in': return parseList(arg).includes(String(v));
    case 'gte': return v != null && v >= coerce(arg, v);
    case 'gt': return v != null && v > coerce(arg, v);
    case 'lte': return v != null && v <= coerce(arg, v);
    case 'lt': return v != null && v < coerce(arg, v);
    case 'is': return arg === 'null' ? v == null : String(v) === arg;
    case 'not': return !matches(row, column, arg);
    case 'like': return v != null && likeToRegExp(arg).test(String(v));
    case 'ov': {
      const wanted = parseList(arg);
      return Array.isArray(v) && v.some((g) => wanted.includes(g));
    }
    default: throw new Error(`fake PostgREST: unsupported operator ${op}`);
  }
}

/** Splits "a,and(b,c),d" at top-level commas. */
function splitTop(list) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Evaluates a logic-tree term: "and(x.eq.1,y.gt.2)", "or(...)" or "col.op.arg". */
function evalTerm(row, term) {
  const group = term.match(/^(and|or)\((.*)\)$/s);
  if (group) {
    const terms = splitTop(group[2]);
    return group[1] === 'and' ? terms.every((t) => evalTerm(row, t)) : terms.some((t) => evalTerm(row, t));
  }
  const dot = term.indexOf('.');
  return matches(row, term.slice(0, dot), term.slice(dot + 1));
}

function applyFilter(rows, column, expr) {
  if (column === 'or' || column === 'and') return rows.filter((row) => evalTerm(row, `${column}${expr}`));
  return rows.filter((row) => matches(row, column, expr));
}

function compareBy(term) {
  const [column, dir = 'asc', nulls] = term.split('.');
  const nullsLast = nulls === 'nullslast' || (nulls !== 'nullsfirst' && dir === 'asc');
  return (a, b) => {
    const x = a[column];
    const y = b[column];
    if (x == null && y == null) return 0;
    if (x == null) return nullsLast ? 1 : -1;
    if (y == null) return nullsLast ? -1 : 1;
    return dir === 'desc' ? (y > x ? 1 : y < x ? -1 : 0) : (x > y ? 1 : x < y ? -1 : 0);
  };
}

/** "rating.desc.nullslast,id.asc" — terms applied left to right. */
function applyOrder(rows, spec) {
  const comparators = spec.split(',').map(compareBy);
  return [...rows].sort((a, b) => {
    for (const cmp of comparators) {
      const r = cmp(a, b);
      if (r) return r;
    }
    return 0;
  });
}

/** Evaluates one PostgREST GET against `tables`. Returns { rows, total }. */
function postgrest(tables, url, missingColumns) {
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = tables[table];
  if (!rows) throw new Error(`fake PostgREST: no fixture table ${table}`);
  let order = null;
  let limit = null;
  let select = null;
  for (const [key, value] of url.searchParams) {
    if (key === 'select') select = value;
    else if (key === 'order') order = value;
    else if (key === 'limit') limit = Number(value);
    else rows = applyFilter(rows, key, value);
  }
  const columns = select && select !== '*' ? splitTop(select) : null;
  const missing = (columns || []).filter((c) => missingColumns.has(c));
  if (missing.length) {
    const err = new Error(`column anime_index.${missing[0]} does not exist`);
    err.status = 400;
    err.code = '42703';
    throw err;
  }
  if (order) rows = applyOrder(rows, order);
  const total = rows.length;
  if (limit != null) rows = rows.slice(0, limit);
  if (columns && columns.every((c) => /^\w+$/.test(c))) {
    rows = rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
  }
  return { rows, total };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Installs a fake global fetch.
 *
 *   tables          — { anime_index: [...], ratings: [...] }, or null to
 *                     simulate a Supabase outage (every request fails).
 *   anilist         — the `data` object an AniList GraphQL request resolves
 *                     to, or null to simulate AniList being down.
 *   missingColumns  — columns the database does not have yet; selecting one
 *                     fails the way PostgREST does before a migration runs.
 *
 * Honours `Range: from-to` and `Prefer: count=exact` (Content-Range header),
 * as PostgREST does. Returns the list of requests made.
 */
export function installFetch({ tables = { anime_index: [], ratings: [] }, anilist = null, missingColumns = [] } = {}) {
  const calls = [];
  const missing = new Set(missingColumns);
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init });
    if (url.origin === SUPABASE_URL) {
      if (!tables) return json({ message: 'down' }, 503);
      let result;
      try {
        result = postgrest(tables, url, missing);
      } catch (err) {
        if (err.status) return json({ code: err.code, message: err.message }, err.status);
        throw err;
      }
      const headers = new Headers(init.headers || {});
      let { rows } = result;
      let from = 0;
      const range = headers.get('Range')?.match(/^(\d+)-(\d+)$/);
      if (range) {
        from = Number(range[1]);
        rows = rows.slice(from, Number(range[2]) + 1);
      }
      const res = json(rows);
      if (/count=exact/.test(headers.get('Prefer') || '')) {
        res.headers.set('Content-Range', `${rows.length ? `${from}-${from + rows.length - 1}` : '*'}/${result.total}`);
      }
      return res;
    }
    if (url.hostname === 'graphql.anilist.co') {
      if (!anilist) return json({ errors: [{ message: 'down' }] }, 500);
      return json({ data: typeof anilist === 'function' ? anilist(JSON.parse(init.body)) : anilist });
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
