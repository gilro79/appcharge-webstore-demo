import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { GameAuthInitRequest, GameAuthInitResponse } from 'shared/src/types.js';
import { playerStore } from '../../index.js';
import { gameAuthSessions } from '../dashboard/game-auth.js';
import { settings } from '../dashboard/settings.js';

const router = Router();

/**
 * POST /api/appcharge/game-auth
 * Initiate Game Auth Callback — called by Appcharge.
 * Receives { deviceType, date }, returns { deeplink, accessToken }.
 */
router.post('/', (req, res) => {
  const body = req.body as GameAuthInitRequest;
  const accessToken = uuid();

  // Store the session so the auth endpoint can validate later
  gameAuthSessions.set(accessToken, { publisherPlayerId: '' });

  // Derive deeplink base URL from the incoming request (works behind Render proxy)
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const deeplink = `${baseUrl}/game-redirect?accessToken=${accessToken}`;

  const response: GameAuthInitResponse = { deeplink, accessToken, desktopAutoRedirect: true };
  res.json(response);
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

  // Store the player mapping and generate a 6-digit proofKey
  session.publisherPlayerId = publisherPlayerId;
  session.proofKey = String(Math.floor(100000 + Math.random() * 900000));

  const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);

  res.json({
    proofKey: session.proofKey,
    playerName: player?.playerName || 'Unknown Player',
    webstoreUrl: settings.appchargeWebstoreUrl,
  });
});

export default router;
