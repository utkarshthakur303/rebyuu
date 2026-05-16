import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Play, Plus, Calendar, Film, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAnimeById, getAnimeReviews, type Anime, type Review } from '@/services/anime';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { EpisodeModal } from '@/app/components/EpisodeModal';
import ListPickerModal from '@/app/components/ListPickerModal';
import { toast } from 'sonner';

export default function AnimeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [showListPicker, setShowListPicker] = useState(false);
  const animeRef = useRef<Anime | null>(null);
  const [deletingReview, setDeletingReview] = useState<string | null>(null);

  const loadAnime = useCallback(async (animeId: string) => {
    if (!animeId) return;
    setLoading(true);
    try {
      const data = await getAnimeById(animeId);
      if (data && data.id === animeId) {
        animeRef.current = data;
        setAnime(data);
      } else if (!data) {
        setAnime(null);
      }
    } catch (error) {
      console.error('Error loading anime:', error);
      setAnime(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async (animeId: string) => {
    if (!animeId) return;
    try {
      const data = await getAnimeReviews(animeId);
      setReviews(data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }, []);

  useEffect(() => {
    if (!id) {
      setAnime(null);
      setReviews([]);
      return;
    }
    
    const currentId = animeRef.current?.id;
    if (currentId === id && anime) {
      return;
    }
    
    let cancelled = false;
    animeRef.current = null;
    setAnime(null);
    setReviews([]);
    
    loadAnime(id).then(() => {
      if (!cancelled) {
        loadReviews(id);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [id, loadAnime, loadReviews]);


  if (loading && !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-crimson mb-3" />
          <p className="text-xs text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!loading && !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>This entry was not found in the archive</p>
      </div>
    );
  }

  if (!anime) {
    return null;
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !userRating || !review.trim()) return;

    try {
      const { sanitizeComment } = await import('@/utils/sanitize');
      const sanitizedContent = sanitizeComment(review.trim());
      
      if (!sanitizedContent || sanitizedContent.length === 0) {
        toast.error('Review cannot be empty');
        return;
      }

      if (userRating > 0) {
        const { error: ratingErr } = await supabase.from('ratings').upsert({
          user_id: user.id,
          anime_id: id,
          rating: userRating
        });
        if (ratingErr) {
          if (!import.meta.env.PROD) {
            console.error('rating upsert failed', ratingErr);
          }
          toast.error(ratingErr.message || 'Failed to save rating');
        }
      }

      const optimisticUsername =
        (user.user_metadata as any)?.username || user.email?.split('@')[0] || 'You'
      const optimisticId = `optimistic-${Date.now()}`
      
      setReviews((prev) => [
        {
          id: optimisticId,
          anime_id: id,
          user_id: user.id,
          rating: userRating,
          content: sanitizedContent,
          created_at: new Date().toISOString(),
          user: { username: optimisticUsername, avatar_url: null }
        },
        ...prev
      ])

      const { error: commentErr } = await supabase.from('comments').insert({
        user_id: user.id,
        anime_id: id,
        content: sanitizedContent
      });
      if (commentErr) {
        setReviews((prev) => prev.filter((r) => r.id !== optimisticId));
        if (!import.meta.env.PROD) {
          console.error('comment insert failed', commentErr);
        }
        toast.error(commentErr.message || 'Failed to post review');
        return;
      }
      
      setReview('');
      setUserRating(0);
      if (id) {
        await loadReviews(id);
      }
      toast.success('Review posted');
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error('Error submitting review:', error);
      }
      toast.error('Something went wrong');
    }
  };

  return (
    <div className="bg-background pb-20 lg:pb-8 overflow-x-hidden">
      {/* Cinematic Banner */}
      <div className="relative h-[35vh] min-h-[250px] sm:h-[40vh] sm:min-h-[300px] md:h-[50vh] md:min-h-[380px] lg:h-[55vh] lg:min-h-[440px] w-full overflow-hidden" style={{ zIndex: 1 }}>
        {(anime?.banner_image || anime?.cover_image) ? (
          <img
            src={anime.banner_image || anime.cover_image || ''}
            alt={anime?.title || 'Anime'}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (anime?.cover_image && target.src !== anime.cover_image) {
                target.src = anime.cover_image
              } else {
                target.style.display = 'none'
              }
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-crimson/20 to-gold/10" />
        )}
        
        {/* Multi-layer gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" style={{ zIndex: 0 }} />
        <div className="hero-gradient-cinematic absolute inset-0" style={{ zIndex: 1 }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(8,8,8,0.5) 100%)', zIndex: 1 }} />
        
        {/* Back button */}
        <div className="absolute inset-0 flex items-end" style={{ zIndex: 2 }}>
          <div className="mx-auto w-full max-w-7xl px-4 pb-4 sm:pb-6 md:pb-8 sm:px-6 lg:px-8">
            <Link
              to="/browse"
              className="mb-2 sm:mb-4 inline-flex items-center gap-2 rounded-md bg-black/50 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium tracking-wider uppercase text-white/80 backdrop-blur-sm transition-all hover:bg-black/70 border border-gold/10 hover:border-gold/20"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <ArrowLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Back to Archive</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
        
        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/10 to-transparent" style={{ zIndex: 2 }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8" style={{ zIndex: 1 }}>
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row pt-4 sm:pt-6 md:pt-8 lg:pt-0">
          <div className="flex justify-center lg:justify-start lg:-mt-28 order-2 lg:order-1">
            {/* Poster */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="shrink-0"
            >
              {anime?.cover_image ? (
                <img
                  src={anime.cover_image}
                  alt={anime?.title || 'Anime'}
                  className="h-56 w-40 sm:h-64 sm:w-44 md:h-72 md:w-52 lg:h-80 lg:w-56 rounded-md border-2 border-gold/10 object-cover shadow-2xl shadow-black/50"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="h-56 w-40 sm:h-64 sm:w-44 md:h-72 md:w-52 lg:h-80 lg:w-56 rounded-md border-2 border-gold/10 bg-gradient-to-br from-crimson/30 to-ink shadow-2xl" />
              )}
            </motion.div>
          </div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 pt-4 sm:pt-6 lg:pt-0 order-1 lg:order-2"
          >
            <h1 className="mb-3 sm:mb-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight" style={{ fontFamily: 'Cinzel, serif' }}>
              {anime?.title || 'Loading...'}
            </h1>

            <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
              {anime?.rating && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 star-gold" />
                  <span className="text-lg font-semibold text-gold" style={{ fontFamily: 'Outfit, sans-serif' }}>{anime.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground/50 text-sm">/10</span>
                </div>
              )}

              <span className={`badge-imperial ${
                anime?.status === 'airing' 
                  ? 'badge-bamboo' 
                  : anime?.status === 'upcoming'
                  ? ''
                  : ''
              }`}>
                {anime?.status?.toUpperCase() || 'UNKNOWN'}
              </span>

              {anime?.year && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <Calendar className="h-3.5 w-3.5 text-gold/40" />
                  <span>{anime.year}</span>
                </div>
              )}

              {anime?.episodes && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <Film className="h-3.5 w-3.5 text-gold/40" />
                  <span>{anime.episodes} Episodes</span>
                </div>
              )}
            </div>

            <div className="mb-4 sm:mb-5 flex flex-wrap gap-1.5">
              {anime?.genres?.map((genre) => (
                <span
                  key={genre}
                  className="rounded-sm border border-gold/15 bg-gold/5 px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase text-gold/70"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {genre}
                </span>
              ))}
            </div>

            {anime?.description && (
              <p className="mb-5 sm:mb-6 text-sm text-muted-foreground leading-relaxed" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', lineHeight: '1.7' }}>
                {anime.description}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-0">
              {anime?.trailer && (
                <button
                  onClick={() => {
                    const el = document.getElementById('trailer')
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="btn-imperial w-full sm:w-auto min-h-[48px]"
                >
                  <Play className="h-4 w-4" />
                  <span className="hidden sm:inline">Watch Trailer</span>
                  <span className="sm:hidden">Trailer</span>
                </button>
              )}
              <button
                onClick={() => setShowListPicker(true)}
                className="btn-imperial-outline w-full sm:w-auto min-h-[48px]"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add to Collection</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6 sm:space-y-8 mt-6 sm:mt-8">
          {anime?.trailer && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              id="trailer"
              className="rounded-lg border border-gold/[0.08] bg-card p-4 sm:p-6"
            >
              <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Trailer</h2>
              <div className="aspect-video overflow-hidden rounded-md border border-gold/[0.06] bg-background">
                <iframe
                  src={anime?.trailer?.replace('watch?v=', 'embed/') || ''}
                  title={`${anime?.title || 'Anime'} trailer`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </motion.section>
          )}

          {/* Episodes */}
          {anime?.episodes && anime.episodes > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Episodes</h2>
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: anime?.episodes || 0 }, (_, i) => {
                  const episodeNum = i + 1;
                  return (
                    <button
                      key={episodeNum}
                      onClick={() => setSelectedEpisode(episodeNum)}
                      className="flex items-center gap-3 sm:gap-4 rounded-md border border-gold/[0.06] bg-card p-3 sm:p-4 text-left transition-all hover:border-gold/15 hover:shadow-lg hover:shadow-black/20 min-h-[60px] sm:min-h-[70px] group"
                    >
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-md bg-crimson/10 text-sm font-bold text-crimson group-hover:bg-crimson/15 transition-colors" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {episodeNum}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-foreground group-hover:text-gold transition-colors" style={{ fontFamily: 'Outfit, sans-serif' }}>Episode {episodeNum}</h3>
                        <p className="text-[11px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>24 min</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* Reviews */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Reviews</h2>

            {user && (
              <form onSubmit={handleSubmitReview} className="mb-4 sm:mb-6 rounded-lg border border-gold/[0.08] bg-card p-4 sm:p-5 md:p-6">
              <h3 className="mb-3 sm:mb-4 text-sm font-semibold tracking-wider uppercase text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>Write a Review</h3>
              
              <div className="mb-3 sm:mb-4">
                <label className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Your Rating</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setUserRating(rating)}
                      className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm transition-all min-h-[44px] min-w-[44px] ${
                        userRating >= rating
                          ? 'border-crimson bg-crimson text-white'
                          : 'border-gold/10 bg-transparent text-muted-foreground hover:bg-accent active:bg-accent'
                      }`}
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="review" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Your Review
                </label>
                <textarea
                  id="review"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your thoughts about this anime..."
                  rows={4}
                  className="input-imperial resize-none"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <button
                type="submit"
                disabled={!userRating || !review.trim()}
                className="btn-imperial w-full sm:w-auto min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Submit Review
              </button>
            </form>
            )}

            {!user && (
              <div className="mb-6 rounded-lg border border-gold/[0.06] bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>Please enter the archive to write a review</p>
              </div>
            )}

            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gold/10 bg-card p-8 text-center">
                  <p className="text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>No reviews yet. Be the first to share your thoughts.</p>
                </div>
              ) : (
                reviews.map((reviewItem) => (
                  <div key={reviewItem.id} className="rounded-lg border border-gold/[0.06] bg-card p-4 sm:p-5 break-words">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {reviewItem.user.avatar_url ? (
                          <img
                            src={reviewItem.user.avatar_url}
                            alt={reviewItem.user.username}
                            className="h-9 w-9 rounded-full object-cover border border-gold/10"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-crimson/20 to-crimson/10 font-semibold text-crimson text-xs border border-crimson/10">
                            {reviewItem.user.username.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{reviewItem.user.username}</h4>
                          <p className="text-[11px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            {new Date(reviewItem.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewItem.rating > 0 && (
                          <div className="flex items-center gap-1 rounded-md bg-crimson/10 px-2 py-1 border border-crimson/15">
                            <Star className="h-3 w-3 fill-crimson text-crimson" />
                            <span className="font-semibold text-xs text-crimson" style={{ fontFamily: 'Outfit, sans-serif' }}>{reviewItem.rating}</span>
                          </div>
                        )}
                        {user && reviewItem.user_id === user.id && (
                          <button
                            onClick={async () => {
                              if (confirm('Delete this review?')) {
                                setDeletingReview(reviewItem.id)
                                const { error } = await supabase
                                  .from('comments')
                                  .delete()
                                  .eq('id', reviewItem.id)
                                  .eq('user_id', user.id)
                                if (error) {
                                  toast.error(error.message || 'Failed to delete review')
                                } else {
                                  setReviews((prev) => prev.filter((r) => r.id !== reviewItem.id))
                                  toast.success('Review deleted')
                                }
                                setDeletingReview(null)
                              }
                            }}
                            disabled={deletingReview === reviewItem.id}
                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deletingReview === reviewItem.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed" style={{ fontFamily: 'Outfit, sans-serif' }}>{reviewItem.content}</p>
                  </div>
                ))
              )}
            </div>
          </motion.section>
        </div>
      </div>

      {selectedEpisode && (
        <EpisodeModal
          isOpen={!!selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          animeId={anime?.id || ''}
          episodeNumber={selectedEpisode || 0}
          animeTitle={anime?.title || ''}
        />
      )}
      <ListPickerModal
        isOpen={showListPicker}
        onClose={() => setShowListPicker(false)}
        animeId={anime?.id || ''}
      />
    </div>
  );
}
