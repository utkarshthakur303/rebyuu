/**
 * Turns one AniList `Media` record into an anime_index row.
 *
 * Lives outside syncAnime.ts so it can be tested: that script starts syncing
 * the moment it is imported.
 *
 * The base columns are mapped exactly as the sync always mapped them. The
 * detail columns (supabase/title_details_migration.sql) carry what a title
 * page needs to answer the searches people make with a title: every name it
 * goes by, where to stream it, when the next episode airs, its sequels and
 * prequels, and who made it.
 */

import { seasonFromAniList } from '../api/_catalog.js';

/** Added by title_details_migration.sql. Absent until that migration runs. */
export const DETAIL_COLUMNS = [
  'title_romaji', 'title_english', 'title_native', 'synonyms',
  'format', 'source', 'duration', 'studios', 'mal_id',
  'streaming', 'relations', 'next_episode', 'next_episode_at',
];

/**
 * Added by season_year_migration.sql, and checked for on its own: a sync that
 * runs before that migration keeps writing every other column.
 */
export const SEASON_YEAR_COLUMNS = ['season_year'];

/**
 * Added by airing_schedule_migration.sql, and checked for on its own, like
 * season_year. See api/_schedule.js for what the pages do with it.
 */
export const SCHEDULE_COLUMNS = ['airing_schedule'];

/** Episodes kept per title: a two-cour show, with room to spare. */
const SCHEDULE_SIZE = 40;

/** A show that finished this long ago has no use for its schedule. */
const SCHEDULE_STALE_MS = 60 * 86400000;

const STATUS = {
  RELEASING: 'airing',
  FINISHED: 'completed',
  NOT_YET_RELEASED: 'upcoming',
  CANCELLED: 'completed',
  HIATUS: 'airing',
};

/**
 * Relations worth listing on a title page, in the order they are listed:
 * the watch order first, then the stories around it. Manga, novels, music
 * videos and "character appears in" links are left out.
 */
const RELATION_ORDER = ['PREQUEL', 'SEQUEL', 'PARENT', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'];

/** One Piece has ~140 side stories; a page lists the most recent few. */
const MAX_SIDE_RELATIONS = 8;
const SIDE_RELATIONS = new Set(['SPIN_OFF', 'SIDE_STORY']);

/** Only web URLs: a link's scheme comes from upstream data and lands in an href. */
const isWebUrl = (url) => /^https?:\/\//i.test(String(url || ''));

function streamingLinks(links) {
  const seen = new Set();
  const out = [];
  for (const link of links || []) {
    if (link?.type !== 'STREAMING' || !isWebUrl(link.url) || !link.site || seen.has(link.site)) continue;
    seen.add(link.site);
    out.push({ site: link.site, url: link.url });
  }
  return out;
}

function relatedEntries(relations) {
  const entries = (relations?.edges || [])
    .filter((e) => RELATION_ORDER.includes(e.relationType) && e.node?.type === 'ANIME' && e.node.format !== 'MUSIC')
    .map((e) => ({
      id: `anilist-${e.node.id}`,
      relation: e.relationType,
      title: e.node.title?.english || e.node.title?.romaji || null,
      year: e.node.startDate?.year ?? null,
      format: e.node.format ?? null,
    }));

  const main = entries.filter((e) => !SIDE_RELATIONS.has(e.relation));
  const side = entries
    .filter((e) => SIDE_RELATIONS.has(e.relation))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, MAX_SIDE_RELATIONS);

  const rank = (e) => RELATION_ORDER.indexOf(e.relation);
  return [
    ...main.sort((a, b) => rank(a) - rank(b) || (a.year ?? 0) - (b.year ?? 0)),
    ...side,
  ];
}

/** Well-formed entries only, as { episode, at: ISO string }. */
function scheduleEntries(list) {
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const at = Date.parse(e?.at);
    if (Number.isInteger(e?.episode) && e.episode >= 1 && Number.isFinite(at)) out.push({ episode: e.episode, at: new Date(at).toISOString() });
  }
  return out;
}

/**
 * AniList's schedule for one title: the first 25 entries it holds
 * (`airingSchedule`, which is the whole run for a seasonal show) and the next
 * four to air (`upcomingSchedule`, which is what matters for a long runner
 * whose first 25 are years old). [{ episode, at }] in episode order.
 */
function airingScheduleOf(m) {
  const nodes = [...(m.airingSchedule?.nodes || []), ...(m.upcomingSchedule?.nodes || [])];
  const byEpisode = new Map();
  for (const n of nodes) {
    if (Number.isInteger(n?.episode) && Number.isFinite(n?.airingAt)) {
      byEpisode.set(n.episode, { episode: n.episode, at: new Date(n.airingAt * 1000).toISOString() });
    }
  }
  return [...byEpisode.values()].sort((a, b) => a.episode - b.episode);
}

/**
 * The schedule to store: what AniList lists now, plus the stored episodes
 * that have already aired and AniList no longer returns — so a long runner,
 * of which AniList returns only the next four, keeps its recent past. A
 * stored future episode AniList no longer lists is dropped, since it has been
 * rescheduled or cancelled. Capped to the latest SCHEDULE_SIZE episodes, and
 * emptied once the show's last episode is SCHEDULE_STALE_MS old.
 */
export function mergeSchedule(stored, fetched, now = new Date()) {
  const byEpisode = new Map();
  for (const e of scheduleEntries(stored)) if (Date.parse(e.at) <= now.getTime()) byEpisode.set(e.episode, e);
  for (const e of scheduleEntries(fetched)) byEpisode.set(e.episode, e);
  const entries = [...byEpisode.values()].sort((a, b) => a.episode - b.episode).slice(-SCHEDULE_SIZE);
  const latest = Math.max(...entries.map((e) => Date.parse(e.at)));
  return entries.length && now.getTime() - latest <= SCHEDULE_STALE_MS ? entries : [];
}

/**
 * `details`, `seasonYear` and `schedule` say which migrations the database
 * has had (DETAIL_COLUMNS, SEASON_YEAR_COLUMNS, SCHEDULE_COLUMNS); a column
 * is only produced once it exists.
 */
export function toRow(m, { details = true, seasonYear = details, schedule = details } = {}) {
  const row = {
    id: `anilist-${m.id}`,
    title: m.title.english || m.title.romaji,
    rating: m.averageScore ? m.averageScore / 10 : null,
    genres: m.genres,
    year: m.startDate.year,
    season: seasonFromAniList(m.season),
    status: STATUS[m.status] || 'completed',
    episodes: m.episodes,
    description: m.description?.replace(/<[^>]*>/g, '').substring(0, 1000) || null,
    cover_image: m.coverImage.large,
    banner_image: m.bannerImage,
    trailer: m.trailer?.site === 'youtube' && m.trailer?.id ? `https://www.youtube.com/watch?v=${m.trailer.id}` : null,
    anilist_id: m.id,
  };
  // AniList files a December premiere under the next year's Winter; `year`
  // stays the start year. See seasonYearOf in api/_catalog.js.
  if (seasonYear) row.season_year = m.seasonYear ?? null;
  if (!details) return row;

  return {
    ...row,
    title_romaji: m.title.romaji ?? null,
    title_english: m.title.english ?? null,
    title_native: m.title.native ?? null,
    synonyms: (m.synonyms || []).filter(Boolean),
    format: m.format ?? null,
    source: m.source ?? null,
    duration: m.duration ?? null,
    studios: (m.studios?.nodes || []).map((n) => n.name).filter(Boolean),
    mal_id: m.idMal ?? null,
    streaming: streamingLinks(m.externalLinks),
    relations: relatedEntries(m.relations),
    next_episode: m.nextAiringEpisode?.episode ?? null,
    next_episode_at: m.nextAiringEpisode ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() : null,
    ...(schedule ? { airing_schedule: airingScheduleOf(m) } : {}),
  };
}
