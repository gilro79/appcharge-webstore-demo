import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { Player } from 'shared/src/types.js';
import { playerStore } from '../../index.js';

const router = Router();

// List all players
router.get('/', (_req, res) => {
  res.json(playerStore.getAll());
});

// Get single player
router.get('/:id', (req, res) => {
  const player = playerStore.getById(req.params.id);
  if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
  res.json(player);
});

// Create player
router.post('/', (req, res) => {
  const player: Player = { id: uuid(), isActive: false, ...req.body };
  playerStore.create(player);
  res.status(201).json(player);
});

// Update player
router.put('/:id', (req, res) => {
  const updated = playerStore.update(req.params.id, req.body);
  if (!updated) { res.status(404).json({ error: 'Player not found' }); return; }
  res.json(updated);
});

// Delete player
router.delete('/:id', (req, res) => {
  const deleted = playerStore.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Player not found' }); return; }
  res.json({ deleted: true });
});

// Set active player
router.post('/:id/activate', (req, res) => {
  // Deactivate all
  playerStore.getAll().forEach((p) => playerStore.update(p.id, { isActive: false }));
  // Activate selected
  const updated = playerStore.update(req.params.id, { isActive: true });
  if (!updated) { res.status(404).json({ error: 'Player not found' }); return; }
  res.json(updated);
});

export default router;
