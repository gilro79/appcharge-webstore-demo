import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { Tier } from 'shared/src/types.js';
import { tierStore } from '../../index.js';
import { syncFromAppcharge } from '../../services/syncAppcharge.js';

const router = Router();

// List all tiers
router.get('/', (_req, res) => {
  res.json(tierStore.getAll());
});

// Get single tier
router.get('/:id', (req, res) => {
  const tier = tierStore.getById(req.params.id);
  if (!tier) { res.status(404).json({ error: 'Tier not found' }); return; }
  res.json(tier);
});

// Create tier
router.post('/', (req, res) => {
  const tier: Tier = {
    id: uuid(),
    name: '',
    productColumns: [],
    offerDesigns: ['Default'],
    offers: [],
    ...req.body,
  };
  tierStore.create(tier);
  res.status(201).json(tier);
});

// Update tier
router.put('/:id', (req, res) => {
  const updated = tierStore.update(req.params.id, req.body);
  if (!updated) { res.status(404).json({ error: 'Tier not found' }); return; }
  res.json(updated);
});

// Re-sync offers & products from Appcharge (preserves existing tier settings)
router.post('/sync', async (_req, res) => {
  try {
    await syncFromAppcharge();
    res.json(tierStore.getAll());
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', details: String(err) });
  }
});

// Delete tier
router.delete('/:id', (req, res) => {
  const deleted = tierStore.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Tier not found' }); return; }
  res.json({ deleted: true });
});

export default router;
