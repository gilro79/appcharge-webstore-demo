import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { GameAuthInitRequest, GameAuthInitResponse } from 'shared/src/types.js';
import { playerStore } from '../../index.js';
import { gameAuthSessions, getActiveInitiateType, getActivePublisherPlayerId } from '../dashboard/game-auth.js';
import { settings } from '../dashboard/settings.js';

const router = Router();

/**
 * POST /api/appcharge/game-auth
 * Initiate Game Auth Callback — called by Appcharge.
 * Receives { deviceType, date }, returns { deepLink, accessToken }.
 */
router.post('/', (req, res) => {
  const body = req.body as GameAuthInitRequest;
  // Use the initiate type from the request if provided, otherwise use the
  // active type selected from the dashboard (defaults to 'qr')
  const initiateType = body.initiateType || getActiveInitiateType();
  const accessToken = uuid();

  // Store the session — use the player selected from the dashboard so the
  // game-redirect page can auto-identify without showing a picker
  gameAuthSessions.set(accessToken, { publisherPlayerId: getActivePublisherPlayerId(), initiateType });

  // Derive deepLink base URL from the incoming request (works behind Render proxy)
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const deepLink = `${baseUrl}/game-redirect?accessToken=${accessToken}`;

  const desktopAutoRedirect = initiateType !== 'qr';

  const response: GameAuthInitResponse = { deepLink, accessToken, token: accessToken, desktopAutoRedirect };
  res.json(response);
});

/**
 * GET /api/appcharge/game-auth/session-info/:accessToken
 * Returns { initiateType, publisherPlayerId, playerName } so the game-redirect page
 * knows how to behave and who the player is. Unprotected.
 */
router.get('/session-info/:accessToken', (req, res) => {
  const { accessToken } = req.params;
  const session = gameAuthSessions.get(accessToken);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === session.publisherPlayerId);

  res.json({
    initiateType: session.initiateType,
    publisherPlayerId: session.publisherPlayerId,
    playerName: player?.playerName || 'Unknown Player',
  });
});

/**
 * GET /api/appcharge/game-auth/players
 * Returns list of players (unprotected — used by the game-redirect page).
 */
router.get('/players', (_req, res) => {
  const players = playerStore.getAll().map((p) => ({
    publisherPlayerId: p.publisherPlayerId,
    playerName: p.playerName,
    playerProfileImage: p.playerProfileImage,
  }));
  res.json(players);
});

/**
 * POST /api/appcharge/game-auth/identify
 * The "game" identifies the player and generates a proofKey.
 * Receives { accessToken, publisherPlayerId }.
 * Returns { proofKey, playerName, webstoreUrl }.
 */
router.post('/identify', (req, res) => {
  const { accessToken, publisherPlayerId } = req.body as {
    accessToken: string;
    publisherPlayerId: string;
  };

  if (!accessToken || !publisherPlayerId) {
    res.status(400).json({ error: 'Missing accessToken or publisherPlayerId' });
    return;
  }

  const session = gameAuthSessions.get(accessToken);
  if (!session) {
    res.status(404).json({ error: 'Session not found — accessToken is invalid or expired' });
    return;
  }

  // Store the player mapping and generate proofKey
  // 4-digit for QR mode, 6-digit for auto-redirect and in-app
  session.publisherPlayerId = publisherPlayerId;
  session.proofKey = session.initiateType === 'qr'
    ? String(Math.floor(1000 + Math.random() * 9000))
    : String(Math.floor(100000 + Math.random() * 900000));

  const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);

  res.json({
    proofKey: session.proofKey,
    playerName: player?.playerName || 'Unknown Player',
    webstoreUrl: settings.appchargeWebstoreUrl,
    initiateType: session.initiateType,
  });
});

export default router;
