import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { AppchargeEvent, EventCategory } from 'shared/src/types.js';
import { eventStore } from '../../index.js';

const router = Router();

const MAX_EVENTS_PER_CATEGORY = 20;

function categorizeEvent(type: string): EventCategory {
  // Appcharge event types are prefixed: "order.*" or "webstore.*"
  const lower = type.toLowerCase();
  if (lower.startsWith('order.') || lower.startsWith('order_')) return 'order';
  // Also catch payment-related keywords as order events
  if (['charge', 'purchase', 'payment', 'refund', 'chargeback', 'transaction'].some((kw) => lower.includes(kw))) return 'order';
  return 'webstore';
}

function pruneCategory(category: EventCategory): void {
  const all = eventStore.getAll();
  const inCategory = all
    .filter((e) => e.category === category)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Delete oldest events beyond the cap
  const toDelete = inCategory.slice(MAX_EVENTS_PER_CATEGORY);
  for (const e of toDelete) {
    eventStore.delete(e.id);
  }
}

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const type = (body.type as string) || 'unknown';
  const category = categorizeEvent(type);

  const event: AppchargeEvent = {
    id: uuid(),
    type,
    category,
    playerId: (body.playerId as string) || (body.publisherPlayerId as string) || undefined,
    timestamp: new Date().toISOString(),
    data: body,
  };

  eventStore.create(event);

  // Prune old events in this category to keep DB small
  pruneCategory(category);

  res.json({ received: true });
});

export default router;
