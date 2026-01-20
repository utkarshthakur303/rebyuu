import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/app/components/Navigation';
import LandingPage from '@/app/pages/LandingPage';
import BrowsePage from '@/app/pages/BrowsePage';
import AnimeDetailPage from '@/app/pages/AnimeDetailPage';
import ProfilePage from '@/app/pages/ProfilePage';
import LoginPage from '@/app/pages/LoginPage';
import AdminPage from '@/app/pages/AdminPage';
import ListsPage from '@/app/pages/ListsPage';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Toaster from '@/app/components/Toaster';

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
        <div className="dark min-h-screen bg-background text-foreground">
          <ScrollToTop />
          <Navigation />
          <Toaster />
          <Routes>
            <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
            <Route path="/browse" element={<ErrorBoundary><ProtectedRoute><BrowsePage /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/anime/:id" element={<ErrorBoundary><AnimeDetailPage /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><ProtectedRoute><ProfilePage /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/lists" element={<ErrorBoundary><ProtectedRoute><ListsPage /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
            <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          </Routes>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
