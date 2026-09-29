/**
 * Which titles are quality titles: the set the title sitemap vouches for,
 * and what a hub page counts to decide whether it is indexed. Every title
 * page stays crawlable either way. The underscore keeps Vercel from
 * deploying this file as a function.
 *
 *   - a synopsis of at least MIN_SYNOPSIS_CHARS — below that the page is
 *     little more than a title and a poster; and then either
 *   - released and rated at least MIN_RATING, or
 *   - airing now, rated or not — new shows have no score for their first
 *     weeks, which is exactly when people search for them, or
 *   - announced for this year or later. An "upcoming" row from years ago is
 *     an announcement that went nowhere.
 *
 * PostgREST has no length() filter, so the synopsis rule is a LIKE pattern:
 * MIN_SYNOPSIS_CHARS single-character wildcards then "anything" matches
 * exactly the strings at least that long.
 */

export const MIN_SYNOPSIS_CHARS = 130;
export const MIN_RATING = 6;

/** The rule as PostgREST logic-tree terms. */
function qualityTerms(now) {
  return [
    `description.like.${'_'.repeat(MIN_SYNOPSIS_CHARS)}*`,
    `or(and(rating.gte.${MIN_RATING},status.neq.upcoming),status.eq.airing,and(status.eq.upcoming,year.gte.${now.getUTCFullYear()}))`,
  ];
}

/**
 * One PostgREST filter for quality titles that also meet `extraTerms`
 * (logic-tree terms such as "season.eq.Fall"). A single and=(…) rather than
 * separate parameters, so extra terms can carry an or(…) of their own.
 */
export const qualityFilter = (extraTerms = [], now = new Date()) =>
  `and=(${[...qualityTerms(now), ...extraTerms].join(',')})`;
