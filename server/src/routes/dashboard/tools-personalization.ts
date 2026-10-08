import { Router } from 'express';
import { getToolsPayload, setToolsPayload } from '../../state/toolsConfig.js';
import { toolsEventStore } from '../../index.js';

const router = Router();

// GET / — return current payload + events
router.get('/', (_req, res) => {
  const payload = getToolsPayload();
  const events = toolsEventStore.getAll()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ payload, events });
});

// PUT / — set personalization payload string
router.put('/', (req, res) => {
  const { payload } = req.body as { payload: string };
  setToolsPayload(payload);
  res.json({ payload });
});

// DELETE /events — clear events
router.delete('/events', (_req, res) => {
  toolsEventStore.clear();
  res.json({ cleared: true });
});

export default router;
