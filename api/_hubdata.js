import { EXCLUDED_GENRES, SEASONS, seasonFromAniList } from './_catalog.js';
import { hubPreset, parseHubPath, seasonPath, shiftSeason } from './_hubs.js';

/**
 * What a hub page asks AniList, and how the answers are read.
 *
 * Shared by the prerender and the React app so both ask the same thing: the
 * list a hub serves is exactly the ranking Browse fetches for the same
 * preset (fetchRankedPage in services/anilist.ts), so the served HTML and
 * the grid a visitor then sees agree. The underscore keeps Vercel from
 * deploying this file as a function.
 */

/** Titles per page of a hub's grid. AniList's maximum, so page 1 is one request. */
export const HUB_PAGE_SIZE = 50;

/** Pages of HUB_PAGE_SIZE the served list covers: a whole season, the first 100 otherwise. */
const SERVED_PAGES = { season: 3, airing: 2, upcoming: 2 };

export const servedLimit = (hub) => SERVED_PAGES[hub.kind] * HUB_PAGE_SIZE;

const ANILIST_SORT = { trending: 'TRENDING_DESC', popularity: 'POPULARITY_DESC', score: 'SCORE_DESC' };

/** AniList media() arguments for a hub, as Browse builds them. */
function mediaArgs(hub, sort) {
  const args = ['type: ANIME', `sort: [${ANILIST_SORT[sort]}]`, `genre_not_in: ${JSON.stringify(EXCLUDED_GENRES)}`, 'isAdult: false'];
  if (hub.kind === 'season') args.push(`season: ${hub.season.toUpperCase()}, seasonYear: ${hub.year}`);
  if (hub.kind === 'airing') args.push('status: RELEASING');
  if (hub.kind === 'upcoming') args.push('status: NOT_YET_RELEASED');
  return args.join(', ');
}

/** The served list, one aliased page per HUB_PAGE_SIZE: p1, p2, … */
function listPages(hub) {
  const fields = hub.kind === 'upcoming' ? 'id season seasonYear' : 'id';
  const args = mediaArgs(hub, hubPreset(hub).sort);
  return Array.from({ length: SERVED_PAGES[hub.kind] }, (_, i) =>
    `p${i + 1}: Page(page: ${i + 1}, perPage: ${HUB_PAGE_SIZE}) { ${i === 0 ? 'pageInfo { hasNextPage } ' : ''}media(${args}) { ${fields} } }`
  );
}

/** Whether the seasons either side have any shows: one title each is enough to know. */
function neighbourPages(hub) {
  if (hub.kind !== 'season') return [];
  return [['prev', -1], ['next', 1]].map(([alias, by]) => {
    const other = { kind: 'season', ...shiftSeason(hub, by) };
    return `${alias}: Page(page: 1, perPage: 1) { media(${mediaArgs(other, 'popularity')}) { id } }`;
  });
}

const query = (parts) => `query {\n  ${parts.join('\n  ')}\n}`;

/** Everything a hub page shows except the schedule, in one request. */
export const hubQuery = (hub) => query([...listPages(hub), ...neighbourPages(hub)]);

/**
 * Just what readHubLinks needs, for React opening a hub the server didn't
 * build (client-side navigation); null for a hub without links.
 */
export function hubLinksQuery(hub) {
  if (hub.kind === 'season') return query(neighbourPages(hub));
  if (hub.kind === 'upcoming') return query(listPages(hub));
  return null;
}

/** p1, p2, … in page order. */
const pageKeys = (data) =>
  Object.keys(data || {})
    .filter((key) => /^p\d+$/.test(key))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

/**
 * anime_index ids of the list, in ranking order. An id AniList repeats on a
 * later page (rankings shift between pages) is kept where it first appeared.
 */
export function readHubIds(data) {
  const ids = [];
  const seen = new Set();
  for (const key of pageKeys(data)) {
    for (const m of data[key]?.media ?? []) {
      const id = `anilist-${m.id}`;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Whether the grid has a page after its first. */
export const readHubHasMore = (data) => Boolean(data?.p1?.pageInfo?.hasNextPage);

const seasonLink = ({ season, year }) => ({ label: `${season} ${year}`, path: seasonPath({ season, year }) });

/**
 * The links above a hub's grid, [{ label, path }]: a season's neighbours
 * that have shows, or the seasons upcoming shows are announced for. Only
 * seasons that have a page are linked, so no link leads to a 404.
 */
export function readHubLinks(hub, data, now = new Date()) {
  if (!data) return [];
  const hasPage = (season) => parseHubPath(seasonPath(season), now) !== null;
  if (hub.kind === 'season') {
    return [['prev', -1], ['next', 1]]
      .map(([alias, by]) => ({ alias, season: shiftSeason(hub, by) }))
      .filter(({ alias, season }) => data[alias]?.media?.length && hasPage(season))
      .map(({ season }) => seasonLink(season));
  }
  if (hub.kind === 'upcoming') {
    const found = new Map();
    for (const key of pageKeys(data)) {
      for (const m of data[key]?.media ?? []) {
        const season = { season: seasonFromAniList(m.season), year: m.seasonYear };
        if (!season.season || !season.year || !hasPage(season)) continue;
        found.set(seasonPath(season), season);
      }
    }
    return [...found.values()]
      .sort((a, b) => a.year - b.year || SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season))
      .map(seasonLink);
  }
  return [];
}

/**
 * The window the airing schedule is fetched for, in Unix seconds: from a day
 * back (today starts up to 14 hours earlier in some zones) to eight days on.
 * groupSchedule then keeps the reader's own seven days.
 */
export function scheduleRange(now = new Date()) {
  const seconds = Math.floor(now.getTime() / 1000);
  return { from: seconds - 86400, to: seconds + 8 * 86400 };
}

/** Up to 200 episodes in the window, in time order. */
export const scheduleQuery = ({ from, to }) =>
  query(
    [1, 2, 3, 4].map((page) =>
      `s${page}: Page(page: ${page}, perPage: 50) { airingSchedules(airingAt_greater: ${from}, airingAt_lesser: ${to}, sort: TIME) { episode airingAt media { id isAdult genres title { english romaji } } } }`
    )
  );

/**
 * Schedule entries, [{ id, title, episode, at }] with `at` in milliseconds.
 * Adult titles and excluded genres are dropped, as everywhere else; the
 * title is named as the catalogue names it (English, else romaji).
 */
export function readSchedule(data) {
  const entries = [];
  const seen = new Set();
  for (const key of ['s1', 's2', 's3', 's4']) {
    for (const s of data?.[key]?.airingSchedules ?? []) {
      const m = s.media;
      if (!m || m.isAdult || (m.genres || []).some((g) => EXCLUDED_GENRES.includes(g))) continue;
      const id = `anilist-${m.id}`;
      if (seen.has(`${id}:${s.episode}`)) continue;
      seen.add(`${id}:${s.episode}`);
      entries.push({ id, title: m.title?.english || m.title?.romaji || null, episode: s.episode, at: s.airingAt * 1000 });
    }
  }
  return entries.sort((a, b) => a.at - b.at);
}

/** "15:05" in `timeZone`. */
export const scheduleTime = (at, timeZone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);

const LONG_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });

/**
 * Seven days from today in `timeZone`, each with its episodes:
 * [{ key: '2026-09-30', label: 'Wednesday 30 September', short: 'Wed 30', entries }].
 * Days are counted on the calendar, not in 24-hour steps, so a week that
 * crosses a daylight-saving change still has seven different days.
 */
export function groupSchedule(entries, { now = new Date(), timeZone = 'UTC', days = 7 } = {}) {
  const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = dayOf.format(now).split('-').map(Number);
  const groups = Array.from({ length: days }, (_, i) => {
    const noon = new Date(Date.UTC(y, m - 1, d + i, 12));
    return {
      key: noon.toISOString().slice(0, 10),
      label: LONG_DAY.format(noon).replace(',', ''),
      short: SHORT_DAY.format(noon).replace(',', ''),
      entries: [],
    };
  });
  const byKey = new Map(groups.map((g) => [g.key, g]));
  for (const entry of [...entries].sort((a, b) => a.at - b.at)) byKey.get(dayOf.format(entry.at))?.entries.push(entry);
  return groups;
}
