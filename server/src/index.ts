import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { Store } from './store/Store.js';
import { requestLogger } from './middleware/requestLogger.js';
import { seedPlayers, seedTiers } from './services/seedData.js';
import type { Player, Tier, AppchargeEvent, ApiLogEntry } from 'shared/src/types.js';

// Routes
import authRoutes from './routes/appcharge/auth.js';
import personalizationRoutes from './routes/appcharge/personalization.js';
import awardRoutes from './routes/appcharge/award.js';
import eventRoutes from './routes/appcharge/events.js';
import dashboardPlayerRoutes from './routes/dashboard/players.js';
import dashboardOfferRoutes from './routes/dashboard/offers.js';
import dashboardTierRoutes from './routes/dashboard/tiers.js';
import dashboardEventRoutes from './routes/dashboard/events.js';
import dashboardLogRoutes from './routes/dashboard/logs.js';
import dashboardSettingsRoutes from './routes/dashboard/settings.js';
import dashboardAppchargeProxyRoutes from './routes/dashboard/appcharge-proxy.js';

// ─── Stores (exported for route handlers) ───
// Declared with `let` so they can be reassigned to MongoStore instances.
export let playerStore: Store<Player> | import('./store/MongoStore.js').MongoStore<Player>;
export let tierStore: Store<Tier> | import('./store/MongoStore.js').MongoStore<Tier>;
export let eventStore: Store<AppchargeEvent> | import('./store/MongoStore.js').MongoStore<AppchargeEvent>;
export let logStore: Store<ApiLogEntry> | import('./store/MongoStore.js').MongoStore<ApiLogEntry>;

async function bootstrap() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    // ─── MongoDB mode ───
    const { connectMongo, MongoStore } = await import('./store/MongoStore.js');
    await connectMongo(mongoUri);

    const ps = new MongoStore<Player>('players');
    const ts = new MongoStore<Tier>('tiers');
    const es = new MongoStore<AppchargeEvent>('events');
    const ls = new MongoStore<ApiLogEntry>('logs');

    // Load existing data from MongoDB into memory
    await Promise.all([ps.init(), ts.init(), es.init(), ls.init()]);

    playerStore = ps;
    tierStore = ts;
    eventStore = es;
    logStore = ls;
  } else {
    // ─── JSON file mode (local dev) ───
    playerStore = new Store<Player>('players', true);
    tierStore = new Store<Tier>('tiers', true);
    eventStore = new Store<AppchargeEvent>('events');
    logStore = new Store<ApiLogEntry>('logs');
  }

  // Seed demo data
  playerStore.seed(seedPlayers);
  tierStore.seed(seedTiers);

  // ─── Express App ───
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Appcharge webhook endpoints (with request logging)
  app.use('/api/appcharge/auth', requestLogger, authRoutes);
  app.use('/api/appcharge/personalization', requestLogger, personalizationRoutes);
  app.use('/api/appcharge/award', requestLogger, awardRoutes);
  app.use('/api/appcharge/events', requestLogger, eventRoutes);

  // Dashboard internal API (with request logging on refresh-store only)
  app.use('/api/dashboard/players', dashboardPlayerRoutes);
  app.use('/api/dashboard/personalization', dashboardOfferRoutes);
  app.use('/api/dashboard/tiers', dashboardTierRoutes);
  app.use('/api/dashboard/events', dashboardEventRoutes);
  app.use('/api/dashboard/logs', dashboardLogRoutes);
  app.use('/api/dashboard/settings', dashboardSettingsRoutes);
  app.use('/api/dashboard/appcharge', dashboardAppchargeProxyRoutes);

  // ─── Serve React client in production ───
  if (config.nodeEnv === 'production') {
    const clientDist = path.join(process.cwd(), 'client/dist');
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
