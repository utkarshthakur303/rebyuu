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
    toast.success('List created')
  }

  const deleteList = async (listId: string) => {
    if (!user || deleting) return
    if (!confirm('Are you sure you want to delete this list? This action cannot be undone.')) return
    
    setDeleting(listId)
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id)
      
      if (error) {
        toast.error(error.message || 'Failed to delete list')
        return
      }
      
      setLists((prev) => prev.filter((l) => l.id !== listId))
      setListItems((prev) => {
        const next = { ...prev }
        delete next[listId]
        return next
      })
      toast.success('List deleted')
    } catch (err) {
      toast.error('Failed to delete list')
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
          <h1 className="text-3xl font-bold text-foreground">My Lists</h1>
          <p className="mt-2 text-muted-foreground">Create and manage your personal anime lists</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onSubmit={createList}
          className="mb-8 rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Create a list</h2>
            <button
              type="submit"
              disabled={!canCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-2.5 text-foreground"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Privacy</label>
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-input-background px-4 py-2.5 text-foreground"
              >
                <span className="text-sm">{isPrivate ? 'Private' : 'Public'}</span>
                {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-input-background px-4 py-3 text-base sm:text-sm text-foreground"
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
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : lists.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No lists yet
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
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{list.name}</h3>
                      {list.description && <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
                        {list.is_private ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                        {list.is_private ? 'Private' : 'Public'}
                      </span>
                      <button
                        onClick={() => deleteList(list.id)}
                        disabled={deleting === list.id}
                        className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {deleting === list.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {items.slice(0, 4).map((item) => (
                          <Link
                            key={item.id}
                            to={`/anime/${item.anime_id}`}
                            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent"
                          >
                            {item.anime?.cover_image ? (
                              <img
                                src={item.anime.cover_image}
                                alt={item.anime.title}
                                className="h-16 w-12 rounded object-cover"
                              />
                            ) : (
                              <div className="h-16 w-12 rounded bg-gradient-to-br from-primary to-purple-600" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-foreground text-sm">
                                {item.anime?.title || 'Unknown'}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      {items.length > 4 && (
                        <p className="mt-3 text-xs text-center text-muted-foreground">
                          +{items.length - 4} more
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

