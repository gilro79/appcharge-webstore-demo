import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { playerStore } from '../../index.js';

const router = Router();

type InitiateType = 'qr' | 'auto-redirect' | 'in-app';

// In-memory map: accessToken -> { publisherPlayerId, proofKey?, initiateType, webstoreUrl? }
const gameAuthSessions = new Map<string, {
  publisherPlayerId: string;
  proofKey?: string;
  initiateType: InitiateType;
  webstoreUrl?: string;
}>();

// Active settings selected from the dashboard — used by the Appcharge game-auth endpoint
let _activeInitiateType: InitiateType = 'qr';
let _activePublisherPlayerId = '';
let _activeWebstoreUrl = '';
function getActiveInitiateType(): InitiateType { return _activeInitiateType; }
function getActivePublisherPlayerId(): string { return _activePublisherPlayerId; }
function getActiveWebstoreUrl(): string { return _activeWebstoreUrl; }

/**
 * POST /api/dashboard/game-auth/simulate
 * Simulates the Initiate Game Auth Callback flow.
 * Receives { publisherPlayerId }, generates an accessToken, stores the mapping.
 */
router.post('/simulate', (req, res) => {
  const { publisherPlayerId, initiateType = 'in-app', webstoreUrl } = req.body as {
    publisherPlayerId: string;
    initiateType?: InitiateType;
    webstoreUrl?: string;
  };

  if (!publisherPlayerId) {
    res.status(400).json({ error: 'Missing publisherPlayerId' });
    return;
  }

  const accessToken = uuid();
  _activeInitiateType = initiateType;
  _activePublisherPlayerId = publisherPlayerId;
  if (webstoreUrl) _activeWebstoreUrl = webstoreUrl;
  gameAuthSessions.set(accessToken, { publisherPlayerId, initiateType, webstoreUrl });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const deepLink = `${baseUrl}/game-redirect?accessToken=${accessToken}`;

  const desktopAutoRedirect = initiateType !== 'qr';

  const simulatedRequest = {
    deviceType: 'desktop',
    date: new Date().toISOString(),
  };

  const simulatedResponse = {
    deepLink,
    accessToken,
    desktopAutoRedirect,
  };

  res.json({
    request: simulatedRequest,
    response: simulatedResponse,
    accessToken,
    deepLink,
  });
});

/**
 * GET /api/dashboard/game-auth/session/:accessToken
 * Returns the player info for a game auth session and generates a proofKey if needed.
 */
router.get('/session/:accessToken', (req, res) => {
  const { accessToken } = req.params;
  const session = gameAuthSessions.get(accessToken);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Generate a 6-digit proofKey if not yet generated
  if (!session.proofKey) {
    session.proofKey = String(Math.floor(100000 + Math.random() * 900000));
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === session.publisherPlayerId);

  res.json({
    publisherPlayerId: session.publisherPlayerId,
    playerName: player?.playerName || 'Unknown Player',
    proofKey: session.proofKey,
  });
});

/**
 * GET /api/dashboard/game-auth/resolve
 * Looks up the player by accessToken + proofKey match.
 * Query: ?proofKey=...&token=...
 */
router.get('/resolve', (req, res) => {
  const { proofKey, token } = req.query as { proofKey?: string; token?: string };

  if (!proofKey || !token) {
    res.status(400).json({ error: 'Missing proofKey or token' });
    return;
  }

  const session = gameAuthSessions.get(token);

  if (!session || session.proofKey !== proofKey) {
    res.json({
      status: 'invalid',
      error: 'Invalid proofKey or token',
    });
    return;
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === session.publisherPlayerId);

  res.json({
    status: 'valid',
    publisherPlayerId: session.publisherPlayerId,
    playerName: player?.playerName || 'Unknown Player',
    playerProfileImage: player?.playerProfileImage || '',
    sessionMetadata: player?.sessionMetadata || {},
  });
});

// Export the sessions map and active initiate type so the Appcharge endpoint can access them
export { gameAuthSessions, getActiveInitiateType, getActivePublisherPlayerId, getActiveWebstoreUrl };
export default router;
