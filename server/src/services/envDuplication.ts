import type { DupEnvType, DupEntityType, DupApiLogger } from 'shared/src/types.js';

// ─── Config ───

const BASE_URLS: Record<DupEnvType, string> = {
  staging: 'https://ext-stg-api.appchargestore.com',
  sandbox: 'https://api-sandbox.appcharge.com',
  production: 'https://api.appcharge.com',
};

function getBaseUrl(envType: DupEnvType): string {
  return BASE_URLS[envType];
}

const ENTITY_ENDPOINTS = {
  product: '/components/v1/product',
  offerDesign: '/components/v1/offer-design',
  badge: '/components/v1/badge',
  offer: '/v2/offer',
  pricePoint: '/v1/price-points',
  asset: '/components/v1/asset',
} as const;

// ─── Helpers ───

const noopLogger: DupApiLogger = () => {};

function logApi(
  logger: DupApiLogger,
  method: string,
  url: string,
  status: number,
  requestBody?: unknown,
  responseBody?: unknown
) {
  logger({
    method,
    url,
    requestBody,
    status,
    responseBody,
    timestamp: new Date().toISOString(),
  });
}

// ─── Fetch ───

export async function fetchAll(
  envType: DupEnvType,
  publisherToken: string,
  entityType: DupEntityType,
  logger: DupApiLogger = noopLogger
): Promise<Record<string, unknown>[]> {
  const base = getBaseUrl(envType);
  const endpoint = ENTITY_ENDPOINTS[entityType];

  if (entityType === 'offer') {
    return fetchOffersPaginated(base, endpoint, publisherToken, logger);
  }

  const url = `${base}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'x-publisher-token': publisherToken },
  });

  const data = await response.json().catch(() => ({}));
  logApi(logger, 'GET', url, response.status, undefined, data);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${entityType}s: ${response.status}`);
  }

  if (entityType === 'pricePoint' && data && typeof data === 'object' && 'pricePoints' in data) {
    return data.pricePoints as Record<string, unknown>[];
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'result' in data && Array.isArray(data.result)) {
    return data.result as Record<string, unknown>[];
  }
  return [];
}

async function fetchOffersPaginated(
  base: string,
  endpoint: string,
  publisherToken: string,
  logger: DupApiLogger
): Promise<Record<string, unknown>[]> {
  const LIMIT = 500;
  const allOffers: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const url = `${base}${endpoint}?recordLimit=${LIMIT}&offset=${offset}`;
    const response = await fetch(url, {
      headers: { 'x-publisher-token': publisherToken },
    });

    const data = await response.json().catch(() => ({}));
    logApi(logger, 'GET', url, response.status, undefined, data);

    if (!response.ok) {
      throw new Error(`Failed to fetch offers: ${response.status}`);
    }

    const offers = (data.offers || []) as Record<string, unknown>[];
    allOffers.push(...offers);

    const totalCount = data.totalCount as number;
    offset += LIMIT;

    if (offset >= totalCount) break;
  }

  return allOffers;
}

// ─── Payload builders ───

function buildProductPayload(src: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: src.name,
    publisherProductId: src.publisherProductId,
    type: src.type,
  };
  if (src.textFontColorHex) payload.textFontColorHex = src.textFontColorHex;
  if (src.productImageUrl) payload.productImageUrl = src.productImageUrl;
  if (src.prefix) payload.prefix = src.prefix;
  if (src.suffix) payload.suffix = src.suffix;
  if (src.displayName) payload.displayName = src.displayName;
  if (src.description) payload.description = src.description;
  return payload;
}

const OFFER_DESIGN_STRIP_FIELDS = new Set([
  '_id', '__v', 'createdAt', 'updatedAt', 'publisherId', 'id',
  'backgroundExternalImageUrl',
  'externalBackgroundImageUrl',
]);

function fixColorObj(obj: Record<string, unknown>) {
  if (!obj.colorTwo || obj.colorTwo === '') obj.colorTwo = obj.colorOne || '#000000';
  if (!obj.gradientDirection || obj.gradientDirection === '') obj.gradientDirection = 'to bottom';
  delete obj.direction;
}

function buildOfferDesignPayload(src: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (OFFER_DESIGN_STRIP_FIELDS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (value === '' && key !== 'headerImage') continue;
    payload[key] = value;
  }

  if (src.offerUiType === 'RollingOffer' && !payload.backgroundImageUrl) {
    payload.backgroundImageUrl =
      src.externalBackgroundImageUrl ||
      src.backgroundExternalImageUrl ||
      'https://media.appcharge.com/defaults/default_rolling_bg.png';
  }

  if (payload.title && typeof payload.title === 'object') {
    const title = payload.title as Record<string, unknown>;
    if (!title.text || (typeof title.text === 'string' && title.text.trim() === '')) {
      delete payload.title;
    } else {
      if (title.fontColor && typeof title.fontColor === 'object') {
        title.fontColor = (title.fontColor as Record<string, unknown>).colorOne || '#FFFFFF';
      }
    }
  }

  if (payload.borderColor && typeof payload.borderColor === 'object') {
    fixColorObj(payload.borderColor as Record<string, unknown>);
  }

  if (payload.backgroundColor && typeof payload.backgroundColor === 'object') {
    fixColorObj(payload.backgroundColor as Record<string, unknown>);
  }

  if (payload.progressBar && typeof payload.progressBar === 'object') {
    const pb = payload.progressBar as Record<string, unknown>;
    if (pb.accumulatedItem && typeof pb.accumulatedItem === 'object') {
      delete (pb.accumulatedItem as Record<string, unknown>).backgroundImageUrl;
    }
  }

  if (payload.subRollingOffer && typeof payload.subRollingOffer === 'object') {
    const sr = payload.subRollingOffer as Record<string, unknown>;
    if (typeof sr.backgroundImageUrl !== 'string') {
      sr.backgroundImageUrl =
        sr.backgroundExternalImageUrl ||
        sr.externalBackgroundImageUrl ||
        payload.backgroundImageUrl ||
        'https://media.appcharge.com/defaults/default_rolling_bg.png';
    }
    delete sr.backgroundExternalImageUrl;
    delete sr.externalBackgroundImageUrl;
  }

  return payload;
}

function stripEmptyColors(colorObj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!colorObj) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(colorObj)) {
    if (value === '') continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function buildBadgePayload(src: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: src.name,
    publisherBadgeId: src.publisherBadgeId,
    type: src.type,
  };
  payload.badgeImageUrl = src.badgeImageUrl || '';
  if (src.text) payload.text = src.text;
  if (src.textColor) payload.textColor = stripEmptyColors(src.textColor as Record<string, unknown>);
  if (src.backgroundColor) payload.backgroundColor = stripEmptyColors(src.backgroundColor as Record<string, unknown>);
  return payload;
}

function buildPricePointPayload(src: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    priceInUsdCents: src.priceInUsdCents,
  };
  if (src.priceOverrides) {
    payload.priceOverrides = src.priceOverrides;
  } else if (Array.isArray(src.priceByCountry)) {
    const overrides = (src.priceByCountry as any[])
      .filter((entry: any) => entry.isOverridden)
      .map((entry: any) => ({
        countryCode2: entry.countryCode2,
        price: entry.price,
      }));
    if (overrides.length > 0) {
      payload.priceOverrides = overrides;
    }
  }
  return payload;
}

function buildAssetPayload(src: Record<string, unknown>): Record<string, unknown> {
  return {
    name: src.name,
    type: src.type,
    externalImageUrl: src.imageUrl,
  };
}

function buildOfferPayload(
  src: Record<string, unknown>,
  offerUiIdMap?: Map<string, string>
): Record<string, unknown> {
  const offerUi = src.offerUi as Record<string, unknown> | undefined;
  const offerExternalUiId = String(offerUi?.externalId ?? '');

  const rawSequence = (src.productsSequence as any[]) || [];
  const productsSequence = rawSequence.map((block: any) => {
    const cleaned: Record<string, unknown> = {
      index: block.index,
      products: (block.products || []).map((p: any) => ({
        publisherProductId: p.publisherProductId,
        quantity: p.quantity,
        priority: p.priority,
      })),
      priceInUsdCents: block.priceInUsdCents,
    };
    if (block.productSale) cleaned.productSale = block.productSale;
    if (block.priceDiscount) cleaned.priceDiscount = block.priceDiscount;
    if (block.playerAvailability != null) cleaned.playerAvailability = block.playerAvailability;
    if (block.hidePlayerAvailability != null) cleaned.hidePlayerAvailability = block.hidePlayerAvailability;
    if (Array.isArray(block.progressBarPoints)) cleaned.progressBarPoints = block.progressBarPoints;
    return cleaned;
  });

  const payload: Record<string, unknown> = {
    publisherOfferId: src.publisherOfferId,
    name: src.name,
    type: src.type,
    offerExternalUiId,
    active: src.active ?? true,
    segments: src.segments ?? [],
    productsSequence,
  };
  if (src.displayName) payload.displayName = src.displayName;
  if (src.subType) payload.subType = src.subType;
  if (src.priority != null) payload.priority = src.priority;
  if (Array.isArray(src.badges) && src.badges.length > 0) {
    const badges = (src.badges as any[])
      .map((b: any) => {
        const inner = b.badge || b;
        return { publisherBadgeId: String(inner.name || inner.publisherBadgeId || '') };
      })
      .filter((b) => b.publisherBadgeId);
    if (badges.length > 0) payload.badges = badges;
  }
  if (src.productSale) payload.productSale = src.productSale;
  if (src.priceDiscount) payload.priceDiscount = src.priceDiscount;
  if (src.schedule) payload.schedule = src.schedule;
  return payload;
}

export function buildPayload(
  entityType: DupEntityType,
  entity: Record<string, unknown>,
  offerUiIdMap?: Map<string, string>
): Record<string, unknown> {
  switch (entityType) {
    case 'product': return buildProductPayload(entity);
    case 'offerDesign': return buildOfferDesignPayload(entity);
    case 'badge': return buildBadgePayload(entity);
    case 'offer': return buildOfferPayload(entity, offerUiIdMap);
    case 'pricePoint': return buildPricePointPayload(entity);
    case 'asset': return buildAssetPayload(entity);
  }
}

// ─── API operations ───

export async function createEntity(
  envType: DupEnvType,
  publisherToken: string,
  entityType: DupEntityType,
  entity: Record<string, unknown>,
  offerUiIdMap?: Map<string, string>,
  logger: DupApiLogger = noopLogger
): Promise<{ success: boolean; status: number; error?: string; updated?: boolean }> {
  const base = getBaseUrl(envType);
  const endpoint = ENTITY_ENDPOINTS[entityType];
  const url = `${base}${endpoint}`;
  const body = buildPayload(entityType, entity, offerUiIdMap);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-publisher-token': publisherToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    const resBody = await response.json().catch(() => ({}));
    logApi(logger, 'POST', url, response.status, body, resBody);
    return { success: true, status: response.status };
  }

  const errorBody = await response.json().catch(() => ({}));
  logApi(logger, 'POST', url, response.status, body, errorBody);

  const apiMessage = (errorBody as any)?.message || (errorBody as any)?.error || `HTTP ${response.status}`;
  const apiDetail = (errorBody as any)?.body || '';
  const errorMessage = apiDetail ? `${apiMessage} — ${apiDetail}` : apiMessage;

  // For offer designs that already exist, try PUT to update
  if (entityType === 'offerDesign' && errorMessage?.toLowerCase().includes('already exists')) {
    const externalId = String((entity as any).externalId || '');
    if (externalId) {
      const putUrl = `${url}/${externalId}`;
      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'x-publisher-token': publisherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const putResBody = await putResponse.json().catch(() => ({}));
      logApi(logger, 'PUT', putUrl, putResponse.status, body, putResBody);

      if (putResponse.ok) {
        return { success: true, status: putResponse.status, updated: true };
      }
      const putMsg = (putResBody as any)?.message || (putResBody as any)?.error || `HTTP ${putResponse.status}`;
      const putDetail = (putResBody as any)?.body || '';
      return { success: false, status: putResponse.status, error: putDetail ? `${putMsg} — ${putDetail}` : putMsg };
    }
  }

  return { success: false, status: response.status, error: errorMessage };
}

export async function deleteEntity(
  envType: DupEnvType,
  publisherToken: string,
  entityType: DupEntityType,
  entityId: string,
  logger: DupApiLogger = noopLogger
): Promise<{ success: boolean; status: number; error?: string }> {
  const base = getBaseUrl(envType);
  const endpoint = ENTITY_ENDPOINTS[entityType];
  const url = `${base}${endpoint}/${entityId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'x-publisher-token': publisherToken },
  });

  const resBody = await response.json().catch(() => ({}));
  logApi(logger, 'DELETE', url, response.status, undefined, resBody);

  if (response.ok) {
    return { success: true, status: response.status };
  }

  const errorMessage = (resBody as any)?.message || (resBody as any)?.error || `HTTP ${response.status}`;
  return { success: false, status: response.status, error: errorMessage };
}
