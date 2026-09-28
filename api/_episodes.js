import { animePath } from './_paths.js';
import { nextEpisode, formatAiring } from './_titlepage.js';

/**
 * Episode pages: /anime/<title>/episode/<n>.
 *
 * Shared by the prerender, the episode sitemap and the React app. The
 * underscore keeps Vercel from deploying this file as a function.
 *
 * "<show> episode 5" is one of the most common anime searches while a show
 * airs, and small sites rank for it with a plain page per episode. But there
 * are ~22,000 titles here and One Piece alone has 1,100+ episodes: a
 * crawlable page for every episode would be a quarter of a million mostly
 * empty URLs, and a new site's crawl budget would go on them instead of on
 * title pages. So every episode has a page a visitor can open, but only the
 * ones with something on them are indexable, linked as <a href> and listed in
 * the sitemap:
 *
 *   - episodes with a comment, or MIN_EPISODE_RATINGS ratings; and
 *   - while a show airs, its latest aired and next scheduled episode — the
 *     two that are searched for that week.
 *
 * The rest are `noindex, follow`, reached from buttons rather than links.
 */

export const MIN_EPISODE_RATINGS = 3;

/** The highest episode number with a page, or null when there are none. */
export function lastEpisode(row) {
  if (row.episodes > 1) return row.episodes;
  if (row.status === 'airing' && row.next_episode > 1) return row.next_episode;
  return null;
}

export const episodePath = (row, n) => `${animePath(row)}/episode/${n}`;

/** Comment and rating counts per episode number, from rows with `episode_number`. */
export function episodeActivity(comments = [], ratings = []) {
  const activity = new Map();
  const bump = (n, key) => {
    const entry = activity.get(n) || { comments: 0, ratings: 0 };
    entry[key]++;
    activity.set(n, entry);
  };
  for (const c of comments) bump(c.episode_number, 'comments');
  for (const r of ratings) bump(r.episode_number, 'ratings');
  return activity;
}

export function isEpisodeIndexable(row, n, activity = {}, now = new Date()) {
  if ((activity.comments ?? 0) >= 1 || (activity.ratings ?? 0) >= MIN_EPISODE_RATINGS) return true;
  const next = row.status === 'airing' ? nextEpisode(row, now) : null;
  return !!next && (n === next.episode || n === next.episode - 1);
}

/** Every indexable episode number of `row`, ascending. */
export function indexableEpisodes(row, activity = new Map(), now = new Date()) {
  const last = lastEpisode(row);
  if (!last) return [];
  const candidates = new Set(activity.keys());
  const next = row.status === 'airing' ? nextEpisode(row, now) : null;
  if (next) [next.episode - 1, next.episode].forEach((n) => candidates.add(n));
  return [...candidates]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= last && isEpisodeIndexable(row, n, activity.get(n), now))
    .sort((a, b) => a - b);
}

export function episodeTitleTag(row, n, { now = new Date() } = {}) {
  const name = String(row.title || 'Untitled');
  const next = nextEpisode(row, now);
  return next && next.episode === n
    ? `${name} Episode ${n}: Release Date & Time · Rebyuu`
    : `${name} Episode ${n} — Rating & Discussion · Rebyuu`;
}

/**
 * `stats` is { average, count, comments } for this episode: its Rebyuu
 * ratings and comment count.
 */
export function episodeDescription(row, n, stats = {}, { now = new Date(), timeZone } = {}) {
  const name = String(row.title || 'Untitled');
  const next = nextEpisode(row, now);
  if (next && next.episode === n) {
    return `Episode ${n} of ${name} airs on ${formatAiring(next.at, { timeZone })}. Rate it and join the discussion on Rebyuu once it is out.`;
  }
  const last = lastEpisode(row);
  let text = `Episode ${n}${last && row.episodes ? ` of ${last}` : ''} of ${name}${row.year ? ` (${row.year})` : ''}`;
  if ((stats.count ?? 0) >= MIN_EPISODE_RATINGS) {
    text += `. Rated ${Number(stats.average).toFixed(1)}/10 by ${stats.count} Rebyuu users`;
  }
  if (stats.comments) text += `, with ${stats.comments} comment${stats.comments === 1 ? '' : 's'}`;
  return `${text}. Rate it and join the discussion.`;
}
