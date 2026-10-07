import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { toolsEventStore } from '../../index.js';

const router = Router();

const MAX_EVENTS = 50;

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;

  toolsEventStore.create({
    id: uuid(),
    timestamp: new Date().toISOString(),
    body,
  });

  // Prune to last MAX_EVENTS
  const all = toolsEventStore.getAll()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const toDelete = all.slice(MAX_EVENTS);
  for (const e of toDelete) {
    toolsEventStore.delete(e.id);
  }

  res.json({ received: true });
});

export default router;
