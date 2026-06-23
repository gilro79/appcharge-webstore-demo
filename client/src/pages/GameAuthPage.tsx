import { useState, useEffect } from 'react';
import { useActivePlayer } from '../context/ActivePlayerContext';
import { api } from '../hooks/api';

export default function GameAuthPage() {
  const { players } = useActivePlayer();
  const [settings, setSettings] = useState<any>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [initiateType, setInitiateType] = useState<'qr' | 'auto-redirect' | 'in-app'>('qr');
  const [webstoreUrl, setWebstoreUrl] = useState('');
  const [flowData, setFlowData] = useState<any>(null);
  const [resolveData, setResolveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: any) => {
      setSettings(s);
      // Find the webstore URL from settings or the active environment
      const url = s?.appchargeWebstoreUrl
        || s?.environments?.find((e: any) => e.name === s.activeEnvName)?.webstoreUrl
        || s?.environments?.find((e: any) => e.webstoreUrl)?.webstoreUrl
        || '';
      if (url) setWebstoreUrl(url);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (players.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(players[0].publisherPlayerId);
    }
  }, [players, selectedPlayerId]);

  const handleStartFlow = async () => {
    if (!selectedPlayerId) return;
    if (!webstoreUrl) {
      alert('Please enter the Webstore URL before starting the flow.');
      return;
    }
    setLoading(true);
    setResolveData(null);
    try {
      // Persist the webstore URL to settings so it survives server restarts
      await api.updateSettings({ appchargeWebstoreUrl: webstoreUrl });
      const data = await api.simulateGameAuth(selectedPlayerId, initiateType, webstoreUrl);
      setFlowData(data);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!flowData) return;
    try {
      // First get the session to retrieve the proofKey
      const session = await api.getGameAuthSession(flowData.accessToken);
      const data = await api.resolveGameAuth(session.proofKey, flowData.accessToken);
      setResolveData({ request: { token: flowData.accessToken, proofKey: session.proofKey }, response: data });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Game Redirect Login</h1>
        <p className="text-gray-500 mt-1">
          Simulate the OTP-based Game Redirect Login authentication flow
        </p>
      </div>

      {/* Flow overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>1.</strong> Appcharge calls the publisher's <strong>Initiate Game Auth Callback</strong> endpoint.</p>
          <p><strong>2.</strong> The publisher responds with a <strong>deeplink</strong> + <strong>accessToken</strong>.</p>
          <p><strong>3.</strong> The player is redirected to the game via the deeplink.</p>
          <p><strong>4.</strong> The game identifies the player and generates a <strong>player code (proofKey)</strong>.</p>
          <p><strong>5.</strong> The player returns to the store with the proofKey + token.</p>
          <p><strong>6.</strong> Appcharge calls <strong>Authenticate Player</strong> to validate.</p>
        </div>
      </div>

      {/* Player picker + Start */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Start Simulation</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Player</label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {players.map((p) => (
                <option key={p.id} value={p.publisherPlayerId}>
                  {p.playerName} ({p.publisherPlayerId})
                </option>
              ))}
            </select>
            {initiateType === 'auto-redirect' && (
              <p className="text-xs text-primary-600 mt-1">
                This player will be automatically identified and redirected back to the store.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webstore URL</label>
            <input
              type="text"
              value={webstoreUrl}
              onChange={(e) => setWebstoreUrl(e.target.value)}
              placeholder="https://your-store.appchargestore.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The Appcharge store URL to redirect back to after authentication.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initiate Type</label>
            <div className="flex gap-2">
              {([
                { value: 'qr', label: 'QR Code', desc: 'Player scans QR, types 4-digit code' },
                { value: 'auto-redirect', label: 'Auto Redirect to Store', desc: 'Seamless two-redirect flow' },
                { value: 'in-app', label: 'In-App Redirect', desc: 'Player stays in app, clicks to return' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInitiateType(opt.value)}
                  className={`flex-1 text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    initiateType === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className="font-medium block">{opt.label}</span>
                  <span className="text-xs text-gray-500 block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleStartFlow}
              disabled={loading || !selectedPlayerId}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Flow'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 1: Initiate Game Auth Callback */}
      {flowData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">1</span>
            <h2 className="text-lg font-semibold text-gray-900">Initiate Game Auth Callback</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Appcharge calls the publisher's endpoint. The publisher responds with a deeplink and accessToken.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Request</h3>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(flowData.request, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Response</h3>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(flowData.response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Redirect to Game */}
      {flowData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">2</span>
            <h2 className="text-lg font-semibold text-gray-900">Redirect to Game</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            The player is redirected to the game using the deeplink. The game identifies the player and generates a proofKey.
          </p>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Deeplink</h3>
            <code className="block bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono break-all">
              {flowData.deepLink}
            </code>
          </div>
          <button
            onClick={() => window.open(flowData.deepLink, '_blank')}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Game Page
          </button>
        </div>
      )}

      {/* Step 3: Authenticate Player */}
      {flowData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">3</span>
            <h2 className="text-lg font-semibold text-gray-900">Authenticate Player</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Appcharge calls the Authenticate Player endpoint with the proofKey and token to validate the player.
          </p>

          {!resolveData && (
            <button
              onClick={handleResolve}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resolve Authentication
            </button>
          )}

          {resolveData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Request to /api/appcharge/auth</h3>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(resolveData.request, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Response</h3>
                <pre className={`border rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${
                  resolveData.response.status === 'valid'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  {JSON.stringify(resolveData.response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
