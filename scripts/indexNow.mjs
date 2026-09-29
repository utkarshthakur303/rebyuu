/**
 * IndexNow submission for the nightly catalogue sync.
 *
 * IndexNow tells Bing, Yandex, Seznam, Naver and the other participating
 * engines that a URL changed, instead of waiting for them to recrawl it.
 * Bing's index is also what Copilot and ChatGPT search draw on. Google does
 * not take part, and needs no action here: the sitemap covers it.
 *
 * Only titles the sync actually changed are submitted. The fresh passes
 * upsert every row they fetch, changed or not, and pinging a few hundred
 * unchanged URLs every night is exactly the misuse IndexNow's documentation
 * asks sites to avoid.
 */

export const INDEXNOW_KEY = '51e4575cc2fd6e7cdb863a444f00d95e';

const HOST = 'www.rebyuu.app';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** IndexNow accepts at most 10,000 URLs per request. */
const MAX_URLS_PER_REQUEST = 10_000;

/** The columns syncAnime.ts writes. Anything else on the row is ignored. */
export const SYNCED_COLUMNS = [
  'title', 'rating', 'genres', 'year', 'season', 'status',
  'episodes', 'description', 'cover_image', 'banner_image', 'trailer',
];

/** Timestamp columns: Postgres returns "+00:00", JavaScript writes "Z". */
const TIMESTAMP_COLUMNS = new Set(['next_episode_at']);

/**
 * JSON with object keys sorted, so jsonb values compare by content. Postgres
 * does not keep the key order a row was written with.
 */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameValue(column, a, b) {
  if (a == null || b == null) return a == null && b == null;
  // numeric columns can come back as strings depending on the client.
  if (column === 'rating') return Number(a) === Number(b);
  if (TIMESTAMP_COLUMNS.has(column)) return Date.parse(a) === Date.parse(b);
  return canonical(a) === canonical(b);
}

/**
 * Ids of `incoming` rows that are new, or differ from `existing` in one of
 * `columns` — the columns this sync writes, which include the detail columns
 * only once their migration has run.
 */
export function changedIds(existing, incoming, columns = SYNCED_COLUMNS) {
  const before = new Map(existing.map((row) => [row.id, row]));
  return incoming
    .filter((row) => {
      const old = before.get(row.id);
      return !old || columns.some((c) => !sameValue(c, old[c], row[c]));
    })
    .map((row) => row.id);
}

/**
 * What the sync should write for one page of titles.
 *
 * Only new or changed rows are written, each stamped with `now` as its
 * updated_at. The table's trigger bumps updated_at on every UPDATE, and the
 * sitemap publishes it as lastmod — so rewriting unchanged rows, as the sync
 * used to, told search engines that ~800 pages changed every night when a few
 * dozen had. `existing` is null when the stored rows could not be read: then
 * everything is written (the catalogue must still update) and nothing is
 * reported as changed.
 */
export function planWrite(existing, incoming, { now = new Date(), columns = SYNCED_COLUMNS } = {}) {
  if (!existing) return { write: incoming, changed: [] };
  const changed = changedIds(existing, incoming, columns);
  const stamp = now.toISOString();
  const write = incoming.filter((row) => changed.includes(row.id)).map((row) => ({ ...row, updated_at: stamp }));
  return { write, changed };
}

/**
 * Submits `paths` — root-relative page paths, built with api/_paths.js so they
 * are the canonical URLs. Never throws: a failed ping must not fail the sync
 * that has already written the catalogue.
 */
export async function submitToIndexNow(paths, { fetchImpl = fetch, log = console.log } = {}) {
  const urls = paths.map((path) => `https://${HOST}${path}`);
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    const urlList = urls.slice(i, i + MAX_URLS_PER_REQUEST);
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: HOST,
          key: INDEXNOW_KEY,
          keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
          urlList,
        }),
      });
      log(`IndexNow: ${urlList.length} URLs submitted, HTTP ${res.status}`);
    } catch (error) {
      log(`IndexNow: submission failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
