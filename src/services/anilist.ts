/**
 * Live ranking + score lookups.
 *
 * `anime_index` is a one-shot snapshot (populated by scripts/syncAnime.ts and
 * never re-run), so ordering rows by `rating` produced the same list forever.
 * These helpers pull the *ranking* live from AniList and the MAL score from
 * Jikan, while the row data itself still comes from Supabase.
 *
 * Both APIs send `access-control-allow-origin: *`, so they are callable
 * straight from the browser — no proxy or serverless route needed.
 *
 * Caching is keyed by UTC date rather than by a TTL timestamp: a new day means
 * a new key, so every cache rolls over at midnight UTC on its own. That is the
 * whole "refreshes every day" mechanism.
 */

const ANILIST_API = 'https://graphql.anilist.co';
const JIKAN_API = 'https://api.jikan.moe/v4';
const CACHE_PREFIX = 'rebyuu:v1:';

export type AniListSort =
  | 'TRENDING_DESC'
  | 'POPULARITY_DESC'
  | 'FAVOURITES_DESC'
  | 'SCORE_DESC';

export type AniListStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED';

export interface RankedEntry {
  /** Matches the `anime_index.id` convention, e.g. "anilist-16498". */
  id: string;
  anilistId: number;
  malId: number | null;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reads a same-day cache entry. Every accessor is guarded: Safari private mode
 * throws on access rather than returning null, so a bare read can hard-fail the
 * page.
 */
function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key + ':' + utcDay());
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key + ':' + utcDay(),
      JSON.stringify(value)
    );
    pruneStaleCache();
  } catch {
    /* quota exceeded or storage blocked — caching is best-effort */
  }
}

/** Drops entries from previous days so the date-keying can't leak storage. */
function pruneStaleCache(): void {
  try {
    const today = ':' + utcDay();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && !k.endsWith(today)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* non-critical */
  }
}

const RANKED_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: $sort, status: $status, isAdult: false) {
        id
        idMal
      }
    }
  }
`;

const BY_IDS_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(type: ANIME, id_in: $ids) {
        id
        idMal
      }
    }
  }
`;

async function anilistRequest<T>(query: string, variables: unknown): Promise<T | null> {
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors) return null;
    return json.data as T;
  } catch {
    // Offline, rate-limited, or blocked. Callers fall back to the DB ordering.
    return null;
  }
}

/**
 * Live ranking for a section. Returns [] on any failure so callers can fall
 * back to their existing Supabase query rather than rendering an empty page.
 */
export async function fetchRanked(
  sort: AniListSort,
  limit: number,
  status?: AniListStatus
): Promise<RankedEntry[]> {
  const cacheKey = `ranked:${sort}:${status ?? 'any'}:${limit}`;
  const cached = readCache<RankedEntry[]>(cacheKey);
  if (cached) return cached;

  const data = await anilistRequest<{
    Page: { media: { id: number; idMal: number | null }[] };
  }>(RANKED_QUERY, {
    page: 1,
    // AniList caps perPage at 50.
    perPage: Math.min(limit, 50),
    sort: [sort],
    status,
  });

  const media = data?.Page?.media;
  if (!media?.length) return [];

  const entries: RankedEntry[] = media.map((m) => ({
    id: `anilist-${m.id}`,
    anilistId: m.id,
    malId: m.idMal,
  }));
  writeCache(cacheKey, entries);
  return entries;
}

/**
 * Resolves AniList ids to MAL ids in a single batched request, so the hero can
 * look up its whole rotation pool at once instead of one call per slide.
 */
export async function fetchMalIds(
  anilistIds: number[]
): Promise<Record<number, number | null>> {
  if (!anilistIds.length) return {};
  const ids = anilistIds.slice(0, 50);
  const cacheKey = `malids:${ids.join(',')}`;
  const cached = readCache<Record<number, number | null>>(cacheKey);
  if (cached) return cached;

  const data = await anilistRequest<{
    Page: { media: { id: number; idMal: number | null }[] };
  }>(BY_IDS_QUERY, { ids });

  const map: Record<number, number | null> = {};
  for (const m of data?.Page?.media ?? []) map[m.id] = m.idMal;
  if (Object.keys(map).length) writeCache(cacheKey, map);
  return map;
}

export interface TitleSet {
  english: string | null;
  romaji: string | null;
  native: string | null;
}

const TITLES_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(type: ANIME, id_in: $ids) {
        id
        title { english romaji native }
      }
    }
  }
`;

/**
 * Title variants for up to 50 ids per call.
 *
 * `anime_index.title` stores a single collapsed string (`english || romaji`),
 * so the alternate spelling simply isn't in our data — it has to come from
 * AniList for the EN/JP switch to have anything to switch to.
 */
export async function fetchTitles(
  anilistIds: number[]
): Promise<Record<number, TitleSet>> {
  if (!anilistIds.length) return {};
  const ids = [...new Set(anilistIds)].slice(0, 50).sort((a, b) => a - b);
  const cacheKey = `titles:${ids.join(',')}`;
  const cached = readCache<Record<number, TitleSet>>(cacheKey);
  if (cached) return cached;

  const data = await anilistRequest<{
    Page: { media: { id: number; title: TitleSet }[] };
  }>(TITLES_QUERY, { ids });

  const map: Record<number, TitleSet> = {};
  for (const m of data?.Page?.media ?? []) map[m.id] = m.title;
  if (Object.keys(map).length) writeCache(cacheKey, map);
  return map;
}

export interface MalScore {
  score: number | null;
  scoredBy: number | null;
  rank: number | null;
}

/**
 * MAL score for one title, fetched on demand.
 *
 * Jikan's rate limit (3/sec, 60/min) is per client IP, and this runs in the
 * visitor's own browser, so each visitor has their own budget. The hero rotates
 * every 7s (~8 requests/minute) and same-day repeats are served from cache.
 */
export async function fetchMalScore(malId: number): Promise<MalScore | null> {
  const cacheKey = `mal:${malId}`;
  const cached = readCache<MalScore>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${JIKAN_API}/anime/${malId}`);
    // 429 = rate limited, 404 = no such MAL entry. Both are non-fatal.
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data;
    if (!d) return null;

    const result: MalScore = {
      score: typeof d.score === 'number' ? d.score : null,
      scoredBy: typeof d.scored_by === 'number' ? d.scored_by : null,
      rank: typeof d.rank === 'number' ? d.rank : null,
    };
    writeCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
