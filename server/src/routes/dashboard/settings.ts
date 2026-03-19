import { Router } from 'express';
import type { AppSettings } from 'shared/src/types.js';
import { config } from '../../config.js';
import { logOutboundCall } from '../../services/apiLogger.js';

const router = Router();

let settings: AppSettings = {
  appchargeApiKey: config.appchargeApiKey,
  appchargeWebstoreUrl: config.appchargeWebstoreUrl,
  appchargeApiBase: config.appchargeApiBase,
};

router.get('/', (_req, res) => {
  // Mask the API key for security
  res.json({
    ...settings,
    appchargeApiKey: settings.appchargeApiKey
      ? `${settings.appchargeApiKey.slice(0, 8)}...`
      : '',
  });
});

router.put('/', (req, res) => {
  const body = req.body as Partial<AppSettings>;
  if (body.appchargeApiKey !== undefined) settings.appchargeApiKey = body.appchargeApiKey;
  if (body.appchargeWebstoreUrl !== undefined) settings.appchargeWebstoreUrl = body.appchargeWebstoreUrl;
  if (body.appchargeApiBase !== undefined) settings.appchargeApiBase = body.appchargeApiBase;
  res.json({ updated: true });
});

// Refresh store (outbound call to Appcharge)
router.post('/refresh-store', async (_req, res) => {
  const apiKey = settings.appchargeApiKey || config.appchargePublisherToken;
  if (!apiKey) {
    res.status(400).json({ error: 'Appcharge API key not configured. Set it in the Settings page or via APPCHARGE_API_KEY env var.' });
    return;
  }

  try {
    const url = `${settings.appchargeApiBase}/store/v1/personalization/refresh-active-players`;
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publisher-token': apiKey,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));

    logOutboundCall({
      method: 'POST',
      url,
      category: 'refresh',
      requestBody: {},
      responseStatus: response.status,
      responseBody: data,
      durationMs: Date.now() - start,
    });

    res.json({ status: response.status, data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to call Appcharge API', details: String(err) });
  }
});

export { settings };
export default router;
