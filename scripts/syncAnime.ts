import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';
const ANILIST_API = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        hasNextPage
      }
      media(type: ANIME, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
        }
        averageScore
        genres
        startDate {
          year
        }
        season
        status
        episodes
        description
        coverImage {
          large
        }
        bannerImage
        trailer {
          id
          site
        }
      }
    }
  }
`;

type AniListMedia = {
  id: number;
  title: {
    romaji: string;
    english: string | null;
  };
  averageScore: number | null;
  genres: string[];
  startDate: {
    year: number | null;
  };
  season: string | null;
  status: string;
  episodes: number | null;
  description: string | null;
  coverImage: {
    large: string;
  };
  bannerImage: string | null;
  trailer: {
    id: string | null;
    site: string | null;
  } | null;
};

function mapStatus(status: string): 'airing' | 'completed' | 'upcoming' {
  const statusMap: Record<string, 'airing' | 'completed' | 'upcoming'> = {
    'RELEASING': 'airing',
    'FINISHED': 'completed',
    'NOT_YET_RELEASED': 'upcoming',
    'CANCELLED': 'completed',
    'HIATUS': 'airing'
  };
  return statusMap[status] || 'completed';
}

function mapSeason(season: string | null): string | null {
  if (!season) return null;
  const seasonMap: Record<string, string> = {
    'WINTER': 'Winter',
    'SPRING': 'Spring',
    'SUMMER': 'Summer',
    'FALL': 'Fall'
  };
  return seasonMap[season] || null;
}

async function fetchAniListPage(page: number, perPage: number = 50): Promise<{
  data: AniListMedia[];
  hasNextPage: boolean;
}> {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { page, perPage }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`AniList GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  const pageInfo = result.data.Page.pageInfo;
  const media = result.data.Page.media;

  return {
    data: media,
    hasNextPage: pageInfo.hasNextPage
  };
}

async function syncAnimeToSupabase(
  supabase: ReturnType<typeof createClient>,
  media: AniListMedia[]
): Promise<void> {
  const animeData = media.map((m) => {
    const title = m.title.english || m.title.romaji;
    const trailerUrl = m.trailer?.site === 'youtube' && m.trailer?.id
      ? `https://www.youtube.com/watch?v=${m.trailer.id}`
      : null;

    return {
      id: `anilist-${m.id}`,
      title,
      rating: m.averageScore ? m.averageScore / 10 : null,
      genres: m.genres,
      year: m.startDate.year,
      season: mapSeason(m.season),
      status: mapStatus(m.status),
      episodes: m.episodes,
      description: m.description?.replace(/<[^>]*>/g, '').substring(0, 1000) || null,
      cover_image: m.coverImage.large,
      banner_image: m.bannerImage,
      trailer: trailerUrl,
      anilist_id: m.id
    };
  });

  const { error } = await supabase.from('anime_index').upsert(animeData, {
    onConflict: 'id',
    ignoreDuplicates: false
  });

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

async function syncAnime() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let page = 1;
  let hasNextPage = true;
  let totalSynced = 0;

  console.log('Starting AniList sync...');

  while (hasNextPage) {
    try {
      console.log(`Fetching page ${page}...`);
      const { data, hasNextPage: next } = await fetchAniListPage(page, 50);
      
      if (data.length === 0) {
        console.log('No more data to fetch');
        break;
      }

      console.log(`Syncing ${data.length} anime to Supabase...`);
      await syncAnimeToSupabase(supabase, data);
      
      totalSynced += data.length;
      console.log(`Synced ${totalSynced} anime so far...`);

      hasNextPage = next;
      page++;

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error syncing page ${page}:`, error);
      break;
    }
  }

  console.log(`Sync complete! Total anime synced: ${totalSynced}`);
}

syncAnime().catch(console.error);

export { syncAnime };
