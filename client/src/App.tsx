import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import PlayersPage from './pages/PlayersPage';
import PersonalizationPage from './pages/PersonalizationPage';
import EventsPage from './pages/EventsPage';
import ApiReferencePage from './pages/ApiReferencePage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/personalization" element={<PersonalizationPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/api-reference" element={<ApiReferencePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
