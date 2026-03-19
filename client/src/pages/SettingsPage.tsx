import { useState, useEffect } from 'react';
import { api } from '../hooks/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    appchargeApiKey: '',
    appchargeWebstoreUrl: '',
    appchargeApiBase: 'https://api-sandbox.appcharge.com',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setMessage('Settings saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure Appcharge connection settings</p>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appcharge Webstore URL</label>
          <input
            type="text"
            value={settings.appchargeWebstoreUrl}
            onChange={(e) => setSettings({ ...settings, appchargeWebstoreUrl: e.target.value })}
            placeholder="https://your-store.appcharge.com"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">URL of your Appcharge webstore. Used for the "Open Webstore" button.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appcharge API Key</label>
          <input
            type="password"
            value={settings.appchargeApiKey}
            onChange={(e) => setSettings({ ...settings, appchargeApiKey: e.target.value })}
            placeholder="Enter your API key"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Used for calling Appcharge APIs (e.g., Refresh Store).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appcharge API Base URL</label>
          <input
            type="text"
            value={settings.appchargeApiBase}
            onChange={(e) => setSettings({ ...settings, appchargeApiBase: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Base URL for Appcharge API calls. Default: sandbox.</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Webhook URLs info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Webhook Endpoints</h2>
        <p className="text-sm text-gray-500 mb-4">Configure these URLs in your Appcharge dashboard:</p>
        <div className="space-y-3">
          {[
            { label: 'Auth', path: '/api/appcharge/auth' },
            { label: 'Personalization', path: '/api/appcharge/personalization' },
            { label: 'Award', path: '/api/appcharge/award' },
            { label: 'Events', path: '/api/appcharge/events' },
          ].map((endpoint) => (
            <div key={endpoint.path} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-32">{endpoint.label}:</span>
              <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono text-gray-800 flex-1">
                {window.location.origin}{endpoint.path}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
