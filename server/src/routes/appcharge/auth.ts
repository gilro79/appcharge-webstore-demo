import { Router } from 'express';
import type { AuthRequest, AuthResponse } from 'shared/src/types.js';
import { playerStore } from '../../index.js';
import { gameAuthSessions } from '../dashboard/game-auth.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as AuthRequest;

  console.log('[auth] called with body:', JSON.stringify(body));

  // Game Redirect Login (OTP): Appcharge sends { otp: { playerCode, accessToken } }
  if (body.otp) {
    const { playerCode, accessToken } = body.otp;
    console.log('[auth] OTP mode — playerCode:', playerCode, 'accessToken:', accessToken);

    const session = gameAuthSessions.get(accessToken);
    console.log('[auth] session lookup:', session ? { publisherPlayerId: session.publisherPlayerId, proofKey: session.proofKey, initiateType: session.initiateType } : 'NOT FOUND');

    if (!session || session.proofKey !== playerCode) {
      console.log('[auth] OTP MISMATCH — session proofKey:', session?.proofKey, 'vs playerCode:', playerCode);
      res.status(401).json({ status: 'invalid', error: 'Invalid playerCode or accessToken' });
      return;
    }

    const player = playerStore.findBy((p) => p.publisherPlayerId === session.publisherPlayerId);
    console.log('[auth] OTP SUCCESS — player:', player?.playerName);

    const response: AuthResponse = {
      status: 'valid',
      publisherPlayerId: session.publisherPlayerId,
      playerName: player?.playerName || 'Guest',
      playerProfileImage: player?.playerProfileImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
      sessionMetadata: player?.sessionMetadata || {},
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
