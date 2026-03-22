import { Router } from 'express';
import type { AuthRequest, AuthResponse } from 'shared/src/types.js';
import { playerStore } from '../../index.js';

const router = Router();

router.post('/', (req, res) => {
  const { publisherPlayerId } = req.body as AuthRequest;

  if (!publisherPlayerId) {
    res.status(400).json({ error: 'Missing publisherPlayerId' });
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
