import { tierStore } from '../index.js';
import type { TierOfferRow, OfferType } from 'shared/src/types.js';
import { logOutboundCall } from './apiLogger.js';
import { getPublisherToken, getApiBase } from '../routes/dashboard/settings.js';

interface AppchargeOffer {
  publisherOfferId: string;
  type?: string;
  offerUi?: { offerUiId?: string; name?: string; [key: string]: unknown };
  [key: string]: unknown;
}

// ─── Cached offer UIs (populated during sync) ───
interface CachedOfferUi {
  offerUiId: string;
  name: string;
  type: string;
}

let cachedOfferUis: CachedOfferUi[] = [];

export function getCachedOfferUis(): CachedOfferUi[] {
  return cachedOfferUis;
}

interface AppchargeProduct {
  publisherProductId: string;
  [key: string]: unknown;
}

export async function syncFromAppcharge(): Promise<void> {
  const appchargeApiBase = getApiBase();
  const appchargePublisherToken = getPublisherToken();
  if (!appchargePublisherToken) {
    console.log('[sync] No publisher token configured, skipping Appcharge sync');
    return;
  }

  const headers = { 'x-publisher-token': appchargePublisherToken };

  try {
    // Fetch offers and products in parallel
    const offersUrl = `${appchargeApiBase}/v2/offer`;
    const productsUrl = `${appchargeApiBase}/components/v1/product`;

    const offersStart = Date.now();
    const productsStart = Date.now();
    const [offersRes, productsRes] = await Promise.all([
      fetch(offersUrl, { headers }),
      fetch(productsUrl, { headers }),
    ]);

    const offersData = (await offersRes.json().catch(() => ({}))) as { offers: AppchargeOffer[] };
    const productsData = (await productsRes.json().catch(() => ([]))) as AppchargeProduct[];

    logOutboundCall({
      method: 'GET',
      url: offersUrl,
      category: 'sync',
      requestBody: null,
      responseStatus: offersRes.status,
      responseBody: offersData,
      durationMs: Date.now() - offersStart,
    });
    logOutboundCall({
      method: 'GET',
      url: productsUrl,
      category: 'sync',
      requestBody: null,
      responseStatus: productsRes.status,
      responseBody: productsData,
      durationMs: Date.now() - productsStart,
    });

    if (!offersRes.ok || !productsRes.ok) {
      console.error('[sync] Appcharge API error:', {
        offers: offersRes.status,
        products: productsRes.status,
      });
      return;
    }

    // Cache offer UIs for the Create page dropdown
    const uiMap = new Map<string, CachedOfferUi>();
    for (const o of offersData.offers) {
      const ui = o.offerUi;
      if (ui?.offerUiId && !uiMap.has(ui.offerUiId)) {
        uiMap.set(ui.offerUiId, {
          offerUiId: ui.offerUiId,
          name: ui.name || ui.offerUiId,
          type: o.type || 'Bundle',
        });
      }
    }
    cachedOfferUis = Array.from(uiMap.values());

    const offerIds = offersData.offers.map((o) => o.publisherOfferId);
    const offerTypeMap = new Map(
      offersData.offers.map((o) => [o.publisherOfferId, (o.type || 'Bundle') as OfferType])
    );
    const offerPriceMap = new Map(
      offersData.offers.map((o) => {
        const seq = (o as any).productsSequence;
        const price = Array.isArray(seq) && seq.length > 0 ? seq[0].priceInUsdCents : undefined;
        return [o.publisherOfferId, price as number | undefined];
      })
    );
    // Rolling offer sub-offer data
    const offerSubOfferMap = new Map<string, { count: number; prices: number[] }>(
      offersData.offers
        .filter((o) => o.type === 'RollingOffer')
        .map((o) => {
          const seq = (o as any).productsSequence as any[];
          const count = Array.isArray(seq) ? seq.length : 0;
          const prices = Array.isArray(seq) ? seq.map((s: any) => s.priceInUsdCents ?? 0) : [];
          return [o.publisherOfferId, { count, prices }];
        })
    );
    const productIds = productsData.map((p) => p.publisherProductId);

    console.log(`[sync] Fetched ${offerIds.length} offers, ${productIds.length} products from Appcharge`);

    // Update every tier with the full offer/product lists
    const tiers = tierStore.getAll();
    for (const tier of tiers) {
      // Build a lookup of existing offer rows by ID
      const existingOffers = new Map(tier.offers.map((o) => [o.publisherOfferId, o]));

      // Build new offers list: keep existing config where it exists, add new ones as disabled
      const updatedOffers: TierOfferRow[] = offerIds.map((offerId) => {
        const existing = existingOffers.get(offerId);
        const offerType = offerTypeMap.get(offerId) || 'Bundle';
        const priceInUsdCents = offerPriceMap.get(offerId);
        const subOfferData = offerSubOfferMap.get(offerId);
        if (existing) {
          // Keep existing row, but ensure all product columns exist and update offerType/price
          const products: Record<string, number> = {};
          for (const pid of productIds) {
            products[pid] = existing.products[pid] ?? 0;
          }
          const row: TierOfferRow = { ...existing, offerType, priceInUsdCents, products };
          // Rolling offer sub-offer products
          if (subOfferData) {
            row.subOfferCount = subOfferData.count;
            row.subOfferPrices = subOfferData.prices;
            // Preserve existing sub-offer products or initialize empty
            const existingSubs = existing.subOfferProducts || [];
            row.subOfferProducts = Array.from({ length: subOfferData.count }, (_, idx) => {
              const existingBlock = existingSubs[idx] || {};
              const block: Record<string, number> = {};
              for (const pid of productIds) {
                block[pid] = existingBlock[pid] ?? 0;
              }
              return block;
            });
          }
          return row;
        }
        // New offer — default to disabled with 0 quantities
        const products: Record<string, number> = {};
        for (const pid of productIds) {
          products[pid] = 0;
        }
        const row: TierOfferRow = {
          publisherOfferId: offerId,
          offerType,
          enabled: false,
          offerDesignId: tier.offerDesigns[0] || 'Default',
          priceInUsdCents,
          products,
        };
        if (subOfferData) {
          row.subOfferCount = subOfferData.count;
          row.subOfferPrices = subOfferData.prices;
          row.subOfferProducts = Array.from({ length: subOfferData.count }, () => {
            const block: Record<string, number> = {};
            for (const pid of productIds) {
              block[pid] = 0;
            }
            return block;
          });
        }
        return row;
      });

      tierStore.update(tier.id, {
        productColumns: productIds,
        offers: updatedOffers,
      });
    }

    console.log(`[sync] Updated ${tiers.length} tiers with Appcharge offers/products`);
  } catch (err) {
    console.error('[sync] Failed to sync from Appcharge:', err);
  }
}
