import { supabase } from './supabase';
import {
  fetchMediaById,
  fetchRanked,
  fetchRankedPage,
  searchAnime,
  type AniListMedia,
  type AniListSort,
  type AniListStatus,
  type RankedEntry,
} from './anilist';
import { relatedPools, rankRelated, RELATED_SIZE, RELATED_POOL_SIZE } from '../../api/_related.js';
import { episodeActivity } from '../../api/_episodes.js';

export interface Anime {
  id: string;
  title: string;
  rating: number | null;
  genres: string[];
  year: number | null;
  season: string | null;
  status: 'airing' | 'completed' | 'upcoming';
  episodes: number | null;
  description: string | null;
  cover_image: string;
  banner_image: string | null;
  trailer: string | null;
  /* Detail columns (supabase/title_details_migration.sql). Absent on rows
     read before that migration runs, so every one is optional. */
  title_romaji?: string | null;
  title_english?: string | null;
  title_native?: string | null;
  synonyms?: string[];
  format?: string | null;
  source?: string | null;
  duration?: number | null;
  studios?: string[];
  mal_id?: number | null;
  streaming?: { site: string; url: string }[];
  relations?: { id: string; relation: string; title: string | null; year: number | null; format: string | null }[];
  next_episode?: number | null;
  next_episode_at?: string | null;
}

export interface Review {
  id: string;
  anime_id: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

export async function getAnimeList(filters?: {
  genres?: string[];
  year?: number;
  season?: string;
  status?: string;
}): Promise<Anime[]> {
  let query = supabase.from('anime_index').select('*');

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }

  if (filters?.season) {
    query = query.eq('season', filters.season);
  }

  if (filters?.genres && filters.genres.length > 0) {
    query = query.overlaps('genres', filters.genres);
  }

  const { data, error } = await query.order('rating', {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    console.error('Error fetching anime:', error);
    return [];
  }

  return data || [];
}

/**
 * One title by id.
 *
 * Falls back to AniList when the row isn't in our snapshot, so a suggestion for
 * a newly announced show still opens instead of landing on "not found".
 * `.maybeSingle()` rather than `.single()`: the latter treats "no rows" as an
 * error, which made a miss indistinguishable from a real failure.
 */
/**
 * The row the prerender built this page from, when it is the title being
 * asked for. api/render.js hands it over in <script id="rebyuu-boot"> so the
 * detail page's first render has it: no second fetch of the same row, and no
 * spinner between the served page and React's. Client-side navigation to any
 * other title finds no match and fetches as before.
 */
export function readBootAnime(id: string): Anime | null {
  if (typeof document === 'undefined' || !id) return null;
  try {
    const text = document.getElementById('rebyuu-boot')?.textContent;
    const data = text ? JSON.parse(text) : null;
    return data?.anime?.id === id ? (data.anime as Anime) : null;
  } catch {
    return null;
  }
}

export async function getAnimeById(id: string): Promise<Anime | null> {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && !import.meta.env.PROD) {
    console.error('Error fetching anime:', error);
  }
  if (data) return data as Anime;

  const anilistId = Number(String(id).replace(/^anilist-/, ''));
  if (!Number.isFinite(anilistId) || anilistId <= 0) return null;

  const media = await fetchMediaById(anilistId);
  return media ? mediaToAnime(media) : null;
}

/**
 * "More like this" for a title page. The pools and the ranking live in
 * api/_related.js and are shared with the prerender, so these cards are the
 * same titles, in the same order, that the served HTML already linked to.
 */
export async function getRelatedAnime(anime: Anime): Promise<Anime[]> {
  const fetched: Anime[][] = [];
  let picked: Anime[] = [];
  for (const pool of relatedPools(anime)) {
    let q = supabase
      .from('anime_index')
      .select('*')
      .neq('id', anime.id)
      .overlaps('genres', pool.genres);
    if (pool.yearFrom) q = q.gte('year', pool.yearFrom).lte('year', pool.yearTo);
    const { data, error } = await q
      .order('rating', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(RELATED_POOL_SIZE);
    if (error) console.error('Error fetching related anime:', error);
    fetched.push((data as Anime[]) || []);
    picked = rankRelated(anime, fetched);
    if (picked.length === RELATED_SIZE) break;
  }
  return picked;
}

/**
 * Which of `ids` exist in the catalogue, with the title and year to link them
 * by. A title page links a sequel or prequel only when it is here — otherwise
 * the link would be a 404.
 */
export async function getKnownTitles(
  ids: string[]
): Promise<Map<string, { id: string; title: string; year: number | null }>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('anime_index').select('id,title,year').in('id', ids);
  if (error) console.error('Error fetching related titles:', error);
  return new Map((data || []).map((row) => [row.id, row]));
}

/**
 * Rebyuu's own community score for a title: the mean of ratings left by
 * Rebyuu accounts, plus how many it is based on.
 *
 * This is the only rating on a title page that is genuinely first-party. The
 * number shown next to it is AniList's average of AniList users' scores,
 * which is why that one is never marked up as this page's
 * aggregateRating — presenting another platform's verdict as your own is what
 * review-snippet spam guidance exists to stop. This one can be, because it is
 * ours and because the count is real.
 *
 * MIN_RATINGS_FOR_SCORE exists so a title does not display "10.0" off the back
 * of one enthusiastic vote. Below the threshold the caller shows nothing,
 * which is more honest than showing noise.
 *
 * Rows are fetched and averaged in the browser rather than aggregated in
 * Postgres. At present that is trivially cheap — the table is close to empty —
 * but a title with thousands of ratings would be shipping one integer per
 * rating to compute one number. If this ever gets real usage, move it to a
 * view or an RPC; it is deliberately isolated here so that is a one-function
 * change.
 */
export const MIN_RATINGS_FOR_SCORE = 3;

export interface CommunityScore {
  average: number;
  count: number;
}

export async function getCommunityScore(animeId: string): Promise<CommunityScore | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('rating')
    .eq('anime_id', animeId);

  if (error) {
    if (!import.meta.env.PROD) console.error('Error fetching community score:', error);
    return null;
  }
  if (!data || data.length < MIN_RATINGS_FOR_SCORE) return null;

  const total = data.reduce((sum, row) => sum + (row.rating ?? 0), 0);
  return {
    average: Math.round((total / data.length) * 10) / 10,
    count: data.length,
  };
}

export async function getAnimeReviews(animeId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      anime_id,
      user_id,
      content,
      created_at,
      user:users!comments_user_id_fkey (
        username,
        avatar_url
      )
    `)
    .eq('anime_id', animeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }

  const { data: ratingsData } = await supabase
    .from('ratings')
    .select('user_id, rating')
    .eq('anime_id', animeId);

  const ratingsMap = new Map(
    ratingsData?.map(r => [r.user_id, r.rating]) || []
  );

  return (data || []).map((comment: any) => ({
    id: comment.id,
    anime_id: comment.anime_id,
    user_id: comment.user_id,
    rating: ratingsMap.get(comment.user_id) || 0,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      username: comment.user?.username || 'Anonymous',
      avatar_url: comment.user?.avatar_url || null
    }
  }));
}

/**
 * Hydrates a live AniList ranking into full rows from `anime_index`.
 *
 * Supabase returns `.in()` results in arbitrary order, so the ranking is
 * re-applied client-side — otherwise the "trending" order would be lost the
 * moment the rows come back. Ids missing from our snapshot are skipped, which
 * is why callers over-fetch the ranking before slicing to `limit`.
 */
async function hydrateRanked(entries: RankedEntry[], limit: number): Promise<Anime[]> {
  if (!entries.length) return [];

  const ids = entries.map((e) => e.id);
  const { data, error } = await supabase.from('anime_index').select('*').in('id', ids);
  if (error || !data?.length) return [];

  const byId = new Map(data.map((row) => [row.id, row as Anime]));
  const ordered: Anime[] = [];
  for (const entry of entries) {
    const row = byId.get(entry.id);
    if (row) ordered.push(row);
    if (ordered.length === limit) break;
  }
  return ordered;
}

/** Static fallback used whenever the live ranking is unavailable. */
async function rankedFallback(
  limit: number,
  status?: 'airing' | 'completed' | 'upcoming'
): Promise<Anime[]> {
  let q = supabase.from('anime_index').select('*');
  if (status) q = q.eq('status', status);
  // nullsFirst: false — otherwise this fallback fills the homepage sections
  // with unrated titles whenever the live ranking is unavailable.
  const { data, error } = await q
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching section (fallback):', error);
    return [];
  }
  return data || [];
}

export async function getTrendingAnime(limit: number = 8): Promise<Anime[]> {
  // Over-fetch: some AniList trending titles won't exist in our snapshot.
  const ranked = await fetchRanked('TRENDING_DESC', Math.min(limit * 3, 50));
  const hydrated = await hydrateRanked(ranked, limit);
  return hydrated.length ? hydrated : rankedFallback(limit);
}

export async function getFanFavorites(limit: number = 8): Promise<Anime[]> {
  const ranked = await fetchRanked('FAVOURITES_DESC', Math.min(limit * 3, 50));
  const hydrated = await hydrateRanked(ranked, limit);
  return hydrated.length ? hydrated : rankedFallback(limit);
}

export async function getAiringNow(limit: number = 8): Promise<Anime[]> {
  const ranked = await fetchRanked('TRENDING_DESC', 50, 'RELEASING');
  const hydrated = await hydrateRanked(ranked, limit);
  // Our snapshot has only 2 rows marked `airing`, so the DB fallback is thin —
  // the live ranking is what makes this section meaningful.
  return hydrated.length ? hydrated : rankedFallback(limit, 'airing');
}

export async function getUpcoming(limit: number = 8): Promise<Anime[]> {
  // Unreleased titles have no meaningful score, so rank them by anticipation
  // (popularity) rather than by rating.
  const ranked = await fetchRanked('POPULARITY_DESC', 50, 'NOT_YET_RELEASED');
  const hydrated = await hydrateRanked(ranked, limit);
  if (hydrated.length) return hydrated;

  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .eq('status', 'upcoming')
    .order('year', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming:', error);
    return [];
  }

  return data || [];
}

/**
 * Hero rotation pool: the current top trending titles, shuffled.
 *
 * Over-fetches the live ranking because the hero is a wide key-art stage —
 * entries carrying a real `banner_image` are preferred, and cover-art-only
 * ones are used just to top the pool back up to `size`.
 */
export async function getTrendingHeroPool(size: number = 10): Promise<Anime[]> {
  const ranked = await fetchRanked('TRENDING_DESC', 50);
  const hydrated = await hydrateRanked(ranked, 50);

  const withBanner = hydrated.filter((a) => a.banner_image);
  const withoutBanner = hydrated.filter((a) => !a.banner_image);
  const pool = [...withBanner, ...withoutBanner].slice(0, size);

  // Fall back to the previous Action-based pool if the ranking is unavailable.
  const chosen = pool.length ? pool : await getRandomActionAnime(size);

  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}

export async function getRandomActionAnime(poolSize: number = 40): Promise<Anime[]> {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .overlaps('genres', ['Action'])
    .not('banner_image', 'is', null)
    // Postgres sorts DESC as NULLS FIRST, so without this the pool filled up
    // with unrated titles — which is why the hero kept showing no score.
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(poolSize);

  if (error) {
    console.error('Error fetching action anime:', error);
    return [];
  }

  const pool = [...(data || [])];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * AniList's complete non-adult genre vocabulary, which is what `anime_index`
 * actually stores.
 *
 * The previous list was a hand-picked subset of 13 and silently stranded five
 * whole genres — Mecha alone covers ~900 titles that no filter could reach.
 * Anything not on this list is unreachable in Browse, so it tracks the source
 * vocabulary rather than taste.
 */
export const genres = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
];

/**
 * Genres withheld from the catalogue.
 *
 * The sync passes `isAdult: false`, but AniList treats that flag as separate
 * from the Hentai tag, so 1,633 explicitly tagged rows made it into the table
 * anyway and were reachable through Browse and search. Filtered at query time
 * rather than at sync time so the rule applies to rows already stored.
 */
export const EXCLUDED_GENRES = ['Hentai'];

/** Year range offered in the filters, newest first. */
const CURRENT_YEAR = new Date().getFullYear();
/**
 * Spans the whole catalogue: the oldest row is dated 1907 and the newest 2033,
 * because upcoming shows are announced years ahead.
 *
 * The old fixed `2024 - i` list ran 2024→2000, which stranded ~1,150 titles
 * from 2025 onward and ~240 from before 2000 — none of them reachable by any
 * filter. Derived from the clock so it cannot silently expire again.
 */
export const years = Array.from(
  { length: CURRENT_YEAR + 2 - 1900 + 1 },
  (_, i) => CURRENT_YEAR + 2 - i
);

export const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

export const statuses = ['all', 'airing', 'completed', 'upcoming'] as const;

/**
 * Browse orderings.
 *
 * `rating` is served by Postgres against our own snapshot; every other mode is
 * a live AniList ranking, which is the same source the homepage rails use. That
 * is what lets "View More" on Trending open a Browse that is genuinely the
 * trending list continued, rather than the whole archive sorted by score.
 */
export const BROWSE_SORTS = [
  { id: 'trending', label: 'Trending', anilist: 'TRENDING_DESC' },
  { id: 'popularity', label: 'Most Popular', anilist: 'POPULARITY_DESC' },
  { id: 'favorites', label: 'Fan Favorites', anilist: 'FAVOURITES_DESC' },
  { id: 'score', label: 'Top Rated', anilist: 'SCORE_DESC' },
  { id: 'newest', label: 'Newest', anilist: 'START_DATE_DESC' },
  { id: 'rating', label: 'Archive Score', anilist: null },
] as const;

export type BrowseSort = (typeof BROWSE_SORTS)[number]['id'];

export const DEFAULT_BROWSE_SORT: BrowseSort = 'trending';

export function isBrowseSort(value: string): value is BrowseSort {
  return BROWSE_SORTS.some((s) => s.id === value);
}

/** Our three-state `status` mapped onto AniList's enum. */
const STATUS_TO_ANILIST: Record<string, AniListStatus> = {
  airing: 'RELEASING',
  completed: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
};

export interface EpisodeRating {
  id: string;
  user_id: string;
  anime_id: string;
  episode_number: number;
  rating: number;
  created_at: string;
}

export interface EpisodeComment {
  id: string;
  user_id: string;
  anime_id: string;
  episode_number: number;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

/**
 * Comment and rating counts per episode of one title — what decides which
 * episode pages are indexable (api/_episodes.js).
 */
export async function getEpisodeActivity(animeId: string): Promise<Map<number, { comments: number; ratings: number }>> {
  const [comments, ratings] = await Promise.all([
    supabase.from('episode_comments').select('episode_number').eq('anime_id', animeId),
    supabase.from('episode_ratings').select('episode_number').eq('anime_id', animeId),
  ]);
  if (comments.error) console.error('Error fetching episode comments:', comments.error);
  if (ratings.error) console.error('Error fetching episode ratings:', ratings.error);
  return episodeActivity(comments.data || [], ratings.data || []);
}

export async function getEpisodeRatings(animeId: string, episodeNumber: number): Promise<EpisodeRating[]> {
  const { data, error } = await supabase
    .from('episode_ratings')
    .select('*')
    .eq('anime_id', animeId)
    .eq('episode_number', episodeNumber)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching episode ratings:', error);
    return [];
  }

  return data || [];
}

export async function getEpisodeComments(animeId: string, episodeNumber: number): Promise<EpisodeComment[]> {
  const { data, error } = await supabase
    .from('episode_comments')
    .select(`
      id,
      user_id,
      anime_id,
      episode_number,
      content,
      created_at,
      user:users!episode_comments_user_id_fkey (
        username,
        avatar_url
      )
    `)
    .eq('anime_id', animeId)
    .eq('episode_number', episodeNumber)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching episode comments:', error);
    return [];
  }

  return (data || []).map((comment: any) => ({
    id: comment.id,
    user_id: comment.user_id,
    anime_id: comment.anime_id,
    episode_number: comment.episode_number,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      username: comment.user?.username || 'Anonymous',
      avatar_url: comment.user?.avatar_url || null
    }
  }));
}

/**
 * `%` and `_` are LIKE wildcards, and `\` escapes them. Left raw, a query like
 * "100%" silently becomes "100<anything>" and matches unrelated rows.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Comparison form: case/accent-insensitive, punctuation-free, single-spaced. */
function normaliseTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Typographic quotes appear in AniList titles ("Journey's End") but people
    // type the ASCII apostrophe.
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

/**
 * Match quality for one spelling of a title, highest first. Rating alone is a
 * poor sort for a search box: for "one piece" it buried ONE PIECE under ONE
 * PIECE HEROINES, because the spin-off happened to be rated higher.
 */
function spellingScore(spelling: string, normQuery: string, tokens: string[]): number {
  const t = normaliseTitle(spelling);
  if (!t) return 0;

  // Word spacing varies between spellings of the same title — "DAN DA DAN" is
  // typed "dandadan", "Steins;Gate" as "steins gate". Compare with spaces
  // removed so those still count as exact.
  const tight = t.replace(/ /g, '');
  const tightQuery = normQuery.replace(/ /g, '');

  // The gap between "starts with" and "contains as a whole word" is kept
  // narrow on purpose: both are equally good matches to a reader, the words
  // just fall in a different place. Leaving it wide let any obscure title
  // beginning with the query outrank the famous one that merely contains it.
  let base: number;
  if (t === normQuery || tight === tightQuery) base = 1000;
  else if (t.startsWith(normQuery + ' ') || tight.startsWith(tightQuery)) base = 780;
  else if (t.startsWith(normQuery)) base = 770;
  else if (new RegExp(`\\b${escapeRegExp(normQuery)}`).test(t)) base = 760;
  else if (t.includes(normQuery)) base = 600;
  else {
    // Words present but not adjacent: "spy family" vs "SPY x FAMILY".
    // Every word must appear — matching a subset let "K-On!" pull in "Attack
    // on Titan" on the strength of the word "on" alone.
    const allPresent = tokens.every((tok) => new RegExp(`\\b${escapeRegExp(tok)}`).test(t));
    if (!allPresent) return 0;
    base = 450;
  }

  // How much of the title the query accounts for. Without this, "spy family"
  // ranked "Street Fighter 6 VS SPY×FAMILY CODE: White" above SPY x FAMILY,
  // and "mob psycho" put season II above the original — in both cases the
  // longer title matched just as literally, it was simply mostly other words.
  const coverage = Math.min(normQuery.length / t.length, 1);
  return base + coverage * 120;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A row plus every spelling it is known by. The DB stores one collapsed title,
 * so romaji/native/synonym spellings ride along from AniList — otherwise
 * "Shingeki no Kyojin" can never rank the row displayed as "Attack on Titan".
 */
interface Candidate {
  row: Anime;
  spellings: string[];
  /**
   * Position in AniList's own SEARCH_MATCH ordering, if it returned this row.
   * Their relevance engine knows things ours can't — that "kimetsu no yaiba"
   * means the main series and not the MLB collaboration short.
   */
  remoteRank?: number;
  /** AniList member count. Separates a franchise's main entry from its shorts. */
  popularity?: number | null;
}

function rankSuggestions(candidates: Candidate[], query: string, limit: number): Anime[] {
  const normQuery = normaliseTitle(query);
  const tokens = normQuery.split(' ').filter(Boolean);

  return candidates
    .map(({ row, spellings, remoteRank, popularity }) => ({
      row,
      // Best-matching spelling wins; a row shouldn't be penalised for the
      // language it happens to be displayed in.
      score:
        Math.max(
          ...spellings.filter(Boolean).map((s) => spellingScore(s, normQuery, tokens)),
          0
        ) +
        // Kept small: a row that only our own index knows about cannot earn
        // this at all, so a large bonus would rank by *source* rather than by
        // how well the title actually matches.
        (remoteRank !== undefined ? Math.max(0, 50 - remoteRank * 4) : 0) +
        // Audience size, log-scaled: ~60 points per 10x members. This is the
        // signal that picks the entry someone typing a franchise name means —
        // "evangelion" is the TV series, not a promo short whose title happens
        // to begin with the word. It is wide enough to outweigh the gap
        // between the near-miss tiers above, but never the 220-point jump to
        // an exact match, so precision still wins where it exists.
        (popularity && popularity > 0
          ? Math.min(Math.log10(popularity) * 60, 320)
          : 0),
      rating: typeof row.rating === 'number' ? row.rating : -1,
      length: (row.title || '').length,
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.rating - a.rating || a.length - b.length
    )
    .slice(0, limit)
    .map((entry) => entry.row);
}

/** AniList payload shaped into the row type the UI already renders. */
function mediaToAnime(m: AniListMedia): Anime {
  return {
    id: `anilist-${m.id}`,
    title: m.title.english || m.title.romaji || m.title.native || 'Untitled',
    rating: m.averageScore != null ? m.averageScore / 10 : null,
    genres: m.genres ?? [],
    year: m.year,
    season: m.season
      ? m.season.charAt(0) + m.season.slice(1).toLowerCase()
      : null,
    status:
      m.status === 'RELEASING' || m.status === 'HIATUS'
        ? 'airing'
        : m.status === 'NOT_YET_RELEASED'
          ? 'upcoming'
          : 'completed',
    episodes: m.episodes,
    description: m.description?.replace(/<[^>]*>/g, '') ?? null,
    cover_image: m.coverImage ?? '',
    banner_image: m.bannerImage,
    trailer: m.trailer,
  };
}

/**
 * Fandom abbreviations, which neither our titles nor AniList's search resolve —
 * "jjk" and "snk" both return nothing at all upstream. Only whole-query matches
 * are expanded, so typing a real title is never rewritten out from under you.
 */
const QUERY_ALIASES: Record<string, string> = {
  aot: 'Attack on Titan',
  snk: 'Shingeki no Kyojin',
  jjk: 'Jujutsu Kaisen',
  kny: 'Kimetsu no Yaiba',
  mha: 'My Hero Academia',
  bnha: 'Boku no Hero Academia',
  fmab: 'Fullmetal Alchemist: Brotherhood',
  fma: 'Fullmetal Alchemist',
  nge: 'Neon Genesis Evangelion',
  tng: 'Tengen Toppa Gurren Lagann',
  ttgl: 'Tengen Toppa Gurren Lagann',
  jojo: "JoJo's Bizarre Adventure",
  ygo: 'Yu-Gi-Oh!',
  hxh: 'Hunter x Hunter',
  csm: 'Chainsaw Man',
  ohshc: 'Ouran High School Host Club',
  konosuba: 'KonoSuba',
  rezero: 'Re:Zero',
  sao: 'Sword Art Online',
  opm: 'One Punch Man',
  dbz: 'Dragon Ball Z',
  pmmm: 'Puella Magi Madoka Magica',
  'code geass': 'Code Geass',
  'shield hero': 'The Rising of the Shield Hero',
};

/** Resolves an abbreviation to its full title, or returns the query unchanged. */
function expandQuery(query: string): string {
  const key = normaliseTitle(query).replace(/ /g, '');
  for (const [alias, full] of Object.entries(QUERY_ALIASES)) {
    if (alias.replace(/ /g, '') === key) return full;
  }
  return query;
}

/**
 * Suggestions for the search box.
 *
 * Two sources run in parallel and are merged:
 *   - `anime_index`, matched as a substring on every word of the query. The
 *     previous prefix-only match (`title ILIKE 'q%'`) meant "titan" returned
 *     nothing at all, since no title *begins* with it.
 *   - AniList's own search, which covers english/romaji/native/synonyms and
 *     titles newer than the last nightly sync.
 *
 * Either source failing still yields results from the other; both failing
 * yields [], never a throw.
 */
export async function getAnimeSearchSuggestions(
  query: string,
  limit: number = 10
): Promise<Anime[]> {
  const raw = query.trim();
  if (raw.length === 0) return [];

  const q = expandQuery(raw);
  const tokens = normaliseTitle(q).split(' ').filter(Boolean).slice(0, 6);

  const COLUMNS = 'id, title, cover_image, genres, rating';

  /** Broad pool: every word present somewhere in the title, best-rated first. */
  const localBroad = (async (): Promise<Anime[]> => {
    try {
      let builder = supabase.from('anime_index').select(COLUMNS);
      for (const genre of EXCLUDED_GENRES) {
        builder = builder.not('genres', 'cs', `{${genre}}`);
      }

      // Chained ilike filters are ANDed, so "spy family" matches "SPY x FAMILY"
      // even though the words aren't adjacent.
      for (const token of tokens.length ? tokens : [q]) {
        builder = builder.ilike('title', `%${escapeLike(token)}%`);
      }

      // Over-fetch, then rank locally: the best match is often not the
      // highest-rated row. `nullsFirst: false` matters because Postgres sorts
      // DESC as NULLS FIRST, which otherwise fills the list with unrated rows.
      const { data, error } = await builder
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(Math.max(limit * 6, 60));

      if (error) throw error;
      return (data ?? []) as Anime[];
    } catch (error) {
      if (!import.meta.env.PROD) console.error('Local search failed:', error);
      return [];
    }
  })();

  /**
   * Targeted pool: titles that literally start with the query.
   *
   * The broad pool is capped and ordered by rating, so a low-rated exact match
   * can fall outside it entirely — searching "K-On!" returned Season 2 and the
   * movie while the original sat below the cut. This guarantees the best
   * possible match is always among the candidates.
   */
  const localPrefix = (async (): Promise<Anime[]> => {
    try {
      let builder = supabase.from('anime_index').select(COLUMNS);
      for (const genre of EXCLUDED_GENRES) {
        builder = builder.not('genres', 'cs', `{${genre}}`);
      }
      const { data, error } = await builder
        .ilike('title', `${escapeLike(q)}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Anime[];
    } catch {
      return [];
    }
  })();

  // Deliberately wider than `limit`. Only rows AniList returns carry the
  // popularity and alternate-spelling data the ranker uses, so a narrow
  // window quietly handicaps everything it left out — asking for 12 meant
  // "evangelion" never saw Neon Genesis Evangelion at all.
  const remote = searchAnime(q, Math.max(limit * 2, 25)).catch(() => [] as AniListMedia[]);

  const [broadRows, prefixRows, remoteMedia] = await Promise.all([
    localBroad,
    localPrefix,
    remote,
  ]);
  const localRows = [...prefixRows, ...broadRows];

  // Local rows first so the DB copy wins on id collision — it carries the
  // curated cover art and is guaranteed to open.
  const merged = new Map<string, Candidate>();

  for (const row of localRows) {
    if (row?.id && !merged.has(row.id)) {
      merged.set(row.id, { row, spellings: [row.title] });
    }
  }

  remoteMedia.forEach((media, index) => {
    const id = `anilist-${media.id}`;
    const spellings = [
      media.title.english,
      media.title.romaji,
      media.title.native,
      ...(media.synonyms ?? []),
    ].filter((s): s is string => !!s);

    const existing = merged.get(id);
    if (existing) {
      // Keep the DB row, but let it be found by its other names.
      existing.spellings.push(...spellings);
      existing.remoteRank = index;
      existing.popularity = media.popularity;
    } else {
      merged.set(id, {
        row: mediaToAnime(media),
        spellings,
        remoteRank: index,
        popularity: media.popularity,
      });
    }
  });

  // AniList's own `isAdult: false` does not cover everything carrying the
  // Hentai tag, so the remote half of the merge is filtered here too — the
  // local half was already excluded at query time.
  const safe = [...merged.values()].filter(
    (c) => !c.row.genres?.some((g) => EXCLUDED_GENRES.includes(g))
  );

  return rankSuggestions(safe, q, limit);
}

export interface BrowseFilters {
  genres?: string[];
  year?: number;
  season?: string;
  status?: string;
  query?: string;
  sort?: BrowseSort;
}

export interface BrowseResult {
  data: Anime[];
  hasMore: boolean;
  /**
   * `null` when the count is unknowable, which is the case for every live
   * AniList ordering — see `RankedPage.hasNextPage`. Callers must render the
   * unknown case rather than printing a zero.
   */
  totalCount: number | null;
  totalPages: number | null;
  /** True when the rows came from AniList rather than our snapshot. */
  live: boolean;
}

/**
 * One page of Browse.
 *
 * Two engines behind one signature:
 *
 *   - A live AniList ranking, used for every ordering except `rating`. Filters
 *     are pushed upstream so the ranking is genuinely of the filtered set, and
 *     the rows are rendered straight from the response — no hydration against
 *     `anime_index`, which would drop anything the last sync missed and leave
 *     short pages. This is what keeps Browse current between syncs.
 *
 *   - Postgres over `anime_index`, used for `rating` and for any text search,
 *     where relevance and an exact count matter more than recency.
 *
 * The live path falls back to the Postgres one on any failure, so an AniList
 * outage degrades the ordering rather than emptying the page.
 */
export async function getAnimeListPaginated(
  filters?: BrowseFilters,
  page: number = 1,
  pageSize: number = 24
): Promise<BrowseResult> {
  const sort = filters?.sort ?? DEFAULT_BROWSE_SORT;
  const hasQuery = Boolean(filters?.query && filters.query.trim());
  const anilistSort = BROWSE_SORTS.find((s) => s.id === sort)?.anilist ?? null;

  // A text search always goes to Postgres: AniList's SEARCH_MATCH cannot be
  // combined with another ordering, so honouring the sort here would mean
  // discarding relevance — the one thing a search is ordered by.
  if (anilistSort && !hasQuery) {
    const live = await fetchLiveBrowsePage(filters, anilistSort, page, pageSize);
    if (live) return live;
  }

  return fetchArchiveBrowsePage(filters, page, pageSize);
}

/** Live-ranking path. Returns null on any upstream failure so a caller can fall back. */
async function fetchLiveBrowsePage(
  filters: BrowseFilters | undefined,
  anilistSort: AniListSort,
  page: number,
  pageSize: number
): Promise<BrowseResult | null> {
  const status = filters?.status && filters.status !== 'all'
    ? STATUS_TO_ANILIST[filters.status]
    : undefined;

  const result = await fetchRankedPage({
    sort: anilistSort,
    page,
    // AniList caps perPage at 50; Browse asks for 24.
    perPage: Math.min(pageSize, 50),
    status,
    genres: filters?.genres?.length ? filters.genres : undefined,
    excludeGenres: EXCLUDED_GENRES,
    season: filters?.season || undefined,
    year: filters?.year || undefined,
  });

  // Only a null result means the request failed. An empty page is a real
  // answer — "nothing matched", or "you have paged past the end" — and must
  // not fall through to the archive, which would silently swap the ordering
  // out from under the visitor rather than telling them they hit the end.
  if (!result) return null;

  return {
    data: result.media.map(mediaToAnime),
    hasMore: result.hasNextPage,
    totalCount: null,
    totalPages: null,
    live: true,
  };
}

/** Snapshot path: exact counts and numbered pages, ordered by stored rating. */
async function fetchArchiveBrowsePage(
  filters: BrowseFilters | undefined,
  page: number,
  pageSize: number
): Promise<BrowseResult> {
  let query = supabase.from('anime_index').select('*', { count: 'exact' });

  // Applies to every archive query, including an unfiltered browse and every
  // text search.
  for (const genre of EXCLUDED_GENRES) {
    query = query.not('genres', 'cs', `{${genre}}`);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }

  if (filters?.season) {
    query = query.eq('season', filters.season);
  }

  if (filters?.genres && filters.genres.length > 0) {
    query = query.overlaps('genres', filters.genres);
  }

  if (filters?.query && filters.query.trim()) {
    // Same treatment as the suggestion box, so pressing Enter can't show
    // fewer titles than the dropdown just offered: abbreviations expanded,
    // wildcards escaped, and each word matched independently.
    const expanded = expandQuery(filters.query.trim());
    const words = normaliseTitle(expanded).split(' ').filter(Boolean).slice(0, 6);
    for (const word of words.length ? words : [expanded]) {
      query = query.ilike('title', `%${escapeLike(word)}%`);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    // Postgres sorts DESC as NULLS FIRST, so without this every result page
    // led with unrated titles.
    .order('rating', { ascending: false, nullsFirst: false })
    // Tie-breaker: `rating` has heavy ties (hundreds of rows share 7.0) and
    // Postgres gives no stable order within them, so the same row could appear
    // on two different pages while another never appeared at all.
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Error fetching anime:', error);
    return { data: [], hasMore: false, totalCount: 0, totalPages: 0, live: false };
  }

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasMore = totalCount > to + 1;

  return { data: data || [], hasMore, totalCount, totalPages, live: false };
}
