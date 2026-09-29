import { seasonOf, shiftSeason } from '../api/_hubs.js';

/**
 * The seasons the nightly sync fetches in full: the current one and the
 * next.
 *
 * The other passes take the most popular titles of each slice, so a small
 * show in the coming season was often never synced: on 29 September 2026
 * AniList listed 94 Fall 2026 shows and anime_index had 65. A season page
 * can only link titles the catalogue has, so these two are fetched whole —
 * about a hundred titles each, two or three requests.
 *
 * Lives outside syncAnime.ts so it can be tested: that script starts syncing
 * the moment it is imported.
 */
export function seasonPasses(now = new Date()) {
  const current = seasonOf(now);
  return [current, shiftSeason(current, 1)].map(({ season, year }) => ({
    label: `season ${season} ${year}`,
    sort: 'POPULARITY_DESC',
    season: season.toUpperCase(),
    seasonYear: year,
    maxPages: 6,
  }));
}
