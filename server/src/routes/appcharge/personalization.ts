import { Router } from 'express';
import type { PersonalizationResponse, PersonalizationOffer } from 'shared/src/types.js';
import { playerStore, tierStore } from '../../index.js';

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

  // Look up the player's tier, or fall back to Bronze for guests
  const tierId = player?.tierId || 'tier-bronze';
  const tier = tierStore.getById(tierId);
  if (!tier) {
    res.json({ status: 'invalid' });
    return;
  }

  const sessionMetadata = player?.sessionMetadata || { guest: 'true' };

  // Transform enabled TierOfferRows into Appcharge PersonalizationOffer format
  const offers: PersonalizationOffer[] = tier.offers
    .filter((row) => row.enabled)
    .map((row) => {
      let productsSequence;

      if (row.offerType === 'RollingOffer' && row.subOfferProducts) {
        // Rolling offers: one sequence entry per sub-offer block, quantities as strings
        productsSequence = row.subOfferProducts.map((blockProducts, idx) => ({
          index: idx + 1,
          products: Object.entries(blockProducts)
            .filter(([, qty]) => qty > 0)
            .map(([productId, qty]) => ({
              publisherProductId: productId,
              quantity: String(qty),
              priority: 'Main' as const,
            })),
        }));
      } else {
        // Regular offers: single sequence entry
        const products = Object.entries(row.products)
          .filter(([, qty]) => qty > 0)
          .map(([productId, qty]) => ({
            publisherProductId: productId,
            quantity: qty,
            priority: 'Main' as const,
          }));
        productsSequence = [{ index: 1, products }];
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

      return offer;
    });

  const response: PersonalizationResponse = {
    version: 2,
    status: 'valid',
    sessionMetadata,
    offersOrder: 'priceLowToHigh',
    sectionsOrder: [],
    attributes: {},
    balances: [],
    storeTheme: {},
    offers,
  };

  res.json(response);
});

export default router;
