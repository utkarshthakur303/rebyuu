/**
 * When each episode of a title airs: its AniList airing schedule, as the sync
 * stores it in anime_index.airing_schedule (supabase/airing_schedule_migration.sql).
 *
 * Shared by the prerender, the sitemap and the React app. The underscore
 * keeps Vercel from deploying this file as a function.
 *
 * Why the whole schedule rather than only `next_episode`: "<show> episode 8
 * release date" is searched all week, for the next episode and the one after
 * it, and "is episode 5 delayed" when a week is skipped. And `next_episode` is
 * only as fresh as the last sync: the sync runs once a day, so between an
 * episode airing and the next run the row named an episode that had already
 * aired, and the show had no release date anywhere on the site. With the
 * schedule, the next episode is worked out when the page is served.
 */

const DAY_MS = 86400000;

/** Episodes shown either side of the current one in a schedule excerpt. */
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 4;

/**
 * Where the people who search Rebyuu for release times are (Search Console,
 * Aug–Nov 2026: India, then the US, the Philippines, Indonesia, the UK,
 * Europe and Brazil), plus Japan, where the time is set. `zone` is fixed
 * where the place has one abbreviation all year; elsewhere Intl names it, so
 * daylight saving (EST/EDT, GMT/BST, CET/CEST) is applied.
 */
export const RELEASE_ZONES = [
  { place: 'India', timeZone: 'Asia/Kolkata', zone: 'IST' },
  { place: 'US East (New York)', timeZone: 'America/New_York' },
  { place: 'US West (Los Angeles)', timeZone: 'America/Los_Angeles' },
  { place: 'Philippines', timeZone: 'Asia/Manila', zone: 'PHT' },
  { place: 'Indonesia (Jakarta)', timeZone: 'Asia/Jakarta', zone: 'WIB' },
  { place: 'UK (London)', timeZone: 'Europe/London', locale: 'en-GB' },
  { place: 'Central Europe (Berlin, Paris, Rome)', timeZone: 'Europe/Berlin', locale: 'en-GB' },
  { place: 'Brazil (São Paulo)', timeZone: 'America/Sao_Paulo', zone: 'BRT' },
  { place: 'Japan', timeZone: 'Asia/Tokyo', zone: 'JST' },
];

const toDate = (value) => {
  const at = value instanceof Date ? value : new Date(value ?? NaN);
  return Number.isFinite(at.getTime()) ? at : null;
};

/**
 * [{ episode, at: Date }] in episode order. Rows synced before the schedule
 * column existed fall back to next_episode / next_episode_at.
 */
export function scheduleOf(row) {
  const byEpisode = new Map();
  for (const entry of Array.isArray(row?.airing_schedule) ? row.airing_schedule : []) {
    const at = toDate(entry?.at);
    if (Number.isInteger(entry?.episode) && entry.episode >= 1 && at) byEpisode.set(entry.episode, { episode: entry.episode, at });
  }
  const nextAt = toDate(row?.next_episode_at);
  if (Number.isInteger(row?.next_episode) && nextAt && !byEpisode.has(row.next_episode)) {
    byEpisode.set(row.next_episode, { episode: row.next_episode, at: nextAt });
  }
  return [...byEpisode.values()].sort((a, b) => a.episode - b.episode);
}

/** When episode `n` airs or aired, or null when the schedule does not say. */
export function airingOf(row, n) {
  return scheduleOf(row).find((e) => e.episode === n)?.at ?? null;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * How many weeks a weekly show skips before episode `n`: 1 when it comes a
 * fortnight after episode n-1 instead of a week. 0 when it is on its usual
 * schedule, when the show is not weekly, or when the schedule cannot tell.
 */
export function breakWeeks(row, n) {
  const schedule = scheduleOf(row);
  const at = new Map(schedule.map((e) => [e.episode, e.at.getTime()]));
  const gaps = schedule
    .filter((e) => at.has(e.episode - 1))
    .map((e) => (e.at.getTime() - at.get(e.episode - 1)) / DAY_MS);
  if (!gaps.length || !at.has(n) || !at.has(n - 1)) return 0;
  const usual = median(gaps);
  if (usual < 6 || usual > 8) return 0;
  const gap = (at.get(n) - at.get(n - 1)) / DAY_MS;
  return Math.max(0, Math.round((gap - usual) / 7));
}

/** Older names browsers still report (Chrome on macOS gives India as Asia/Calcutta). */
const ZONE_ALIASES = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Rangoon': 'Asia/Yangon' };

const intlZoneName = (at, timeZone, locale) =>
  new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;

/**
 * The abbreviation people use for `timeZone` at `at`: IST, EST/EDT, CET/CEST.
 * Intl names a zone only in the locale that uses it ("EST" in en-US but
 * "GMT-5" in en-GB, "CET" the other way round), so both are asked, and an
 * offset like "GMT+11" is the answer only when neither has a name.
 */
export function zoneName(at, timeZone) {
  const zone = ZONE_ALIASES[timeZone] ?? timeZone;
  const known = RELEASE_ZONES.find((z) => z.timeZone === zone);
  if (known?.zone) return known.zone;
  const names = [known?.locale, 'en-US', 'en-GB'].filter(Boolean).map((locale) => intlZoneName(at, zone, locale)).filter(Boolean);
  return names.find((n) => !/^GMT[+-]/.test(n)) ?? names[0] ?? zone;
}

/** { day: 'Sun 15 Nov', time: '8:00 PM', zone: 'IST' } for `at` in `timeZone`. */
export function zoneTime(at, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return { day: `${parts.weekday} ${parts.day} ${parts.month}`, time: `${parts.hour}:${parts.minute} ${parts.dayPeriod}`, zone: zoneName(at, timeZone) };
}

/** `at` in each of RELEASE_ZONES, in their order. */
export function releaseTimes(at) {
  return RELEASE_ZONES.map(({ place, timeZone }) => ({ place, ...zoneTime(at, timeZone) }));
}

/** The scheduled episodes around episode `n`. */
export function scheduleWindow(row, n) {
  return scheduleOf(row).filter((e) => e.episode >= n - WINDOW_BEFORE && e.episode <= n + WINDOW_AFTER);
}

/**
 * Time left until `at`, as { days, hours, minutes, seconds }, rounded up to
 * the second so it never reads zero before the episode is out. Null once it is.
 */
export function countdown(at, now = new Date()) {
  const left = Math.ceil((at.getTime() - now.getTime()) / 1000);
  if (left <= 0) return null;
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor(left / 3600) % 24,
    minutes: Math.floor(left / 60) % 60,
    seconds: left % 60,
  };
}
