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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

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
      // Sanitize search query to prevent injection
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
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  return (
    <nav className="sticky top-0 z-[60] border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 md:h-24 items-center justify-between gap-2">
          {/* Logo - Always visible */}
          <Link 
            to="/" 
            className="flex items-center shrink-0" 
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Go to homepage"
          >
            <img 
              src="/rebyuu-logo.png" 
              alt="Rebyuu Logo" 
              className="h-16 w-auto sm:h-20 md:h-24 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative px-4 py-2"
                >
                  <div className={`flex items-center gap-2 transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-lg bg-primary/10"
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
                className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Login
              </Link>
            )}
          </div>

          {/* Search Bar - Large Desktop Only (lg+) */}
          <div className="hidden lg:block flex-1 max-w-md ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search anime..."
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
                className="w-full rounded-lg border border-border bg-card/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                style={{ fontSize: '16px' }}
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-2xl z-[200]"
                >
                  {loadingSuggestions ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    suggestions.map((anime) => (
                      <button
                        key={anime.id}
                        onClick={() => handleSuggestionClick(anime)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
                      >
                        {anime.cover_image ? (
                          <img
                            src={anime.cover_image}
                            alt={anime.title}
                            className="h-12 w-8 object-cover rounded shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-8 bg-gradient-to-br from-primary to-purple-600 rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{anime.title}</p>
                          {anime.genres && anime.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {anime.genres.slice(0, 2).map((genre) => (
                                <span
                                  key={genre}
                                  className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
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
              )}
            </div>
          </div>

          {/* Mobile Right Side Actions - Only on mobile */}
          <div className="flex items-center gap-1 md:hidden">
            {/* Search Icon */}
            <button 
              onClick={() => setMobileSearchOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Profile Icon (if logged in) or Login Button (if not) */}
            {user ? (
              <Link
                to="/profile"
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Profile"
              >
                <User className="h-5 w-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground border border-border hover:bg-accent min-h-[44px] flex items-center justify-center"
                aria-label="Login"
              >
                <LogIn className="h-4 w-4 md:hidden" />
                <span className="hidden">Login</span>
              </Link>
            )}

            {/* Hamburger Menu Icon */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Modal - Full Screen */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileSearchOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSearchOpen(false)}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="fixed inset-0 md:hidden top-0 left-0 right-0 z-[101] bg-background border-b border-border md:rounded-none"
              >
              <div className="flex items-center gap-2 p-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground z-10" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search anime..."
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
                    className="w-full rounded-lg border border-border bg-card/50 py-3 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    style={{ fontSize: '16px' }}
                  />
                  
                  {/* Mobile Suggestions Dropdown */}
                  {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                    <div
                      ref={suggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-2xl z-[200]"
                    >
                      {loadingSuggestions ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : (
                        suggestions.map((anime) => (
                          <button
                            key={anime.id}
                            onClick={() => {
                              handleSuggestionClick(anime);
                              setMobileSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
                          >
                            {anime.cover_image ? (
                              <img
                                src={anime.cover_image}
                                alt={anime.title}
                                className="h-12 w-8 object-cover rounded shrink-0"
                              />
                            ) : (
                              <div className="h-12 w-8 bg-gradient-to-br from-primary to-purple-600 rounded shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{anime.title}</p>
                              {anime.genres && anime.genres.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {anime.genres.slice(0, 2).map((genre) => (
                                    <span
                                      key={genre}
                                      className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
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
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed left-0 top-0 bottom-0 z-[101] w-64 overflow-y-auto border-r border-border bg-background p-4 md:hidden"
              >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {/* Browse */}
                <Link
                  to="/browse"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors min-h-[44px] ${
                    isActive('/browse') ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                  }`}
                >
                  <Grid3x3 className="h-5 w-5" />
                  Browse
                </Link>

                {/* Lists (if logged in) */}
                {user && (
                  <Link
                    to="/lists"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors min-h-[44px] ${
                      isActive('/lists') ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <List className="h-5 w-5" />
                    Lists
                  </Link>
                )}

                {/* Profile (if logged in) */}
                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors min-h-[44px] ${
                      isActive('/profile') ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <User className="h-5 w-5" />
                    Profile
                  </Link>
                )}

                {/* Settings (if logged in) */}
                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent min-h-[44px]"
                  >
                    <Shield className="h-5 w-5" />
                    Settings
                  </Link>
                )}

                {/* Logout (if logged in) */}
                {user && (
                  <>
                    <div className="my-2 h-px bg-border" />
                    <button
                      onClick={handleMobileLogout}
                      className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive min-h-[44px]"
                    >
                      <LogIn className="h-5 w-5 rotate-180" />
                      Logout
                    </button>
                  </>
                )}
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
