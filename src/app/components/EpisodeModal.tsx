import { useState, useEffect, useCallback } from 'react';
import { X, Star, MessageSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { getEpisodeRatings, getEpisodeComments, type EpisodeComment } from '@/services/anime';
import { toast } from 'sonner';

interface EpisodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: string;
  episodeNumber: number;
  animeTitle: string;
}

export function EpisodeModal({ isOpen, onClose, animeId, episodeNumber, animeTitle }: EpisodeModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<EpisodeComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [deletingRating, setDeletingRating] = useState(false);
  const [userEpisodeRating, setUserEpisodeRating] = useState<{ id: string; rating: number } | null>(null);

  const loadData = useCallback(async () => {
    if (!animeId || !episodeNumber) return;
    setLoading(true);
    try {
      const [commentsData, ratingsData] = await Promise.all([
        getEpisodeComments(animeId, episodeNumber),
        getEpisodeRatings(animeId, episodeNumber)
      ]);
      setComments(commentsData);
      if (user) {
        const userRating = ratingsData.find(r => r.user_id === user.id);
        if (userRating) {
          setRating(userRating.rating);
          setUserEpisodeRating({ id: userRating.id, rating: userRating.rating });
        } else {
          setRating(0);
          setUserEpisodeRating(null);
        }
      } else {
        setRating(0);
        setUserEpisodeRating(null);
      }
    } catch (error) {
      console.error('Error loading episode data:', error);
      setComments([]);
      setRating(0);
    } finally {
      setLoading(false);
    }
  }, [animeId, episodeNumber, user]);

  useEffect(() => {
    if (isOpen && animeId && episodeNumber) {
      loadData();
    } else {
      setRating(0);
      setComment('');
      setComments([]);
      setUserEpisodeRating(null);
    }
  }, [isOpen, animeId, episodeNumber, user, loadData]);

  const handleSubmitRating = async () => {
    if (!user || !rating || !animeId || !episodeNumber) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('episode_ratings').upsert({
        user_id: user.id,
        anime_id: animeId,
        episode_number: episodeNumber,
        rating
      }, {
        onConflict: 'user_id,anime_id,episode_number'
      }).select('id, rating').single();
      
      if (error) {
        console.error('Error submitting episode rating:', error);
        toast.error(error.message || 'Failed to save rating');
        setSubmitting(false);
        return;
      }
      
      if (data) {
        setUserEpisodeRating({ id: data.id, rating: data.rating });
        toast.success('Rating saved');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comment.trim() || !animeId || !episodeNumber) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      // Sanitize comment content to prevent XSS
      const { sanitizeComment } = await import('@/utils/sanitize');
      const sanitizedContent = sanitizeComment(comment.trim());
      
      if (!sanitizedContent || sanitizedContent.length === 0) {
        toast.error('Comment cannot be empty');
        setSubmitting(false);
        return;
      }
      
      const { error } = await supabase.from('episode_comments').insert({
        user_id: user.id,
        anime_id: animeId,
        episode_number: episodeNumber,
        content: sanitizedContent
      });
      if (error) {
        if (!import.meta.env.PROD) {
          console.error('Error submitting episode comment:', error);
        }
        toast.error(error.message || 'Failed to post comment');
        return;
      }
      setComment('');
      await loadData();
      toast.success('Comment posted');
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error('Error submitting comment:', error);
      }
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 sm:left-1/2 sm:top-1/2 sm:right-auto sm:bottom-auto sm:inset-auto z-50 max-h-[100vh] sm:max-h-[90vh] w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 overflow-y-auto rounded-none sm:rounded-2xl border-0 sm:border border-border bg-background shadow-2xl sm:mx-4"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background p-4 sm:p-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Episode {episodeNumber}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{animeTitle}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0 ml-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {user && (
                <>
                  <div>
                    <label className="mb-2 sm:mb-3 block text-sm font-medium text-foreground">
                      Rate this episode
                    </label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRating(r)}
                          className={`flex h-10 w-10 sm:h-10 sm:w-10 items-center justify-center rounded-lg border text-base sm:text-base transition-all min-h-[44px] min-w-[44px] ${
                            rating >= r
                              ? 'border-primary bg-primary text-white'
                              : 'border-border bg-transparent text-muted-foreground hover:bg-accent active:bg-accent'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {rating > 0 && (
                        <>
                          <button
                            onClick={handleSubmitRating}
                            disabled={submitting}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                          >
                            {submitting ? 'Saving...' : 'Save Rating'}
                          </button>
                          {user && userEpisodeRating && (
                            <button
                              onClick={async () => {
                                if (!confirm('Delete your rating?')) return;
                                
                                setDeletingRating(true);
                                try {
                                  const { error, count } = await supabase
                                    .from('episode_ratings')
                                    .delete()
                                    .eq('id', userEpisodeRating.id)
                                    .eq('user_id', user.id)
                                    .select('id', { count: 'exact' });
                                  
                                  if (error) {
                                    console.error('Delete episode rating error:', error);
                                    toast.error(error.message || 'Failed to delete rating');
                                    setDeletingRating(false);
                                    return;
                                  }
                                  
                                  if (count !== undefined && count === 0) {
                                    console.error('Delete episode rating: No rows affected');
                                    toast.error('Rating not found or already deleted');
                                    setDeletingRating(false);
                                    return;
                                  }
                                  
                                  setRating(0);
                                  setUserEpisodeRating(null);
                                  toast.success('Rating deleted');
                                  setDeletingRating(false);
                                } catch (err) {
                                  console.error('Delete episode rating exception:', err);
                                  toast.error('Failed to delete rating');
                                  setDeletingRating(false);
                                }
                              }}
                              disabled={deletingRating}
                              className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            >
                              {deletingRating ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSubmitComment} className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      Add a comment
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your thoughts about this episode..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-input-background px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      type="submit"
                      disabled={!comment.trim() || submitting}
                      className="w-full sm:w-auto rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                    >
                      {submitting ? 'Posting...' : 'Post Comment'}
                    </button>
                  </form>
                </>
              )}

              {!user && (
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Please log in to rate and comment on episodes
                  </p>
                </div>
              )}

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Comments ({comments.length})
                  </h3>
                </div>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2">
                        <div className="h-4 w-3/4 rounded bg-card" />
                        <div className="h-4 w-1/2 rounded bg-card" />
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {c.user.avatar_url ? (
                              <img
                                src={c.user.avatar_url}
                                alt={c.user.username}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {c.user.username.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">{c.user.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {user && c.user_id === user.id && (
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this comment?')) return;
                                
                                setDeletingComment(c.id);
                                try {
                                  const { data, error, count } = await supabase
                                    .from('episode_comments')
                                    .delete()
                                    .eq('id', c.id)
                                    .eq('user_id', user.id)
                                    .select('id', { count: 'exact' });
                                  
                                  if (error) {
                                    console.error('Delete episode comment error:', error);
                                    toast.error(error.message || 'Failed to delete comment');
                                    setDeletingComment(null);
                                    return;
                                  }
                                  
                                  if (count !== undefined && count === 0) {
                                    console.error('Delete episode comment: No rows affected');
                                    toast.error('Comment not found or already deleted');
                                    setDeletingComment(null);
                                    return;
                                  }
                                  
                                  setComments((prev) => prev.filter((comment) => comment.id !== c.id));
                                  toast.success('Comment deleted');
                                  setDeletingComment(null);
                                } catch (err) {
                                  console.error('Delete episode comment exception:', err);
                                  toast.error('Failed to delete comment');
                                  setDeletingComment(null);
                                }
                              }}
                              disabled={deletingComment === c.id}
                              className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            >
                              {deletingComment === c.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
