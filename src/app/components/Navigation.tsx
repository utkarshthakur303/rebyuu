import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Home, Grid3x3, User, LogIn, Shield, List, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { UserDropdown } from './UserDropdown';
import { getAnimeSearchSuggestions, type Anime } from '@/services/anime';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Anime[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user, logout } = useAuth();

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
    { path: '/admin', label: 'Admin', icon: Shield }
  ];

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const { sanitizeSearchQuery } = await import('@/utils/sanitize');
      const sanitizedQuery = sanitizeSearchQuery(query.trim());
      
      if (!sanitizedQuery || sanitizedQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }
      
      const results = await getAnimeSearchSuggestions(sanitizedQuery, 10);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error('Error fetching suggestions:', error);
      }
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
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
        navigate('/browse', { replace: true });
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
      navigate(`/browse?q=${encodeURIComponent(q)}`, { replace: true });
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [searchQuery, navigate, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSuggestionClick = (anime: Anime) => {
    setSearchQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
    navigate(`/anime/${anime.id}`);
  };

  const handleMobileLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
      navigate('/');
    } catch (error) {
      // silently handle
    }
  };

  const SuggestionsList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div
      ref={suggestionsRef}
      className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 z-[200]"
    >
      {loadingSuggestions ? (
        <div className="p-4 text-center">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="mt-2 text-xs text-muted-foreground">Searching the archive...</p>
        </div>
      ) : (
        suggestions.map((anime) => (
          <button
            key={anime.id}
            onClick={() => {
              handleSuggestionClick(anime);
              onItemClick?.();
            }}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-b-0 group"
          >
            {anime.cover_image ? (
              <img
                src={anime.cover_image}
                alt={anime.title}
                className="h-14 w-10 object-cover rounded shrink-0 border border-border/30"
              />
            ) : (
              <div className="h-14 w-10 bg-gradient-to-br from-crimson to-crimson-dark rounded shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate group-hover:text-gold transition-colors" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {anime.title}
              </p>
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {anime.genres.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-gold/20 bg-gold/5 text-gold/70 tracking-wider uppercase"
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );

  return (
    <nav className={`sticky top-0 z-[60] transition-all duration-500 ${
      scrolled
        ? 'border-b border-gold/10 bg-background/90 backdrop-blur-2xl shadow-lg shadow-black/20'
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
              src="/rebyuu-logo.png" 
              alt="Rebyuu Logo" 
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
            {user ? (
              <UserDropdown />
            ) : (
              <Link
                to="/login"
                className="ml-2 rounded-md border border-gold/20 bg-transparent px-4 py-2 text-xs font-medium tracking-wider uppercase text-gold/80 transition-all duration-300 hover:bg-gold/5 hover:border-gold/35 hover:text-gold"
                style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.1em' }}
              >
                Enter
              </Link>
            )}
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:block flex-1 max-w-md ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search the archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = searchQuery.trim();
                    setShowSuggestions(false);
                    if (q) {
                      navigate(`/browse?q=${encodeURIComponent(q)}`);
                    } else {
                      navigate('/browse');
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                className="input-imperial w-full py-2 pl-10 pr-4 text-sm"
                style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}
              />
              
              {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                <SuggestionsList />
              )}
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-1 md:hidden">
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
                className="rounded-lg px-3 py-2 text-sm font-medium text-gold/70 border border-gold/15 hover:bg-accent min-h-[44px] flex items-center justify-center transition-colors"
                aria-label="Login"
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
                className="fixed inset-0 md:hidden top-0 left-0 right-0 z-[101] bg-background border-b border-gold/10"
              >
              <div className="flex items-center gap-2 p-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gold/40 z-10" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search the archive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = searchQuery.trim();
                        setMobileSearchOpen(false);
                        setShowSuggestions(false);
                        if (q) {
                          navigate(`/browse?q=${encodeURIComponent(q)}`);
                        } else {
                          navigate('/browse');
                        }
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                    autoFocus
                    className="input-imperial w-full py-3 pl-10 pr-4 text-base"
                    style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif' }}
                  />
                  
                  {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                    <SuggestionsList onItemClick={() => setMobileSearchOpen(false)} />
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
                className="fixed left-0 top-0 bottom-0 z-[101] w-72 overflow-y-auto border-r border-gold/10 bg-background p-5 md:hidden"
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
