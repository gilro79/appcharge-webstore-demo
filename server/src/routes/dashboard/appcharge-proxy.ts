import { Router } from 'express';
import { syncFromAppcharge, getCachedOfferUis } from '../../services/syncAppcharge.js';
import { logOutboundCall } from '../../services/apiLogger.js';
import { getPublisherToken, getApiBase } from './settings.js';

const router = Router();

// GET /api/dashboard/appcharge/offer-uis → return cached offer UIs (no external call)
router.get('/offer-uis', (_req, res) => {
  res.json(getCachedOfferUis());
});

// POST /api/dashboard/appcharge/products → proxy to Appcharge create product
router.post('/products', async (req, res) => {
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
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
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
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

// GET /api/dashboard/appcharge/offer-designs → proxy to Appcharge get offer designs
router.get('/offer-designs', async (_req, res) => {
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
  if (!appchargePublisherToken) {
    res.status(400).json({ error: 'Publisher token not configured' });
    return;
  }

  const url = `${appchargeApiBase}/components/v1/offer-design`;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'x-publisher-token': appchargePublisherToken },
    });

    const data = await response.json().catch(() => ([]));

    logOutboundCall({
      method: 'GET',
      url,
      category: 'sync',
      requestBody: null,
      responseStatus: response.status,
      responseBody: data,
      durationMs: Date.now() - start,
    });

    if (!response.ok) {
      res.status(response.status).json({ error: (data as any).message || 'Appcharge API error', details: data });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offer designs', details: String(err) });
  }
});

// GET /api/dashboard/appcharge/price-points → proxy to Appcharge get price points
router.get('/price-points', async (_req, res) => {
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
  if (!appchargePublisherToken) {
    res.status(400).json({ error: 'Publisher token not configured' });
    return;
  }

  const url = `${appchargeApiBase}/v1/price-points`;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'x-publisher-token': appchargePublisherToken },
    });

    const data = await response.json().catch(() => ({}));

    logOutboundCall({
      method: 'GET',
      url,
      category: 'sync',
      requestBody: null,
      responseStatus: response.status,
      responseBody: data,
      durationMs: Date.now() - start,
    });

    if (!response.ok) {
      res.status(response.status).json({ error: data.message || 'Appcharge API error', details: data });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price points', details: String(err) });
  }
});

// POST /api/dashboard/appcharge/price-points → proxy to Appcharge create price point
router.post('/price-points', async (req, res) => {
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
  if (!appchargePublisherToken) {
    res.status(400).json({ error: 'Publisher token not configured' });
    return;
  }

  const url = `${appchargeApiBase}/v1/price-points`;
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
      res.status(response.status).json({ error: data.message || 'Appcharge API error', details: data });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create price point', details: String(err) });
  }
});

export default router;
