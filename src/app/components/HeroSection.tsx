import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Play, X, Plus, Star, Share2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getTrendingHeroPool, type Anime } from '@/services/anime';
import { fetchMalIds, fetchMalScore, type MalScore } from '@/services/anilist';
import { useAnimeTitle } from '@/context/TitleLangContext';

const ROTATE_MS = 7000;
/** Hero rotates through the current top trending titles. */
const HERO_POOL_SIZE = 10;

const MONO = 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace';
const DISPLAY = 'Anton, Impact, sans-serif';

const ORANGE = '#FF7A18';
const PAPER = '#EDEBE4';
const INK = '#0A0A0A';
const MINT = '#7DFFC3';

function streamingCode(title: string) {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.replace(/[AEIOU]/g, '').slice(0, 5) || w.slice(0, 5))
    .join('_');
}

/** `anime_index.id` is stored as "anilist-<id>"; MAL lookups start from that. */
function anilistIdOf(id: string): number | null {
  const n = Number(id.replace(/^anilist-/, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function HeroSection() {
  const [pool, setPool] = useState<Anime[]>([]);
  const [index, setIndex] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [malIds, setMalIds] = useState<Record<number, number | null>>({});
  const [malScores, setMalScores] = useState<Record<string, MalScore | null>>({});

  useEffect(() => {
    getTrendingHeroPool(HERO_POOL_SIZE).then(setPool);
  }, []);

  // Resolve the whole rotation pool's MAL ids in one batched AniList request,
  // so switching slides never costs an extra id lookup.
  useEffect(() => {
    const ids = pool.map((a) => anilistIdOf(a.id)).filter((n): n is number => n !== null);
    if (!ids.length) return;
    let cancelled = false;
    fetchMalIds(ids).then((map) => {
      if (!cancelled) setMalIds(map);
    });
    return () => {
      cancelled = true;
    };
  }, [pool]);

  useEffect(() => {
    if (pool.length < 2 || trailerOpen) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % pool.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [pool.length, trailerOpen]);

  const anime = pool[index];
  /**
   * youtube-nocookie.com, not youtube.com: the privacy-enhanced host does not
   * write YouTube's tracking cookies until the viewer actually plays the
   * video. The trailer is a convenience on someone else's platform — it should
   * not tag every visitor who merely opens the modal. Both embeds on the site
   * use this host, and the CSP frame-src admits it.
   */
  const embedUrl = useMemo(
    () =>
      anime?.trailer
        ?.replace('watch?v=', 'embed/')
        .replace('www.youtube.com', 'www.youtube-nocookie.com') ?? null,
    [anime?.trailer]
  );

  // Fetch the displayed title's MAL score on demand. One request per slide,
  // served from the same-day cache on repeats, and skipped entirely once a
  // result (including a null "no score") is already recorded for this id.
  useEffect(() => {
    if (!anime) return;
    if (anime.id in malScores) return;
    const anilistId = anilistIdOf(anime.id);
    const malId = anilistId !== null ? malIds[anilistId] : null;
    if (!malId) return;

    let cancelled = false;
    fetchMalScore(malId).then((score) => {
      if (!cancelled) setMalScores((prev) => ({ ...prev, [anime.id]: score }));
    });
    return () => {
      cancelled = true;
    };
  }, [anime, malIds, malScores]);

  const displayTitle = useAnimeTitle(anime);
  const mal = anime ? malScores[anime.id] : null;
  // MAL first; fall back to the AniList score already in our snapshot.
  const displayScore = mal?.score ?? anime?.rating ?? null;
  const scoreSource = mal?.score != null ? 'MAL' : anime?.rating != null ? 'ANILIST' : null;

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: PAPER, color: INK }}
    >
      {/* Diagonal orange field */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: ORANGE,
          clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 80%)',
        }}
      />

      {/* Oversized watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden"
      >
        <span
          className="whitespace-nowrap select-none opacity-[0.07]"
          style={{
            fontFamily: DISPLAY,
            fontSize: 'clamp(6rem, 16vw, 16rem)',
            transform: 'rotate(-8deg) translateY(-10%)',
            letterSpacing: '0.02em',
          }}
        >
          CURATED // SUBMIT
        </span>
      </div>

      {/* Left vertical system readouts (decorative) */}
      <div
        aria-hidden
        className="absolute left-2 top-1/4 hidden lg:flex flex-col gap-10"
        style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.15em' }}
      >
        {['001_LATENCY_4MS', '002_ENC_READY', '003_USER_AUTH'].map((t) => (
          <span key={t} style={{ writingMode: 'vertical-rl', opacity: 0.45 }}>
            {t}
          </span>
        ))}
      </div>

      {/* Top-right status readout (decorative) */}
      <div
        aria-hidden
        className="absolute right-4 top-5 hidden sm:block text-right"
        style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em' }}
      >
        <div>
          SYSTEM STATUS: <span style={{ color: '#0F7B4F' }}>OPTIMAL</span>
        </div>
        <div style={{ opacity: 0.7 }}>USER: GUEST_0832</div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-14 sm:pt-16 lg:pt-20 pb-0">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-6 items-start">
          {/* ── Left: title block ── */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={anime?.id ?? 'loading'}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                <div
                  className="inline-block px-3 py-1.5 mb-5"
                  style={{
                    backgroundColor: INK,
                    color: PAPER,
                    fontFamily: MONO,
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                  }}
                >
                  STREAMING_CODE: [{anime ? streamingCode(displayTitle) : '________'}]
                </div>

                <p
                  className="mb-1"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                    letterSpacing: '0.02em',
                  }}
                >
                  SEASONAL PEAK
                </p>

                <h1
                  className="break-words"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 'clamp(2.75rem, 8.5vw, 7rem)',
                    lineHeight: 0.85,
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                  }}
                >
                  {anime ? (
                    // The headline is the most obviously clickable thing on the
                    // page and led nowhere. `color: inherit` keeps the paper/ink
                    // treatment; the underline only appears on hover so the flat
                    // poster look is undisturbed at rest.
                    <Link
                      to={`/anime/${anime.id}`}
                      className="hero-title-link"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {displayTitle}
                    </Link>
                  ) : (
                    'LOADING ARCHIVE'
                  )}
                </h1>

                <div className="mt-7 sm:mt-9 flex items-center gap-5">
                  <div
                    className="px-5 py-2"
                    style={{
                      backgroundColor: INK,
                      color: PAPER,
                      fontFamily: DISPLAY,
                      fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
                      lineHeight: 1.05,
                    }}
                  >
                    {displayScore != null ? displayScore.toFixed(2) : '—'}
                  </div>
                  <div style={{ fontFamily: MONO }}>
                    <p
                      className="font-bold"
                      style={{ color: '#B23C00', letterSpacing: '0.08em', fontSize: '15px' }}
                    >
                      {scoreSource === 'MAL'
                        ? mal?.rank
                          ? `MAL SCORE · #${mal.rank}`
                          : 'MAL SCORE'
                        : scoreSource === 'ANILIST'
                        ? 'ANILIST SCORE'
                        : 'NOT YET SCORED'}
                    </p>
                    <p style={{ fontSize: '13px', opacity: 0.75, letterSpacing: '0.04em' }}>
                      {/* A real vote count when MAL gives us one; never a fabricated figure. */}
                      {scoreSource === 'MAL' && mal?.scoredBy
                        ? `BASED ON ${mal.scoredBy.toLocaleString()} RATINGS`
                        : 'BASED ON COMMUNITY RATINGS'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Right: tilted key art ── */}
          <div className="relative min-h-[260px] sm:min-h-[340px] lg:min-h-[440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={anime?.id ?? 'art-loading'}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
                className="relative"
                style={{ transform: 'rotate(2deg)' }}
              >
                <div
                  className="relative overflow-hidden"
                  style={{
                    backgroundColor: INK,
                    padding: '10px',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                  }}
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                    {anime && (
                      <Link
                        to={`/anime/${anime.id}`}
                        className="group block h-full w-full"
                        aria-label={`Open ${displayTitle}`}
                      >
                        <img
                          src={anime.banner_image || anime.cover_image}
                          alt={displayTitle}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </Link>
                    )}
                  </div>

                  {anime?.genres?.length ? (
                    <div
                      className="absolute bottom-5 right-5 px-3 py-2"
                      style={{
                        backgroundColor: INK,
                        color: PAPER,
                        fontFamily: MONO,
                        fontSize: '11px',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {anime.genres.slice(0, 3).map((g) => (
                        <div key={g}>GENRE: {g.toUpperCase()}</div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div
                  className="absolute -top-3 -left-4 px-3 py-1.5"
                  style={{
                    backgroundColor: MINT,
                    color: INK,
                    fontFamily: MONO,
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    transform: 'rotate(-3deg)',
                  }}
                >
                  LIVE_NOW
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="relative mt-10 sm:mt-12 flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
          <button
            type="button"
            onClick={() => embedUrl && setTrailerOpen(true)}
            disabled={!embedUrl}
            className="group flex flex-1 items-center gap-4 px-3 py-3 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: `2px solid ${INK}` }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              style={{ backgroundColor: INK, color: PAPER }}
            >
              <Play className="h-4 w-4" fill="currentColor" />
            </span>
            <span
              className="flex-1 text-left truncate"
              style={{ fontFamily: DISPLAY, fontSize: 'clamp(1.1rem, 2.2vw, 1.6rem)' }}
            >
              {embedUrl ? 'WATCH TRAILER_V2.0' : 'TRAILER UNAVAILABLE'}
            </span>
          </button>

          <div
            className="flex items-stretch divide-x-2"
            style={{ backgroundColor: INK, color: PAPER, borderColor: '#333' }}
          >
            {anime && (
              <>
                <Link
                  to="/lists"
                  className="flex items-center gap-2 px-4 sm:px-6 py-3 hover:opacity-80 transition-opacity"
                >
                  <span
                    className="hidden sm:inline px-1.5 py-0.5"
                    style={{
                      border: `1px solid ${ORANGE}`,
                      color: ORANGE,
                      fontFamily: MONO,
                      fontSize: '10px',
                    }}
                  >
                    ALT+W
                  </span>
                  <Plus className="h-4 w-4 sm:hidden" />
                  <span style={{ fontFamily: DISPLAY, fontSize: '1.05rem' }}>WATCH_LIST</span>
                </Link>

                <Link
                  to={`/anime/${anime.id}`}
                  className="flex items-center gap-2 px-4 sm:px-6 py-3 hover:opacity-80 transition-opacity"
                  style={{ color: ORANGE }}
                >
                  <span
                    className="hidden sm:inline px-1.5 py-0.5"
                    style={{
                      border: `1px solid ${ORANGE}`,
                      fontFamily: MONO,
                      fontSize: '10px',
                    }}
                  >
                    ALT+R
                  </span>
                  <Star className="h-4 w-4 sm:hidden" />
                  <span style={{ fontFamily: DISPLAY, fontSize: '1.05rem' }}>RATE_NOW</span>
                </Link>

                <Link
                  to={`/anime/${anime.id}`}
                  className="flex items-center gap-2 px-4 sm:px-6 py-3 hover:opacity-80 transition-opacity"
                >
                  <span
                    className="hidden sm:inline px-1.5 py-0.5"
                    style={{
                      border: `1px solid ${ORANGE}`,
                      color: ORANGE,
                      fontFamily: MONO,
                      fontSize: '10px',
                    }}
                  >
                    ALT+S
                  </span>
                  <Share2 className="h-4 w-4 sm:hidden" />
                  <span style={{ fontFamily: DISPLAY, fontSize: '1.05rem' }}>SHARE</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Rotation progress ticks */}
        {pool.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {/* One tick per pooled title. This previously sliced to 12 while
                comparing against `index % 12`, so the active tick drifted out
                of sync once the pool ran past twelve entries. */}
            {pool.map((a, i) => (
              /* The tick stays 4px tall — that is the design. What changed is
                 the hit area: the button is now a transparent 24px-tall strip
                 with the bar drawn inside it, because a 29x4 target is not
                 tappable by any thumb. Nothing moves visually: the padding is
                 vertical and the row already sits in its own flex line. */
              <button
                key={a.id}
                onClick={() => setIndex(i)}
                aria-label={`Show ${a.title}`}
                className="flex-1 flex items-center py-2.5 bg-transparent transition-opacity hover:opacity-100"
                style={{ opacity: i === index ? 0.9 : 0.18 }}
              >
                <span
                  aria-hidden="true"
                  className="block h-1 w-full"
                  style={{ backgroundColor: INK }}
                />
              </button>
            ))}
          </div>
        )}

        <p
          className="mt-5 pb-4"
          style={{ fontFamily: MONO, fontSize: '11px', opacity: 0.55, letterSpacing: '0.06em' }}
        >
          ©2024 REBYUU_NETWORK // ALL RIGHTS RESERVED // NEW_ERIDU_OS_V4.2
        </p>
      </div>

      {/* Hazard stripe footer */}
      <div
        aria-hidden
        className="h-4 w-full"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${INK} 0 14px, ${ORANGE} 14px 28px)`,
        }}
      />

      {/* Trailer modal */}
      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {trailerOpen && embedUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
                onClick={() => setTrailerOpen(false)}
              >
                <div
                  className="relative w-full max-w-4xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setTrailerOpen(false)}
                    aria-label="Close trailer"
                    className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center"
                    style={{ backgroundColor: ORANGE, color: INK }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      src={embedUrl}
                      title={`${anime?.title ?? 'Anime'} trailer`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
