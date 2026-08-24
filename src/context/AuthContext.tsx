import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  /** True only when the signed-in user's `users.is_admin` column is true.
      Fails closed: every error path — including the column not existing
      because the migration hasn't been applied — reads as "not an admin".
      This flag only hides UI. RLS is what actually protects the data. */
  isAdmin: boolean
  /** Separates "still checking is_admin" from "checked, not an admin" so
      /admin can hold on a spinner instead of flashing a redirect. */
  adminLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, username: string) => Promise<void>
  logout: () => Promise<void>
  loginWithGoogle: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    init().catch(() => {
      if (!mounted) return
      setUser(null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }

    let cancelled = false
    setAdminLoading(true)

    supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        setIsAdmin(!error && (data as { is_admin?: boolean } | null)?.is_admin === true)
        setAdminLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signup = useCallback(async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin, adminLoading, login, signup, logout, loginWithGoogle }),
    [user, loading, isAdmin, adminLoading, login, signup, logout, loginWithGoogle]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

