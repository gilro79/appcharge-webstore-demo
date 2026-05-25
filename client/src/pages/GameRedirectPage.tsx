import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../hooks/api';

export default function GameRedirectPage() {
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('accessToken') || '';
  const [session, setSession] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setError('No accessToken provided');
      setLoading(false);
      return;
    }

    Promise.all([
      api.getGameAuthSession(accessToken),
      api.getSettings(),
    ])
      .then(([sessionData, settingsData]) => {
        setSession(sessionData);
        setSettings(settingsData);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load session');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accessToken]);

  const webstoreUrl = settings?.appchargeWebstoreUrl || '';
  const storeLink = webstoreUrl
    ? `${webstoreUrl.startsWith('http') ? webstoreUrl : `https://${webstoreUrl}`}/login?proofKey=${session?.proofKey}&token=${accessToken}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg p-6 max-w-md text-center">
          <p className="text-lg font-semibold mb-2">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Game header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Game Authentication</h1>
          <p className="text-gray-400 mt-1 text-sm">Simulated game page for redirect login</p>
        </div>

        {/* Player card */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
          {/* Player info */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">Player identified</p>
            <p className="text-xl font-bold text-white mt-1">{session?.playerName}</p>
            <p className="text-gray-500 text-xs font-mono mt-1">{session?.publisherPlayerId}</p>
          </div>

          {/* Proof key */}
          <div className="bg-gray-900 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm mb-2">Your player code</p>
            <p className="text-4xl font-mono font-bold text-green-400 tracking-[0.3em]">
              {session?.proofKey}
            </p>
          </div>

          {/* Store link */}
          {storeLink && (
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-2">Store link</p>
                <code className="block bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-300 break-all">
                  {storeLink}
                </code>
              </div>
              <button
                onClick={() => window.open(storeLink, '_blank')}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
              >
                Open Store
              </button>
            </div>
          )}

          {!storeLink && (
            <p className="text-gray-500 text-sm text-center">
              No webstore URL configured. Set it in the dashboard Settings page.
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs text-center mt-6">
          This is a simulated game page for the Game Redirect Login demo.
        </p>
      </div>
    </div>
  );
}
