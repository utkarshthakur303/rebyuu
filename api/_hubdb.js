import { EXCLUDED_GENRES, GENRES, SEASONS, seasonYearOf } from './_catalog.js';
import { qualityFilter } from './_quality.js';
import { hubPath, parseHubPath } from './_hubs.js';

/**
 * What hub pages ask anime_index: which titles a hub holds, whether it has
 * enough quality titles to be indexed, and — for the sitemap — every hub
 * that does.
 *
 * A page's own robots tag and the hub sitemap are decided by the same count
 * over the same titles (hubTerms + the quality rule), so the sitemap never
 * lists a page that says noindex. The underscore keeps Vercel from deploying
 * this file as a function.
 */

/** A hub is indexed once it has this many quality titles. */
export const MIN_HUB_TITLES = 12;

/** Hubs whose lists are never thin. */
const ALWAYS_INDEXED = ['airing', 'upcoming', 'top'];

const NOT_EXCLUDED = `genres.not.ov.{${EXCLUDED_GENRES.join(',')}}`;

/**
 * PostgREST logic-tree terms for the titles a hub holds. A season matches on
 * season_year, and on the start year for rows the sync hasn't filled it in
 * for yet (see seasonYearOf).
 */
function hubTerms(hub) {
  const terms = [NOT_EXCLUDED];
  if (hub.kind === 'season') {
    terms.push(`season.eq.${hub.season}`, `or(season_year.eq.${hub.year},and(season_year.is.null,year.eq.${hub.year}))`);
  }
  if (hub.kind === 'airing') terms.push('status.eq.airing');
  if (hub.kind === 'upcoming') terms.push('status.eq.upcoming');
  // The start year, as Browse's year filter and the year page's list use.
  if (hub.kind === 'year') terms.push(`year.eq.${hub.year}`);
  if (hub.kind === 'genre') terms.push(`genres.ov.{"${hub.genre}"}`);
  return terms;
}

/**
 * A query returning up to MIN_HUB_TITLES of the hub's quality titles — the
 * number returned is all isIndexable needs — or null for a hub that is
 * always indexed.
 */
export function hubCountPath(hub, now = new Date()) {
  if (ALWAYS_INDEXED.includes(hub.kind)) return null;
  return `anime_index?select=id&${qualityFilter(hubTerms(hub), now)}&limit=${MIN_HUB_TITLES}`;
}

export const isIndexable = (hub, qualityTitles) =>
  ALWAYS_INDEXED.includes(hub.kind) || qualityTitles >= MIN_HUB_TITLES;

/**
 * The hub's titles from the catalogue alone, for when AniList can't be
 * reached: best rated first, as Browse's own fallback orders them, and
 * upcoming by year, since nothing upcoming has a score.
 */
export function hubFallbackPath(hub, { columns, limit }) {
  const order = hub.kind === 'upcoming' ? 'year.asc.nullslast,id.asc' : 'rating.desc.nullslast,id.asc';
  return `anime_index?select=${columns}&and=(${hubTerms(hub).join(',')})&order=${order}&limit=${limit}`;
}

/** Every quality title's season, years and genres, for indexedHubPaths. Read a page at a time. */
export const censusPath = (now = new Date()) =>
  `anime_index?select=season,year,season_year,genres&${qualityFilter([NOT_EXCLUDED], now)}&order=id.asc`;

/**
 * Every hub worth indexing, from censusPath's rows: the hubs that always
 * are, then each genre, year (up to this one) and season with
 * MIN_HUB_TITLES quality titles, oldest first. A season appears here — and
 * so in the sitemap — the day the sync brings it enough titles, with no code
 * or copy to change.
 */
export function indexedHubPaths(rows, now = new Date()) {
  const genres = new Map();
  const years = new Map();
  const seasons = new Map();
  for (const row of rows) {
    for (const genre of row.genres || []) if (GENRES.includes(genre)) genres.set(genre, (genres.get(genre) || 0) + 1);
    if (row.year && row.year <= now.getUTCFullYear()) years.set(row.year, (years.get(row.year) || 0) + 1);

    const year = seasonYearOf(row);
    if (!row.season || !year) continue;
    const hub = parseHubPath(`/seasons/${String(row.season).toLowerCase()}-${year}`, now);
    if (!hub) continue;
    const path = hubPath(hub);
    const entry = seasons.get(path) ?? { hub, count: 0 };
    entry.count++;
    seasons.set(path, entry);
  }
  const indexedSeasons = [...seasons.values()]
    .filter((entry) => isIndexable(entry.hub, entry.count))
    .sort((a, b) => a.hub.year - b.hub.year || SEASONS.indexOf(a.hub.season) - SEASONS.indexOf(b.hub.season))
    .map((entry) => hubPath(entry.hub));
  const indexedGenres = GENRES.filter((genre) => (genres.get(genre) || 0) >= MIN_HUB_TITLES).map((genre) => hubPath({ kind: 'genre', genre }));
  const indexedYears = [...years]
    .filter(([, count]) => count >= MIN_HUB_TITLES)
    .map(([year]) => year)
    .sort((a, b) => a - b)
    .map((year) => hubPath({ kind: 'year', year }))
    .filter((path) => parseHubPath(path, now));
  return [...ALWAYS_INDEXED.map((kind) => hubPath({ kind })), ...indexedGenres, ...indexedYears, ...indexedSeasons];
}
