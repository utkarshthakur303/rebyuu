import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
    items
  }: {
    title: string
    items: Anime[]
  }) => {
    return (
      <section className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-8 sm:h-10 w-1 rounded-full bg-gradient-to-b from-primary via-purple-500 to-purple-600"></div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              {title}
            </h2>
          </div>
          <Link to="/browse" className="text-sm font-medium text-primary hover:underline shrink-0">
            View All
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[270px] w-44 shrink-0 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nothing here yet
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-4">
            {items.map((anime, index) => (
              <AnimeCard key={anime.id} anime={anime} index={index} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[400px] sm:h-[65vh] sm:min-h-[450px] md:h-[70vh] md:min-h-[500px] overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1920"
            alt="Hero"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Discover Your Next Favorite</span>
            </div>

            <h1 className="mb-3 sm:mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight text-transparent">
              Explore the World of Anime
            </h1>

            <p className="mb-6 sm:mb-8 text-base sm:text-lg md:text-xl text-muted-foreground">
              Discover, track, and share your anime journey. Join millions of fans exploring the best anime series.
            </p>

            <Link
              to="/browse"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 px-5 py-3 sm:px-6 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 min-h-[44px] w-full sm:w-auto"
            >
              <span>Explore Now</span>
            </Link>
          </motion.div>
        </div>
      </section>

      <Section title="Trending" items={trendingAnime} />
      <Section title="Fan Favorites" items={fanFavorites} />
      <Section title="Airing Now" items={airingNow} />
      <Section title="Upcoming" items={upcoming} />

      {/* Popular Genres */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-8 sm:py-10 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="h-8 sm:h-10 w-1 rounded-full bg-gradient-to-b from-primary via-purple-500 to-purple-600"></div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              Popular Genres
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {popularGenres.map((genre, index) => (
              <motion.div
                key={genre}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onHoverStart={() => setHoveredGenre(genre)}
                onHoverEnd={() => setHoveredGenre(null)}
                className="relative"
              >
                <Link
                  to={`/browse?genre=${genre.toLowerCase()}`}
                  className="group block"
                >
                  <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-4 sm:p-6 text-center transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:border-primary/50 active:shadow-lg active:shadow-primary/10">
                    {hoveredGenre === genre && typeof window !== 'undefined' && !('ontouchstart' in window) && (
                      <motion.div
                        layoutId="genreHover"
                        className="absolute inset-0 bg-primary/5"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <p className="relative z-10 font-semibold text-sm sm:text-base text-foreground transition-colors group-hover:text-primary">
                      {genre}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {!user && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-purple-600/10 to-primary/10 p-8 md:p-12"
          >
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl" />
            
            <div className="relative text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
                Ready to Start Your Journey?
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Join our community and discover thousands of anime series
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 px-8 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40"
              >
                Sign Up Now
              </Link>
            </div>
          </motion.div>
        </section>
      )}
    </div>
  );
}
