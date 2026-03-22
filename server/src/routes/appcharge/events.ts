import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { AppchargeEvent, EventCategory } from 'shared/src/types.js';
import { eventStore } from '../../index.js';

const router = Router();

const PAYMENT_KEYWORDS = [
  'charge', 'purchase', 'payment', 'order', 'refund',
  'chargeback', 'transaction', 'receipt', 'billing', 'paid',
];

function categorizeEvent(type: string): EventCategory {
  const lower = type.toLowerCase();
  if (PAYMENT_KEYWORDS.some((kw) => lower.includes(kw))) return 'payment';
  return 'webstore';
}

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const type = (body.type as string) || 'unknown';

  const event: AppchargeEvent = {
    id: uuid(),
    type,
    category: categorizeEvent(type),
    playerId: (body.playerId as string) || (body.publisherPlayerId as string) || undefined,
    timestamp: new Date().toISOString(),
    data: body,
  };

  eventStore.create(event);
  res.json({ received: true });
});

export default router;
