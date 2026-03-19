import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { AppchargeEvent } from 'shared/src/types.js';
import { eventStore } from '../../index.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;

  const event: AppchargeEvent = {
    id: uuid(),
    type: (body.type as string) || 'unknown',
    playerId: (body.playerId as string) || (body.publisherPlayerId as string) || undefined,
    timestamp: new Date().toISOString(),
    data: body,
  };

  eventStore.create(event);
  res.json({ received: true });
});

export default router;
