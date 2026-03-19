import { Router } from 'express';
import { sseManager } from '../../services/sseManager.js';
import { logStore } from '../../index.js';

const router = Router();

// Get all log entries
router.get('/', (_req, res) => {
  const logs = logStore.getAll().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  res.json(logs);
});

// SSE stream
router.get('/stream', (req, res) => {
  sseManager.addClient(res);
});

// Clear logs
router.delete('/', (_req, res) => {
  logStore.clear();
  res.json({ cleared: true });
});

export default router;
