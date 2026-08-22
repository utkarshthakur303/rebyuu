import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
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
    // Carries the query string, not just the pathname. /browse is protected, so
    // every "View More" on the homepage passes through here — sending back a
    // bare pathname dropped the sort and filters the visitor actually clicked.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return children
}
