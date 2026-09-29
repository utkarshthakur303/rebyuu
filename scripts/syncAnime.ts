import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';
import { planWrite, submitToIndexNow, SYNCED_COLUMNS } from './indexNow.mjs';
import { toRow, DETAIL_COLUMNS, SEASON_YEAR_COLUMNS } from './animeRow.mjs';
import { recheckBatches, RECHECK_BATCH } from './recheck.mjs';
import { animePath } from '../api/_paths.js';
const ANILIST_API = 'https://graphql.anilist.co';

// The detail fields (names, studio, streaming links, next episode, relations)
// are fetched on every run; they are only written once the migration that adds
// their columns has run. Measured on a live 50-title page: ~1.6 s, ~150-200 KB,
// well inside AniList's complexity limit.
const ANILIST_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $ids: [Int]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        hasNextPage
      }
      media(type: ANIME, sort: $sort, status: $status, id_in: $ids, isAdult: false) {
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
        seasonYear
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
  seasonYear: boolean;
  columns: string[];
}

/** Null when `columns` all exist, else the database's reason they don't. */
async function missingColumns(supabase: ReturnType<typeof createClient>, columns: string[]): Promise<string | null> {
  const { error } = await supabase.from('anime_index').select(columns.join(',')).limit(1);
  return error ? error.message : null;
}

/**
 * Each migration's columns are checked for separately and written only once
 * they exist, so deploying this before a migration runs changes nothing, and
 * a missing season_year never costs the detail columns.
 */
async function detectSchema(supabase: ReturnType<typeof createClient>): Promise<Schema> {
  const detailsMissing = await missingColumns(supabase, DETAIL_COLUMNS);
  if (detailsMissing) {
    console.log(`Detail columns not found (${detailsMissing}). Skipping them — run supabase/title_details_migration.sql to enable them.`);
  }
  const seasonYearMissing = await missingColumns(supabase, SEASON_YEAR_COLUMNS);
  if (seasonYearMissing) {
    console.log(`season_year not found (${seasonYearMissing}). Skipping it — run supabase/season_year_migration.sql to enable it.`);
  }
  const details = !detailsMissing;
  const seasonYear = !seasonYearMissing;
  return {
    details,
    seasonYear,
    columns: [...SYNCED_COLUMNS, ...(details ? DETAIL_COLUMNS : []), ...(seasonYear ? SEASON_YEAR_COLUMNS : [])],
  };
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
  status?: AniListStatus,
  ids?: number[]
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
        variables: { page, perPage, sort: [sort], status, ids }
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
  const animeData = media.map((m) => toRow(m, { details: schema.details, seasonYear: schema.seasonYear }));

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
  changed: Set<string>,
  seen: Set<string>
): Promise<number> {
  console.log(`\n── pass: ${pass.label} (${pass.sort}${pass.status ? ' / ' + pass.status : ''}) ──`);
  let synced = 0;

  for (let page = 1; page <= pass.maxPages; page++) {
    try {
      const { data, hasNextPage } = await fetchAniListPage(page, 50, pass.sort, pass.status);
      if (!data.length) break;

      for (const m of data) seen.add(`anilist-${m.id}`);
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

/** Every stored row still marked airing or upcoming, a PostgREST page at a time. */
async function storedLiveRows(supabase: ReturnType<typeof createClient>): Promise<{ id: string }[]> {
  const rows: { id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('anime_index')
      .select('id')
      .in('status', ['airing', 'upcoming'])
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`could not read airing and upcoming rows: ${error.message}`);
    rows.push(...((data ?? []) as { id: string }[]));
    if (!data || data.length < 1000) return rows;
  }
}

/**
 * Re-fetches, by id, the stored airing and upcoming titles the passes did
 * not see — the shows that have since finished or started — so their status
 * and episode data catch up (see recheck.mjs).
 */
async function recheckStale(
  supabase: ReturnType<typeof createClient>,
  schema: Schema,
  seen: Set<string>,
  changed: Set<string>
): Promise<number> {
  console.log('\n── recheck: airing and upcoming titles the passes did not fetch ──');
  const batches = recheckBatches(await storedLiveRows(supabase), seen);
  let fetched = 0;
  let asked = 0;
  for (const ids of batches) {
    try {
      const { data } = await fetchAniListPage(1, RECHECK_BATCH, 'POPULARITY_DESC', undefined, ids);
      for (const path of await syncAnimeToSupabase(supabase, data, schema)) changed.add(path);
      fetched += data.length;
      asked += ids.length;
    } catch (error) {
      console.error('  recheck batch failed:', error instanceof Error ? error.message : error);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  // A title AniList no longer returns (removed, merged, or now marked adult)
  // keeps its stored row as it was.
  console.log(`  rechecked ${fetched} of ${asked} titles in ${batches.length} requests`);
  return fetched;
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
  const seen = new Set<string>();

  for (const pass of passes) {
    total += await runPass(supabase, pass, schema, changed, seen);
    await sleep(REQUEST_INTERVAL_MS);
  }

  try {
    total += await recheckStale(supabase, schema, seen, changed);
  } catch (error) {
    // The passes' writes stand, and their changes still go to IndexNow.
    console.error('Recheck skipped:', error instanceof Error ? error.message : error);
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  // Rows overlap between passes, so "checked" counts rows fetched, not
  // distinct titles. Only the changed ones were written.
  console.log(`\nSync complete in ${mins} min. Rows checked: ${total}. Titles changed and written: ${changed.size}`);

  await submitToIndexNow([...changed]);
}

syncAnime().catch(console.error);

export { syncAnime };
