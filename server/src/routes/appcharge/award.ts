import { Router } from 'express';
import type { AwardResponse } from 'shared/src/types.js';
import { v4 as uuid } from 'uuid';
import { playerStore } from '../../index.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const publisherPurchaseId = uuid().replace(/-/g, '').slice(0, 24);

  // Deduct soft currency from player balance if applicable
  const publisherPlayerId = (body.playerId as string) || (body.publisherPlayerId as string);
  const softCurrency = body.softCurrency as { publisherProductId?: string; quantity?: number } | undefined;

  if (publisherPlayerId && softCurrency?.publisherProductId && softCurrency.quantity) {
    const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);
    if (player && player.balances) {
      const balanceEntry = player.balances.find(
        (b) => b.publisherProductId === softCurrency.publisherProductId
      );
      if (balanceEntry) {
        balanceEntry.quantity = Math.max(0, balanceEntry.quantity - softCurrency.quantity);
        playerStore.update(player.id, { balances: player.balances });
      }
    }
  }

  const response: AwardResponse = { publisherPurchaseId };
  res.json(response);
});

export default router;
