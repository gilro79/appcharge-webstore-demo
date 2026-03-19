import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import PlayersPage from './pages/PlayersPage';
import PersonalizationPage from './pages/PersonalizationPage';
import CreatePage from './pages/CreatePage';
import EventsPage from './pages/EventsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/personalization" element={<PersonalizationPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
