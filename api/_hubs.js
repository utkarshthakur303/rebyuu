import { SEASONS, genreSlug, genreFromSlug } from './_catalog.js';

/**
 * Hub pages: a few Browse views with an address of their own, so the
 * searches people make for lists of anime ("fall 2026 anime", "anime airing
 * now") have a page to land on.
 *
 *   { kind: 'season', season: 'Fall', year: 2026 }   /seasons/fall-2026
 *   { kind: 'airing' }                               /airing
 *   { kind: 'upcoming' }                             /upcoming
 *   { kind: 'top' }                                  /top
 *   { kind: 'year', year: 2025 }                     /top/2025
 *   { kind: 'genre', genre: 'Slice of Life' }        /genres/slice-of-life
 *
 * Every hub *is* the Browse page, opened on a preset (hubPreset). The
 * filtered /browse?… URLs stay out of search on purpose — ~296,000
 * near-duplicate combinations — and these few chosen views stand in for them.
 *
 * Shared by the prerender and the React app. The underscore keeps Vercel
 * from deploying this file as a function.
 */

/** Browse's year filter starts here, so season pages do too. */
export const FIRST_YEAR = 1900;

/** Shows are announced up to two years ahead; Browse's year filter goes that far. */
export const lastSeasonYear = (now = new Date()) => now.getUTCFullYear() + 2;

/** Other names for a season, answered with a redirect to the canonical path. */
const SEASON_ALIASES = { autumn: 'Fall' };

export const seasonPath = ({ season, year }) => `/seasons/${season.toLowerCase()}-${year}`;

export const genrePath = (genre) => `/genres/${genreSlug(genre)}`;

export function hubPath(hub) {
  if (hub.kind === 'season') return seasonPath(hub);
  if (hub.kind === 'airing' || hub.kind === 'upcoming' || hub.kind === 'top') return `/${hub.kind}`;
  if (hub.kind === 'year') return `/top/${hub.year}`;
  if (hub.kind === 'genre') return genrePath(hub.genre);
  throw new Error(`hubPath: unknown hub kind ${hub.kind}`);
}

/**
 * The hub a path names, or null. Case and aliases are forgiven
 * (/seasons/Autumn-2026 is Fall 2026): a caller compares hubPath(hub) with
 * the path it was given to decide whether to redirect.
 */
export function parseHubPath(pathname, now = new Date()) {
  const path = String(pathname ?? '');
  if (path === '/airing') return { kind: 'airing' };
  if (path === '/upcoming') return { kind: 'upcoming' };
  if (path === '/top') return { kind: 'top' };
  const top = /^\/top\/(\d{4})$/.exec(path);
  if (top) {
    // "Best of" a year that hasn't happened has nothing to rank.
    const year = Number(top[1]);
    return year >= FIRST_YEAR && year <= now.getUTCFullYear() ? { kind: 'year', year } : null;
  }
  const genre = /^\/genres\/([a-z0-9-]+)$/i.exec(path);
  if (genre) {
    const name = genreFromSlug(genre[1]);
    return name ? { kind: 'genre', genre: name } : null;
  }
  const match = /^\/seasons\/([a-z]+)-(\d{4})$/i.exec(path);
  if (!match) return null;
  const word = match[1].toLowerCase();
  const season = SEASONS.find((s) => s.toLowerCase() === word) ?? SEASON_ALIASES[word];
  const year = Number(match[2]);
  if (!season || year < FIRST_YEAR || year > lastSeasonYear(now)) return null;
  return { kind: 'season', season, year };
}

/** The season a date falls in, by the calendar in UTC: Winter is January to March. */
export const seasonOf = (date) => ({
  season: SEASONS[Math.floor(date.getUTCMonth() / 3)],
  year: date.getUTCFullYear(),
});

const ordinal = ({ season, year }) => year * 4 + SEASONS.indexOf(season);

/** The season `by` seasons after `from` (before it, when negative). */
export function shiftSeason(from, by) {
  const n = ordinal(from) + by;
  return { season: SEASONS[((n % 4) + 4) % 4], year: Math.floor(n / 4) };
}

/** 'past', 'current' or 'upcoming', as of `now`. */
export function seasonTense(season, now = new Date()) {
  const diff = ordinal(season) - ordinal(seasonOf(now));
  return diff < 0 ? 'past' : diff === 0 ? 'current' : 'upcoming';
}

const NO_FILTERS = { genres: [], year: null, season: null, status: 'all', query: '' };

/**
 * The Browse view a hub is: its filters, in Browse's state shape, and the
 * order it opens in. Airing and Upcoming open in the order of the homepage
 * rails whose "View More" leads to them, so the list continues rather than
 * reshuffles. Genres open most popular first: by score, Comedy, Action and
 * Sci-Fi each start with a run of Gintama seasons.
 */
export function hubPreset(hub) {
  switch (hub.kind) {
    case 'season':
      return { filters: { ...NO_FILTERS, season: hub.season, year: hub.year }, sort: 'popularity' };
    case 'airing':
      return { filters: { ...NO_FILTERS, status: 'airing' }, sort: 'trending' };
    case 'upcoming':
      return { filters: { ...NO_FILTERS, status: 'upcoming' }, sort: 'popularity' };
    case 'top':
      return { filters: { ...NO_FILTERS }, sort: 'score' };
    case 'year':
      return { filters: { ...NO_FILTERS, year: hub.year }, sort: 'score' };
    case 'genre':
      return { filters: { ...NO_FILTERS, genres: [hub.genre] }, sort: 'popularity' };
    default:
      throw new Error(`hubPreset: unknown hub kind ${hub.kind}`);
  }
}

/** Browse's query string for `state`, leaving out everything at its default; "" when nothing is set. */
export function browseSearch(state, defaultSort) {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.genres.length) params.set('genre', state.genres.join(','));
  if (state.year) params.set('year', String(state.year));
  if (state.season) params.set('season', state.season);
  if (state.status !== 'all') params.set('status', state.status);
  if (state.sort !== defaultSort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

const sameFilters = (a, b) =>
  a.year === b.year &&
  a.season === b.season &&
  a.status === b.status &&
  (a.query || '') === (b.query || '') &&
  a.genres.length === b.genres.length &&
  a.genres.every((genre) => b.genres.includes(genre));

/**
 * Where a change made on a hub leads. A new order or page stays on the hub.
 * Any filter change opens Browse with the resulting filters, the order
 * spelled out when it isn't Browse's default — nothing reshuffles unless the
 * visitor asked it to. On /top the order is what the page is, so a new one
 * opens Browse too. Moving between hubs is done with links, which are also
 * what search engines follow.
 */
export function hubChangeTarget(hub, next, browseDefaultSort) {
  const preset = hubPreset(hub);
  const keepsIdentity = hub.kind !== 'top' || next.sort === preset.sort;
  if (sameFilters(next, preset.filters) && keepsIdentity) {
    const params = new URLSearchParams();
    if (next.sort !== preset.sort) params.set('sort', next.sort);
    if (next.page > 1) params.set('page', String(next.page));
    const query = params.toString();
    return `${hubPath(hub)}${query ? `?${query}` : ''}`;
  }
  return `/browse${browseSearch(next, browseDefaultSort)}`;
}

/**
 * The hub links every page carries. "Next season" is there from day one of
 * the current one: people search for a season for weeks before it starts.
 */
export function hubNavLinks(now = new Date()) {
  const current = seasonOf(now);
  const next = shiftSeason(current, 1);
  return [
    { label: `${current.season} ${current.year} anime`, path: seasonPath(current) },
    { label: `${next.season} ${next.year} anime`, path: seasonPath(next) },
    { label: 'Airing schedule', path: '/airing' },
    { label: 'Upcoming anime', path: '/upcoming' },
    { label: 'Top rated anime', path: '/top' },
  ];
}
