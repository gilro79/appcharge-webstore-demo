import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

type InitiateType = 'qr' | 'auto-redirect' | 'in-app';

async function fetchSessionInfo(accessToken: string) {
  const res = await fetch(`/api/appcharge/game-auth/session-info/${accessToken}`);
  if (!res.ok) throw new Error('Failed to load session info');
  return res.json() as Promise<{
    initiateType: InitiateType;
    publisherPlayerId: string;
    playerName: string;
  }>;
}

async function fetchPlayers() {
  const res = await fetch('/api/appcharge/game-auth/players');
  if (!res.ok) throw new Error('Failed to load players');
  return res.json();
}

async function identifyPlayer(accessToken: string, publisherPlayerId: string) {
  const res = await fetch('/api/appcharge/game-auth/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, publisherPlayerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to identify player');
  }
  return res.json() as Promise<{
    proofKey: string;
    playerName: string;
    webstoreUrl: string;
    initiateType: InitiateType;
  }>;
}

export default function GameRedirectPage() {
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('accessToken') || '';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [initiateType, setInitiateType] = useState<InitiateType | null>(null);
  const [identified, setIdentified] = useState<{
    proofKey: string;
    playerName: string;
    webstoreUrl: string;
  } | null>(null);

  // Fallback picker state (for real Appcharge flow where player is not pre-set)
  const [needsPicker, setNeedsPicker] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [identifying, setIdentifying] = useState(false);

  const didRun = useRef(false);

  useEffect(() => {
    if (!accessToken || didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        // 1. Get session info (initiateType + pre-set player)
        const session = await fetchSessionInfo(accessToken);
        setInitiateType(session.initiateType);

        if (session.publisherPlayerId) {
          // 2a. Player is pre-set (simulation flow) — auto-identify
          const result = await identifyPlayer(accessToken, session.publisherPlayerId);
          setIdentified(result);
        } else {
          // 2b. No player pre-set (real Appcharge flow) — show picker
          const playerList = await fetchPlayers();
          setPlayers(playerList);
          if (playerList.length > 0) setSelectedPlayerId(playerList[0].publisherPlayerId);
          setNeedsPicker(true);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  // Auto-redirect mode: redirect immediately once identified
  useEffect(() => {
    if (initiateType !== 'auto-redirect' || !identified) return;

    const webstoreUrl = identified.webstoreUrl;
    if (!webstoreUrl) {
      setError('No webstore URL configured. Set it in the dashboard Settings page.');
      return;
    }

    const url = webstoreUrl.startsWith('http') ? webstoreUrl : `https://${webstoreUrl}`;
    const redirectUrl = `${url}?proofKey=${encodeURIComponent(identified.proofKey)}&token=${encodeURIComponent(accessToken)}`;

    // Brief delay so user sees the "Redirecting..." message
    const timer = setTimeout(() => {
      window.location.href = redirectUrl;
    }, 800);

    return () => clearTimeout(timer);
  }, [initiateType, identified, accessToken]);

  const handleIdentify = async () => {
    if (!selectedPlayerId) return;
    setIdentifying(true);
    try {
      const result = await identifyPlayer(accessToken, selectedPlayerId);
      setIdentified(result);
      setNeedsPicker(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIdentifying(false);
    }
  };

  const storeLink =
    identified?.webstoreUrl
      ? `${identified.webstoreUrl.startsWith('http') ? identified.webstoreUrl : `https://${identified.webstoreUrl}`}?proofKey=${encodeURIComponent(identified.proofKey)}&token=${encodeURIComponent(accessToken)}`
      : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Identifying player...</p>
        </div>
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

  // --- Player picker fallback (real Appcharge flow, no pre-set player) ---
  if (needsPicker && !identified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Game Authentication</h1>
            <p className="text-gray-400 mt-1 text-sm">Simulated game page — identify the player to continue</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select player (simulates game identifying the user)
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {players.map((p: any) => (
                  <option key={p.publisherPlayerId} value={p.publisherPlayerId}>
                    {p.playerName} ({p.publisherPlayerId})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleIdentify}
              disabled={identifying || !selectedPlayerId}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-50"
            >
              {identifying ? 'Identifying...' : 'Identify Player & Generate Code'}
            </button>
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            This is a simulated game page for the Game Redirect Login demo.
          </p>
        </div>
      </div>
    );
  }

  // --- QR Code mode ---
  if (initiateType === 'qr' && identified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Enter This Code</h1>
            <p className="text-gray-400 mt-1 text-sm">Type this code into the store on your desktop</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 space-y-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Player</p>
              <p className="text-lg font-semibold text-white mt-1">{identified.playerName}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">Your code</p>
              <p className="text-6xl font-mono font-bold text-green-400 tracking-[0.4em]">
                {identified.proofKey}
              </p>
            </div>

            <p className="text-gray-500 text-xs text-center">
              Enter this 4-digit code in the Appcharge store to complete authentication.
            </p>
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            Game Redirect Login — QR Code mode
          </p>
        </div>
      </div>
    );
  }

  // --- Auto Redirect mode ---
  if (initiateType === 'auto-redirect' && identified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-white mb-2">Redirecting to Store...</h1>
          <p className="text-gray-400 text-sm">
            Authenticated as <span className="text-white font-medium">{identified.playerName}</span>
          </p>
          <p className="text-gray-600 text-xs mt-6">
            Game Redirect Login — Auto Redirect mode
          </p>
        </div>
      </div>
    );
  }

  // --- In-App Redirect mode (default) ---
  if (identified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Player Authenticated</h1>
            <p className="text-gray-400 mt-1 text-sm">You've been identified — return to the store to continue</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Player identified</p>
              <p className="text-xl font-bold text-white mt-1">{identified.playerName}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">Your player code</p>
              <p className="text-4xl font-mono font-bold text-green-400 tracking-[0.3em]">
                {identified.proofKey}
              </p>
            </div>

            {storeLink ? (
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Store link</p>
                  <code className="block bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-300 break-all">
                    {storeLink}
                  </code>
                </div>
                <a
                  href={storeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold text-center"
                >
                  Open Store
                </a>
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center">
                No webstore URL configured. Set it in the dashboard Settings page.
              </p>
            )}
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            Game Redirect Login — In-App Redirect mode
          </p>
        </div>
      </div>
    );
  }

  return null;
}
