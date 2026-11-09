import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Anime } from '@/services/anime';
import { countdown, releaseTimes, zoneTime } from '../../../api/_schedule.js';
import { formatAiring } from '../../../api/_titlepage.js';
import { episodePath } from '../../../api/_episodes.js';

/**
 * Release times as a reader sees them: a live countdown, the time in their
 * own zone and around the world, and a show's schedule. The words and the
 * times come from api/_schedule.js and api/_episodes.js, which the served HTML
 * uses too; only the countdown and "your time" are the browser's own.
 */

const outfit = { fontFamily: 'Outfit, ui-sans-serif, sans-serif' };
const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' };
const anton = { fontFamily: 'Anton, Impact, sans-serif' };

/** The current time, updated every `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The reader's time zone, e.g. "Asia/Kolkata". */
export const readerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Days, hours, minutes and seconds until `at`, ticking; "Out now" once it has passed. */
export function Countdown({ at }: { at: Date }) {
  const now = useNow(1000);
  const left = countdown(at, now);
  if (!left) {
    return <p className="text-lg font-semibold text-crimson" style={outfit}>Out now</p>;
  }
  const units: [number, string][] = [
    [left.days, left.days === 1 ? 'day' : 'days'],
    [left.hours, left.hours === 1 ? 'hour' : 'hours'],
    [left.minutes, 'min'],
    [left.seconds, 'sec'],
  ];
  return (
    <div role="timer" aria-label={`${left.days} days, ${left.hours} hours and ${left.minutes} minutes to go`} className="flex gap-2 sm:gap-3">
      {units.map(([value, label]) => (
        <div key={label} className="min-w-[64px] flex-1 border-2 border-ink bg-background px-2 py-2 text-center sm:min-w-[76px]">
          <div className="text-2xl sm:text-3xl tabular-nums leading-none text-foreground" style={anton}>{String(value).padStart(2, '0')}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground" style={mono}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/** An upcoming episode's release time in the reader's zone, then where Rebyuu's readers are. */
export function ReleaseTimesTable({ at, title, n }: { at: Date; title: string; n: number }) {
  const zone = useMemo(readerZone, []);
  const mine = zoneTime(at, zone);
  const rows: { place: string; day: string; time: string; zone: string }[] = releaseTimes(at);
  return (
    <section className="rounded-lg border border-ink/20 bg-card p-4 sm:p-6">
      <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl text-foreground" style={anton}>
        {title} episode {n} release time around the world
      </h2>
      <table className="w-full text-sm" style={outfit}>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground" style={mono}>
            <th className="pb-2 pr-3 font-normal">Where</th>
            <th className="pb-2 pr-3 font-normal">Date</th>
            <th className="pb-2 font-normal">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          <tr className="font-semibold text-foreground">
            <td className="py-2 pr-3">Your time</td>
            <td className="whitespace-nowrap py-2 pr-3">{mine.day}</td>
            <td className="whitespace-nowrap py-2 tabular-nums">{mine.time} {mine.zone}</td>
          </tr>
          {rows.map((t) => (
            <tr key={t.place} className="text-foreground/85">
              <td className="py-2 pr-3">{t.place}</td>
              <td className="whitespace-nowrap py-2 pr-3">{t.day}</td>
              <td className="whitespace-nowrap py-2 tabular-nums">{t.time} {t.zone}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground" style={outfit}>
        Times are when the episode first airs, from AniList's schedule. Streaming services usually add it the same day, sometimes a few hours later.
      </p>
    </section>
  );
}

/**
 * Scheduled episodes with their air times in the reader's zone. Episodes
 * whose page is indexable are links; the rest navigate from a button, so
 * crawlers are not led to noindex pages (see api/_episodes.js).
 */
export function ScheduleList({
  anime,
  entries,
  current,
  next,
  linkable,
}: {
  anime: Anime;
  entries: { episode: number; at: Date }[];
  current?: number;
  next?: number | null;
  linkable: (n: number) => boolean;
}) {
  const navigate = useNavigate();
  const now = new Date();
  return (
    <ol className="divide-y divide-ink/10" style={outfit}>
      {entries.map((e) => {
        const label = `Episode ${e.episode}`;
        const name = e.episode === current
          ? <span className="font-semibold text-foreground">{label}</span>
          : linkable(e.episode)
            ? <Link to={episodePath(anime, e.episode)} className="text-foreground underline decoration-ink/30 underline-offset-2 hover:text-crimson">{label}</Link>
            : <button type="button" onClick={() => navigate(episodePath(anime, e.episode))} className="normal-case tracking-normal text-left text-foreground hover:text-crimson" style={outfit}>{label}</button>;
        const note = e.at <= now ? 'Out' : e.episode === next ? 'Next' : null;
        return (
          <li key={e.episode} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
            <span className="w-24 shrink-0">{name}</span>
            <time dateTime={e.at.toISOString()} className="flex-1 text-foreground/80">{formatAiring(e.at)}</time>
            {note && (
              <span className={`text-[10px] uppercase tracking-[0.14em] ${note === 'Next' ? 'text-crimson' : 'text-muted-foreground'}`} style={mono}>{note}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
