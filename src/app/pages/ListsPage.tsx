import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Lock, Globe, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/services/supabase'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

type ListRow = {
  id: string
  name: string
  description: string | null
  is_private: boolean
  created_at: string
  item_count?: number
}

type ListItem = {
  id: string
  anime_id: string
  anime: {
    id: string
    title: string
    cover_image: string | null
  } | null
}

export default function ListsPage() {
  const { user } = useAuth()
  const [lists, setLists] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [listItems, setListItems] = useState<Record<string, ListItem[]>>({})

  const canCreate = useMemo(() => name.trim().length > 0 && !saving, [name, saving])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user) {
        setLists([])
        setListItems({})
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('lists')
          .select('id,name,description,is_private,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLists([])
          setListItems({})
          return
        }
        
        const listsData = (data ?? []) as ListRow[]
        setLists(listsData)
        
        const itemsMap: Record<string, ListItem[]> = {}
        await Promise.all(
          listsData.map(async (list) => {
            const { data: itemsData } = await supabase
              .from('list_items')
              .select(`
                id,
                anime_id,
                anime:anime_index!list_items_anime_id_fkey(id,title,cover_image)
              `)
              .eq('list_id', list.id)
            
            if (itemsData) {
              itemsMap[list.id] = itemsData as ListItem[]
            }
          })
        )
        
        if (!cancelled) {
          setListItems(itemsMap)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lists')
          setLists([])
          setListItems({})
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  const createList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    const { data: newList, error: err } = await supabase.from('lists').insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      is_private: isPrivate
    }).select('id,name,description,is_private,created_at').single()
    if (err) {
      setSaving(false)
      setError(err.message)
      toast.error(err.message || 'Failed to create list')
      return
    }
    setName('')
    setDescription('')
    setIsPrivate(false)
    
    setLists((prev) => [newList, ...prev])
    setListItems((prev) => ({ ...prev, [newList.id]: [] }))
    setSaving(false)
    toast.success('Collection created')
  }

  const deleteList = async (listId: string) => {
    if (!user || deleting) return
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) return
    
    setDeleting(listId)
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id)
      
      if (error) {
        toast.error(error.message || 'Failed to delete collection')
        return
      }
      
      setLists((prev) => prev.filter((l) => l.id !== listId))
      setListItems((prev) => {
        const next = { ...prev }
        delete next[listId]
        return next
      })
      toast.success('Collection deleted')
    } catch (err) {
      toast.error('Failed to delete collection')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8 overflow-x-hidden">
      <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start gap-3">
            <div className="hidden sm:block h-10 w-[3px] rounded-full bg-gradient-to-b from-crimson via-crimson/50 to-transparent mt-1 shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Collections</h1>
              <p className="mt-1 text-xs tracking-[0.1em] uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>Create and manage your anime collections</p>
            </div>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onSubmit={createList}
          className="mb-8 rounded-lg border border-gold/[0.08] bg-card p-5 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Create Collection</h2>
            <button
              type="submit"
              disabled={!canCreate}
              className="btn-imperial min-h-[40px] py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-imperial min-h-[44px]"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Privacy</label>
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className="flex w-full items-center justify-between input-imperial min-h-[44px]"
              >
                <span className="text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>{isPrivate ? 'Private' : 'Public'}</span>
                {isPrivate ? <Lock className="h-4 w-4 text-gold/40" /> : <Globe className="h-4 w-4 text-gold/40" />}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-imperial resize-none"
              style={{ fontSize: '16px' }}
            />
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-gold/[0.06] bg-card py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-crimson" />
            </div>
          ) : lists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gold/10 p-10 text-center text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
              No collections yet — create your first one above
            </div>
          ) : (
            lists.map((list, idx) => {
              const items = listItems[list.id] || []
              return (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                  className="rounded-lg border border-gold/[0.06] bg-card p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>{list.name}</h3>
                      {list.description && <p className="mt-1 text-xs text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{list.description}</p>}
                      <p className="mt-2 text-[10px] text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {items.length} {items.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge-imperial">
                        {list.is_private ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {list.is_private ? 'Private' : 'Public'}
                      </span>
                      <button
                        onClick={() => deleteList(list.id)}
                        disabled={deleting === list.id}
                        className="rounded-md p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        {deleting === list.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gold/[0.06]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.slice(0, 4).map((item) => (
                          <Link
                            key={item.id}
                            to={`/anime/${item.anime_id}`}
                            className="flex items-center gap-3 rounded-md border border-gold/[0.06] bg-background p-3 transition-all hover:bg-accent hover:border-gold/15 group"
                          >
                            {item.anime?.cover_image ? (
                              <img
                                src={item.anime.cover_image}
                                alt={item.anime.title}
                                className="h-14 w-10 rounded-sm object-cover border border-gold/[0.06]"
                              />
                            ) : (
                              <div className="h-14 w-10 rounded-sm bg-gradient-to-br from-crimson/20 to-ink" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-sm text-foreground group-hover:text-gold transition-colors" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                {item.anime?.title || 'Unknown'}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      {items.length > 4 && (
                        <p className="mt-3 text-[10px] text-center text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          +{items.length - 4} more entries
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })
          )}
        </motion.div>
      </div>
    </div>
  )
}
