import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCanonical } from '@/utils/useCanonical';
import { useSeo } from '@/utils/useSeo';
import { PAGES } from '../../../api/_pages.js';
import { Filter, X, ChevronLeft, ChevronRight, AlertTriangle, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeCard } from '@/app/components/AnimeCard';
import {
  getAnimeListPaginated,
  genres,
  years,
  seasons,
  statuses,
  BROWSE_SORTS,
  DEFAULT_BROWSE_SORT,
  isBrowseSort,
  type Anime,
  type BrowseSort,
} from '@/services/anime';

const PAGE_SIZE = 24;

/**
 * Every filter lives in the URL and nowhere else.
 *
 * The previous version read `?genre=` and `?status=` once, in a mount-only
 * effect, and kept the rest in local state. That broke in three ways at once:
 * a link to Browse from Browse (the homepage "View More" buttons, the genre
 * tiles) changed the query string without remounting, so the filters silently
 * ignored it; refreshing or sharing a filtered view lost the filters; and Back
 * did nothing because no navigation had ever been recorded. Deriving state from
 * `searchParams` fixes all three, and makes the URL the single source of truth.
 */
interface BrowseState {
  genres: string[];
  year: number | null;
  season: string | null;
  status: string;
  sort: BrowseSort;
  page: number;
  query: string;
}

function parseState(params: URLSearchParams): BrowseState {
  const rawGenres = params.get('genre');
  const parsedGenres = (rawGenres ? rawGenres.split(',') : [])
    // Accepts the lowercase form the homepage genre tiles link with, and
    // discards anything not in our vocabulary rather than querying for it.
    .map((g) => genres.find((known) => known.toLowerCase() === g.trim().toLowerCase()))
    .filter((g): g is string => Boolean(g));

  const rawYear = Number(params.get('year'));
  const year = years.includes(rawYear) ? rawYear : null;

  const rawSeason = params.get('season');
  const season = seasons.find((s) => s.toLowerCase() === rawSeason?.toLowerCase()) ?? null;

  const rawStatus = params.get('status') ?? 'all';
  const status = (statuses as readonly string[]).includes(rawStatus) ? rawStatus : 'all';

  const rawSort = params.get('sort') ?? '';
  const sort = isBrowseSort(rawSort) ? rawSort : DEFAULT_BROWSE_SORT;

  const rawPage = Number(params.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return { genres: parsedGenres, year, season, status, sort, page, query: params.get('q') ?? '' };
}

/** Serialises state back to a query string, omitting anything at its default. */
function toParams(state: BrowseState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.genres.length) params.set('genre', state.genres.join(','));
  if (state.year) params.set('year', String(state.year));
  if (state.season) params.set('season', state.season);
  if (state.status !== 'all') params.set('status', state.status);
  if (state.sort !== DEFAULT_BROWSE_SORT) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

export default function BrowsePage() {
  /**
   * Every faceted variant of this page — genre, year, season, status, sort,
   * page, q, in any combination — points at the bare path. They are all
   * reorderings of one catalogue, and consolidating them here means a link
   * someone shares to a filtered view still passes its weight to /browse
   * rather than stranding it on a near-duplicate. robots.txt keeps crawlers
   * out of that space in the first place; this covers the URLs that reach an
   * engine by being linked or shared rather than by being crawled.
   */
  useCanonical('/browse');
  useSeo({ title: PAGES.browse.title, description: PAGES.browse.description });

  const [searchParams, setSearchParams] = useSearchParams();
  // Memoised on the serialised string, not the object: a URLSearchParams
  // instance is not guaranteed to be referentially stable across renders, and
  // an unstable `state` would re-fire the fetch effect on every render.
  const search = searchParams.toString();
  const state = useMemo(() => parseState(new URLSearchParams(search)), [search]);
  const { genres: selectedGenres, year: selectedYear, season: selectedSeason } = state;
  const { status: selectedStatus, sort: selectedSort, page, query: queryParam } = state;

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  /**
   * Guards against out-of-order responses. Toggling three genre chips quickly
   * fires three overlapping requests, and without a sequence check whichever
   * finished last won — routinely painting the grid with results for a filter
   * set the visitor had already moved past.
   */
  const requestRef = useRef(0);

  /**
   * Writes a partial change back to the URL. Any filter change resets to page 1:
   * staying on page 7 while switching from 400 results to 12 lands on a blank
   * grid that reads as "no matches".
   */
  const update = useCallback(
    (patch: Partial<BrowseState>, replace = false) => {
      const next = { ...state, ...patch };
      if (!('page' in patch)) next.page = 1;
      setSearchParams(toParams(next), { replace });
    },
    [state, setSearchParams]
  );

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const result = await getAnimeListPaginated(
          {
            genres: selectedGenres.length > 0 ? selectedGenres : undefined,
            year: selectedYear || undefined,
            season: selectedSeason || undefined,
            status: selectedStatus !== 'all' ? selectedStatus : undefined,
            query: queryParam || undefined,
            sort: selectedSort,
          },
          page,
          PAGE_SIZE
        );

        if (requestId !== requestRef.current) return;
        setAnimeList(result.data);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setHasMore(result.hasMore);
        setIsLive(result.live);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        console.error('Error loading anime:', error);
        // Distinguished from an empty result: "nothing matched" and "the
        // request failed" need different copy and only one of them is worth
        // offering a retry for.
        setFailed(true);
        setAnimeList([]);
        setTotalCount(null);
        setTotalPages(null);
        setHasMore(false);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    })();
  }, [
    selectedGenres,
    selectedYear,
    selectedSeason,
    selectedStatus,
    selectedSort,
    queryParam,
    page,
    retryToken,
  ]);

  // Paging should return you to the top of the grid; changing a filter should
  // not yank the page around while you are still working in the sidebar.
  useEffect(() => {
    if (page > 1) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage === page) return;
    if (totalPages !== null && newPage > totalPages) return;
    // Scrolling is handled by the effect above, which also covers arriving at a
    // page through Back/Forward rather than through this button.
    update({ page: newPage });
  };

  const getPageNumbers = () => {
    if (totalPages === null) return [];
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...', totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, '...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, '...');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('...', totalPages);
    }

    return pages;
  };

  const toggleGenre = (genre: string) => {
    update({
      genres: selectedGenres.includes(genre)
        ? selectedGenres.filter((g) => g !== genre)
        : [...selectedGenres, genre],
    });
  };

  const clearFilters = () => {
    update({ genres: [], year: null, season: null, status: 'all' });
  };

  const hasActiveFilters =
    selectedGenres.length > 0 || !!selectedYear || !!selectedSeason || selectedStatus !== 'all';

  /** A search forces the archive ordering, so the sort control is inert then. */
  const sortDisabled = Boolean(queryParam);

  const resultSummary = () => {
    if (loading) return 'Searching...';
    if (failed) return 'Could not load results';
    if (queryParam) return `Results for "${queryParam}"`;
    if (totalCount !== null && totalCount > 0) {
      return `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount} entries`;
    }
    // Live rankings have no trustworthy total, so the page number is stated
    // plainly instead of inventing a count to divide.
    if (animeList.length > 0) {
      const label = BROWSE_SORTS.find((s) => s.id === selectedSort)?.label ?? '';
      return `${label} · page ${page}${isLive ? ' · live from AniList' : ''}`;
    }
    return 'No entries found';
  };

  const sortControl = (idPrefix: string) => (
    <div>
      <h3
        className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        Sort
      </h3>
      <div className="space-y-1">
        {BROWSE_SORTS.map((option) => (
          <button
            key={`${idPrefix}-${option.id}`}
            onClick={() => update({ sort: option.id })}
            disabled={sortDisabled}
            className={`w-full rounded-md px-3 py-2 text-left text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedSort === option.id
                ? 'bg-crimson text-ink'
                : 'text-foreground/70 hover:bg-accent hover:text-foreground'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {sortDisabled && (
        <p
          className="mt-2 text-[10px] leading-relaxed text-muted-foreground"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Search results are ordered by relevance.
        </p>
      )}
    </div>
  );

  const statusControl = (idPrefix: string, size: 'sm' | 'md') => (
    <div>
      <h3
        className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        Status
      </h3>
      <div className={size === 'sm' ? 'space-y-1' : 'space-y-1.5'}>
        {statuses.map((status) => (
          <button
            key={`${idPrefix}-${status}`}
            onClick={() => update({ status })}
            className={`w-full rounded-md px-3 text-left transition-all ${
              size === 'sm' ? 'py-2 text-xs' : 'py-3 text-sm min-h-[44px]'
            } ${
              selectedStatus === status
                ? 'bg-crimson text-ink'
                : 'text-foreground/70 hover:bg-accent hover:text-foreground'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  const genreControl = (idPrefix: string, size: 'sm' | 'md') => (
    <div>
      <h3
        className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        Genres
      </h3>
      <div className={`flex flex-wrap ${size === 'sm' ? 'gap-1.5' : 'gap-2'}`}>
        {genres.map((genre) => (
          <button
            key={`${idPrefix}-${genre}`}
            onClick={() => toggleGenre(genre)}
            className={`rounded-sm font-medium tracking-wider uppercase transition-all ${
              size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-2 text-xs min-h-[36px]'
            } ${
              selectedGenres.includes(genre)
                ? 'bg-crimson text-ink shadow-md shadow-crimson/20'
                : 'border border-ink/20 bg-transparent text-foreground/60 hover:bg-accent hover:border-ink/35'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {genre}
          </button>
        ))}
      </div>
    </div>
  );

  const yearControl = (size: 'sm' | 'md') => (
    <div>
      <h3
        className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        Year
      </h3>
      <select
        value={selectedYear || ''}
        onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : null })}
        className={`input-imperial min-h-[44px] ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
        // 16px on mobile: anything smaller makes iOS Safari zoom the viewport
        // on focus and leaves the page scrolled sideways.
        style={{ fontSize: size === 'sm' ? '14px' : '16px', fontFamily: 'Outfit, sans-serif' }}
      >
        <option value="">All Years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );

  const seasonControl = (idPrefix: string, size: 'sm' | 'md') => (
    <div>
      <h3
        className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        Season
      </h3>
      <div className={`grid grid-cols-2 ${size === 'sm' ? 'gap-1.5' : 'gap-2'}`}>
        {seasons.map((season) => (
          <button
            key={`${idPrefix}-${season}`}
            onClick={() => update({ season: selectedSeason === season ? null : season })}
            className={`rounded-md px-3 transition-all ${
              size === 'sm' ? 'py-2.5 text-xs min-h-[40px]' : 'py-3 text-sm min-h-[44px]'
            } ${
              selectedSeason === season
                ? 'bg-crimson text-ink'
                : 'border border-ink/20 bg-transparent text-foreground/60 hover:bg-accent'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {season}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8 overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 sm:mb-6 md:mb-8 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="hidden sm:block h-10 w-[3px] rounded-full bg-gradient-to-b from-crimson via-crimson/50 to-transparent mt-1 shrink-0" />
              <div>
                <h1
                  className="mb-1 text-2xl sm:text-3xl md:text-4xl text-foreground"
                  style={{ fontFamily: 'Anton, Impact, sans-serif' }}
                >
                  {PAGES.browse.heading}
                </h1>
                <p
                  className="text-xs sm:text-sm text-muted-foreground"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {resultSummary()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-md border border-ink/35 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-ink/70 min-h-[44px]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-md bg-crimson px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-ink transition-all hover:bg-crimson/90 lg:hidden min-h-[44px]"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="rounded-full bg-ink/20 px-1.5 text-[10px] leading-4">
                  {selectedGenres.length +
                    (selectedYear ? 1 : 0) +
                    (selectedSeason ? 1 : 0) +
                    (selectedStatus !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20 lg:top-24 space-y-6 rounded-lg border border-ink/20 bg-card p-4 lg:p-5 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <div className="pb-3 border-b border-ink/20">
                <p
                  className="text-[10px] tracking-[0.2em] uppercase text-gold/40 font-medium"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Refine Search
                </p>
              </div>

              {sortControl('d')}
              {statusControl('d', 'sm')}
              {genreControl('d', 'sm')}
              {yearControl('sm')}
              {seasonControl('d', 'sm')}
            </div>
          </aside>

          {/* Mobile Filters Modal */}
          <AnimatePresence>
            {showFilters && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowFilters(false)}
                  className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-ink/20 bg-background p-4 sm:p-6 lg:hidden"
                >
                  <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <h2
                      className="text-sm font-semibold tracking-[0.15em] uppercase text-gold/70"
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      Filters
                    </h2>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Close filters"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {sortControl('m')}
                    {statusControl('m', 'md')}
                    {genreControl('m', 'md')}
                    {yearControl('md')}
                    {seasonControl('m', 'md')}

                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          clearFilters();
                          setShowFilters(false);
                        }}
                        className="w-full rounded-md border border-ink/35 bg-card px-4 py-3 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent min-h-[44px]"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Anime Grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] skeleton-imperial" />
                ))}
              </div>
            ) : failed ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-ink/35">
                <div className="text-center px-6">
                  <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-crimson" />
                  <p
                    className="mb-2 text-lg text-foreground"
                    style={{ fontFamily: 'Anton, Impact, sans-serif' }}
                  >
                    Couldn't reach the archive
                  </p>
                  <p
                    className="mb-5 text-sm text-muted-foreground"
                    style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}
                  >
                    Check your connection and try again.
                  </p>
                  <button
                    onClick={() => setRetryToken((t) => t + 1)}
                    className="inline-flex items-center gap-2 rounded-md border border-ink/35 bg-card px-4 py-2.5 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent min-h-[44px]"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </div>
            ) : animeList.length > 0 ? (
              <>
                <div
                  className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  style={{ isolation: 'isolate' }}
                >
                  {animeList.map((anime, index) => (
                    <AnimeCard key={anime.id} anime={anime} index={index} />
                  ))}
                </div>

                {(totalPages === null ? hasMore || page > 1 : totalPages > 1) && (
                  <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="flex items-center gap-1 rounded-md border border-ink/20 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-ink/35 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>

                      {totalPages === null ? (
                        // Live rankings have no reliable page count, so a
                        // numbered bar here would be fiction — see RankedPage.
                        <span
                          className="px-4 text-xs font-medium tracking-wider text-foreground/70"
                          style={{ fontFamily: 'Outfit, sans-serif' }}
                        >
                          Page {page}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                          {getPageNumbers().map((pageNum, idx) =>
                            pageNum === '...' ? (
                              <span key={`ellipsis-${idx}`} className="px-2 text-gold/30">
                                ···
                              </span>
                            ) : (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum as number)}
                                className={`min-w-[44px] min-h-[44px] rounded-md px-3 py-2 text-xs font-medium tracking-wider transition-all flex items-center justify-center ${
                                  page === pageNum
                                    ? 'bg-crimson text-ink shadow-lg shadow-crimson/20'
                                    : 'border border-ink/20 bg-card text-foreground/70 hover:bg-accent hover:border-ink/35'
                                }`}
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                              >
                                {pageNum}
                              </button>
                            )
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={totalPages === null ? !hasMore : page >= totalPages}
                        className="flex items-center gap-1 rounded-md border border-ink/20 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-ink/35 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-ink/20">
                <div className="text-center px-6">
                  <p
                    className="mb-2 text-lg text-foreground"
                    style={{ fontFamily: 'Anton, Impact, sans-serif' }}
                  >
                    No entries found
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif', fontStyle: 'normal' }}
                  >
                    {queryParam
                      ? 'Try a different search term'
                      : hasActiveFilters
                        ? 'No titles match this combination of filters'
                        : 'Adjust your filters to discover more'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-5 inline-flex items-center gap-2 rounded-md border border-ink/35 bg-card px-4 py-2.5 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent min-h-[44px]"
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
