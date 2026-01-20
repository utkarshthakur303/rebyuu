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
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
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
        <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 sm:mb-2 text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              Browse Anime
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {loading ? 'Loading...' : queryParam ? `Results for "${queryParam}"` : totalCount > 0 ? `Showing ${((page - 1) * 24) + 1}-${Math.min(page * 24, totalCount)} of ${totalCount} anime` : 'No anime found'}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent min-h-[44px]"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 lg:hidden min-h-[44px]"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20 lg:top-24 space-y-6 rounded-xl border border-border bg-card p-4 lg:p-6">
              <div>
                <h3 className="mb-3 font-semibold text-foreground">Status</h3>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selectedStatus === status
                          ? 'bg-primary text-white'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-foreground">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        selectedGenres.includes(genre)
                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : 'border border-border bg-transparent text-foreground hover:bg-accent'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Year</h3>
                      <select
                        value={selectedYear || ''}
                        onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-lg border border-border bg-input-background px-3 py-3 text-base sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                        style={{ fontSize: '16px' }}
                      >
                        <option value="">All Years</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Season</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {seasons.map((season) => (
                          <button
                            key={season}
                            onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                            className={`rounded-lg px-3 py-3 text-sm transition-all min-h-[44px] ${
                              selectedSeason === season
                                ? 'bg-primary text-white'
                                : 'border border-border bg-transparent text-foreground hover:bg-accent'
                            }`}
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
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4 sm:p-6 lg:hidden"
                >
                  <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">Filters</h2>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Mobile filter content - same as desktop */}
                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Status</h3>
                      <div className="space-y-2">
                        {statuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`w-full rounded-lg px-3 py-3 text-left text-sm transition-colors min-h-[44px] ${
                              selectedStatus === status
                                ? 'bg-primary text-white'
                                : 'text-foreground hover:bg-accent'
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Genres</h3>
                      <div className="flex flex-wrap gap-2">
                        {genres.map((genre) => (
                          <button
                            key={genre}
                            onClick={() => toggleGenre(genre)}
                            className={`rounded-full px-3 py-2 text-xs sm:text-sm font-medium transition-all min-h-[36px] ${
                              selectedGenres.includes(genre)
                                ? 'bg-primary text-white shadow-md shadow-primary/30'
                                : 'border border-border bg-transparent text-foreground hover:bg-accent'
                            }`}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Year</h3>
                      <select
                        value={selectedYear || ''}
                        onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-lg border border-border bg-input-background px-3 py-3 text-base sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                        style={{ fontSize: '16px' }}
                      >
                        <option value="">All Years</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm sm:text-base font-semibold text-foreground">Season</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {seasons.map((season) => (
                          <button
                            key={season}
                            onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                            className={`rounded-lg px-3 py-3 text-sm transition-all min-h-[44px] ${
                              selectedSeason === season
                                ? 'bg-primary text-white'
                                : 'border border-border bg-transparent text-foreground hover:bg-accent'
                            }`}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-card" />
                ))}
              </div>
            ) : animeList.length > 0 ? (
              <>
                <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" style={{ isolation: 'isolate' }}>
                  {animeList.map((anime, index) => (
                    <AnimeCard key={`${anime.id}-${index}`} anime={anime} index={index} />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1 || loading}
                        className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>
                      
                      <div className="flex items-center gap-1 flex-wrap justify-center">
                        {getPageNumbers().map((pageNum, idx) => (
                          pageNum === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum as number)}
                              disabled={loading}
                              className={`min-w-[44px] min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center ${
                                page === pageNum
                                  ? 'bg-primary text-white'
                                  : 'border border-border bg-card text-foreground hover:bg-accent'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {pageNum}
                            </button>
                          )
                        ))}
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages || loading}
                        className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-border">
                <div className="text-center">
                  <p className="mb-2 text-lg font-medium text-foreground">No anime found</p>
                  <p className="text-muted-foreground">{queryParam ? 'Try a different search' : 'Try adjusting your filters'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
