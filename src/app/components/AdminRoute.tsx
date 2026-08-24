import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * Gate for /admin. Requires a session AND `users.is_admin === true`.
 *
 * Fails closed by design: until the is_admin migration is applied and a row is
 * flipped to true, this sends everyone away — which is the safe direction. The
 * check is client-side and therefore cosmetic; the moderation queue is only
 * genuinely protected by RLS on the underlying tables.
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, adminLoading } = useAuth()
  const location = useLocation()

  // Waiting on either check. Rendering the redirect early would flash the
  // login page at an admin who is in fact signed in.
  if (loading || adminLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink/70 border-t-crimson mx-auto mb-3" />
          <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  // Signed in but not an admin. Home, not /login — they have nothing to log
  // into, and bouncing them to a login form they've already satisfied reads
  // as a bug. Nothing acknowledges that /admin exists.
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
