import { Router } from 'express';
import { eventStore } from '../../index.js';

const router = Router();

// List all events
router.get('/', (_req, res) => {
  const events = eventStore.getAll().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  res.json(events);
});

// Clear events
router.delete('/', (_req, res) => {
  eventStore.clear();
  res.json({ cleared: true });
});

export default router;
