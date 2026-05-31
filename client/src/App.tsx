import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ActivePlayerProvider } from './context/ActivePlayerContext';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import PlayersPage from './pages/PlayersPage';
import PersonalizationPage from './pages/PersonalizationPage';
import EventsPage from './pages/EventsPage';
import ApiReferencePage from './pages/ApiReferencePage';
import SettingsPage from './pages/SettingsPage';
import GameAuthPage from './pages/GameAuthPage';
import GameRedirectPage from './pages/GameRedirectPage';
import LoginPage from './pages/LoginPage';

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
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/game-auth" element={<GameAuthPage />} />
          <Route path="/personalization" element={<PersonalizationPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/api-reference" element={<ApiReferencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ActivePlayerProvider>
  );
}
