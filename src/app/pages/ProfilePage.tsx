import { useEffect, useMemo, useState } from 'react'
import { Edit2, Save, X, ListPlus, Star, MessageSquare, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CreateListModal } from '@/app/components/CreateListModal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/services/supabase'

type UserProfile = {
  id: string
  username: string
  bio: string | null
  avatar_url: string | null
}

type UserList = {
  id: string
  name: string
  description: string | null
  is_private: boolean
  created_at: string
}

type UserRating = {
  id: string
  rating: number
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
}

type UserComment = {
  id: string
  content: string
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
}

type UserEpisodeRating = {
  id: string
  rating: number
  episode_number: number
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
}

type UserEpisodeComment = {
  id: string
  content: string
  episode_number: number
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
}

type UnifiedRating = {
  id: string
  rating: number
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
  episode_number?: number
  type: 'anime' | 'episode'
}

type UnifiedComment = {
  id: string
  content: string
  created_at: string
  anime: { id: string; title: string; cover_image: string | null } | null
  episode_number?: number
  type: 'anime' | 'episode'
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'lists' | 'ratings' | 'reviews'>('lists')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')

  const [lists, setLists] = useState<UserList[]>([])
  const [ratings, setRatings] = useState<UserRating[]>([])
  const [reviews, setReviews] = useState<UserComment[]>([])
  const [episodeRatings, setEpisodeRatings] = useState<UserEpisodeRating[]>([])
  const [episodeComments, setEpisodeComments] = useState<UserEpisodeComment[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const unifiedRatings = useMemo<UnifiedRating[]>(() => {
    const animeRatings: UnifiedRating[] = ratings.map(r => ({
      id: r.id,
      rating: r.rating,
      created_at: r.created_at,
      anime: r.anime,
      type: 'anime' as const
    }))
    
    const episodeRatingsList: UnifiedRating[] = episodeRatings.map(r => ({
      id: r.id,
      rating: r.rating,
      created_at: r.created_at,
      anime: r.anime,
      episode_number: r.episode_number,
      type: 'episode' as const
    }))
    
    return [...animeRatings, ...episodeRatingsList].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [ratings, episodeRatings])

  const unifiedComments = useMemo<UnifiedComment[]>(() => {
    const animeComments: UnifiedComment[] = reviews.map(c => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      anime: c.anime,
      type: 'anime' as const
    }))
    
    const episodeCommentsList: UnifiedComment[] = episodeComments.map(c => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      anime: c.anime,
      episode_number: c.episode_number,
      type: 'episode' as const
    }))
    
    return [...animeComments, ...episodeCommentsList].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [reviews, episodeComments])

  const stats = useMemo(
    () => [
      { label: 'Lists', value: String(lists.length), icon: ListPlus },
      { label: 'Ratings', value: String(ratings.length + episodeRatings.length), icon: Star },
      { label: 'Reviews', value: String(reviews.length + episodeComments.length), icon: MessageSquare }
    ],
    [lists.length, ratings.length, episodeRatings.length, reviews.length, episodeComments.length]
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      setLoadingProfile(true)
      const { data, error } = await supabase
        .from('users')
        .select('id,username,bio,avatar_url')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (error) {
        console.error('profile load failed', error)
        setProfile(null)
        setLoadingProfile(false)
        return
      }
      setProfile(data as UserProfile)
      setEditBio((data as any)?.bio || '')
      setEditAvatarUrl((data as any)?.avatar_url || '')
      setLoadingProfile(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      setLoadingData(true)
      try {
        // Limit results to prevent loading thousands of items
        // In future, implement pagination for users with large datasets
        const ITEMS_PER_TYPE = 100;
        
        const [listsRes, ratingsRes, commentsRes, episodeRatingsRes, episodeCommentsRes] = await Promise.all([
          supabase
            .from('lists')
            .select('id,name,description,is_private,created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(ITEMS_PER_TYPE),
          supabase
            .from('ratings')
            .select(
              'id,rating,created_at,anime:anime_index!ratings_anime_id_fkey(id,title,cover_image)'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(ITEMS_PER_TYPE),
          supabase
            .from('comments')
            .select(
              'id,content,created_at,anime:anime_index!comments_anime_id_fkey(id,title,cover_image)'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(ITEMS_PER_TYPE),
          supabase
            .from('episode_ratings')
            .select(
              'id,rating,episode_number,created_at,anime:anime_index!episode_ratings_anime_id_fkey(id,title,cover_image)'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(ITEMS_PER_TYPE),
          supabase
            .from('episode_comments')
            .select(
              'id,content,episode_number,created_at,anime:anime_index!episode_comments_anime_id_fkey(id,title,cover_image)'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(ITEMS_PER_TYPE)
        ])

        if (cancelled) return

        if (listsRes.error) {
          console.error('lists load failed', listsRes.error)
          toast.error('Failed to load lists')
        }
        if (ratingsRes.error) {
          console.error('ratings load failed', ratingsRes.error)
          toast.error('Failed to load ratings')
        }
        if (commentsRes.error) {
          console.error('reviews load failed', commentsRes.error)
          toast.error('Failed to load reviews')
        }
        if (episodeRatingsRes.error) {
          console.error('episode ratings load failed', episodeRatingsRes.error)
          toast.error('Failed to load episode ratings')
        }
        if (episodeCommentsRes.error) {
          console.error('episode comments load failed', episodeCommentsRes.error)
          toast.error('Failed to load episode comments')
        }

        if (!listsRes.error) {
          setLists((listsRes.data ?? []) as UserList[])
        } else {
          setLists([])
        }
        if (!ratingsRes.error) {
          setRatings((ratingsRes.data ?? []) as UserRating[])
        } else {
          setRatings([])
        }
        if (!commentsRes.error) {
          setReviews((commentsRes.data ?? []) as UserComment[])
        } else {
          setReviews([])
        }
        if (!episodeRatingsRes.error) {
          setEpisodeRatings((episodeRatingsRes.data ?? []) as UserEpisodeRating[])
        } else {
          setEpisodeRatings([])
        }
        if (!episodeCommentsRes.error) {
          setEpisodeComments((episodeCommentsRes.data ?? []) as UserEpisodeComment[])
        } else {
          setEpisodeComments([])
        }
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  const saveProfile = async () => {
    if (!user || !profile) return
    const { error } = await supabase
      .from('users')
      .update({
        bio: editBio.trim() ? editBio.trim() : null,
        avatar_url: editAvatarUrl.trim() ? editAvatarUrl.trim() : null
      })
      .eq('id', user.id)
    if (error) {
      console.error('profile save failed', error)
      toast.error('Failed to save profile')
      return
    }
    setProfile({
      ...profile,
      bio: editBio.trim() ? editBio.trim() : null,
      avatar_url: editAvatarUrl.trim() ? editAvatarUrl.trim() : null
    })
    setEditing(false)
    toast.success('Profile updated')
  }

  const createList = async (listData: { name: string; description: string; isPrivate: boolean }) => {
    if (!user) return
    const { data, error } = await supabase
      .from('lists')
      .insert({
        user_id: user.id,
        name: listData.name.trim(),
        description: listData.description.trim() ? listData.description.trim() : null,
        is_private: listData.isPrivate
      })
      .select('id,name,description,is_private,created_at')
      .single()
    if (error) {
      toast.error('Failed to create list')
      return
    }
    if (data) {
      setLists((prev) => [data as UserList, ...prev])
      toast.success('List created')
    }
  }

  const deleteRating = async (ratingId: string, type: 'anime' | 'episode') => {
    if (!user) return
    try {
      const table = type === 'anime' ? 'ratings' : 'episode_ratings'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', ratingId)
        .eq('user_id', user.id)
      
      if (error) {
        toast.error(error.message || 'Failed to delete rating')
        return
      }
      
      if (type === 'anime') {
        setRatings((prev) => prev.filter((r) => r.id !== ratingId))
      } else {
        setEpisodeRatings((prev) => prev.filter((r) => r.id !== ratingId))
      }
      toast.success('Rating deleted')
    } catch (err) {
      toast.error('Failed to delete rating')
    }
  }

  const deleteComment = async (commentId: string, type: 'anime' | 'episode') => {
    if (!user) return
    try {
      const table = type === 'anime' ? 'comments' : 'episode_comments'
      const { data, error, count } = await supabase
        .from(table)
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id)
        .select('id', { count: 'exact' })
      
      if (error) {
        console.error(`Delete ${type} comment error:`, error);
        toast.error(error.message || 'Failed to delete comment')
        return
      }
      
      if (count !== undefined && count === 0) {
        console.error(`Delete ${type} comment: No rows affected`);
        toast.error('Comment not found or already deleted')
        return
      }
      
      if (type === 'anime') {
        setReviews((prev) => prev.filter((c) => c.id !== commentId))
      } else {
        setEpisodeComments((prev) => prev.filter((c) => c.id !== commentId))
      }
      toast.success('Comment deleted')
    } catch (err) {
      console.error(`Delete ${type} comment exception:`, err)
      toast.error('Failed to delete comment')
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    )
  }

  const displayName = profile.username || user?.email?.split('@')[0] || 'User'
  const initials = displayName.substring(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8 overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 rounded-2xl border border-border bg-card p-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-3xl font-bold text-white shadow-lg">
                  {initials}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{displayName}</h1>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {editing ? (
                <div className="mb-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Bio</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-input-background px-3 py-3 text-base sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Avatar URL</label>
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input-background px-3 py-3 text-base sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveProfile}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setEditBio(profile.bio || '')
                        setEditAvatarUrl(profile.avatar_url || '')
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-muted-foreground">{profile.bio || 'No bio yet'}</p>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {stats.map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className="rounded-xl border border-border bg-background p-3 sm:p-4">
                      <div className="mb-1 flex items-center gap-1 sm:gap-2">
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        <p className="text-lg sm:text-2xl font-bold text-foreground">{s.value}</p>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-6 border-b border-border">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'lists', label: 'Lists' },
              { id: 'ratings', label: 'Ratings' },
              { id: 'reviews', label: 'Reviews & Comments' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`relative shrink-0 px-4 py-3 font-medium transition-colors ${
                  activeTab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <motion.div
                    layoutId="profileTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: 'spring', duration: 0.5 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {loadingData ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-border bg-card">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {activeTab === 'lists' && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Your Lists</h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    <ListPlus className="h-4 w-4" />
                    Create
                  </button>
                </div>
                {lists.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                    No lists yet
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {lists.map((l) => (
                      <Link
                        key={l.id}
                        to="/lists"
                        className="rounded-xl border border-border bg-background p-5 transition-colors hover:bg-accent cursor-pointer block"
                      >
                        <p className="font-semibold text-foreground">{l.name}</p>
                        {l.description && <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>}
                        <p className="mt-3 text-xs text-muted-foreground">
                          {l.is_private ? 'Private' : 'Public'} · {new Date(l.created_at).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ratings' && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-xl font-bold text-foreground">Ratings</h2>
                {unifiedRatings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                    No ratings yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unifiedRatings.map((r) => (
                      <div
                        key={`rating-${r.type}-${r.id}-${r.anime?.id || 'unknown'}-${r.episode_number || ''}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-background p-4"
                      >
                        <Link
                          to={r.anime ? `/anime/${r.anime.id}` : '#'}
                          className="flex items-center gap-4 flex-1 min-w-0"
                        >
                          {r.anime?.cover_image ? (
                            <img
                              src={r.anime.cover_image}
                              alt={r.anime.title}
                              className="h-20 w-14 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-20 w-14 rounded bg-gradient-to-br from-primary to-purple-600 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {r.anime?.title || 'Unknown anime'}
                              {r.type === 'episode' && r.episode_number && ` – Episode ${r.episode_number}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                            {r.rating}/10
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this rating?')) {
                              deleteRating(r.id, r.type)
                            }
                          }}
                          className="shrink-0 rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-xl font-bold text-foreground">Reviews & Comments</h2>
                {unifiedComments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                    No reviews or comments yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unifiedComments.map((c) => (
                      <div
                        key={`comment-${c.type}-${c.id}-${c.anime?.id || 'unknown'}-${c.episode_number || ''}`}
                        className="flex gap-4 rounded-xl border border-border bg-background p-4"
                      >
                        <Link
                          to={c.anime ? `/anime/${c.anime.id}` : '#'}
                          className="flex gap-4 flex-1 min-w-0"
                        >
                          {c.anime?.cover_image ? (
                            <img
                              src={c.anime.cover_image}
                              alt={c.anime.title}
                              className="h-20 w-14 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-20 w-14 rounded bg-gradient-to-br from-primary to-purple-600 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="mb-1 truncate font-medium text-foreground">
                              {c.anime?.title || 'Unknown anime'}
                              {c.type === 'episode' && c.episode_number && ` – Episode ${c.episode_number}`}
                            </p>
                            <p className="line-clamp-2 text-sm text-foreground">{c.content}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this comment?')) {
                              deleteComment(c.id, c.type)
                            }
                          }}
                          className="shrink-0 rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={createList}
      />
    </div>
  )
}
