/**
 * "More like this" — which titles a title page recommends.
 *
 * Shared by the prerender (api/render.js) and the React detail page
 * (services/anime.ts), so the links in the served HTML and the cards a
 * visitor sees after mount are the same titles in the same order. The
 * underscore keeps Vercel from deploying this file as a function.
 *
 * Candidates come from anime_index in pools, nearest first: titles sharing a
 * genre from the same era (±YEAR_WINDOW years), then titles sharing a genre
 * from any year. The era pool goes first on purpose. Ranked purely by genre
 * overlap and score, every Action/Fantasy page would recommend the same
 * handful of all-time classics — useless to a reader, and it would pour every
 * internal link on the site into the same dozen pages. Starting from the
 * title's own era spreads recommendations, and the links, across the
 * catalogue.
 */

export const RELATED_SIZE = 8;

/** Candidates fetched per pool before ranking. */
export const RELATED_POOL_SIZE = 60;

export const YEAR_WINDOW = 2;

/** Mirrors EXCLUDED_GENRES in services/anime.ts. */
const EXCLUDED_GENRES = ['Hentai'];

/**
 * The candidate queries for `target`, in priority order. Each pool means:
 * genres overlapping `genres`, and when given, year within [yearFrom, yearTo].
 * Callers fetch each pool ordered by rating (nulls last) then id, capped at
 * RELATED_POOL_SIZE, excluding the target itself. The id tiebreak matters:
 * without it tied ratings come back in no fixed order, and the prerender and
 * the browser could pick different sets from the same catalogue.
 */
export function relatedPools(target) {
  const genres = Array.isArray(target.genres) ? target.genres.filter(Boolean) : [];
  if (!genres.length) return [];
  const pools = [];
  if (target.year) {
    pools.push({ genres, yearFrom: target.year - YEAR_WINDOW, yearTo: target.year + YEAR_WINDOW });
  }
  pools.push({ genres });
  return pools;
}

/**
 * Picks up to `limit` titles from the fetched pools. Within a pool: most
 * genres shared with the target first, then highest rating, unrated last.
 * Earlier pools fill first; later pools only top up.
 */
export function rankRelated(target, pools, limit = RELATED_SIZE) {
  const targetGenres = new Set(target.genres || []);
  const shared = (row) => (row.genres || []).filter((g) => targetGenres.has(g)).length;
  const chosen = [];
  const seen = new Set([target.id]);

  for (const pool of pools) {
    const ranked = (pool || [])
      .filter((row) => !(row.genres || []).some((g) => EXCLUDED_GENRES.includes(g)))
      .sort((a, b) => shared(b) - shared(a) || (b.rating ?? -1) - (a.rating ?? -1));
    for (const row of ranked) {
      if (chosen.length === limit) return chosen;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      chosen.push(row);
    }
  }
  return chosen;
}
