import { supabase } from './supabase';
import { fetchRanked, type RankedEntry } from './anilist';

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

  const { data, error } = await query.order('rating', { ascending: false });

  if (error) {
    console.error('Error fetching anime:', error);
    return [];
  }

  return data || [];
}

export async function getAnimeById(id: string): Promise<Anime | null> {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching anime:', error);
    return null;
  }

  return data;
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
  const { data, error } = await q.order('rating', { ascending: false }).limit(limit);
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

export const genres = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
];

export const years = Array.from({ length: 25 }, (_, i) => 2024 - i);

export const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

export const statuses = ['all', 'airing', 'completed', 'upcoming'] as const;

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

export async function getAnimeSearchSuggestions(query: string, limit: number = 10): Promise<Anime[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('anime_index')
    .select('id, title, cover_image, genres')
    .ilike('title', `${query.trim()}%`)
    .limit(limit)
    .order('rating', { ascending: false });

  if (error) {
    console.error('Error fetching search suggestions:', error);
    return [];
  }

  return data || [];
}

export async function getAnimeListPaginated(
  filters?: {
    genres?: string[];
    year?: number;
    season?: string;
    status?: string;
    query?: string;
  },
  page: number = 1,
  pageSize: number = 24
): Promise<{ data: Anime[]; hasMore: boolean; totalCount: number; totalPages: number }> {
  let query = supabase.from('anime_index').select('*', { count: 'exact' });

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
    query = query.ilike('title', `%${filters.query.trim()}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('rating', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching anime:', error);
    return { data: [], hasMore: false, totalCount: 0, totalPages: 0 };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasMore = totalCount > to + 1;

  return { data: data || [], hasMore, totalCount, totalPages };
}
