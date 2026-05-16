import { supabase } from './supabase';

/**
 * All anime service functions - direct port from web app
 * Uses identical Supabase queries, zero backend changes
 */

export async function getAnimeList(filters) {
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

export async function getAnimeById(id) {
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

export async function getAnimeReviews(animeId) {
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
    ratingsData?.map((r) => [r.user_id, r.rating]) || []
  );
  return (data || []).map((comment) => ({
    id: comment.id,
    anime_id: comment.anime_id,
    user_id: comment.user_id,
    rating: ratingsMap.get(comment.user_id) || 0,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      username: comment.user?.username || 'Anonymous',
      avatar_url: comment.user?.avatar_url || null,
    },
  }));
}

export async function getTrendingAnime(limit = 6) {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching trending anime:', error);
    return [];
  }
  return data || [];
}

export async function getFanFavorites(limit = 12) {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching fan favorites:', error);
    return [];
  }
  return data || [];
}

export async function getAiringNow(limit = 12) {
  const { data, error } = await supabase
    .from('anime_index')
    .select('*')
    .eq('status', 'airing')
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching airing now:', error);
    return [];
  }
  return data || [];
}

export async function getUpcoming(limit = 12) {
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

export const genres = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller',
];

export const years = Array.from({ length: 25 }, (_, i) => 2024 - i);

export const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

export const statuses = ['all', 'airing', 'completed', 'upcoming'];

export async function getEpisodeRatings(animeId, episodeNumber) {
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

export async function getEpisodeComments(animeId, episodeNumber) {
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
  return (data || []).map((comment) => ({
    id: comment.id,
    user_id: comment.user_id,
    anime_id: comment.anime_id,
    episode_number: comment.episode_number,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      username: comment.user?.username || 'Anonymous',
      avatar_url: comment.user?.avatar_url || null,
    },
  }));
}

export async function getAnimeSearchSuggestions(query, limit = 10) {
  if (!query || query.trim().length === 0) return [];
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

export async function getAnimeListPaginated(filters, page = 1, pageSize = 24) {
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
