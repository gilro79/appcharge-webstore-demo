import { Router } from 'express';
import type { AwardResponse } from 'shared/src/types.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.post('/', (req, res) => {
  const publisherPurchaseId = uuid().replace(/-/g, '').slice(0, 24);

  const response: AwardResponse = { publisherPurchaseId };
  res.json(response);
});

export default router;
