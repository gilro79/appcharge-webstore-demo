import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ActivePlayerProvider } from './context/ActivePlayerContext';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import PlayersPage from './pages/PlayersPage';
import PersonalizationPage from './pages/PersonalizationPage';
import EventsPage from './pages/EventsPage';
import ApiReferencePage from './pages/ApiReferencePage';
import SettingsPage from './pages/SettingsPage';
import WebstorePreviewPage from './pages/WebstorePreviewPage';
import GameAuthPage from './pages/GameAuthPage';
import GameRedirectPage from './pages/GameRedirectPage';
import LoginPage from './pages/LoginPage';
import ToolsPage from './pages/ToolsPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/game-redirect" element={<GameRedirectPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <ActivePlayerProvider>
      <Routes>
        <Route path="/game-redirect" element={<GameRedirectPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/checkout" element={<WebstorePreviewPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route element={<AppShell />}>
          <Route path="/demo" element={<DashboardPage />} />
          <Route path="/demo/players" element={<PlayersPage />} />
          <Route path="/demo/game-auth" element={<GameAuthPage />} />
          <Route path="/demo/personalization" element={<PersonalizationPage />} />
          <Route path="/demo/events" element={<EventsPage />} />
          <Route path="/demo/api-reference" element={<ApiReferencePage />} />
          <Route path="/demo/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ActivePlayerProvider>
  );
}
