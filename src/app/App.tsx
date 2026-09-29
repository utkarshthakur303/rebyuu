import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/app/components/Navigation';
import { Footer } from '@/app/components/Footer';
import LandingPage from '@/app/pages/LandingPage';
import BrowsePage from '@/app/pages/BrowsePage';
import AnimeDetailPage from '@/app/pages/AnimeDetailPage';

/**
 * Split point. /, /browse and /anime/:id stay in the main bundle: they are
 * the three routes an anonymous visitor and a crawler actually land on, and
 * making them wait on a second round trip would trade a parse cost nobody
 * notices for a latency cost everybody does.
 *
 * The four below are different — every one of them requires an account, so
 * shipping them to a logged-out visitor is pure dead weight. The admin
 * moderation console was being downloaded, parsed and executed by every
 * anonymous reader of the homepage.
 */
const ProfilePage = lazy(() => import('@/app/pages/ProfilePage'));
const LoginPage = lazy(() => import('@/app/pages/LoginPage'));
const AdminPage = lazy(() => import('@/app/pages/AdminPage'));
const ListsPage = lazy(() => import('@/app/pages/ListsPage'));

/* Written pages. Rarely visited, so they are chunks — but they carry the
   trust signals (sourcing, ownership, data handling) that the catalogue
   pages cannot, so they are indexed and linked from every page footer. */
const AboutPage = lazy(() => import('@/app/pages/AboutPage'));
const TermsPage = lazy(() => import('@/app/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/app/pages/PrivacyPage'));
const EpisodePage = lazy(() => import('@/app/pages/EpisodePage'));
import NotFoundPage from '@/app/pages/NotFoundPage';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import AdminRoute from '@/app/components/AdminRoute';
import Toaster from '@/app/components/Toaster';
import { TitleLangProvider } from '@/context/TitleLangContext';
import { Analytics } from "@vercel/analytics/next"

/** Matches the in-page loading state AnimeDetailPage already uses. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink/70 border-t-crimson mb-3" />
        <p className="text-xs text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>Loading...</p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, state } = useLocation();
  useEffect(() => {
    // A filter change that moves between a hub page and Browse is not a new
    // page, so it keeps your place; BrowsePage marks those navigations.
    if ((state as { keepScroll?: boolean } | null)?.keepScroll) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Only a new path scrolls; the state is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Wraps Navigation too — the EN/JP switch lives in the navbar, and
            search suggestions there render titles as well. */}
        <TitleLangProvider>
        {/* No `dark` class: the site renders on the paper canvas defined in
            :root. Re-adding it flips every token to the inverted palette. */}
        <div className="min-h-screen bg-background text-foreground grain-overlay">
          <ScrollToTop />
          <Navigation />
          <Toaster />
          <main className="relative z-10">
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
              {/* Browse and the hub pages are one page on different paths. As a
                  layout route it stays mounted when a filter change moves
                  between them, so an open filter drawer stays open. */}
              <Route element={<ErrorBoundary><BrowsePage /></ErrorBoundary>}>
                <Route path="/browse" element={null} />
                <Route path="/seasons/:key" element={null} />
                <Route path="/airing" element={null} />
                <Route path="/upcoming" element={null} />
              </Route>
              <Route path="/anime/:id" element={<ErrorBoundary><AnimeDetailPage /></ErrorBoundary>} />
              <Route path="/anime/:id/episode/:ep" element={<ErrorBoundary><EpisodePage /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><ProtectedRoute><ProfilePage /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/lists" element={<ErrorBoundary><ProtectedRoute><ListsPage /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
              <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
              <Route path="/terms" element={<ErrorBoundary><TermsPage /></ErrorBoundary>} />
              <Route path="/privacy" element={<ErrorBoundary><PrivacyPage /></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><AdminRoute><AdminPage /></AdminRoute></ErrorBoundary>} />
              {/* Reached only by client-side navigation to an unknown route.
                  A direct request never gets here — vercel.json rewrites the
                  seven real routes and lets everything else 404 at the edge. */}
              <Route path="*" element={<ErrorBoundary><NotFoundPage /></ErrorBoundary>} />
            </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
        </TitleLangProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
