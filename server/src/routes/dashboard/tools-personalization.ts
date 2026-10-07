import { Router } from 'express';
import { toolsPersonalization, toolsEventStore } from '../../index.js';

const router = Router();

// GET / — return current payload + events
router.get('/', (_req, res) => {
  const events = toolsEventStore.getAll()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ payload: toolsPersonalization.payload, events });
});

// PUT / — set personalization payload string
router.put('/', (req, res) => {
  const { payload } = req.body as { payload: string };
  toolsPersonalization.payload = payload;
  res.json({ payload: toolsPersonalization.payload });
});

// DELETE /events — clear events
router.delete('/events', (_req, res) => {
  toolsEventStore.clear();
  res.json({ cleared: true });
});

export default router;
