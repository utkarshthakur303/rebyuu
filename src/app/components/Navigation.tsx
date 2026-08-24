import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Home, Grid3x3, User, LogIn, Shield, List, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { UserDropdown } from './UserDropdown';
import { getAnimeSearchSuggestions, type Anime } from '@/services/anime';
import { useTitleLang, useAnimeTitle } from '@/context/TitleLangContext';

/**
 * EN | JP switch for anime titles across the site. Rendered as a segmented
 * control so the inactive language stays visible — a single-label toggle
 * leaves people guessing whether it shows the current or the next state.
 */
function TitleLangToggle({ className = '' }: { className?: string }) {
  const { lang, toggle } = useTitleLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Anime titles: ${lang === 'en' ? 'English' : 'Japanese'}. Switch to ${lang === 'en' ? 'Japanese' : 'English'}.`}
      title="Switch anime title language"
      /* 44px tall on touch layouts to clear the minimum tap target; the
         desktop bar keeps the compact height. */
      className={`inline-flex items-stretch border-2 border-ink overflow-hidden shrink-0 min-h-[44px] md:min-h-0 ${className}`}
      style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
    >
      <span
        className={`flex items-center px-2.5 md:px-2 py-1 text-[10px] font-bold tracking-[0.1em] transition-colors ${
          lang === 'en' ? 'bg-orange text-ink' : 'bg-transparent text-ink/50'
        }`}
      >
        EN
      </span>
      <span
        className={`flex items-center px-2.5 md:px-2 py-1 text-[10px] font-bold tracking-[0.1em] transition-colors border-l-2 border-ink ${
          lang === 'jp' ? 'bg-orange text-ink' : 'bg-transparent text-ink/50'
        }`}
      >
        JP
      </span>
    </button>
  );
}

/** Search suggestion row — needs the hook, so it lives in its own component. */
function SuggestionTitle({ anime }: { anime: Anime }) {
  return <>{useAnimeTitle(anime)}</>;
}

/**
 * The suggestion dropdown.
 *
 * Defined at module scope on purpose. It used to be declared inside
 * `Navigation`, which gave it a new component identity on every render — React
 * then unmounted and rebuilt every row. When that happened between a press and
 * a release (and it happened routinely, because resolving titles triggers a
 * context update moments after the list appears) the browser had no common
 * element left to fire `click` on, and the tap did nothing. That is the
 * "some don't open when clicked" bug.
 *
 * Rows also activate on pointer-down rather than click, so selection survives
 * anything that closes the list on blur.
 */
const SearchSuggestions = memo(function SearchSuggestions({
  suggestions,
  loading,
  activeIndex,
  onSelect,
  onHoverIndex,
  listId,
}: {
  suggestions: Anime[];
  loading: boolean;
  activeIndex: number;
  onSelect: (anime: Anime) => void;
  onHoverIndex: (index: number) => void;
  listId: string;
}) {
  if (loading && suggestions.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--ink)] z-[200]">
        <div className="p-4 text-center">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          <p className="mt-2 text-xs text-muted-foreground">Searching the archive...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--ink)] z-[200]">
        <p
          className="p-4 text-center text-xs uppercase tracking-[0.15em] text-muted-foreground"
          style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          No titles found
        </p>
      </div>
    );
  }

  return (
    <div
      id={listId}
      role="listbox"
      className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--ink)] z-[200]"
    >
      {suggestions.map((anime, index) => (
        <button
          key={anime.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          id={`${listId}-opt-${index}`}
          // Pointer-down, not click: the list closes on outside mousedown, and
          // waiting for the full click let the row disappear underneath it.
          onPointerDown={(e) => {
            e.preventDefault();
            onSelect(anime);
          }}
          // Keyboard activation and any environment without pointer events.
          onClick={(e) => {
            e.preventDefault();
            onSelect(anime);
          }}
          onMouseEnter={() => onHoverIndex(index)}
          className={`w-full flex items-center gap-3 p-3 text-left transition-colors border-b-2 border-ink/15 last:border-b-0 group ${
            index === activeIndex ? 'bg-orange/20' : 'hover:bg-orange/10'
          }`}
        >
          {anime.cover_image ? (
            <img
              src={anime.cover_image}
              alt=""
              loading="lazy"
              className="h-14 w-10 object-cover shrink-0 border-2 border-ink"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          ) : (
            <div className="h-14 w-10 bg-orange/30 border-2 border-ink shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className="font-medium text-foreground truncate"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <SuggestionTitle anime={anime} />
            </p>
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {anime.genres.slice(0, 2).map((genre) => (
                  <span
                    key={genre}
                    className="text-[10px] px-1.5 py-0.5 border border-ink/40 text-ink/70 tracking-wider uppercase"
                    style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  // Seeded from the URL, not empty. The effect below reads an empty box on
  // /browse?q=... as "the visitor just cleared the search" and strips q, so
  // starting empty silently discarded the query on every direct load — a
  // shared or crawled search link landed on unfiltered results.
  const [searchQuery, setSearchQuery] = useState(() =>
    window.location.pathname === '/browse'
      ? new URLSearchParams(window.location.search).get('q') ?? ''
      : ''
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Anime[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** Monotonic id of the most recent suggestion request; older ones are dropped. */
  const latestRequestRef = useRef(0);
  const { user, isAdmin, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  // Scroll detection for navbar glass effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { path: '/', label: 'Discover', icon: Home },
    { path: '/browse', label: 'Browse', icon: Grid3x3 },
    ...(user ? [
      { path: '/profile', label: 'Profile', icon: User },
      { path: '/lists', label: 'Lists', icon: List }
    ] : []),
    // Admins only. This sat outside the auth conditional, so every visitor —
    // signed out included — was handed a link to the moderation panel.
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: Shield }] : [])
  ];

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Responses can land out of order — the local-only path returns in ~250ms
    // while one that waits on AniList takes ~800ms, so a slower request for an
    // earlier prefix could overwrite the results for what was actually typed.
    const requestId = ++latestRequestRef.current;

    setLoadingSuggestions(true);
    try {
      const { sanitizeSearchQuery } = await import('@/utils/sanitize');
      const sanitizedQuery = sanitizeSearchQuery(query.trim());

      if (!sanitizedQuery || sanitizedQuery.length < 2) {
        if (requestId === latestRequestRef.current) {
          setSuggestions([]);
          setShowSuggestions(false);
          setLoadingSuggestions(false);
        }
        return;
      }

      const results = await getAnimeSearchSuggestions(sanitizedQuery, 10);
      if (requestId !== latestRequestRef.current) return;

      setSuggestions(results);
      setActiveIndex(-1);
      setShowSuggestions(true);
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error('Error fetching suggestions:', error);
      }
      if (requestId === latestRequestRef.current) {
        setSuggestions([]);
        // Keep the panel open so the failure reads as "no titles found"
        // rather than the box silently doing nothing.
        setShowSuggestions(true);
      }
    } finally {
      if (requestId === latestRequestRef.current) setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchSuggestions]);

  useEffect(() => {
    if (!searchQuery) {
      if (location.pathname === '/browse' && new URLSearchParams(location.search).get('q')) {
        // Drop only `q`. Rebuilding the URL as a bare "/browse" also discarded
        // the genre, year, season, status and sort the visitor had set, so
        // clearing the search box quietly reset the whole page.
        const params = new URLSearchParams(location.search);
        params.delete('q');
        params.delete('page');
        navigate({ pathname: '/browse', search: params.toString() }, { replace: true });
      }
      return;
    }

    if (location.pathname !== '/browse') {
      return;
    }

    const t = window.setTimeout(() => {
      const currentPath = window.location.pathname;
      const q = searchQuery.trim();
      if (!q) return;
      if (currentPath !== '/browse') {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      // Already in sync: this is the seeded mount, not a keystroke. Rewriting
      // here would drop `page` and break a deep link into a search's page N.
      if (params.get('q') === q) return;
      params.set('q', q);
      // A new query is a new result set; whatever page you were on is gone.
      params.delete('page');
      navigate({ pathname: '/browse', search: params.toString() }, { replace: true });
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [searchQuery, navigate, location.pathname]);

  /**
   * The desktop and mobile search boxes both render a dropdown, so a single
   * shared ref pointed at whichever mounted last and the handler then treated
   * taps inside the *other* one as outside clicks — closing the list mid-tap.
   * Matching on an ancestor marker covers every instance without refs.
   */
  useEffect(() => {
    const handlePointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('[data-search-root]')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleSuggestionClick = useCallback(
    (anime: Anime) => {
      setSearchQuery('');
      setShowSuggestions(false);
      setSuggestions([]);
      setActiveIndex(-1);
      setMobileSearchOpen(false);
      navigate(`/anime/${anime.id}`);
    },
    [navigate]
  );

  /** Shared by both inputs so desktop and mobile behave identically. */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const open = showSuggestions && suggestions.length > 0;

      if (e.key === 'ArrowDown' && open) {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp' && open) {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (open && activeIndex >= 0 && suggestions[activeIndex]) {
          handleSuggestionClick(suggestions[activeIndex]);
          return;
        }
        const q = searchQuery.trim();
        setShowSuggestions(false);
        setMobileSearchOpen(false);
        // Searching from within Browse keeps the filters already applied;
        // searching from anywhere else starts clean.
        const params = new URLSearchParams(
          window.location.pathname === '/browse' ? window.location.search : ''
        );
        if (q) params.set('q', q);
        else params.delete('q');
        params.delete('page');
        navigate({ pathname: '/browse', search: params.toString() });
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    },
    [showSuggestions, suggestions, activeIndex, searchQuery, navigate, handleSuggestionClick]
  );

  const handleMobileLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
      navigate('/');
    } catch (error) {
      // silently handle
    }
  };

  return (
    <nav className={`sticky top-0 z-[60] transition-all duration-500 ${
      scrolled
        ? 'border-b border-ink/20 bg-background/90 backdrop-blur-2xl shadow-lg shadow-black/20'
        : 'border-b border-transparent bg-background/50 backdrop-blur-sm'
    }`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-16 sm:h-18 md:h-20 items-center justify-between gap-2">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center shrink-0 group" 
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Go to homepage"
          >
            <img 
              src="/rebyuu-logo.webp" 
              alt="Rebyuu Logo" 
              width={288}
              height={192}
              decoding="async"
              className="h-12 w-auto sm:h-14 md:h-16 object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-300"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative px-4 py-2"
                >
                  <div className={`flex items-center gap-2 transition-all duration-300 ${
                    active 
                      ? 'text-gold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium tracking-wide uppercase" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.1em' }}>
                      {item.label}
                    </span>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-crimson via-gold to-crimson rounded-full"
                      transition={{ type: 'spring', duration: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
            <TitleLangToggle className="ml-2" />
            {user ? (
              <UserDropdown />
            ) : (
              <Link
                to="/login"
                className="ml-2 rounded-md border border-ink/35 bg-transparent px-4 py-2 text-xs font-medium tracking-wider uppercase text-gold/80 transition-all duration-300 hover:bg-gold/5 hover:border-ink/70 hover:text-gold"
                style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.1em' }}
              >
                Login/Signup
              </Link>
            )}
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:block flex-1 max-w-md ml-4">
            <div className="relative" data-search-root>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls="search-suggestions-desktop"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 ? `search-suggestions-desktop-opt-${activeIndex}` : undefined
                }
                placeholder="Search the archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onKeyDown={handleSearchKeyDown}
                className="input-imperial w-full py-2 pl-10 pr-4 text-sm"
                style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}
              />

              {/* Suppressed while the mobile sheet is open so only one list is
                  ever mounted — two competed for the same keyboard state. */}
              {showSuggestions && !mobileSearchOpen && searchQuery.trim().length >= 2 && (
                <SearchSuggestions
                  suggestions={suggestions}
                  loading={loadingSuggestions}
                  activeIndex={activeIndex}
                  onSelect={handleSuggestionClick}
                  onHoverIndex={setActiveIndex}
                  listId="search-suggestions-desktop"
                />
              )}
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-1 md:hidden">
            {/* Same switch on mobile — the desktop nav row is hidden here. */}
            <TitleLangToggle className="mr-1" />
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="rounded-lg p-2 text-gold/50 hover:bg-accent hover:text-gold min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            {user ? (
              <Link
                to="/profile"
                className="rounded-lg p-2 text-gold/50 hover:bg-accent hover:text-gold min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                aria-label="Profile"
              >
                <User className="h-5 w-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gold/70 border border-ink/35 hover:bg-accent min-h-[44px] flex items-center justify-center transition-colors"
                aria-label="Login or sign up"
              >
                <LogIn className="h-4 w-4" />
              </Link>
            )}

            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-gold/50 hover:bg-accent hover:text-gold min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Modal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileSearchOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSearchOpen(false)}
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="fixed inset-0 md:hidden top-0 left-0 right-0 z-[101] bg-background border-b border-ink/20"
              >
              <div className="flex items-center gap-2 p-3">
                <div className="relative flex-1" data-search-root>
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gold/40 z-10" />
                  <input
                    ref={mobileSearchInputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={showSuggestions}
                    aria-controls="search-suggestions-mobile"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeIndex >= 0 ? `search-suggestions-mobile-opt-${activeIndex}` : undefined
                    }
                    placeholder="Search the archive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                    className="input-imperial w-full py-3 pl-10 pr-4 text-base"
                    /* 16px keeps iOS Safari from zooming the viewport on focus. */
                    style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif' }}
                  />

                  {showSuggestions && searchQuery.trim().length >= 2 && (
                    <SearchSuggestions
                      suggestions={suggestions}
                      loading={loadingSuggestions}
                      activeIndex={activeIndex}
                      onSelect={handleSuggestionClick}
                      onHoverIndex={setActiveIndex}
                      listId="search-suggestions-mobile"
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setShowSuggestions(false);
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Mobile Menu Drawer */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed left-0 top-0 bottom-0 z-[101] w-72 overflow-y-auto border-r border-ink/20 bg-background p-5 md:hidden"
              >
              {/* Drawer Header */}
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-gold/70" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Archive
                  </h2>
                  <div className="mt-1 h-[1px] w-8 bg-gradient-to-r from-crimson to-transparent" />
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                <Link
                  to="/browse"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                    isActive('/browse') ? 'bg-crimson/10 text-crimson border-l-2 border-crimson' : 'text-foreground hover:bg-accent'
                  }`}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  <Grid3x3 className="h-4 w-4" />
                  Browse
                </Link>

                {user && (
                  <Link
                    to="/lists"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                      isActive('/lists') ? 'bg-crimson/10 text-crimson border-l-2 border-crimson' : 'text-foreground hover:bg-accent'
                    }`}
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <List className="h-4 w-4" />
                    Collections
                  </Link>
                )}

                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                      isActive('/profile') ? 'bg-crimson/10 text-crimson border-l-2 border-crimson' : 'text-foreground hover:bg-accent'
                    }`}
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                )}

                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent min-h-[44px]"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <Shield className="h-4 w-4" />
                    Settings
                  </Link>
                )}

                {user && (
                  <>
                    <div className="my-3 h-px bg-gradient-to-r from-gold/10 via-gold/5 to-transparent" />
                    <button
                      onClick={handleMobileLogout}
                      className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive min-h-[44px]"
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      <LogIn className="h-4 w-4 rotate-180" />
                      Logout
                    </button>
                  </>
                )}
              </div>

              {/* Decorative bottom element */}
              <div className="absolute bottom-6 left-5 right-5">
                <div className="h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent mb-3" />
                <p className="text-[9px] text-muted-foreground/30 tracking-[0.2em] uppercase text-center" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  レビュー · Rebyuu
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
      )}
    </nav>
  );
}
