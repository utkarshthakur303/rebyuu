/**
 * The one place a title page's URL is built.
 *
 * Every link to a title — the prerender's lists, the sitemap, IndexNow, the
 * React app — goes through here, so changing the URL scheme is a change to
 * this file and not a hunt through every caller. The underscore keeps Vercel
 * from deploying this file as a function.
 */

/** Root-relative path of a title page, from its anime_index row. */
export const animePath = (row) => `/anime/${row.id}`;
