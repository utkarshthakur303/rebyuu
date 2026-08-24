import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/app/components/Navigation';
import { Footer } from '@/app/components/Footer';
import LandingPage from '@/app/pages/LandingPage';
import BrowsePage from '@/app/pages/BrowsePage';
import AnimeDetailPage from '@/app/pages/AnimeDetailPage';
import ProfilePage from '@/app/pages/ProfilePage';
import LoginPage from '@/app/pages/LoginPage';
import AdminPage from '@/app/pages/AdminPage';
import ListsPage from '@/app/pages/ListsPage';
import NotFoundPage from '@/app/pages/NotFoundPage';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import AdminRoute from '@/app/components/AdminRoute';
import Toaster from '@/app/components/Toaster';
import { TitleLangProvider } from '@/context/TitleLangContext';
import { Analytics } from "@vercel/analytics/next"

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
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
            <Routes>
              <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
              <Route path="/browse" element={<ErrorBoundary><BrowsePage /></ErrorBoundary>} />
              <Route path="/anime/:id" element={<ErrorBoundary><AnimeDetailPage /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><ProtectedRoute><ProfilePage /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/lists" element={<ErrorBoundary><ProtectedRoute><ListsPage /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><AdminRoute><AdminPage /></AdminRoute></ErrorBoundary>} />
              {/* Reached only by client-side navigation to an unknown route.
                  A direct request never gets here — vercel.json rewrites the
                  seven real routes and lets everything else 404 at the edge. */}
              <Route path="*" element={<ErrorBoundary><NotFoundPage /></ErrorBoundary>} />
            </Routes>
          </main>
          <Footer />
        </div>
        </TitleLangProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
