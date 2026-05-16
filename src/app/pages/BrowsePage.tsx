import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeCard } from '@/app/components/AnimeCard';
import { getAnimeListPaginated, genres, years, seasons, statuses, type Anime } from '@/services/anime';

export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const genreParam = searchParams.get('genre') || '';
  
  // Sync search query from URL to Navigation component
  useEffect(() => {
    // This ensures URL params are respected on mount
  }, [queryParam, genreParam]);
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Parse genre query param on mount
  useEffect(() => {
    if (genreParam) {
      const genreCapitalized = genreParam.charAt(0).toUpperCase() + genreParam.slice(1);
      if (genres.includes(genreCapitalized)) {
        setSelectedGenres([genreCapitalized]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedGenres, selectedYear, selectedSeason, selectedStatus, queryParam, genreParam]);

  // Clear filters when navigating away from browse
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.pathname !== '/browse') {
        setSelectedGenres([]);
        setSelectedYear(null);
        setSelectedSeason(null);
        setSelectedStatus('all');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const loadAnime = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const { data, totalCount: count, totalPages: pages } = await getAnimeListPaginated({
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        year: selectedYear || undefined,
        season: selectedSeason || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        query: queryParam || undefined
      }, pageNum, 24);
      
      setAnimeList(data);
      setTotalCount(count || 0);
      setTotalPages(pages || 1);
    } catch (error) {
      console.error('Error loading anime:', error);
      setAnimeList([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [selectedGenres, selectedYear, selectedSeason, selectedStatus, queryParam]);

  useEffect(() => {
    setPage(1);
    setAnimeList([]);
    loadAnime(1);
  }, [selectedGenres, selectedYear, selectedSeason, selectedStatus, queryParam, loadAnime]);

  useEffect(() => {
    loadAnime(page);
  }, [page, loadAnime]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
    setSelectedSeason(null);
    setSelectedStatus('all');
  };

  const hasActiveFilters =
    selectedGenres.length > 0 || selectedYear || selectedSeason || selectedStatus !== 'all';

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
                <h1 className="mb-1 text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
                  Browse Archive
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {loading ? 'Searching...' : queryParam ? `Results for "${queryParam}"` : totalCount > 0 ? `Showing ${((page - 1) * 24) + 1}–${Math.min(page * 24, totalCount)} of ${totalCount} entries` : 'No entries found'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-md border border-gold/15 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-gold/25 min-h-[44px]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-md bg-crimson px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-white transition-all hover:bg-crimson/90 lg:hidden min-h-[44px]"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20 lg:top-24 space-y-6 rounded-lg border border-gold/[0.08] bg-card p-4 lg:p-5">
              {/* Decorative header */}
              <div className="pb-3 border-b border-gold/10">
                <p className="text-[10px] tracking-[0.2em] uppercase text-gold/40 font-medium" style={{ fontFamily: 'Outfit, sans-serif' }}>Refine Search</p>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Status</h3>
                <div className="space-y-1">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs transition-all ${
                        selectedStatus === status
                          ? 'bg-crimson text-white'
                          : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                      }`}
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Genres</h3>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`rounded-sm px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase transition-all ${
                        selectedGenres.includes(genre)
                          ? 'bg-crimson text-white shadow-md shadow-crimson/20'
                          : 'border border-gold/10 bg-transparent text-foreground/60 hover:bg-accent hover:border-gold/20'
                      }`}
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Year</h3>
                <select
                  value={selectedYear || ''}
                  onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                  className="input-imperial text-xs min-h-[44px]"
                  style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}
                >
                  <option value="">All Years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Season</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {seasons.map((season) => (
                    <button
                      key={season}
                      onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                      className={`rounded-md px-3 py-2.5 text-xs transition-all min-h-[40px] ${
                        selectedSeason === season
                          ? 'bg-crimson text-white'
                          : 'border border-gold/10 bg-transparent text-foreground/60 hover:bg-accent'
                      }`}
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {season}
                    </button>
                  ))}
                </div>
              </div>
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
                  className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-gold/10 bg-background p-4 sm:p-6 lg:hidden"
                >
                  <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-gold/70" style={{ fontFamily: 'Outfit, sans-serif' }}>Filters</h2>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Status</h3>
                      <div className="space-y-1.5">
                        {statuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`w-full rounded-md px-3 py-3 text-left text-sm transition-all min-h-[44px] ${
                              selectedStatus === status
                                ? 'bg-crimson text-white'
                                : 'text-foreground/70 hover:bg-accent'
                            }`}
                            style={{ fontFamily: 'Outfit, sans-serif' }}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Genres</h3>
                      <div className="flex flex-wrap gap-2">
                        {genres.map((genre) => (
                          <button
                            key={genre}
                            onClick={() => toggleGenre(genre)}
                            className={`rounded-sm px-3 py-2 text-xs font-medium tracking-wider transition-all min-h-[36px] ${
                              selectedGenres.includes(genre)
                                ? 'bg-crimson text-white shadow-md shadow-crimson/20'
                                : 'border border-gold/10 bg-transparent text-foreground/60 hover:bg-accent'
                            }`}
                            style={{ fontFamily: 'Outfit, sans-serif' }}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Year</h3>
                      <select
                        value={selectedYear || ''}
                        onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                        className="input-imperial text-sm min-h-[44px]"
                        style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif' }}
                      >
                        <option value="">All Years</option>
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Season</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {seasons.map((season) => (
                          <button
                            key={season}
                            onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                            className={`rounded-md px-3 py-3 text-sm transition-all min-h-[44px] ${
                              selectedSeason === season
                                ? 'bg-crimson text-white'
                                : 'border border-gold/10 bg-transparent text-foreground/60 hover:bg-accent'
                            }`}
                            style={{ fontFamily: 'Outfit, sans-serif' }}
                          >
                            {season}
                          </button>
                        ))}
                      </div>
                    </div>
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
            ) : animeList.length > 0 ? (
              <>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" style={{ isolation: 'isolate' }}>
                  {animeList.map((anime, index) => (
                    <AnimeCard key={`${anime.id}-${index}`} anime={anime} index={index} />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1 || loading}
                        className="flex items-center gap-1 rounded-md border border-gold/10 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-gold/20 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>
                      
                      <div className="flex items-center gap-1 flex-wrap justify-center">
                        {getPageNumbers().map((pageNum, idx) => (
                          pageNum === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gold/30">···</span>
                          ) : (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum as number)}
                              disabled={loading}
                              className={`min-w-[44px] min-h-[44px] rounded-md px-3 py-2 text-xs font-medium tracking-wider transition-all flex items-center justify-center ${
                                page === pageNum
                                  ? 'bg-crimson text-white shadow-lg shadow-crimson/20'
                                  : 'border border-gold/10 bg-card text-foreground/70 hover:bg-accent hover:border-gold/20'
                              } disabled:opacity-30 disabled:cursor-not-allowed`}
                              style={{ fontFamily: 'Outfit, sans-serif' }}
                            >
                              {pageNum}
                            </button>
                          )
                        ))}
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages || loading}
                        className="flex items-center gap-1 rounded-md border border-gold/10 bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-gold/20 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
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
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-gold/10">
                <div className="text-center">
                  <p className="mb-2 text-lg font-medium text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>No entries found</p>
                  <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
                    {queryParam ? 'Try a different search term' : 'Adjust your filters to discover more'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
