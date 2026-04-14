import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { Store } from './store/Store.js';
import { requestLogger } from './middleware/requestLogger.js';
import { sessionMiddleware } from './middleware/session.js';
import { requireAuth } from './middleware/requireAuth.js';
import { seedPlayers, seedTiers } from './services/seedData.js';
import type { Player, Tier, AppchargeEvent, ApiLogEntry, AppSettings } from 'shared/src/types.js';

// Routes
import authRoutes from './routes/appcharge/auth.js';
import personalizationRoutes from './routes/appcharge/personalization.js';
import awardRoutes from './routes/appcharge/award.js';
import eventRoutes from './routes/appcharge/events.js';
import googleAuthRoutes from './routes/auth.js';
import dashboardPlayerRoutes from './routes/dashboard/players.js';
import dashboardOfferRoutes from './routes/dashboard/offers.js';
import dashboardTierRoutes from './routes/dashboard/tiers.js';
import dashboardEventRoutes from './routes/dashboard/events.js';
import dashboardLogRoutes from './routes/dashboard/logs.js';
import dashboardSettingsRoutes from './routes/dashboard/settings.js';
import dashboardAppchargeProxyRoutes from './routes/dashboard/appcharge-proxy.js';

// ─── Stores (exported for route handlers) ───
export const playerStore = new Store<Player>('players');
export const tierStore = new Store<Tier>('tiers');
export const eventStore = new Store<AppchargeEvent>('events');
export const logStore = new Store<ApiLogEntry>('logs');
export const settingsStore = new Store<AppSettings>('settings');

async function bootstrap() {

  // Load persisted settings (or seed defaults)
  const { initSettings } = await import('./routes/dashboard/settings.js');
  initSettings();

  // Seed demo data
  playerStore.seed(seedPlayers);
  tierStore.seed(seedTiers);

  // ─── Express App ───
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(sessionMiddleware);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes (unprotected — handles login/logout/callback)
  app.use('/api/auth', googleAuthRoutes);

  // Appcharge webhook endpoints (unprotected — server-to-server, with request logging)
  app.use('/api/appcharge/auth', requestLogger, authRoutes);
  app.use('/api/appcharge/personalization', requestLogger, personalizationRoutes);
  app.use('/api/appcharge/award', requestLogger, awardRoutes);
  app.use('/api/appcharge/events', requestLogger, eventRoutes);

  // Dashboard internal API (protected — requires authenticated session)
  app.use('/api/dashboard/players', requireAuth, dashboardPlayerRoutes);
  app.use('/api/dashboard/personalization', requireAuth, dashboardOfferRoutes);
  app.use('/api/dashboard/tiers', requireAuth, dashboardTierRoutes);
  app.use('/api/dashboard/events', requireAuth, dashboardEventRoutes);
  app.use('/api/dashboard/logs', requireAuth, dashboardLogRoutes);
  app.use('/api/dashboard/settings', requireAuth, dashboardSettingsRoutes);
  app.use('/api/dashboard/appcharge', requireAuth, dashboardAppchargeProxyRoutes);

  // ─── Serve React client in production ───
  if (config.nodeEnv === 'production') {
    const clientDist = path.join(process.cwd(), '..', 'client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // ─── Start ───
  app.listen(config.port, async () => {
    console.log(`Server running on http://localhost:${config.port} [${config.nodeEnv}]`);

    // Sync offers & products from Appcharge on startup
    const { syncFromAppcharge } = await import('./services/syncAppcharge.js');
    await syncFromAppcharge();
  });
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
