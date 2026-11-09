import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ExternalLink, Star } from 'lucide-react';
import { getAnimeById, getEpisodeActivity, getEpisodeRatings, type Anime } from '@/services/anime';
import { EpisodeModal } from '@/app/components/EpisodeModal';
import { Countdown, ReleaseTimesTable, ScheduleList } from '@/app/components/ReleaseTime';
import { useSeo } from '@/utils/useSeo';
import { useNoIndex } from '@/utils/useNoIndex';
import { useAnimeTitle } from '@/context/TitleLangContext';
import { animePath, parseAnimeRef } from '../../../api/_paths.js';
import { nextEpisode, formatAiring, streamingLinks } from '../../../api/_titlepage.js';
import { scheduleWindow } from '../../../api/_schedule.js';
import {
  lastEpisode,
  episodePath,
  isEpisodeIndexable,
  episodeTitleTag,
  episodeDescription,
  episodeRelease,
  episodeAnswers,
  weeksWord,
  MIN_EPISODE_RATINGS,
} from '../../../api/_episodes.js';

const outfit = { fontFamily: 'Outfit, ui-sans-serif, sans-serif' };
const anton = { fontFamily: 'Anton, Impact, sans-serif' };
const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' };
const card = 'rounded-lg border border-ink/20 bg-card p-4 sm:p-6';
const heading = 'mb-3 sm:mb-4 text-xl sm:text-2xl text-foreground';

type Activity = Map<number, { comments: number; ratings: number }>;

/**
 * One episode's page: when it comes out (with a countdown, in the reader's
 * time and around the world) or when it came out, where to watch it, the
 * schedule around it, how Rebyuu rates it, and the discussion.
 *
 * The prerender serves the same page (api/render.js, route=episode) and both
 * take their rules from api/_episodes.js: which episodes have pages, which are
 * indexable, and what the title and description say. Neighbouring episodes
 * are links only when indexable — the rest are buttons, so crawlers are not
 * led to a quarter of a million empty pages. Visitors can open any of them.
 */
export default function EpisodePage() {
  const { id: ref = '', ep = '' } = useParams();
  const id = parseAnimeRef(ref)?.id ?? '';
  const n = Number(ep);
  const navigate = useNavigate();
  const location = useLocation();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity>(new Map());
  const [score, setScore] = useState<{ average: number; count: number } | null>(null);
  const displayTitle = useAnimeTitle(anime);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAnimeById(id)
      .then((row) => { if (!cancelled) setAnime(row && row.id === id ? row : null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const loadStats = useCallback(async () => {
    const [act, ratings] = await Promise.all([getEpisodeActivity(id), getEpisodeRatings(id, n)]);
    setActivity(act);
    setScore(ratings.length
      ? { average: ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length, count: ratings.length }
      : null);
  }, [id, n]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const last = anime ? lastEpisode(anime) : null;
  const valid = !!anime && !!last && Number.isInteger(n) && n >= 1 && n <= last;
  const own = activity.get(n);
  const indexable = valid && isEpisodeIndexable(anime, n, own);

  useSeo(
    valid
      ? {
          title: episodeTitleTag(anime, n),
          description: episodeDescription(anime, n, { average: score?.average ?? null, count: score?.count ?? 0, comments: own?.comments ?? 0 }),
          path: episodePath(anime, n),
        }
      : { title: '' }
  );
  useNoIndex(!loading && !indexable);

  // As on the title page: older URL forms are replaced with the canonical one.
  useEffect(() => {
    if (valid && location.pathname !== episodePath(anime, n)) {
      navigate(episodePath(anime, n), { replace: true });
    }
  }, [valid, anime, n, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink/70 border-t-crimson" />
      </div>
    );
  }

  if (!valid || !anime) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground" style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}>This episode is not in the archive.</p>
        {anime && <Link to={animePath(anime)} className="btn-imperial-outline">Back to {displayTitle}</Link>}
      </div>
    );
  }

  const release = episodeRelease(anime, n);
  const linkable = (m: number) => m >= 1 && m <= last! && isEpisodeIndexable(anime, m, activity.get(m));
  const schedule: { episode: number; at: Date }[] = scheduleWindow(anime, n);
  const answers: { question: string; answer: string }[] = episodeAnswers(anime, n);
  const links: { site: string; url: string }[] = streamingLinks(anime);
  const next = nextEpisode(anime);
  const EpisodeLink = ({ m }: { m: number }) =>
    linkable(m) ? (
      <Link to={episodePath(anime, m)} className="font-semibold underline decoration-ink/30 underline-offset-2 hover:text-crimson">episode {m}</Link>
    ) : (
      <button type="button" onClick={() => navigate(episodePath(anime, m))} className="normal-case tracking-normal font-semibold underline decoration-ink/30 underline-offset-2 hover:text-crimson" style={outfit}>episode {m}</button>
    );

  const Neighbour = ({ m, children }: { m: number; children: React.ReactNode }) => {
    if (m < 1 || m > last!) return <span />;
    const className = 'btn-imperial-outline min-h-[48px]';
    return linkable(m) ? (
      <Link to={episodePath(anime, m)} className={className}>{children}</Link>
    ) : (
      <button type="button" onClick={() => navigate(episodePath(anime, m))} className={className}>{children}</button>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 pb-24 lg:pb-14">
      <Link
        to={animePath(anime)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {displayTitle}
      </Link>

      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-orange" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
        Episode {n}{anime.episodes ? ` of ${anime.episodes}` : ''}
      </p>
      <h1 className="mb-6 text-3xl sm:text-4xl uppercase leading-[0.95] text-foreground" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
        {release?.state === 'upcoming' ? `${displayTitle} Episode ${n}: Release Date & Time` : `${displayTitle} — Episode ${n}`}
      </h1>

      {release?.state === 'upcoming' && (
        <section className={`${card} mb-6`} aria-label="Release date">
          <p className="mb-4 flex items-start gap-2 text-base text-foreground/85" style={outfit}>
            <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
            <span>
              {displayTitle} episode {n} comes out{release.breakWeeks ? ` ${weeksWord(release.breakWeeks)} later than usual,` : ''} on{' '}
              {/* The reader's own time zone; the served HTML says UTC. */}
              <time dateTime={release.at.toISOString()} className="font-semibold">{formatAiring(release.at)}</time>.
            </span>
          </p>
          <Countdown at={release.at} />
        </section>
      )}
      {release?.state === 'aired' && (
        <section className={`${card} mb-6`} aria-label="Release date">
          <p className="flex items-start gap-2 text-base text-foreground/85" style={outfit}>
            <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
            <span>
              {displayTitle} episode {n} came out on{' '}
              <time dateTime={release.at.toISOString()} className="font-semibold">{formatAiring(release.at)}</time>.
              {release.next && (
                <>
                  {' '}The next episode, <EpisodeLink m={release.next.episode} />, comes out on{' '}
                  <time dateTime={release.next.at.toISOString()} className="font-semibold">{formatAiring(release.next.at)}</time>.
                </>
              )}
            </span>
          </p>
        </section>
      )}

      <div className="mb-8 flex flex-wrap gap-3">
        {score && score.count >= MIN_EPISODE_RATINGS && (
          <p className="flex items-center gap-2 border border-ink/20 bg-card px-4 py-3 text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <Star className="h-4 w-4 fill-crimson text-crimson" aria-hidden="true" />
            <span className="font-semibold">{score.average.toFixed(1)}/10</span>
            <span className="text-muted-foreground">from {score.count} ratings</span>
          </p>
        )}
      </div>

      <div className="mb-8 space-y-6">
        {release?.state === 'upcoming' && <ReleaseTimesTable at={release.at} title={displayTitle || anime.title} n={n} />}

        {links.length > 0 && (
          <section className={card}>
            <h2 className={heading} style={anton}>Where to watch {displayTitle} episode {n}</h2>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.site}
                  href={link.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-[44px] items-center gap-2 border-2 border-ink bg-background px-4 py-2 text-sm font-medium text-foreground transition-shadow hover:shadow-[4px_4px_0_var(--orange)]"
                  style={outfit}
                >
                  {link.site}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground" style={outfit}>Availability varies by country. Services as listed on AniList.</p>
          </section>
        )}

        {schedule.length >= 2 && (
          <section className={card}>
            <h2 className={heading} style={anton}>{displayTitle} release schedule</h2>
            <ScheduleList anime={anime} entries={schedule} current={n} next={next?.episode ?? null} linkable={linkable} />
            <p className="mt-3 text-xs text-muted-foreground" style={outfit}>
              Air times from AniList, in your time zone. <Link to={animePath(anime)} className="underline underline-offset-2 hover:text-crimson">Every episode of {displayTitle}</Link>
            </p>
          </section>
        )}

        {answers.length > 0 && (
          <section className={card}>
            <h2 className={heading} style={anton}>{displayTitle} episode {n}: quick answers</h2>
            <div className="space-y-4">
              {answers.map((qa) => (
                <div key={qa.question}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/80" style={mono}>{qa.question}</h3>
                  <p className="mt-1 text-base leading-relaxed text-foreground/85" style={outfit}>{qa.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="rounded-lg border border-ink/20 bg-card">
        <h2 className="border-b border-ink/20 px-4 sm:px-6 pt-5 pb-4 text-xl sm:text-2xl text-foreground" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
          Discussion
        </h2>
        <EpisodeModal
          variant="page"
          isOpen
          onClose={() => {}}
          animeId={anime.id}
          episodeNumber={n}
          animeTitle={displayTitle || anime.title}
          onChange={loadStats}
        />
      </section>

      <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Episodes">
        <Neighbour m={n - 1}>← Episode {n - 1}</Neighbour>
        <Neighbour m={n + 1}>Episode {n + 1} →</Neighbour>
      </nav>
    </div>
  );
}
