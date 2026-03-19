import { Router } from 'express';
import type { PersonalizationResponse, PersonalizationOffer } from 'shared/src/types.js';
import { playerStore, tierStore } from '../../index.js';

const router = Router();

router.post('/', (req, res) => {
  const { publisherPlayerId } = req.body as { publisherPlayerId: string };

  if (!publisherPlayerId) {
    res.status(400).json({ error: 'Missing publisherPlayerId' });
    return;
  }

  const player = playerStore.findBy((p) => p.publisherPlayerId === publisherPlayerId);
  if (!player) {
    res.json({ status: 'invalid' });
    return;
  }

  // Look up the player's tier
  const tier = player.tierId ? tierStore.getById(player.tierId) : undefined;
  if (!tier) {
    res.json({ status: 'invalid' });
    return;
  }

  // Transform enabled TierOfferRows into Appcharge PersonalizationOffer format
  const offers: PersonalizationOffer[] = tier.offers
    .filter((row) => row.enabled)
    .map((row) => {
      const products = Object.entries(row.products)
        .filter(([, qty]) => qty > 0)
        .map(([productId, qty]) => ({
          publisherProductId: productId,
          quantity: qty,
          priority: 'Main' as const,
        }));

      const offer: PersonalizationOffer = {
        publisherOfferId: row.publisherOfferId,
        productsSequence: [
          {
            index: 1,
            products,
          },
        ],
      };

      if (row.offerDesignId && row.offerDesignId !== 'Default') {
        offer.offerDesignOverride = { offerDesignId: row.offerDesignId };
      }

      return offer;
    });

  const response: PersonalizationResponse = {
    version: 2,
    status: 'valid',
    sessionMetadata: player.sessionMetadata || {},
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
