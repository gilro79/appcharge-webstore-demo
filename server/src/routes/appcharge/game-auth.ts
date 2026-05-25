import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { GameAuthInitRequest, GameAuthInitResponse } from 'shared/src/types.js';
import { config } from '../../config.js';

const router = Router();

/**
 * POST /api/appcharge/game-auth
 * Initiate Game Auth Callback — called by Appcharge.
 * Receives { deviceType, date }, returns { deeplink, accessToken }.
 */
router.post('/', (req, res) => {
  const body = req.body as GameAuthInitRequest;
  const accessToken = uuid();

  const baseUrl = config.clientUrl;
  const deeplink = `${baseUrl}/game-redirect?accessToken=${accessToken}`;

  const response: GameAuthInitResponse = { deeplink, accessToken };
  res.json(response);
});

export default router;
