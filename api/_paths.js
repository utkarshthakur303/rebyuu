/**
 * The one place a title page's URL is built and read.
 *
 * Every link to a title — the prerender's lists, the sitemaps, IndexNow, the
 * React app — goes through here. The underscore keeps Vercel from deploying
 * this file as a function.
 *
 *   /anime/154587-frieren-beyond-journeys-end     canonical
 *   /anime/154587                                 no Latin title, or a bare id
 *   /anime/anilist-154587                         the original form
 *
 * The number is AniList's id and is all that identifies the title; the slug
 * is for people and search results, which show it and match it against the
 * query. Every non-canonical form — the original, a bare id, a slug from
 * before a title was renamed — is answered with a 301 to the canonical one,
 * so links made to any of them keep working and pass their weight on.
 */

const MAX_SLUG = 60;

export function slugify(title) {
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining marks: ō -> o
    .toLowerCase()
    .replace(/['’‘`]/g, '') // "journey's" -> "journeys", not "journey-s"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= MAX_SLUG) return slug;
  const cut = slug.slice(0, MAX_SLUG);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, '');
}

const numberOf = (id) => String(id).replace(/^anilist-/, '');

/** "154587-frieren-beyond-journeys-end": the path segment after /anime/. */
export function animeRef(row) {
  const slug = slugify(row.title);
  return slug ? `${numberOf(row.id)}-${slug}` : numberOf(row.id);
}

/** Root-relative path of a title page, from its anime_index row. */
export const animePath = (row) => `/anime/${animeRef(row)}`;

/**
 * The anime_index id a path segment points at, from any form above; null
 * when it is not one.
 */
export function parseAnimeRef(ref) {
  const match = /^(?:anilist-)?([1-9]\d*)(?:-[\w-]*)?$/.exec(String(ref ?? ''));
  return match ? { id: `anilist-${match[1]}` } : null;
}
