import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '@/app/components/AnimeCard';
import { HeroSection } from '@/app/components/HeroSection';
import { getTrendingAnime, getFanFavorites, getAiringNow, getUpcoming, type Anime } from '@/services/anime';
import { useAuth } from '@/context/AuthContext';

/** Cards per homepage section — 8 fills exactly two rows on the 4-up grid. */
const SECTION_SIZE = 8;

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
        getTrendingAnime(SECTION_SIZE),
        getFanFavorites(SECTION_SIZE),
        getAiringNow(SECTION_SIZE),
        getUpcoming(SECTION_SIZE)
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
    items,
    viewMoreTo = '/browse'
  }: {
    title: string
    subtitle?: string
    items: Anime[]
    /** Where "View More" lands — pre-filters Browse where the section maps to one. */
    viewMoreTo?: string
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl text-foreground tracking-wide" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
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
            className="text-xs font-medium tracking-[0.1em] uppercase text-gold/60 hover:text-gold transition-colors duration-300 shrink-0 border-b border-ink/35 hover:border-ink/70 pb-0.5"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            View All
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: SECTION_SIZE }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton-imperial" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed border-ink/35 p-10 text-center text-muted-foreground">
            <p style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif', fontStyle: 'normal' }}>The archive awaits...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {items.map((anime, index) => (
                <AnimeCard key={anime.id} anime={anime} index={index} />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link to={viewMoreTo} className="btn-imperial">
                View More
              </Link>
            </div>
          </>
        )}
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 overflow-x-hidden">
      <HeroSection />

      {/* ═══ CONTENT SECTIONS ═══ */}
      <Section title="Trending" subtitle="Trending on AniList right now" items={trendingAnime} />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Fan Favorites" subtitle="Beloved by the community" items={fanFavorites} />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Airing Now" subtitle="Currently broadcasting" items={airingNow} viewMoreTo="/browse?status=airing" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="brush-divider" />
      </div>

      <Section title="Upcoming" subtitle="Anticipated releases" items={upcoming} viewMoreTo="/browse?status=upcoming" />

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
              <h2 className="text-2xl sm:text-3xl md:text-4xl text-foreground tracking-wide" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
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
                  <div className="relative overflow-hidden border-2 border-ink bg-card p-5 sm:p-6 text-center transition-all duration-300 hover:shadow-[6px_6px_0_var(--orange)] active:shadow-none">
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
            className="relative overflow-hidden rounded-lg border border-ink/20 bg-card p-8 md:p-14"
          >
            {/* Atmospheric orbs */}
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-crimson/[0.04] blur-[100px]" />
            <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-gold/[0.03] blur-[100px]" />
            
            {/* Decorative corners */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-ink/35" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-ink/35" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-ink/35" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-ink/35" />
            
            <div className="relative text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-gold/30" />
                <span className="text-[10px] tracking-[0.25em] uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Join the Archive
                </span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-gold/30" />
              </div>
              
              <h2 className="mb-4 text-3xl md:text-4xl text-foreground" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
                Begin Your Journey
              </h2>
              <p className="mb-8 text-base text-muted-foreground max-w-md mx-auto" style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif', fontSize: '18px' }}>
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
