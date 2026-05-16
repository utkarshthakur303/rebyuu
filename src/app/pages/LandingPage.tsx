import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '@/app/components/AnimeCard';
import { getTrendingAnime, getFanFavorites, getAiringNow, getUpcoming, type Anime } from '@/services/anime';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const [hoveredGenre, setHoveredGenre] = useState<string | null>(null);
  const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
  const [fanFavorites, setFanFavorites] = useState<Anime[]>([]);
  const [airingNow, setAiringNow] = useState<Anime[]>([]);
  const [upcoming, setUpcoming] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const popularGenres = ['Action', 'Fantasy', 'Comedy', 'Romance', 'Sci-Fi', 'Horror'];

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [t, f, a, u] = await Promise.all([
        getTrendingAnime(12),
        getFanFavorites(12),
        getAiringNow(12),
        getUpcoming(12)
      ]);
      setTrendingAnime(t);
      setFanFavorites(f);
      setAiringNow(a);
      setUpcoming(u);
    } catch (error) {
      console.error('Error loading home sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const Section = ({
    title,
    subtitle,
    items
  }: {
    title: string
    subtitle?: string
    items: Anime[]
  }) => {
    return (
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12"
      >
        <div className="mb-6 sm:mb-8 flex items-end justify-between">
          <div className="flex items-start gap-4">
            {/* Crimson accent bar */}
            <div className="hidden sm:block h-12 w-[3px] rounded-full bg-gradient-to-b from-crimson via-crimson/50 to-transparent mt-1 shrink-0" />
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-xs tracking-[0.15em] uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <Link 
            to="/browse" 
            className="text-xs font-medium tracking-[0.1em] uppercase text-gold/60 hover:text-gold transition-colors duration-300 shrink-0 border-b border-gold/20 hover:border-gold/40 pb-0.5"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            View All
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton-imperial" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gold/10 p-10 text-center text-muted-foreground">
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>The archive awaits...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {items.map((anime, index) => (
              <AnimeCard key={anime.id} anime={anime} index={index} />
            ))}
          </div>
        )}
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 overflow-x-hidden">
      {/* ═══ CINEMATIC HERO SECTION ═══ */}
      <section className="relative h-[65vh] min-h-[420px] sm:h-[70vh] sm:min-h-[480px] md:h-[80vh] md:min-h-[560px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1920"
            alt="Hero"
            className="h-full w-full object-cover"
          />
          {/* Multi-layer cinematic gradients */}
          <div className="hero-gradient-left absolute inset-0" />
          <div className="hero-gradient-cinematic absolute inset-0" />
          {/* Vignette */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(8,8,8,0.6) 100%)' }} />
        </div>

        {/* Floating ember particles (decorative) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="ember-particle"
              style={{
                left: `${15 + i * 18}%`,
                bottom: '10%',
                animationDelay: `${i * 0.8}s`,
                animationDuration: `${3 + i * 0.5}s`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>

        {/* Hero Content */}
        <div className="relative mx-auto flex h-full max-w-7xl items-end px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 md:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-2xl"
          >
            {/* Decorative top element */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-5 flex items-center gap-3"
            >
              <div className="h-[1px] w-8 bg-gradient-to-r from-crimson to-transparent" />
              <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-gold/60" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Sacred Anime Archive
              </span>
              <div className="h-[1px] w-8 bg-gradient-to-l from-gold/30 to-transparent" />
            </motion.div>

            <h1 className="mb-4 sm:mb-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="block">Explore the</span>
              <span className="block bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                World of Anime
              </span>
            </h1>

            <p className="mb-7 sm:mb-9 text-sm sm:text-base md:text-lg text-foreground/60 max-w-lg leading-relaxed" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>
              Discover, track, and share your anime journey. A cinematic archive 
              for those who seek the finest in animated storytelling.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/browse"
                className="btn-imperial text-center min-h-[48px]"
              >
                <span>Enter the Archive</span>
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="btn-imperial-outline text-center min-h-[48px]"
                >
                  <span>Join the Order</span>
                </Link>
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
      </section>

      {/* ═══ CONTENT SECTIONS ═══ */}
      <Section title="Trending" subtitle="Most watched this season" items={trendingAnime} />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Fan Favorites" subtitle="Beloved by the community" items={fanFavorites} />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Airing Now" subtitle="Currently broadcasting" items={airingNow} />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Upcoming" subtitle="Anticipated releases" items={upcoming} />

      {/* ═══ POPULAR GENRES ═══ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-10 sm:py-14 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-start gap-4 mb-8 sm:mb-10">
            <div className="hidden sm:block h-12 w-[3px] rounded-full bg-gradient-to-b from-crimson via-crimson/50 to-transparent mt-1 shrink-0" />
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
                Genres
              </h2>
              <p className="mt-1 text-xs tracking-[0.15em] uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Explore by category
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {popularGenres.map((genre, index) => (
              <motion.div
                key={genre}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
                onHoverStart={() => setHoveredGenre(genre)}
                onHoverEnd={() => setHoveredGenre(null)}
                className="relative"
              >
                <Link
                  to={`/browse?genre=${genre.toLowerCase()}`}
                  className="group block"
                >
                  <div className="relative overflow-hidden rounded-md border border-gold/[0.08] bg-card p-5 sm:p-6 text-center transition-all duration-500 hover:border-gold/25 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)] active:border-gold/25">
                    {hoveredGenre === genre && typeof window !== 'undefined' && !('ontouchstart' in window) && (
                      <motion.div
                        layoutId="genreHover"
                        className="absolute inset-0 bg-gradient-to-br from-crimson/[0.04] to-gold/[0.03]"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    {/* Decorative top line */}
                    <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <p className="relative z-10 font-semibold text-sm text-foreground/80 transition-colors duration-300 group-hover:text-gold tracking-wide" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.08em' }}>
                      {genre}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      {!user && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-lg border border-gold/10 bg-card p-8 md:p-14"
          >
            {/* Atmospheric orbs */}
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-crimson/[0.04] blur-[100px]" />
            <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-gold/[0.03] blur-[100px]" />
            
            {/* Decorative corners */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-gold/15" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-gold/15" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-gold/15" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-gold/15" />
            
            <div className="relative text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-gold/30" />
                <span className="text-[10px] tracking-[0.25em] uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Join the Archive
                </span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-gold/30" />
              </div>
              
              <h2 className="mb-4 text-3xl md:text-4xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
                Begin Your Journey
              </h2>
              <p className="mb-8 text-base text-muted-foreground max-w-md mx-auto" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>
                Enter the sacred archive and discover thousands of anime across every era and genre
              </p>
              <Link
                to="/login"
                className="btn-imperial min-h-[48px]"
              >
                Enter Now
              </Link>
            </div>
          </motion.div>
        </section>
      )}
    </div>
  );
}
