import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { hubPath } from '../../../api/_hubs.js';
import { groupSchedule, scheduleTime } from '../../../api/_hubdata.js';
import { animePath } from '../../../api/_paths.js';
import { getHubLinks, getAiringSchedule, type HubLink, type ScheduleEntry } from '@/services/hubs';
import type { BootList } from '@/services/anime';

/**
 * What a hub page (/seasons/fall-2026, /airing, /upcoming) shows above the
 * Browse grid it otherwise is: a short intro, the links to its neighbouring
 * or upcoming seasons, and on /airing the week's episodes. Kept compact so
 * the grid still starts on a phone's first screen.
 */

const outfit = { fontFamily: 'Outfit, ui-sans-serif, sans-serif' };

type Hub = { kind: string; season?: string; year?: number };

interface Extras {
  path: string | null;
  links: HubLink[] | null;
  schedule: ScheduleEntry[] | null;
}

/**
 * A hub's links and schedule: from the served page when it built them for
 * this hub, fetched otherwise. Null while loading.
 */
export function useHubExtras(hub: Hub | null, boot: BootList | null): Extras {
  const path = hub ? hubPath(hub) : null;
  const [extras, setExtras] = useState<Extras>(() => {
    const served = boot && boot.path === path ? boot : null;
    return { path, links: served?.links ?? null, schedule: served?.schedule ?? null };
  });

  useEffect(() => {
    if (!hub || (extras.path === path && extras.links !== null)) return;
    let cancelled = false;
    Promise.all([
      getHubLinks(hub),
      hub.kind === 'airing' ? getAiringSchedule(new Date()) : Promise.resolve(null),
    ]).then(([links, schedule]) => {
      if (!cancelled) setExtras({ path, links, schedule });
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the hub's path: a hub object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return extras.path === path ? extras : { path, links: null, schedule: null };
}

/** Links shown before "+N more": /top links 47 years, a genre its 17 fellow genres. */
const LINKS_SHOWN = 12;

export function HubIntro({ intro, linksLabel, links }: { intro: string; linksLabel: string | null; links: HubLink[] | null }) {
  const [allLinks, setAllLinks] = useState(false);
  const shown = links && !allLinks ? links.slice(0, LINKS_SHOWN) : links;
  return (
    <div className="mb-4 sm:mb-6 max-w-3xl">
      <p className="text-muted-foreground" style={{ ...outfit, fontSize: '15px', lineHeight: 1.6 }}>
        {intro}
      </p>
      {shown && shown.length > 0 && (
        // On a phone the row scrolls sideways rather than widening the page;
        // wider screens, where a mouse can't swipe it, wrap it instead.
        <nav aria-label={linksLabel ?? undefined} className="scroll-row mt-3 flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
          {linksLabel && (
            <span className="shrink-0 text-[10px] font-semibold tracking-[0.15em] uppercase text-foreground/60" style={outfit}>
              {linksLabel}
            </span>
          )}
          {shown.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="shrink-0 flex items-center min-h-[36px] rounded-md border border-ink/20 bg-card px-3 text-xs font-medium tracking-wider text-foreground/80 transition-all hover:bg-accent hover:border-ink/35"
              style={outfit}
            >
              {link.label}
            </Link>
          ))}
          {links && links.length > shown.length && (
            <button
              onClick={() => setAllLinks(true)}
              className="shrink-0 flex items-center min-h-[36px] rounded-md px-3 text-xs font-medium tracking-wider text-crimson hover:bg-accent"
              style={outfit}
            >
              +{links.length - shown.length} more
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

/** Rows shown for a day before "Show all". */
const SHOWN = 8;

/**
 * This week's episodes, one day at a time, in the reader's own time zone:
 * the served page groups them by UTC day, and this regroups them.
 */
export function AiringSchedule({ entries }: { entries: ScheduleEntry[] | null }) {
  const [now] = useState(() => new Date());
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const days = useMemo(() => groupSchedule(entries ?? [], { now, timeZone }), [entries, now, timeZone]);
  const [day, setDay] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (entries !== null && entries.length === 0) return null;
  const current = days[day];
  const rows = current ? (showAll ? current.entries : current.entries.slice(0, SHOWN)) : [];

  return (
    <section className="mb-6 rounded-lg border border-ink/20 bg-card p-3 sm:p-4" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className="mb-3 text-lg text-foreground" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
        This week's episodes
      </h2>
      <div className="scroll-row mb-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Day">
        {days.map((d, i) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={i === day}
            onClick={() => {
              setDay(i);
              setShowAll(false);
            }}
            className={`shrink-0 min-h-[36px] rounded-md px-3 text-xs font-medium transition-all ${
              i === day ? 'bg-crimson text-ink' : 'border border-ink/20 text-foreground/70 hover:bg-accent'
            }`}
            style={outfit}
          >
            {i === 0 ? 'Today' : d.short}
          </button>
        ))}
      </div>

      {entries === null ? (
        <div className="h-24 skeleton-imperial" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" style={outfit}>
          No episodes scheduled.
        </p>
      ) : (
        <ol className="divide-y divide-ink/10">
          {rows.map((e) => (
            <li key={`${e.id}-${e.episode}`} className="flex items-center gap-3 py-2 text-sm" style={outfit}>
              <time dateTime={new Date(e.at).toISOString()} className="w-12 shrink-0 tabular-nums text-foreground/70">
                {scheduleTime(e.at, timeZone)}
              </time>
              <Link to={animePath({ id: e.id, title: e.title })} className="min-w-0 flex-1 truncate text-foreground hover:text-crimson">
                {e.title}
              </Link>
              <span className="shrink-0 text-xs text-foreground/60">
                Ep {e.episode}
                {e.at <= now.getTime() ? ' · aired' : ''}
              </span>
            </li>
          ))}
        </ol>
      )}

      {current && current.entries.length > SHOWN && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 min-h-[36px] text-xs font-medium tracking-wider uppercase text-crimson"
          style={outfit}
        >
          Show all {current.entries.length}
        </button>
      )}
    </section>
  );
}
