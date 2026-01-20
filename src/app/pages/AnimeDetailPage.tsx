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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!loading && !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Anime not found</p>
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
      // Sanitize review content to prevent XSS
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
      
      // Optimistic update
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
        // Rollback optimistic update
        setReviews((prev) => prev.filter((r) => r.id !== optimisticId));
        if (!import.meta.env.PROD) {
          console.error('comment insert failed', commentErr);
        }
        toast.error(commentErr.message || 'Failed to post review');
        return;
      }
      
      setReview('');
      setUserRating(0);
      // Reload reviews to get the actual data from server
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
      <div className="relative h-[35vh] min-h-[250px] sm:h-[40vh] sm:min-h-[300px] md:h-[45vh] md:min-h-[350px] lg:h-[52vh] lg:min-h-[420px] w-full overflow-hidden" style={{ zIndex: 1 }}>
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
          <div className="h-full w-full bg-gradient-to-r from-primary to-purple-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-600/20" style={{ zIndex: 0 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" style={{ zIndex: 1 }} />
        
        <div className="absolute inset-0 flex items-end" style={{ zIndex: 2 }}>
          <div className="mx-auto w-full max-w-7xl px-4 pb-4 sm:pb-6 md:pb-8 sm:px-6 lg:px-8">
            <Link
              to="/browse"
              className="mb-2 sm:mb-4 inline-flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-black/70"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back to Browse</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8" style={{ zIndex: 1 }}>
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row pt-4 sm:pt-6 md:pt-8 lg:pt-0">
          <div className="flex justify-center lg:justify-start lg:-mt-24 order-2 lg:order-1">
            {/* Poster */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="shrink-0"
            >
              {anime?.cover_image ? (
                <img
                  src={anime.cover_image}
                  alt={anime?.title || 'Anime'}
                  className="h-56 w-40 sm:h-64 sm:w-44 md:h-72 md:w-52 lg:h-80 lg:w-56 rounded-xl border-4 border-background object-cover shadow-2xl"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="h-56 w-40 sm:h-64 sm:w-44 md:h-72 md:w-52 lg:h-80 lg:w-56 rounded-xl border-4 border-background bg-gradient-to-br from-primary to-purple-600 shadow-2xl" />
              )}
            </motion.div>
          </div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 pt-4 sm:pt-6 lg:pt-0 order-1 lg:order-2"
          >
            <h1 className="mb-3 sm:mb-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {anime?.title || 'Loading...'}
            </h1>

            <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2 sm:gap-4">
              {anime?.rating && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-semibold text-foreground">{anime.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/10</span>
                </div>
              )}

              <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                anime?.status === 'airing' 
                  ? 'bg-green-500/20 text-green-400' 
                  : anime?.status === 'upcoming'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {anime?.status?.toUpperCase() || 'UNKNOWN'}
              </span>

              {anime?.year && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{anime.year}</span>
                </div>
              )}

              {anime?.episodes && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Film className="h-4 w-4" />
                  <span>{anime.episodes} Episodes</span>
                </div>
              )}
            </div>

            <div className="mb-4 sm:mb-6 flex flex-wrap gap-2">
              {anime?.genres?.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                >
                  {genre}
                </span>
              ))}
            </div>

            {anime?.description && (
              <p className="mb-4 sm:mb-6 text-sm sm:text-base text-muted-foreground leading-relaxed">{anime.description}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-0">
              {anime?.trailer && (
                <button
                  onClick={() => {
                    const el = document.getElementById('trailer')
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 px-4 py-3 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 min-h-[44px]"
                >
                  <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Watch Trailer</span>
                  <span className="sm:hidden">Trailer</span>
                </button>
              )}
              <button
                onClick={() => setShowListPicker(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-foreground transition-colors hover:bg-accent min-h-[44px]"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Add to List</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6 sm:space-y-8 mt-6 sm:mt-8">
          {anime?.trailer && (
            <section id="trailer" className="rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold text-foreground">Trailer</h2>
              <div className="aspect-video overflow-hidden rounded-lg sm:rounded-xl border border-border bg-background">
                <iframe
                  src={anime?.trailer?.replace('watch?v=', 'embed/') || ''}
                  title={`${anime?.title || 'Anime'} trailer`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}
          {/* Episodes */}
          {anime?.episodes && anime.episodes > 0 && (
            <section>
              <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold text-foreground">Episodes</h2>
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: anime?.episodes || 0 }, (_, i) => {
                  const episodeNum = i + 1;
                  return (
                    <button
                      key={episodeNum}
                      onClick={() => setSelectedEpisode(episodeNum)}
                      className="flex items-center gap-3 sm:gap-4 rounded-lg border border-border bg-card p-3 sm:p-4 text-left transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 min-h-[60px] sm:min-h-[70px]"
                    >
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base sm:text-lg font-bold text-primary">
                        {episodeNum}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm sm:text-base text-foreground">Episode {episodeNum}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">24 min</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section>
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold text-foreground">User Reviews</h2>

            {/* Add Review Form */}
            {user && (
              <form onSubmit={handleSubmitReview} className="mb-4 sm:mb-6 rounded-xl border border-border bg-card p-3 sm:p-4 md:p-6">
              <h3 className="mb-3 sm:mb-4 text-base sm:text-lg font-semibold text-foreground">Write a Review</h3>
              
              {/* Rating Input */}
              <div className="mb-3 sm:mb-4">
                <label className="mb-2 block text-sm font-medium text-foreground">Your Rating</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setUserRating(rating)}
                      className={`flex h-10 w-10 sm:h-10 sm:w-10 items-center justify-center rounded-lg border text-base sm:text-base transition-all min-h-[44px] min-w-[44px] ${
                        userRating >= rating
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-accent active:bg-accent'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div className="mb-4">
                <label htmlFor="review" className="mb-2 block text-sm font-medium text-foreground">
                  Your Review
                </label>
                <textarea
                  id="review"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your thoughts about this anime..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-input-background px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <button
                type="submit"
                disabled={!userRating || !review.trim()}
                className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-primary to-purple-600 px-4 sm:px-6 py-3 sm:py-2.5 text-sm sm:text-base font-medium text-white transition-all hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                Submit Review
              </button>
            </form>
            )}

            {!user && (
              <div className="mb-6 rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Please log in to write a review</p>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">No reviews yet. Be the first to share your thoughts!</p>
                </div>
              ) : (
                reviews.map((reviewItem) => (
                  <div key={reviewItem.id} className="rounded-xl border border-border bg-card p-4 sm:p-6 break-words">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {reviewItem.user.avatar_url ? (
                          <img
                            src={reviewItem.user.avatar_url}
                            alt={reviewItem.user.username}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                            {reviewItem.user.username.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-foreground">{reviewItem.user.username}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(reviewItem.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewItem.rating > 0 && (
                          <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="font-semibold text-primary">{reviewItem.rating}</span>
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
                            className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deletingReview === reviewItem.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-foreground">{reviewItem.content}</p>
                  </div>
                ))
              )}
            </div>
          </section>
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
