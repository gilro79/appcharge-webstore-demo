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

  if (!player) {
    res.json({ status: 'invalid' } as Partial<AuthResponse>);
    return;
  }

  const response: AuthResponse = {
    status: 'valid',
    publisherPlayerId: player.publisherPlayerId,
    playerName: player.playerName,
    playerProfileImage: player.playerProfileImage,
    sessionMetadata: player.sessionMetadata,
  };

  res.json(response);
});

export default router;
