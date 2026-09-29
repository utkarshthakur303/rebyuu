/**
 * The prerender's two upstreams: the catalogue in Supabase (PostgREST, read
 * with the public anon key) and AniList's GraphQL API. Both calls resolve to
 * null on any failure rather than throwing; each page decides what a missing
 * answer means for it. The underscore keeps Vercel from deploying this file
 * as a function.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

const ANILIST_API = 'https://graphql.anilist.co';

/** A slow AniList must not hold a crawler's request open; the archive fallback is fine. */
const ANILIST_TIMEOUT_MS = 2500;

export async function sb(path) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Resolves to the GraphQL `data` object, or null on any failure. */
export async function anilist(query) {
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(ANILIST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.errors ? null : json.data ?? null;
  } catch {
    return null;
  }
}

/** anime_index ids for an AniList `Page { media { id } }`, in ranking order. */
export const rankedIds = (pageData) => (pageData?.media ?? []).map((m) => `anilist-${m.id}`);

/** One anime_index read for a set of ids, as a Map keyed by id. */
export async function rowsById(ids, columns = 'id,title,year') {
  const unique = [...new Set(ids)];
  const rows = unique.length
    ? await sb(`anime_index?id=in.(${unique.join(',')})&select=${columns}`)
    : [];
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]));
}
