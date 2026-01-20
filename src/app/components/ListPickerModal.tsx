import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/services/supabase'
import { CreateListModal } from '@/app/components/CreateListModal'

type ListRow = {
  id: string
  name: string
  description: string | null
  is_private: boolean
}

export default function ListPickerModal({
  isOpen,
  onClose,
  animeId
}: {
  isOpen: boolean
  onClose: () => void
  animeId: string
}) {
  const { user } = useAuth()
  const [lists, setLists] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate] = useState(false)

  const canInteract = useMemo(() => !!user && !!animeId && !saving, [user, animeId, saving])

  useEffect(() => {
    if (!isOpen || !user) {
      if (!isOpen) {
        setLists([])
        setAdded({})
      }
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      console.log('ListPickerModal: Fetching lists for user:', user.id)
      const { data, error } = await supabase
        .from('lists')
        .select('id,name,description,is_private')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('lists load failed', error)
        toast.error('Failed to load lists')
        setLists([])
        setLoading(false)
        return
      }
      console.log('ListPickerModal: Lists fetched:', data?.length || 0)
      setLists((data ?? []) as ListRow[])
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [isOpen, user])

  const addToList = async (listId: string) => {
    if (!user) return
    if (saving) return
    setSaving(listId)
    setAdded((prev) => ({ ...prev, [listId]: true }))
    const { error } = await supabase.from('list_items').insert({
      list_id: listId,
      anime_id: animeId
    })
    if (error) {
      console.error('add to list failed', error)
      setAdded((prev) => ({ ...prev, [listId]: false }))
      toast.error(error.message || 'Failed to add to list')
      setSaving(null)
      return
    }
    toast.success('Added to list')
    setSaving(null)
  }

  const createList = async (listData: { name: string; description: string; isPrivate: boolean }) => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lists')
      .insert({
        user_id: user.id,
        name: listData.name.trim(),
        description: listData.description.trim() ? listData.description.trim() : null,
        is_private: listData.isPrivate
      })
      .select('id,name,description,is_private')
      .single()
    if (error) {
      console.error('create list failed', error)
      toast.error(error.message || 'Failed to create list')
      setLoading(false)
      return
    }
    if (data) {
      setLists((prev) => [data as ListRow, ...prev])
      toast.success('List created')
      setLoading(false)
    }
  }

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl shadow-black/40"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Add to List</h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!user && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Log in to manage lists
                </div>
              )}

              {user && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Choose a list</p>
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      New List
                    </button>
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-14 animate-pulse rounded-xl bg-background" />
                      ))}
                    </div>
                  ) : lists.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                      No lists yet
                    </div>
                  ) : (
                    <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                      {lists.map((l) => {
                        const isAdded = !!added[l.id]
                        const isBusy = saving === l.id
                        return (
                          <button
                            key={l.id}
                            type="button"
                            disabled={!canInteract || isBusy}
                            onClick={() => addToList(l.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{l.name}</p>
                              {l.description && <p className="truncate text-sm text-muted-foreground">{l.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              {isBusy ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : isAdded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                  <Check className="h-3.5 w-3.5" />
                                  Added
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Add</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>

          <CreateListModal
            isOpen={showCreate}
            onClose={() => setShowCreate(false)}
            onSave={createList}
          />
        </>
      )}
    </AnimatePresence>
  )
}

