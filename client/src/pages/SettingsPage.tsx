import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/api';

interface Environment {
  name: string;
  publisherToken: string;
  webstoreUrl: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    appchargeApiKey: '',
    appchargeWebstoreUrl: '',
    appchargeApiBase: 'https://api-sandbox.appcharge.com',
    publisherToken: '',
    environments: [] as Environment[],
    activeEnvName: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // New env form
  const [newEnv, setNewEnv] = useState<Environment>({ name: '', publisherToken: '', webstoreUrl: '' });
  const [showNewEnv, setShowNewEnv] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        appchargeApiBase: settings.appchargeApiBase,
      });
      showMessage('Settings saved.');
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchEnv = async (name: string) => {
    try {
      await api.switchEnv(name);
      // Reload settings to get updated state
      const updated = await api.getSettings();
      setSettings(updated);
      showMessage(`Switched to "${name}"`);
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    }
  };

  const handleSaveEnv = async () => {
    if (!newEnv.name || !newEnv.publisherToken) {
      showMessage('Environment name and publisher token are required');
      return;
    }
    try {
      await api.saveEnvironment(newEnv);
      // Switch to the new env immediately
      await api.switchEnv(newEnv.name);
      const updated = await api.getSettings();
      setSettings(updated);
      setNewEnv({ name: '', publisherToken: '', webstoreUrl: '' });
      setShowNewEnv(false);
      showMessage(`Environment "${newEnv.name}" saved and activated`);
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    }
  };

  const handleDeleteEnv = async (name: string) => {
    if (!confirm(`Delete environment "${name}"?`)) return;
    try {
      await api.deleteEnvironment(name);
      const updated = await api.getSettings();
      setSettings(updated);
      showMessage(`Environment "${name}" deleted`);
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage Appcharge environments and connection settings</p>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Environments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Environments</h2>
          <button
            onClick={() => setShowNewEnv(!showNewEnv)}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            {showNewEnv ? 'Cancel' : '+ Add Environment'}
          </button>
        </div>

        {/* Existing environments */}
        <div className="space-y-3 mb-4">
          {settings.environments.map((env) => (
            <div
              key={env.name}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                settings.activeEnvName === env.name
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{env.name}</span>
                  {settings.activeEnvName === env.name && (
                    <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                  Token: {env.publisherToken}
                </div>
                {env.webstoreUrl && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {env.webstoreUrl}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-3">
                {settings.activeEnvName !== env.name && (
                  <>
                    <button
                      onClick={() => handleSwitchEnv(env.name)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Switch
                    </button>
                    <button
                      onClick={() => handleDeleteEnv(env.name)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* New environment form */}
        {showNewEnv && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">New Environment</h3>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Environment Name *</label>
              <input
                type="text"
                value={newEnv.name}
                onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
                placeholder="e.g. Demo Account 2"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Publisher Token *</label>
              <input
                type="text"
                value={newEnv.publisherToken}
                onChange={(e) => setNewEnv({ ...newEnv, publisherToken: e.target.value })}
                placeholder="x-publisher-token value"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Webstore URL</label>
              <input
                type="text"
                value={newEnv.webstoreUrl}
                onChange={(e) => setNewEnv({ ...newEnv, webstoreUrl: e.target.value })}
                placeholder="https://your-store.appchargestore.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={handleSaveEnv}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Save & Activate
            </button>
          </div>
        )}
      </div>

      {/* API Base URL */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">API Configuration</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appcharge API Base URL</label>
          <input
            type="text"
            value={settings.appchargeApiBase}
            onChange={(e) => setSettings({ ...settings, appchargeApiBase: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Shared across all environments. Default: sandbox.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
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
              <button
                onClick={() => copyToClipboard(`${window.location.origin}${endpoint.path}`, endpoint.path)}
                className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors flex-shrink-0"
                title={copiedPath === endpoint.path ? 'Copied!' : 'Copy'}
              >
                {copiedPath === endpoint.path ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
