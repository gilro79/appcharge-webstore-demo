import { Router } from 'express';
import { toolsConfigStore, toolsEventStore } from '../../index.js';

const router = Router();

// GET / — return current payload + events
router.get('/', (_req, res) => {
  const payload = toolsConfigStore.getById('config')?.payload || '{}';
  const events = toolsEventStore.getAll()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ payload, events });
});

// PUT / — set personalization payload string
router.put('/', (req, res) => {
  const { payload } = req.body as { payload: string };
  toolsConfigStore.update('config', { payload });
  res.json({ payload });
});

// DELETE /events — clear events
router.delete('/events', (_req, res) => {
  toolsEventStore.clear();
  res.json({ cleared: true });
});

export default router;
