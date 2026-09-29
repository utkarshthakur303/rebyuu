import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';
import { planWrite, submitToIndexNow, SYNCED_COLUMNS } from './indexNow.mjs';
import { toRow, DETAIL_COLUMNS } from './animeRow.mjs';
import { animePath } from '../api/_paths.js';
const ANILIST_API = 'https://graphql.anilist.co';

// The detail fields (names, studio, streaming links, next episode, relations)
// are fetched on every run; they are only written once the migration that adds
// their columns has run. Measured on a live 50-title page: ~1.6 s, ~150-200 KB,
// well inside AniList's complexity limit.
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
        idMal
        title {
          romaji
          english
          native
        }
        synonyms
        format
        source
        duration
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
        studios(isMain: true) {
          nodes { name }
        }
        externalLinks {
          site
          url
          type
        }
        nextAiringEpisode {
          airingAt
          episode
        }
        relations {
          edges {
            relationType
            node {
              id
              type
              format
              title { romaji english }
              startDate { year }
            }
          }
        }
      }
    }
  }
`;

/** An AniList Media record; animeRow.mjs owns its shape. */
type AniListMedia = { id: number } & Record<string, unknown>;

/** Which columns this run writes, decided once from the live schema. */
interface Schema {
  details: boolean;
  columns: string[];
}

/**
 * The detail columns exist only once supabase/title_details_migration.sql has
 * been run. Until then the sync keeps writing the original columns, so
 * deploying this before the migration changes nothing.
 */
async function detectSchema(supabase: ReturnType<typeof createClient>): Promise<Schema> {
  const { error } = await supabase.from('anime_index').select(DETAIL_COLUMNS.join(',')).limit(1);
  if (error) {
    console.log(`Detail columns not found (${error.message}). Writing base columns only — run supabase/title_details_migration.sql to enable them.`);
    return { details: false, columns: SYNCED_COLUMNS };
  }
  return { details: true, columns: [...SYNCED_COLUMNS, ...DETAIL_COLUMNS] };
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

/** Upserts one page of titles. Returns the page paths of the titles it actually changed. */
async function syncAnimeToSupabase(
  supabase: ReturnType<typeof createClient>,
  media: AniListMedia[],
  schema: Schema
): Promise<string[]> {
  const animeData = media.map((m) => toRow(m, { details: schema.details }));

  // Read the rows as they stand, so only titles that really changed are
  // written (keeping updated_at, and so the sitemap's lastmod, truthful) and
  // submitted to IndexNow. See planWrite.
  const { data: existing, error: readError } = await supabase
    .from('anime_index')
    .select(['id', ...schema.columns].join(','))
    .in('id', animeData.map((a) => a.id));
  if (readError) console.error(`  could not read stored rows, writing all: ${readError.message}`);
  const { write, changed } = planWrite(readError ? null : existing ?? [], animeData, { columns: schema.columns });

  if (write.length) {
    const { error } = await supabase.from('anime_index').upsert(write, {
      onConflict: 'id',
      ignoreDuplicates: false
    });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
  }

  return animeData.filter((row) => changed.includes(row.id)).map((row) => animePath(row));
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
  schema: Schema,
  changed: Set<string>
): Promise<number> {
  console.log(`\n── pass: ${pass.label} (${pass.sort}${pass.status ? ' / ' + pass.status : ''}) ──`);
  let synced = 0;

  for (let page = 1; page <= pass.maxPages; page++) {
    try {
      const { data, hasNextPage } = await fetchAniListPage(page, 50, pass.sort, pass.status);
      if (!data.length) break;

      for (const path of await syncAnimeToSupabase(supabase, data, schema)) changed.add(path);
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
  const schema = await detectSchema(supabase);
  const started = Date.now();
  let total = 0;
  const changed = new Set<string>();

  for (const pass of passes) {
    total += await runPass(supabase, pass, schema, changed);
    await sleep(REQUEST_INTERVAL_MS);
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  // Rows overlap between passes, so "checked" counts rows fetched, not
  // distinct titles. Only the changed ones were written.
  console.log(`\nSync complete in ${mins} min. Rows checked: ${total}. Titles changed and written: ${changed.size}`);

  await submitToIndexNow([...changed]);
}

syncAnime().catch(console.error);

export { syncAnime };
