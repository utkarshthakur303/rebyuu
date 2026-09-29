import { slugify } from './_paths.js';

/**
 * The catalogue's vocabulary: its genres, its seasons, and what is kept out.
 *
 * One copy, shared by the prerender, the sync and the React app — the genre
 * list used to live in three places and the excluded genres in two. The
 * underscore keeps Vercel from deploying this file as a function.
 */

/**
 * AniList's complete non-adult genre vocabulary, which is what `anime_index`
 * actually stores.
 *
 * An earlier hand-picked list of 13 silently stranded five whole genres —
 * Mecha alone covers ~900 titles that no filter could reach. Anything not on
 * this list is unreachable in Browse, so it tracks the source vocabulary
 * rather than taste.
 */
export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

/**
 * Genres withheld from the catalogue.
 *
 * The sync passes `isAdult: false`, but AniList treats that flag as separate
 * from the Hentai tag, so 1,633 explicitly tagged rows made it into the table
 * anyway and were reachable through Browse and search. Filtered at query time
 * rather than at sync time so the rule applies to rows already stored.
 */
export const EXCLUDED_GENRES = ['Hentai'];

/** A genre's URL segment: "Slice of Life" is "slice-of-life". */
export const genreSlug = (genre) => slugify(genre);

/** The genre a URL segment names, in any case; null for anything not in GENRES. */
export const genreFromSlug = (slug) => {
  const wanted = String(slug ?? '').toLowerCase();
  return GENRES.find((genre) => genreSlug(genre) === wanted) ?? null;
};

/** In calendar order: Winter starts the year. */
export const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];

/** AniList's season enum ("FALL") as the name stored in anime_index ("Fall"); null otherwise. */
export const seasonFromAniList = (value) =>
  SEASONS.find((season) => season.toUpperCase() === value) ?? null;

/**
 * The year of the season a title belongs to. AniList files a December
 * premiere under the next year's Winter, while `year` is the start year, so
 * the two differ for exactly those titles. Rows synced before the
 * season_year column existed fall back to `year`.
 */
export const seasonYearOf = (row) => row.season_year ?? row.year ?? null;
