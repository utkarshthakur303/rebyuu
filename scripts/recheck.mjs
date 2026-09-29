/**
 * Titles the nightly sync has to look up by id.
 *
 * The fresh passes fetch what is airing and announced right now. A show that
 * finished is in neither list any more, so its row kept saying "airing" for
 * good: on 29 September 2026, 198 of the 355 rows marked airing were stale,
 * some of them shows from 2016. So after its passes the sync re-fetches, by
 * id, every stored airing or upcoming row it did not see, and writes whatever
 * changed.
 *
 * Lives outside syncAnime.ts so it can be tested: that script starts syncing
 * the moment it is imported.
 */

/** AniList returns at most 50 media per page. */
export const RECHECK_BATCH = 50;

/**
 * AniList ids of the `stored` rows (anime_index ids, "anilist-21") that are
 * not in `seen`, in batches of RECHECK_BATCH.
 */
export function recheckBatches(stored, seen) {
  const ids = stored
    .filter((row) => !seen.has(row.id))
    .map((row) => Number(String(row.id).replace(/^anilist-/, '')))
    .filter((n) => Number.isInteger(n) && n > 0);
  const batches = [];
  for (let i = 0; i < ids.length; i += RECHECK_BATCH) batches.push(ids.slice(i, i + RECHECK_BATCH));
  return batches;
}
