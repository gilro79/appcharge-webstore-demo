// ─── Player (stored in dashboard) ───

export interface Player {
  id: string;
  publisherPlayerId: string;
  playerName: string;
  playerProfileImage: string;
  sessionMetadata: Record<string, string>;
  description?: string;
  tierId?: string;
  balances?: Record<string, number>;
}

// ─── Tiers ───

export type OfferType = 'Bundle' | 'SpecialOffer' | 'RollingOffer' | 'PopUp' | 'ProgressBar';

export interface TierOfferRow {
  publisherOfferId: string;
  offerType: OfferType;
  enabled: boolean;
  offerDesignId: string;
  priceInUsdCents?: number;
  products: Record<string, number>;
  /** Rolling offers only: number of sub-offer blocks from the API */
  subOfferCount?: number;
  /** Rolling offers only: per-block product quantities */
  subOfferProducts?: Record<string, number>[];
  /** Rolling offers only: per-block price in USD cents */
  subOfferPrices?: number[];
  badgeId?: string;
  productSale?: { type: 'percentage' | 'multiplier'; sale: number };
  priceDiscount?: { type: 'percentage'; discount: number };
}

export interface Tier {
  id: string;
  name: string;
  description?: string;
  productColumns: string[];
  offerDesigns: string[];
  offers: TierOfferRow[];
}

// ─── Auth (returned to Appcharge) ───

export interface AuthRequest {
  token?: string;
  publisherPlayerId?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  status: 'valid' | 'invalid';
  publisherPlayerId: string;
  playerName: string;
  playerProfileImage: string;
  sessionMetadata: Record<string, string>;
}

// ─── Personalization (returned to Appcharge) ───

export interface OfferProduct {
  publisherProductId: string;
  quantity: number | string;
  priority: string;
}

export interface OfferProductSequence {
  index: number;
  products: OfferProduct[];
  productSale?: { type: 'percentage' | 'multiplier'; sale: number };
  priceDiscount?: { type: 'percentage'; discount: number };
}

export interface PersonalizationOffer {
  publisherOfferId: string;
  productsSequence: OfferProductSequence[];
  offerDesignOverride?: { offerDesignId: string };
  dynamicOfferUi?: { offerDesignId: string };
  badges?: { publisherBadgeId: string }[];
}

export interface Balance {
  publisherProductId: string;
  quantity: number;
}

export interface PersonalizationConfig {
  id: string;
  playerId: string;
  version: number;
  status: string;
  sessionMetadata: Record<string, unknown>;
  offersOrder: string;
  sectionsOrder: string[];
  attributes: Record<string, unknown>;
  balances: Balance[];
  storeTheme: Record<string, string>;
  offers: PersonalizationOffer[];
}

export interface PersonalizationResponse {
  version: number;
  status: string;
  sessionMetadata: Record<string, unknown>;
  offersOrder: string;
  sectionsOrder: string[];
  attributes: Record<string, unknown>;
  balances: Balance[];
  storeTheme: Record<string, string>;
  offers: PersonalizationOffer[];
}

// ─── Award (returned to Appcharge) ───

export interface AwardRequest {
  orderId: string;
  playerId?: string;
  publisherPlayerId?: string;
  [key: string]: unknown;
}

export interface AwardResponse {
  publisherPurchaseId: string;
}

// ─── Events ───

export type EventCategory = 'webstore' | 'order';

export interface AppchargeEvent {
  id: string;
  type: string;
  category: EventCategory;
  playerId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── API Log ───

export type ApiLogCategory = 'auth' | 'personalization' | 'award' | 'event' | 'refresh' | 'sync';

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  method: string;
  path: string;
  category: ApiLogCategory;
  requestBody: unknown;
  responseStatus: number;
  responseBody: unknown;
  durationMs: number;
}

// ─── Settings ───

export interface AppEnvironment {
  name: string;
  publisherToken: string;
  webstoreUrl: string;
}

export interface AppSettings {
  appchargeApiKey: string;
  appchargeWebstoreUrl: string;
  appchargeApiBase: string;
  publisherToken: string;
  environments: AppEnvironment[];
  activeEnvName: string;
}
