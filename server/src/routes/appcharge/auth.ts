import { Router } from 'express';
import type { AuthRequest, AuthResponse } from 'shared/src/types.js';
import { playerStore } from '../../index.js';
import { gameAuthSessions } from '../dashboard/game-auth.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as AuthRequest;

  // Game Redirect Login: if request has a proofKey, validate against the game auth session
  if (body.proofKey && body.token) {
    const session = gameAuthSessions.get(body.token as string);
    if (!session || session.proofKey !== body.proofKey) {
      res.status(401).json({ status: 'invalid', error: 'Invalid proofKey or token' });
      return;
    }

    const player = playerStore.findBy((p) => p.publisherPlayerId === session.publisherPlayerId);
    const response: AuthResponse = {
      status: 'valid',
      publisherPlayerId: session.publisherPlayerId,
      playerName: player?.playerName || 'Guest',
      playerProfileImage: player?.playerProfileImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
      sessionMetadata: player?.sessionMetadata || {},
      token: body.token as string,
    };
    res.json(response);
    return;
  }

  // Standard auth: Appcharge sends the player ID in the "token" field
  const publisherPlayerId = body.token || body.publisherPlayerId;

  if (!publisherPlayerId) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);

  // Known player — return their profile
  if (player) {
    const response: AuthResponse = {
      status: 'valid',
      publisherPlayerId: player.publisherPlayerId,
      playerName: player.playerName,
      playerProfileImage: player.playerProfileImage,
      sessionMetadata: player.sessionMetadata,
    };
    res.json(response);
    return;
  }

  // Unknown player — return a guest profile
  const guestResponse: AuthResponse = {
    status: 'valid',
    publisherPlayerId,
    playerName: 'Guest',
    playerProfileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
    sessionMetadata: { guest: 'true' },
  };
  res.json(guestResponse);
});

export default router;
