import { Router } from 'express';
import { getToolsPayload } from '../../state/toolsConfig.js';

const router = Router();

router.post('/', (_req, res) => {
  try {
    const payload = getToolsPayload();
    const parsed = JSON.parse(payload);
    res.json(parsed);
  } catch {
    res.json({});
  }
});

export default router;
