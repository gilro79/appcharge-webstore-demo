import { useState, useEffect } from 'react';
import { useActivePlayer } from '../context/ActivePlayerContext';
import { api } from '../hooks/api';

export default function DashboardPage() {
  const { players } = useActivePlayer();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const webstoreUrl = settings?.appchargeWebstoreUrl || '';

  const handleRefreshStore = async () => {
    try {
      const result = await api.refreshStore();
      alert(`Refresh store response: ${JSON.stringify(result)}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Appcharge Webstore Integration Demo</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Players</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{players.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Webstore Status</div>
          <div className="text-xl font-bold text-green-600 mt-1">
            {settings?.appchargeWebstoreUrl ? 'Configured' : 'Not configured'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="text-sm text-gray-500">API Base</div>
          <div className="text-sm font-medium text-gray-700 mt-1 font-mono truncate">
            {settings?.appchargeApiBase || 'N/A'}
          </div>
        </div>
      </div>

      {/* Webstore Link */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Appcharge Webstore</h2>
            <p className="text-sm text-gray-500 mt-1">
              {settings?.activeEnvName ? `Environment: ${settings.activeEnvName}` : 'Live webstore powered by Appcharge'}
            </p>
          </div>
          {webstoreUrl && (
            <a
              href={webstoreUrl.startsWith('http') ? webstoreUrl : `https://${webstoreUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Webstore
            </a>
          )}
        </div>
        {webstoreUrl && (
          <div className="mt-3">
            <a
              href={webstoreUrl.startsWith('http') ? webstoreUrl : `https://${webstoreUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-800 font-mono"
            >
              {webstoreUrl}
            </a>
          </div>
        )}
        {!webstoreUrl && (
          <p className="mt-3 text-sm text-gray-400">No webstore URL configured. Set it in Settings.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRefreshStore}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Store
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>1.</strong> Configure player profiles in the <strong>Players</strong> page.</p>
          <p><strong>2.</strong> Edit what the personalization endpoint returns for each tier in <strong>Personalization</strong>.</p>
          <p><strong>3.</strong> When Appcharge calls our webhook endpoints, we match the player by ID and return their tier's offers.</p>
          <p><strong>4.</strong> Unknown player IDs automatically get a <strong>Guest</strong> profile.</p>
          <p><strong>5.</strong> All API calls appear in the <strong>API Log</strong> panel on the right in real-time.</p>
        </div>
      </div>
    </div>
  );
}
