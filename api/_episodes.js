import { animePath } from './_paths.js';
import { nextEpisode, formatAiring, streamingLinks, joinWords } from './_titlepage.js';
import { scheduleOf, airingOf, breakWeeks, zoneTime } from './_schedule.js';

/**
 * Episode pages: /anime/<title>/episode/<n>.
 *
 * Shared by the prerender, the episode sitemap and the React app. The
 * underscore keeps Vercel from deploying this file as a function.
 *
 * "<show> episode 5" is one of the most common anime searches while a show
 * airs, and small sites rank for it with a plain page per episode. Search
 * Console bears it out: from August to November 2026 nearly every click to
 * Rebyuu came from "<show> episode <n> release date", "when is <show> episode
 * <n> coming out" and "<show> episode <n>" — searched the week before an
 * episode, and for a few days after it.
 *
 * But there are ~22,000 titles here and One Piece alone has 1,100+ episodes:
 * a crawlable page for every episode would be a quarter of a million mostly
 * empty URLs, and a new site's crawl budget would go on them instead of on
 * title pages. So every episode has a page a visitor can open, but only the
 * ones with something on them are indexable, linked as <a href> and listed in
 * the sitemap:
 *
 *   - episodes with a comment, or MIN_EPISODE_RATINGS ratings;
 *   - episodes airing in the next SOON_DAYS, and always the next one; and
 *   - episodes that aired in the last RECENT_DAYS. These used to drop to
 *     noindex the day they aired, which took the pages that had just earned
 *     their impressions out of the index while they were still searched.
 *
 * The rest are `noindex, follow`, reached from buttons rather than links.
 */

export const MIN_EPISODE_RATINGS = 3;

/** An upcoming episode is indexable this many days ahead. */
export const SOON_DAYS = 14;

/** An aired episode stays indexable this many days. */
export const RECENT_DAYS = 21;

const DAY_MS = 86400000;

/** Past this many characters before " · Rebyuu", a title tag uses its short form. */
const MAX_TITLE = 60;

/**
 * The highest episode number with a page, or null when there are none. An
 * announced count wins; without one, the schedule says how far it goes.
 */
export function lastEpisode(row) {
  if (row.episodes > 1) return row.episodes;
  const scheduled = Math.max(0, ...scheduleOf(row).map((e) => e.episode));
  const next = row.status === 'airing' && row.next_episode > 1 ? row.next_episode : 0;
  const last = Math.max(scheduled, next);
  return last > 1 ? last : null;
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
  const next = nextEpisode(row, now);
  if (next && n === next.episode) return true;
  const at = airingOf(row, n);
  if (at) {
    const ahead = at.getTime() - now.getTime();
    return ahead > 0 ? ahead <= SOON_DAYS * DAY_MS : -ahead <= RECENT_DAYS * DAY_MS;
  }
  // No air date on record: the episode before the next one has just aired.
  return !!next && n === next.episode - 1;
}

/** Every indexable episode number of `row`, ascending. */
export function indexableEpisodes(row, activity = new Map(), now = new Date()) {
  const last = lastEpisode(row);
  if (!last) return [];
  const candidates = new Set([...activity.keys(), ...scheduleOf(row).map((e) => e.episode)]);
  const next = nextEpisode(row, now);
  if (next) [next.episode - 1, next.episode].forEach((n) => candidates.add(n));
  return [...candidates]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= last && isEpisodeIndexable(row, n, activity.get(n), now))
    .sort((a, b) => a - b);
}

/**
 * Whether episode `n` is still to come or has aired, and when; for one to
 * come, how many weeks its show skips before it; for one that has aired, the
 * next episode after it. Null when the schedule does not have the episode.
 */
export function episodeRelease(row, n, { now = new Date() } = {}) {
  const at = airingOf(row, n);
  if (!at) return null;
  if (at > now) return { state: 'upcoming', at, breakWeeks: breakWeeks(row, n), next: null };
  const next = nextEpisode(row, now);
  return { state: 'aired', at, breakWeeks: 0, next: next && next.episode > n ? next : null };
}

const WEEKS = ['', 'a week', 'two weeks', 'three weeks', 'four weeks'];
/** "a week", "two weeks" … for a break of `n` weeks. */
export const weeksWord = (n) => WEEKS[n] ?? `${n} weeks`;

/** "Sunday 15 November", in UTC. */
const utcDay = (at) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(at).replace(',', '');

/** "8:00 PM IST" */
const clock = (at, timeZone) => {
  const t = zoneTime(at, timeZone);
  return `${t.time} ${t.zone}`;
};

export function episodeTitleTag(row, n, { now = new Date() } = {}) {
  const name = String(row.title || 'Untitled');
  const release = episodeRelease(row, n, { now });
  const head = `${name} Episode ${n}`;
  const pick = (full, short) => `${head}: ${`${head}: ${full}`.length > MAX_TITLE ? short : full} · Rebyuu`;
  if (release?.state === 'upcoming') return pick('Release Date, Time & Countdown', 'Release Date & Time');
  if (release?.state === 'aired') {
    return pick(streamingLinks(row).length ? 'Release Date, Where to Watch & Rating' : 'Release Date, Rating & Discussion', 'Release Date & Rating');
  }
  return `${head} — Rating & Discussion · Rebyuu`;
}

/** "Rated 8.3/10 by 4 Rebyuu users, with 2 comments." or "" */
function activitySentence(stats) {
  const comments = stats.comments ? `${stats.comments} comment${stats.comments === 1 ? '' : 's'}` : '';
  if ((stats.count ?? 0) >= MIN_EPISODE_RATINGS) {
    return `Rated ${Number(stats.average).toFixed(1)}/10 by ${stats.count} Rebyuu users${comments ? `, with ${comments}` : ''}.`;
  }
  return comments ? `${comments[0].toUpperCase()}${comments.slice(1)} so far.` : '';
}

/**
 * `stats` is { average, count, comments } for this episode: its Rebyuu
 * ratings and comment count. Times are in UTC, with India's and New York's
 * after it — India is where most of these searches come from — so the
 * description is the same whoever, and wherever, renders it.
 */
export function episodeDescription(row, n, stats = {}, { now = new Date() } = {}) {
  const name = String(row.title || 'Untitled');
  const release = episodeRelease(row, n, { now });
  const watch = streamingLinks(row).length > 0;

  if (release?.state === 'upcoming') {
    const when = `${formatAiring(release.at, { timeZone: 'UTC' })}: ${clock(release.at, 'Asia/Kolkata')}, ${clock(release.at, 'America/New_York')}`;
    const lead = release.breakWeeks
      ? `${name} episode ${n} comes out ${weeksWord(release.breakWeeks)} later than usual, on ${when}.`
      : `${name} episode ${n} comes out on ${when}.`;
    return `${lead} ${watch ? 'See the countdown, the time where you are and where to watch it.' : 'See the countdown and the time where you are.'}`;
  }

  if (release?.state === 'aired') {
    const parts = [`${name} episode ${n} came out on ${formatAiring(release.at, { timeZone: 'UTC' })} (${clock(release.at, 'Asia/Kolkata')}).`];
    if (release.next) parts.push(`Episode ${release.next.episode} is next, on ${utcDay(release.next.at)}.`);
    const activity = activitySentence(stats);
    if (activity) parts.push(activity);
    parts.push(watch ? 'Find where to watch it, rate it and join the discussion.' : 'Rate it and join the discussion.');
    return parts.join(' ');
  }

  const last = lastEpisode(row);
  let text = `Episode ${n}${last && row.episodes ? ` of ${last}` : ''} of ${name}${row.year ? ` (${row.year})` : ''}`;
  if ((stats.count ?? 0) >= MIN_EPISODE_RATINGS) {
    text += `. Rated ${Number(stats.average).toFixed(1)}/10 by ${stats.count} Rebyuu users`;
  }
  if (stats.comments) text += `, with ${stats.comments} comment${stats.comments === 1 ? '' : 's'}`;
  return `${text}. Rate it and join the discussion.`;
}

/**
 * The questions an episode page answers, in the words they are searched with,
 * from the schedule alone. A question the data cannot back is left out: there
 * is no "is it delayed?" without a break on the schedule, since "no" would be
 * a guess about announcements AniList has not caught up with.
 */
export function episodeAnswers(row, n, { now = new Date() } = {}) {
  const name = String(row.title || 'Untitled');
  const release = episodeRelease(row, n, { now });
  if (!release) return [];
  const sites = [...new Set(streamingLinks(row).map((l) => l.site))];
  const watch = sites.length
    ? { question: `Where can I watch ${name} episode ${n}?`, answer: `${name} streams on ${joinWords(sites)}. Availability varies by country.` }
    : null;
  const utc = formatAiring(release.at, { timeZone: 'UTC' });

  if (release.state === 'upcoming') {
    const india = zoneTime(release.at, 'Asia/Kolkata');
    const east = zoneTime(release.at, 'America/New_York');
    const west = zoneTime(release.at, 'America/Los_Angeles');
    const out = [
      { question: `When does ${name} episode ${n} come out?`, answer: `${name} episode ${n} comes out on ${utc}.` },
      { question: `What time does ${name} episode ${n} come out in India?`, answer: `${india.time} ${india.zone}, on ${india.day}.` },
      {
        question: `What time does ${name} episode ${n} come out in the US?`,
        answer: `${east.time} ${east.zone} on ${east.day} in New York, and ${west.time} ${west.zone} on ${west.day} in Los Angeles.`,
      },
    ];
    if (release.breakWeeks) {
      const weeks = weeksWord(release.breakWeeks);
      out.push({
        question: `Is ${name} episode ${n} delayed?`,
        answer: `It comes out ${weeks} later than usual: ${name} skips ${weeks} after episode ${n - 1}, so episode ${n} airs on ${utc}.`,
      });
    }
    return watch ? [...out, watch] : out;
  }

  const out = [{ question: `Is ${name} episode ${n} out?`, answer: `Yes. ${name} episode ${n} came out on ${utc}.` }];
  if (release.next) {
    out.push({
      question: `When is the next episode of ${name}?`,
      answer: `Episode ${release.next.episode} comes out on ${formatAiring(release.next.at, { timeZone: 'UTC' })}.`,
    });
  }
  return watch ? [...out, watch] : out;
}
