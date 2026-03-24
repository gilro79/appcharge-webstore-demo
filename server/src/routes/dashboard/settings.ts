import { Router } from 'express';
import type { AppSettings, AppEnvironment } from 'shared/src/types.js';
import { config } from '../../config.js';
import { logOutboundCall } from '../../services/apiLogger.js';

const router = Router();

let settings: AppSettings = {
  appchargeApiKey: config.appchargeApiKey,
  appchargeWebstoreUrl: config.appchargeWebstoreUrl,
  appchargeApiBase: config.appchargeApiBase,
  publisherToken: config.appchargePublisherToken,
  environments: [
    {
      name: 'Default',
      publisherToken: config.appchargePublisherToken,
      webstoreUrl: config.appchargeWebstoreUrl,
    },
  ],
  activeEnvName: 'Default',
};

/** Returns the currently active publisher token (used by proxy routes and sync). */
export function getPublisherToken(): string {
  return settings.publisherToken;
}

/** Returns the API base URL. */
export function getApiBase(): string {
  return settings.appchargeApiBase;
}

router.get('/', (_req, res) => {
  res.json({
    ...settings,
    // Mask tokens for display
    appchargeApiKey: settings.appchargeApiKey
      ? `${settings.appchargeApiKey.slice(0, 8)}...`
      : '',
    publisherToken: settings.publisherToken
      ? `${settings.publisherToken.slice(0, 8)}...`
      : '',
    environments: settings.environments.map((e) => ({
      ...e,
      publisherToken: e.publisherToken
        ? `${e.publisherToken.slice(0, 8)}...`
        : '',
    })),
  });
});

router.put('/', (req, res) => {
  const body = req.body as Partial<AppSettings>;
  if (body.appchargeApiKey !== undefined) settings.appchargeApiKey = body.appchargeApiKey;
  if (body.appchargeWebstoreUrl !== undefined) settings.appchargeWebstoreUrl = body.appchargeWebstoreUrl;
  if (body.appchargeApiBase !== undefined) settings.appchargeApiBase = body.appchargeApiBase;
  if (body.publisherToken !== undefined) settings.publisherToken = body.publisherToken;
  if (body.environments !== undefined) settings.environments = body.environments;
  if (body.activeEnvName !== undefined) settings.activeEnvName = body.activeEnvName;
  res.json({ updated: true });
});

// Switch active environment
router.post('/switch-env', (req, res) => {
  const { name } = req.body as { name: string };
  const env = settings.environments.find((e) => e.name === name);
  if (!env) {
    res.status(404).json({ error: `Environment "${name}" not found` });
    return;
  }
  settings.activeEnvName = name;
  settings.publisherToken = env.publisherToken;
  settings.appchargeWebstoreUrl = env.webstoreUrl;
  res.json({ switched: name });
});

// Save a new environment (or update existing)
router.post('/environments', (req, res) => {
  const env = req.body as AppEnvironment;
  if (!env.name) {
    res.status(400).json({ error: 'Environment name is required' });
    return;
  }
  const idx = settings.environments.findIndex((e) => e.name === env.name);
  if (idx >= 0) {
    settings.environments[idx] = env;
  } else {
    settings.environments.push(env);
  }
  res.json({ saved: env.name, environments: settings.environments.map((e) => ({ ...e, publisherToken: `${e.publisherToken.slice(0, 8)}...` })) });
});

// Delete an environment
router.delete('/environments/:name', (req, res) => {
  const name = req.params.name;
  if (name === settings.activeEnvName) {
    res.status(400).json({ error: 'Cannot delete the active environment' });
    return;
  }
  settings.environments = settings.environments.filter((e) => e.name !== name);
  res.json({ deleted: name });
});

// Refresh store (outbound call to Appcharge)
router.post('/refresh-store', async (_req, res) => {
  const token = settings.publisherToken || settings.appchargeApiKey;
  if (!token) {
    res.status(400).json({ error: 'No publisher token configured. Set it in Settings or add an environment.' });
    return;
  }

  try {
    const url = `${settings.appchargeApiBase}/store/v1/personalization/refresh-active-players`;
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publisher-token': token,
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
