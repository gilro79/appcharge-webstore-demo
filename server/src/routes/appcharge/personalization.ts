import { Router } from 'express';
import type { PersonalizationResponse, PersonalizationOffer, OfferProductSequence, Balance } from 'shared/src/types.js';
import { playerStore, tierStore } from '../../index.js';
import { scopedTierId } from '../../services/envTiers.js';
import { getActiveEnvName } from '../dashboard/settings.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  // Appcharge sends the player ID as "playerId"
  const publisherPlayerId = (body.playerId as string) || (body.publisherPlayerId as string);

  if (!publisherPlayerId) {
    res.status(400).json({ error: 'Missing playerId' });
    return;
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);

  // Look up the player's tier, scoped to the active environment
  const baseTierId = player?.tierId || 'tier-bronze';
  const envName = getActiveEnvName();
  const scoped = scopedTierId(envName, baseTierId);
  // Try scoped first, fall back to unscoped for backwards compat
  const tier = tierStore.getById(scoped) || tierStore.getById(baseTierId);
  if (!tier) {
    res.json({ status: 'invalid' });
    return;
  }

  const sessionMetadata = player?.sessionMetadata || { guest: 'true' };

  // Build balances from player data (only include positive values)
  const balances: Balance[] = player?.balances
    ? Object.entries(player.balances)
        .filter(([, quantity]) => quantity > 0)
        .map(([publisherProductId, quantity]) => ({
          publisherProductId,
          quantity,
        }))
    : [];

  // Transform enabled TierOfferRows into Appcharge PersonalizationOffer format
  const offers: PersonalizationOffer[] = tier.offers
    .filter((row) => row.enabled)
    .map((row) => {
      let productsSequence: OfferProductSequence[];

      if (row.offerType === 'RollingOffer' && row.subOfferProducts) {
        // Rolling offers: one sequence entry per sub-offer block, quantities as strings
        productsSequence = row.subOfferProducts.map((blockProducts, idx) => {
          const seq: OfferProductSequence = {
            index: idx + 1,
            products: Object.entries(blockProducts)
              .filter(([, qty]) => qty > 0)
              .map(([productId, qty]) => ({
                publisherProductId: productId,
                quantity: String(qty),
                priority: 'Main' as const,
              })),
          };
          // Attach sale/discount to each sub-offer entry
          if (row.productSale) seq.productSale = row.productSale;
          if (row.priceDiscount) seq.priceDiscount = row.priceDiscount;
          return seq;
        });
      } else {
        // Regular offers: single sequence entry
        const products = Object.entries(row.products)
          .filter(([, qty]) => qty > 0)
          .map(([productId, qty]) => ({
            publisherProductId: productId,
            quantity: qty,
            priority: 'Main' as const,
          }));
        const seq: OfferProductSequence = { index: 1, products };
        if (row.productSale) seq.productSale = row.productSale;
        if (row.priceDiscount) seq.priceDiscount = row.priceDiscount;
        productsSequence = [seq];
      }

      const offer: PersonalizationOffer = {
        publisherOfferId: row.publisherOfferId,
        productsSequence,
      };

      // Rolling offers use dynamicOfferUi; regular offers use offerDesignOverride
      if (row.offerType === 'RollingOffer' && row.offerDesignId) {
        offer.dynamicOfferUi = { offerDesignId: row.offerDesignId };
      } else if (row.offerDesignId && row.offerDesignId !== 'Default') {
        offer.offerDesignOverride = { offerDesignId: row.offerDesignId };
      }

      // Badge
      if (row.badgeId) {
        offer.badges = [{ publisherBadgeId: row.badgeId }];
      }

      return offer;
    });

  const response: PersonalizationResponse = {
    version: 2,
    status: 'valid',
    sessionMetadata,
    offersOrder: 'priceLowToHigh',
    sectionsOrder: [],
    attributes: {},
    balances,
    storeTheme: {},
    offers,
  };

  res.json(response);
});

export default router;
