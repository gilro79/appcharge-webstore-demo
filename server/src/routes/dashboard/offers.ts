import { Router } from 'express';

const router = Router();

// Legacy personalization config routes — replaced by /api/dashboard/tiers
router.get('/player/:playerId', (_req, res) => {
  res.status(410).json({ error: 'Personalization configs replaced by tiers. Use /api/dashboard/tiers instead.' });
});

router.get('/:id', (_req, res) => {
  res.status(410).json({ error: 'Personalization configs replaced by tiers. Use /api/dashboard/tiers instead.' });
});

router.put('/:id', (_req, res) => {
  res.status(410).json({ error: 'Personalization configs replaced by tiers. Use /api/dashboard/tiers instead.' });
});

router.put('/player/:playerId', (_req, res) => {
  res.status(410).json({ error: 'Personalization configs replaced by tiers. Use /api/dashboard/tiers instead.' });
});

export default router;
