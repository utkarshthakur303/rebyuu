import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';
import { changedIds, submitToIndexNow, SYNCED_COLUMNS } from './indexNow.mjs';
const ANILIST_API = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        hasNextPage
      }
      media(type: ANIME, sort: $sort, status: $status, isAdult: false) {
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

type AniListSort = 'POPULARITY_DESC' | 'TRENDING_DESC' | 'START_DATE_DESC';
type AniListStatus = 'RELEASING' | 'NOT_YET_RELEASED' | 'FINISHED';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * AniList allows 30 requests/minute. The original 1s delay ran at 60/min and
 * would trip the limiter partway through a deep crawl.
 */
const REQUEST_INTERVAL_MS = 2200;

async function fetchAniListPage(
  page: number,
  perPage: number = 50,
  sort: AniListSort = 'POPULARITY_DESC',
  status?: AniListStatus
): Promise<{ data: AniListMedia[]; hasNextPage: boolean }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { page, perPage, sort: [sort], status }
      })
    });

    if (response.status === 429) {
      // Honour Retry-After when present; otherwise back off progressively.
      const retryAfter = Number(response.headers.get('retry-after')) || (attempt + 1) * 20;
      console.log(`  rate limited, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(`AniList GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return {
      data: result.data.Page.media,
      hasNextPage: result.data.Page.pageInfo.hasNextPage
    };
  }

  throw new Error('AniList rate limit not cleared after 5 attempts');
}

/** Upserts one page of titles. Returns the ids whose stored row it actually changed. */
async function syncAnimeToSupabase(
  supabase: ReturnType<typeof createClient>,
  media: AniListMedia[]
): Promise<string[]> {
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

  // Read the rows as they stand before the upsert overwrites them, so the
  // IndexNow submission can be limited to titles that really changed. If the
  // read fails, report nothing rather than every row as changed.
  const { data: existing, error: readError } = await supabase
    .from('anime_index')
    .select(['id', ...SYNCED_COLUMNS].join(','))
    .in('id', animeData.map((a) => a.id));
  const changed = readError ? [] : changedIds(existing ?? [], animeData);

  const { error } = await supabase.from('anime_index').upsert(animeData, {
    onConflict: 'id',
    ignoreDuplicates: false
  });

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }

  return changed;
}

interface Pass {
  label: string;
  sort: AniListSort;
  status?: AniListStatus;
  maxPages: number;
}

/**
 * Daily default. Sorting the whole catalogue by POPULARITY_DESC buries newly
 * announced shows hundreds of pages deep, so a popularity-only crawl takes
 * ~440 pages to reach titles the homepage needs *today*. These passes fetch
 * exactly the slices the site surfaces, in about a minute.
 */
const FRESH_PASSES: Pass[] = [
  { label: 'trending', sort: 'TRENDING_DESC', maxPages: 4 },
  { label: 'airing', sort: 'POPULARITY_DESC', status: 'RELEASING', maxPages: 4 },
  { label: 'upcoming', sort: 'POPULARITY_DESC', status: 'NOT_YET_RELEASED', maxPages: 4 },
  { label: 'newly-added', sort: 'START_DATE_DESC', maxPages: 3 },
  { label: 'popular', sort: 'POPULARITY_DESC', maxPages: 6 }
];

/** SYNC_MODE=full — deep backfill of the whole catalogue. Slow; run rarely. */
const FULL_PASSES: Pass[] = [
  ...FRESH_PASSES,
  { label: 'popular-deep', sort: 'POPULARITY_DESC', maxPages: 500 }
];

async function runPass(
  supabase: ReturnType<typeof createClient>,
  pass: Pass,
  changed: Set<string>
): Promise<number> {
  console.log(`\n── pass: ${pass.label} (${pass.sort}${pass.status ? ' / ' + pass.status : ''}) ──`);
  let synced = 0;

  for (let page = 1; page <= pass.maxPages; page++) {
    try {
      const { data, hasNextPage } = await fetchAniListPage(page, 50, pass.sort, pass.status);
      if (!data.length) break;

      for (const id of await syncAnimeToSupabase(supabase, data)) changed.add(id);
      synced += data.length;
      console.log(`  page ${page}: +${data.length} (pass total ${synced})`);

      if (!hasNextPage) break;
      await sleep(REQUEST_INTERVAL_MS);
    } catch (error) {
      // One bad page shouldn't abandon the remaining passes.
      console.error(`  page ${page} failed:`, error instanceof Error ? error.message : error);
      break;
    }
  }

  return synced;
}

async function syncAnime() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const mode = (process.env.SYNC_MODE || 'fresh').toLowerCase();
  const passes = mode === 'full' ? FULL_PASSES : FRESH_PASSES;

  console.log(`Starting AniList sync (mode=${mode})...`);
  const started = Date.now();
  let total = 0;
  const changed = new Set<string>();

  for (const pass of passes) {
    total += await runPass(supabase, pass, changed);
    await sleep(REQUEST_INTERVAL_MS);
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  // Rows overlap between passes, so this counts upserts, not distinct titles.
  console.log(`\nSync complete in ${mins} min. Rows upserted: ${total}. Titles changed: ${changed.size}`);

  await submitToIndexNow([...changed]);
}

syncAnime().catch(console.error);

export { syncAnime };
