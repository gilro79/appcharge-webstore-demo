import { Router } from 'express';
import { config } from '../../config.js';
import { syncFromAppcharge, getCachedOfferUis } from '../../services/syncAppcharge.js';
import { logOutboundCall } from '../../services/apiLogger.js';

const router = Router();

// GET /api/dashboard/appcharge/offer-uis → return cached offer UIs (no external call)
router.get('/offer-uis', (_req, res) => {
  res.json(getCachedOfferUis());
});

// POST /api/dashboard/appcharge/products → proxy to Appcharge create product
router.post('/products', async (req, res) => {
  const { appchargeApiBase, appchargePublisherToken } = config;
  if (!appchargePublisherToken) {
    res.status(400).json({ error: 'Publisher token not configured' });
    return;
  }

  const url = `${appchargeApiBase}/components/v1/product`;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publisher-token': appchargePublisherToken,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json().catch(() => ({}));

    logOutboundCall({
      method: 'POST',
      url,
      category: 'sync',
      requestBody: req.body,
      responseStatus: response.status,
      responseBody: data,
      durationMs: Date.now() - start,
    });

    if (!response.ok) {
      const msg = data.message || 'Appcharge API error';
      res.status(response.status).json({ error: msg, details: data });
      return;
    }

    // Re-sync so the new product appears in tiers
    await syncFromAppcharge();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product', details: String(err) });
  }
});

// POST /api/dashboard/appcharge/offers → proxy to Appcharge create offer
router.post('/offers', async (req, res) => {
  const { appchargeApiBase, appchargePublisherToken } = config;
  if (!appchargePublisherToken) {
    res.status(400).json({ error: 'Publisher token not configured' });
    return;
  }

  const url = `${appchargeApiBase}/v2/offer`;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publisher-token': appchargePublisherToken,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json().catch(() => ({}));

    logOutboundCall({
      method: 'POST',
      url,
      category: 'sync',
      requestBody: req.body,
      responseStatus: response.status,
      responseBody: data,
      durationMs: Date.now() - start,
    });

    if (!response.ok) {
      const msg = data.message || 'Appcharge API error';
      res.status(response.status).json({ error: msg, details: data });
      return;
    }

    // Re-sync so the new offer appears in tiers
    await syncFromAppcharge();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create offer', details: String(err) });
  }
});

export default router;
