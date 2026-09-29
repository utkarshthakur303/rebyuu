import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Star } from 'lucide-react';
import { getAnimeById, getEpisodeActivity, getEpisodeRatings, type Anime } from '@/services/anime';
import { EpisodeModal } from '@/app/components/EpisodeModal';
import { useSeo } from '@/utils/useSeo';
import { useNoIndex } from '@/utils/useNoIndex';
import { useAnimeTitle } from '@/context/TitleLangContext';
import { animePath, parseAnimeRef } from '../../../api/_paths.js';
import { nextEpisode, formatAiring } from '../../../api/_titlepage.js';
import {
  lastEpisode,
  episodePath,
  isEpisodeIndexable,
  episodeTitleTag,
  episodeDescription,
  MIN_EPISODE_RATINGS,
} from '../../../api/_episodes.js';

type Activity = Map<number, { comments: number; ratings: number }>;

/**
 * One episode's page: when it airs, how Rebyuu rates it, and the discussion.
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

  const next = anime.status === 'airing' ? nextEpisode(anime) : null;

  const Neighbour = ({ m, children }: { m: number; children: React.ReactNode }) => {
    if (m < 1 || m > last!) return <span />;
    const className = 'btn-imperial-outline min-h-[48px]';
    return isEpisodeIndexable(anime, m, activity.get(m)) ? (
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
        {displayTitle} — Episode {n}
      </h1>

      <div className="mb-8 flex flex-wrap gap-3">
        {next && next.episode === n && (
          <p className="flex items-center gap-2 border border-ink/20 bg-card px-4 py-3 text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <CalendarClock className="h-4 w-4 text-crimson" aria-hidden="true" />
            Airs on <time dateTime={next.at.toISOString()} className="font-semibold">{formatAiring(next.at)}</time>
          </p>
        )}
        {score && score.count >= MIN_EPISODE_RATINGS && (
          <p className="flex items-center gap-2 border border-ink/20 bg-card px-4 py-3 text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <Star className="h-4 w-4 fill-crimson text-crimson" aria-hidden="true" />
            <span className="font-semibold">{score.average.toFixed(1)}/10</span>
            <span className="text-muted-foreground">from {score.count} ratings</span>
          </p>
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
