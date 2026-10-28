import { Router } from 'express';
import { getToolsPayload, setToolsPayload } from '../../state/toolsConfig.js';
import { toolsEventStore } from '../../index.js';
import { fetchAll } from '../../services/envDuplication.js';
import type { DupEnvType, DupEntityType } from 'shared/src/types.js';

const router = Router();

// GET / — return current payload + events
router.get('/', (_req, res) => {
  const payload = getToolsPayload();
  const events = toolsEventStore.getAll()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ payload, events });
});

// PUT / — set personalization payload string
router.put('/', (req, res) => {
  const { payload } = req.body as { payload: string };
  setToolsPayload(payload);
  res.json({ payload });
});

// DELETE /events — clear events
router.delete('/events', (_req, res) => {
  toolsEventStore.clear();
  res.json({ cleared: true });
});

// POST /fetch-appcharge — fetch offers, products, designs, badges, assets from Appcharge
router.post('/fetch-appcharge', async (req, res) => {
  const { envType, publisherToken } = req.body as { envType: DupEnvType; publisherToken: string };

  if (!envType || !publisherToken) {
    res.status(400).json({ error: 'envType and publisherToken are required' });
    return;
  }

  try {
    const entityTypes: DupEntityType[] = ['offer', 'product', 'offerDesign', 'badge', 'asset'];
    const [offers, products, offerDesigns, badges, assets] = await Promise.all(
      entityTypes.map((t) => fetchAll(envType, publisherToken, t))
    );

    res.json({ offers, products, offerDesigns, badges, assets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch Appcharge data' });
  }
});

// POST /refresh-store — trigger Appcharge personalization refresh using user-provided token
router.post('/refresh-store', async (req, res) => {
  const { envType, publisherToken } = req.body as { envType: string; publisherToken: string };

  if (!publisherToken) {
    res.status(400).json({ error: 'publisherToken is required' });
    return;
  }

  const BASE_URLS: Record<string, string> = {
    staging: 'https://ext-stg-api.appchargestore.com',
    sandbox: 'https://api-sandbox.appcharge.com',
    production: 'https://api.appcharge.com',
  };
  const base = BASE_URLS[envType] || BASE_URLS.sandbox;
  const url = `${base}/store/v1/personalization/refresh-active-players`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publisher-token': publisherToken,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.status(response.status).json({ error: (data as any)?.message || `HTTP ${response.status}`, details: data });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to refresh store' });
  }
});

export default router;
