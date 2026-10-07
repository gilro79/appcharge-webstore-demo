import { Router } from 'express';
import { toolsPersonalization } from '../../index.js';

const router = Router();

router.post('/', (_req, res) => {
  try {
    const parsed = JSON.parse(toolsPersonalization.payload);
    res.json(parsed);
  } catch {
    res.json({});
  }
});

export default router;
