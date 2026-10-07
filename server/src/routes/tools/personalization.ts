import { Router } from 'express';
import { toolsConfigStore } from '../../index.js';

const router = Router();

router.post('/', (_req, res) => {
  try {
    const payload = toolsConfigStore.getById('config')?.payload || '{}';
    const parsed = JSON.parse(payload);
    res.json(parsed);
  } catch {
    res.json({});
  }
});

export default router;
