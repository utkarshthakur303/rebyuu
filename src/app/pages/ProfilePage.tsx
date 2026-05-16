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
    const animeRatings: UnifiedRating[] = ratings.map(r => ({ id: r.id, rating: r.rating, created_at: r.created_at, anime: r.anime, type: 'anime' as const }))
    const episodeRatingsList: UnifiedRating[] = episodeRatings.map(r => ({ id: r.id, rating: r.rating, created_at: r.created_at, anime: r.anime, episode_number: r.episode_number, type: 'episode' as const }))
    return [...animeRatings, ...episodeRatingsList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [ratings, episodeRatings])

  const unifiedComments = useMemo<UnifiedComment[]>(() => {
    const animeComments: UnifiedComment[] = reviews.map(c => ({ id: c.id, content: c.content, created_at: c.created_at, anime: c.anime, type: 'anime' as const }))
    const episodeCommentsList: UnifiedComment[] = episodeComments.map(c => ({ id: c.id, content: c.content, created_at: c.created_at, anime: c.anime, episode_number: c.episode_number, type: 'episode' as const }))
    return [...animeComments, ...episodeCommentsList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [reviews, episodeComments])

  const stats = useMemo(
    () => [
      { label: 'Collections', value: String(lists.length), icon: ListPlus },
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
      const { data, error } = await supabase.from('users').select('id,username,bio,avatar_url').eq('id', user.id).single()
      if (cancelled) return
      if (error) { console.error('profile load failed', error); setProfile(null); setLoadingProfile(false); return }
      setProfile(data as UserProfile)
      setEditBio((data as any)?.bio || '')
      setEditAvatarUrl((data as any)?.avatar_url || '')
      setLoadingProfile(false)
    }
    run()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      setLoadingData(true)
      try {
        const ITEMS_PER_TYPE = 100
        const [listsRes, ratingsRes, commentsRes, episodeRatingsRes, episodeCommentsRes] = await Promise.all([
          supabase.from('lists').select('id,name,description,is_private,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(ITEMS_PER_TYPE),
          supabase.from('ratings').select('id,rating,created_at,anime:anime_index!ratings_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(ITEMS_PER_TYPE),
          supabase.from('comments').select('id,content,created_at,anime:anime_index!comments_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(ITEMS_PER_TYPE),
          supabase.from('episode_ratings').select('id,rating,episode_number,created_at,anime:anime_index!episode_ratings_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(ITEMS_PER_TYPE),
          supabase.from('episode_comments').select('id,content,episode_number,created_at,anime:anime_index!episode_comments_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(ITEMS_PER_TYPE)
        ])
        if (cancelled) return
        if (listsRes.error) { console.error('lists load failed', listsRes.error); toast.error('Failed to load lists') }
        if (ratingsRes.error) { console.error('ratings load failed', ratingsRes.error); toast.error('Failed to load ratings') }
        if (commentsRes.error) { console.error('reviews load failed', commentsRes.error); toast.error('Failed to load reviews') }
        if (episodeRatingsRes.error) { console.error('episode ratings load failed', episodeRatingsRes.error); toast.error('Failed to load episode ratings') }
        if (episodeCommentsRes.error) { console.error('episode comments load failed', episodeCommentsRes.error); toast.error('Failed to load episode comments') }
        setLists(!listsRes.error ? (listsRes.data ?? []) as UserList[] : [])
        setRatings(!ratingsRes.error ? (ratingsRes.data ?? []) as UserRating[] : [])
        setReviews(!commentsRes.error ? (commentsRes.data ?? []) as UserComment[] : [])
        setEpisodeRatings(!episodeRatingsRes.error ? (episodeRatingsRes.data ?? []) as UserEpisodeRating[] : [])
        setEpisodeComments(!episodeCommentsRes.error ? (episodeCommentsRes.data ?? []) as UserEpisodeComment[] : [])
      } finally { if (!cancelled) setLoadingData(false) }
    }
    run()
    return () => { cancelled = true }
  }, [user])

  const saveProfile = async () => {
    if (!user || !profile) return
    const { error } = await supabase.from('users').update({ bio: editBio.trim() ? editBio.trim() : null, avatar_url: editAvatarUrl.trim() ? editAvatarUrl.trim() : null }).eq('id', user.id)
    if (error) { console.error('profile save failed', error); toast.error('Failed to save profile'); return }
    setProfile({ ...profile, bio: editBio.trim() ? editBio.trim() : null, avatar_url: editAvatarUrl.trim() ? editAvatarUrl.trim() : null })
    setEditing(false)
    toast.success('Profile updated')
  }

  const createList = async (listData: { name: string; description: string; isPrivate: boolean }) => {
    if (!user) return
    const { data, error } = await supabase.from('lists').insert({ user_id: user.id, name: listData.name.trim(), description: listData.description.trim() ? listData.description.trim() : null, is_private: listData.isPrivate }).select('id,name,description,is_private,created_at').single()
    if (error) { toast.error('Failed to create list'); return }
    if (data) { setLists((prev) => [data as UserList, ...prev]); toast.success('List created') }
  }

  const deleteRating = async (ratingId: string, type: 'anime' | 'episode') => {
    if (!user) return
    try {
      const table = type === 'anime' ? 'ratings' : 'episode_ratings'
      const { error } = await supabase.from(table).delete().eq('id', ratingId).eq('user_id', user.id)
      if (error) { toast.error(error.message || 'Failed to delete rating'); return }
      if (type === 'anime') { setRatings((prev) => prev.filter((r) => r.id !== ratingId)) } else { setEpisodeRatings((prev) => prev.filter((r) => r.id !== ratingId)) }
      toast.success('Rating deleted')
    } catch (err) { toast.error('Failed to delete rating') }
  }

  const deleteComment = async (commentId: string, type: 'anime' | 'episode') => {
    if (!user) return
    try {
      const table = type === 'anime' ? 'comments' : 'episode_comments'
      const { data, error, count } = await supabase.from(table).delete().eq('id', commentId).eq('user_id', user.id).select('id', { count: 'exact' })
      if (error) { console.error(`Delete ${type} comment error:`, error); toast.error(error.message || 'Failed to delete comment'); return }
      if (count !== undefined && count === 0) { console.error(`Delete ${type} comment: No rows affected`); toast.error('Comment not found or already deleted'); return }
      if (type === 'anime') { setReviews((prev) => prev.filter((c) => c.id !== commentId)) } else { setEpisodeComments((prev) => prev.filter((c) => c.id !== commentId)) }
      toast.success('Comment deleted')
    } catch (err) { console.error(`Delete ${type} comment exception:`, err); toast.error('Failed to delete comment') }
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-crimson" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>Profile not found</p>
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
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8 rounded-lg border border-gold/[0.08] bg-card p-6 sm:p-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="relative">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-gold/15 shadow-lg shadow-black/30" />
              ) : (
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-crimson to-crimson-dark text-2xl sm:text-3xl font-bold text-white border-2 border-gold/15 shadow-lg shadow-black/30" style={{ fontFamily: 'Cinzel, serif' }}>
                  {initials}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>{displayName}</h1>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="rounded-md p-2 text-gold/40 transition-colors hover:bg-accent hover:text-gold min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {editing ? (
                <div className="mb-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Bio</label>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="input-imperial resize-none" style={{ fontSize: '16px' }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Avatar URL</label>
                    <input type="url" value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} className="input-imperial min-h-[44px]" style={{ fontSize: '16px' }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveProfile} className="btn-imperial min-h-[40px] py-2 px-4 text-xs"><Save className="h-3.5 w-3.5" /> Save</button>
                    <button onClick={() => { setEditing(false); setEditBio(profile.bio || ''); setEditAvatarUrl(profile.avatar_url || '') }} className="btn-imperial-outline min-h-[40px] py-2 px-4 text-xs"><X className="h-3.5 w-3.5" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-muted-foreground text-sm" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontStyle: profile.bio ? 'normal' : 'italic' }}>{profile.bio || 'No bio yet'}</p>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {stats.map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className="rounded-md border border-gold/[0.06] bg-background p-3 sm:p-4">
                      <div className="mb-1 flex items-center gap-1 sm:gap-2">
                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-crimson/60" />
                        <p className="text-lg sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{s.value}</p>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>{s.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gold/10">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'lists', label: 'Collections' },
              { id: 'ratings', label: 'Ratings' },
              { id: 'reviews', label: 'Reviews' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`relative shrink-0 px-4 py-3 text-xs font-medium tracking-[0.1em] uppercase transition-colors ${
                  activeTab === t.id ? 'text-gold' : 'text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {t.label}
                {activeTab === t.id && (
                  <motion.div layoutId="profileTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-crimson via-gold to-crimson" transition={{ type: 'spring', duration: 0.5 }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {loadingData ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-gold/[0.06] bg-card">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-crimson" />
          </div>
        ) : (
          <>
            {activeTab === 'lists' && (
              <div className="rounded-lg border border-gold/[0.06] bg-card p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Your Collections</h2>
                  <button onClick={() => setShowCreateModal(true)} className="btn-imperial min-h-[38px] py-2 px-4 text-xs"><ListPlus className="h-3.5 w-3.5" /> Create</button>
                </div>
                {lists.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gold/10 p-10 text-center text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>No collections yet</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {lists.map((l) => (
                      <Link key={l.id} to="/lists" className="rounded-md border border-gold/[0.06] bg-background p-4 transition-all hover:bg-accent hover:border-gold/15 cursor-pointer block">
                        <p className="font-semibold text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{l.name}</p>
                        {l.description && <p className="mt-1 text-xs text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{l.description}</p>}
                        <p className="mt-3 text-[10px] text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {l.is_private ? 'Private' : 'Public'} · {new Date(l.created_at).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ratings' && (
              <div className="rounded-lg border border-gold/[0.06] bg-card p-5 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Ratings</h2>
                {unifiedRatings.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gold/10 p-10 text-center text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>No ratings yet</div>
                ) : (
                  <div className="space-y-2">
                    {unifiedRatings.map((r) => (
                      <div key={`rating-${r.type}-${r.id}-${r.anime?.id || 'unknown'}-${r.episode_number || ''}`} className="flex items-center gap-3 rounded-md border border-gold/[0.06] bg-background p-3 sm:p-4">
                        <Link to={r.anime ? `/anime/${r.anime.id}` : '#'} className="flex items-center gap-3 flex-1 min-w-0">
                          {r.anime?.cover_image ? (<img src={r.anime.cover_image} alt={r.anime.title} className="h-16 w-11 rounded-sm object-cover shrink-0 border border-gold/[0.06]" />) : (<div className="h-16 w-11 rounded-sm bg-gradient-to-br from-crimson/20 to-ink shrink-0" />)}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{r.anime?.title || 'Unknown anime'}{r.type === 'episode' && r.episode_number && ` – Ep ${r.episode_number}`}</p>
                            <p className="text-[10px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="shrink-0 rounded-sm bg-crimson/10 px-2.5 py-1 text-xs font-semibold text-crimson border border-crimson/15" style={{ fontFamily: 'Outfit, sans-serif' }}>{r.rating}/10</div>
                        </Link>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this rating?')) { deleteRating(r.id, r.type) } }} className="shrink-0 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="rounded-lg border border-gold/[0.06] bg-card p-5 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Reviews & Comments</h2>
                {unifiedComments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gold/10 p-10 text-center text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>No reviews or comments yet</div>
                ) : (
                  <div className="space-y-2">
                    {unifiedComments.map((c) => (
                      <div key={`comment-${c.type}-${c.id}-${c.anime?.id || 'unknown'}-${c.episode_number || ''}`} className="flex gap-3 rounded-md border border-gold/[0.06] bg-background p-3 sm:p-4">
                        <Link to={c.anime ? `/anime/${c.anime.id}` : '#'} className="flex gap-3 flex-1 min-w-0">
                          {c.anime?.cover_image ? (<img src={c.anime.cover_image} alt={c.anime.title} className="h-16 w-11 rounded-sm object-cover shrink-0 border border-gold/[0.06]" />) : (<div className="h-16 w-11 rounded-sm bg-gradient-to-br from-crimson/20 to-ink shrink-0" />)}
                          <div className="flex-1 min-w-0">
                            <p className="mb-1 truncate font-medium text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{c.anime?.title || 'Unknown anime'}{c.type === 'episode' && c.episode_number && ` – Ep ${c.episode_number}`}</p>
                            <p className="line-clamp-2 text-xs text-foreground/70" style={{ fontFamily: 'Outfit, sans-serif' }}>{c.content}</p>
                            <p className="mt-2 text-[10px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                        </Link>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this comment?')) { deleteComment(c.id, c.type) } }} className="shrink-0 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CreateListModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSave={createList} />
    </div>
  )
}
