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
  | 'SCORE_DESC'
  | 'START_DATE_DESC';

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

export async function anilistRequest<T>(
  query: string,
  variables: unknown,
  timeoutMs?: number
): Promise<T | null> {
  // Without a deadline a slow AniList response holds the caller open
  // indefinitely — a search request was observed taking 18s, which would have
  // left the suggestion dropdown spinning that whole time.
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors) return null;
    return json.data as T;
  } catch {
    // Offline, rate-limited, timed out, or blocked. Callers fall back to the
    // DB ordering.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
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

export interface AniListMedia {
  id: number;
  title: TitleSet;
  /** Alternate spellings and abbreviations ("AoT", "SnK"). */
  synonyms: string[];
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  year: number | null;
  season: string | null;
  status: string | null;
  episodes: number | null;
  description: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  trailer: string | null;
}

/** Every field `anime_index` stores, so a result can stand in for a DB row. */
const MEDIA_FIELDS = `
  id
  title { english romaji native }
  synonyms
  averageScore
  popularity
  genres
  startDate { year }
  season
  status
  episodes
  description
  coverImage { large }
  bannerImage
  trailer { id site }
`;

const SEARCH_QUERY = `
  query ($q: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, search: $q, sort: [SEARCH_MATCH], isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const MEDIA_BY_ID_QUERY = `
  query ($id: Int) {
    Media(type: ANIME, id: $id) {
      ${MEDIA_FIELDS}
    }
  }
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function normaliseMedia(m: any): AniListMedia | null {
  if (!m || typeof m.id !== 'number') return null;
  return {
    id: m.id,
    title: {
      english: m.title?.english ?? null,
      romaji: m.title?.romaji ?? null,
      native: m.title?.native ?? null,
    },
    synonyms: Array.isArray(m.synonyms) ? m.synonyms.filter((s: unknown) => typeof s === 'string') : [],
    averageScore: typeof m.averageScore === 'number' ? m.averageScore : null,
    popularity: typeof m.popularity === 'number' ? m.popularity : null,
    genres: Array.isArray(m.genres) ? m.genres : [],
    year: m.startDate?.year ?? null,
    season: m.season ?? null,
    status: m.status ?? null,
    episodes: typeof m.episodes === 'number' ? m.episodes : null,
    description: typeof m.description === 'string' ? m.description : null,
    coverImage: m.coverImage?.large ?? null,
    bannerImage: m.bannerImage ?? null,
    trailer:
      m.trailer?.site === 'youtube' && m.trailer?.id
        ? `https://www.youtube.com/watch?v=${m.trailer.id}`
        : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Search results are held in memory rather than localStorage: queries are
 * high-cardinality (one entry per prefix the visitor types), so persisting them
 * would churn through the storage quota and evict the caches that matter.
 */
const searchMemo = new Map<string, AniListMedia[]>();
const SEARCH_MEMO_MAX = 120;

/**
 * Full-text search straight from AniList.
 *
 * This is what makes the box find titles the local index can't: `anime_index`
 * collapses each title to one string (`english || romaji`), so a row stored as
 * "Attack on Titan" is unreachable by its romaji name and vice versa. AniList
 * matches against english, romaji, native *and* synonyms, and also knows about
 * shows announced since the last nightly sync.
 *
 * Returns [] on any failure — the Supabase results still stand on their own.
 */
export async function searchAnime(
  query: string,
  perPage: number = 12
): Promise<AniListMedia[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const key = `${q.toLowerCase()}:${perPage}`;
  const memo = searchMemo.get(key);
  if (memo) return memo;

  const data = await anilistRequest<{ Page: { media: unknown[] } }>(
    SEARCH_QUERY,
    { q, perPage: Math.min(perPage, 50) },
    // Type-ahead budget: past this the local results are better than a wait.
    3000
  );

  const results = (data?.Page?.media ?? [])
    .map(normaliseMedia)
    .filter((m): m is AniListMedia => m !== null);

  if (results.length) {
    // Cheap FIFO bound; the oldest key is the first one insertion order yields.
    if (searchMemo.size >= SEARCH_MEMO_MAX) {
      const oldest = searchMemo.keys().next().value;
      if (oldest !== undefined) searchMemo.delete(oldest);
    }
    searchMemo.set(key, results);
  }
  return results;
}

/**
 * One title by AniList id, used when a detail page is opened for something the
 * local index doesn't have — a brand-new show, or a stale bookmark.
 */
export async function fetchMediaById(anilistId: number): Promise<AniListMedia | null> {
  const cacheKey = `media:${anilistId}`;
  const cached = readCache<AniListMedia>(cacheKey);
  if (cached) return cached;

  const data = await anilistRequest<{ Media: unknown }>(MEDIA_BY_ID_QUERY, {
    id: anilistId,
  });
  const media = normaliseMedia(data?.Media);
  if (media) writeCache(cacheKey, media);
  return media;
}

/**
 * A page of a live ranking, with the filters applied upstream.
 *
 * `fetchRanked` above returns bare ids for the homepage rails, which then get
 * hydrated from `anime_index`. Browse can't work that way: hydration silently
 * drops any id missing from our snapshot, which is fine when you are filling
 * eight cards from a pool of fifty but not when the page claims to show
 * "all trending" — the counts would never add up and page 40 could come back
 * half empty. So this returns full media and Browse renders it directly.
 */
const RANKED_PAGE_QUERY = `
  query (
    $page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus,
    $genres: [String], $excludeGenres: [String],
    $season: MediaSeason, $seasonYear: Int,
    $startFrom: FuzzyDateInt, $startTo: FuzzyDateInt
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        sort: $sort
        status: $status
        genre_in: $genres
        genre_not_in: $excludeGenres
        season: $season
        seasonYear: $seasonYear
        startDate_greater: $startFrom
        startDate_lesser: $startTo
        isAdult: false
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export interface RankedPageParams {
  sort: AniListSort;
  page: number;
  perPage: number;
  status?: AniListStatus;
  genres?: string[];
  /**
   * Genres to exclude upstream. Done in the query rather than by filtering the
   * response so pages come back full — dropping rows client-side would leave
   * short, ragged pages.
   */
  excludeGenres?: string[];
  /** Display-cased ("Winter"); mapped to AniList's enum internally. */
  season?: string;
  year?: number;
}

export interface RankedPage {
  media: AniListMedia[];
  /**
   * Authoritative. `pageInfo.total` deliberately is not exposed: AniList
   * reports it as an estimate that changes as you page. The same Fall-2026
   * query returned total=5000/lastPage=500 on page 1, total=89/lastPage=9 on
   * page 9 (the true figure), and total=290 with zero results on page 30.
   * Only "is there another page" can be relied on, so that is all Browse gets
   * — and an empty page means the end regardless of what the flag claims.
   */
  hasNextPage: boolean;
}

/**
 * Ranked pages are memoised in memory rather than localStorage. Each entry is
 * a full page of media (~25KB), and the filter combinations a visitor clicks
 * through are effectively unbounded — persisting them would burn the storage
 * quota and evict the small, genuinely reusable caches above.
 */
const rankedPageMemo = new Map<string, RankedPage>();
const RANKED_PAGE_MEMO_MAX = 40;

const SEASON_ENUM: Record<string, string> = {
  winter: 'WINTER',
  spring: 'SPRING',
  summer: 'SUMMER',
  fall: 'FALL',
};

export async function fetchRankedPage(
  params: RankedPageParams
): Promise<RankedPage | null> {
  const { sort, page, perPage, status, genres, excludeGenres, season, year } = params;
  const key = JSON.stringify([
    sort, page, perPage, status, genres, excludeGenres, season, year, utcDay(),
  ]);
  const memo = rankedPageMemo.get(key);
  if (memo) return memo;

  const seasonEnum = season ? SEASON_ENUM[season.toLowerCase()] : undefined;

  // A year on its own is a start-date range, not a season year: seasonYear is
  // null for movies, OVAs and specials, so filtering on it would quietly hide
  // every non-seasonal release. When a season *is* chosen the pair is the
  // correct model, and AniList indexes it far better than a date range.
  const useSeasonYear = Boolean(seasonEnum && year);

  const data = await anilistRequest<{
    Page: {
      pageInfo: { hasNextPage: boolean };
      media: unknown[];
    };
  }>(
    RANKED_PAGE_QUERY,
    {
      page,
      perPage: Math.min(perPage, 50),
      sort: [sort],
      status,
      genres: genres?.length ? genres : undefined,
      excludeGenres: excludeGenres?.length ? excludeGenres : undefined,
      season: seasonEnum,
      seasonYear: useSeasonYear ? year : undefined,
      startFrom: !useSeasonYear && year ? year * 10000 - 1 : undefined,
      startTo: !useSeasonYear && year ? (year + 1) * 10000 : undefined,
    },
    // Browse is a full page load, not a type-ahead, so it can wait longer than
    // the search box — but not indefinitely, or a stalled request leaves the
    // grid on skeletons with no fallback ever running.
    8000
  );

  if (!data?.Page) return null;

  const media = (data.Page.media ?? [])
    .map(normaliseMedia)
    .filter((m): m is AniListMedia => m !== null);

  const result: RankedPage = {
    media,
    // An empty page is the end of the road whatever the flag says — AniList
    // keeps reporting hasNextPage past the point where it stops returning rows.
    hasNextPage: media.length > 0 && Boolean(data.Page.pageInfo?.hasNextPage),
  };

  if (rankedPageMemo.size >= RANKED_PAGE_MEMO_MAX) {
    const oldest = rankedPageMemo.keys().next().value;
    if (oldest !== undefined) rankedPageMemo.delete(oldest);
  }
  rankedPageMemo.set(key, result);
  return result;
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
