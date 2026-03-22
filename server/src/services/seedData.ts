import type { Player, Tier } from 'shared/src/types.js';

export const seedPlayers: Player[] = [
  {
    id: 'player-1',
    publisherPlayerId: '1234',
    playerName: 'Naama',
    playerProfileImage: 'https://res.cloudinary.com/dewxyzl9a/image/upload/v1770802835/Naama_m1vkou.png',
    sessionMetadata: { abTest: 'group1', locale: 'en-US' },
    description: 'Whale / Diamond tier player with high balances and premium offers',
    tierId: 'tier-diamond',
  },
  {
    id: 'player-2',
    publisherPlayerId: '5678',
    playerName: 'Shelly',
    playerProfileImage: 'https://res.cloudinary.com/dewxyzl9a/image/upload/v1770802863/Shelly_dh3mif.png',
    sessionMetadata: { abTest: 'group2', locale: 'en-US' },
    description: 'Mid-tier gold player with progression offers',
    tierId: 'tier-gold',
  },
  {
    id: 'player-3',
    publisherPlayerId: '9012',
    playerName: 'Roy',
    playerProfileImage: 'https://res.cloudinary.com/dewxyzl9a/image/upload/v1770802851/Roy_fbpxll.png',
    sessionMetadata: { abTest: 'group1', locale: 'fr-FR' },
    description: 'New player with starter packs and first-purchase bonuses',
    tierId: 'tier-bronze',
  },
];

export const seedTiers: Tier[] = [
  {
    id: 'tier-diamond',
    name: 'Diamond',
    description: 'Top-tier whale players with premium offers',
    productColumns: ['star', 'RocketBaby', 'SuperMoon', 'MoonLanding', 'SuperRocket'],
    offerDesigns: ['Default', 'BundleOffer', 'Default_RollingOffer'],
    offers: [
      {
        publisherOfferId: 'RockeyDaily',
        offerType: 'PopUp',
        enabled: true,
        offerDesignId: 'Default',
        products: { star: 0, RocketBaby: 0, SuperMoon: 0, MoonLanding: 100, SuperRocket: 0 },
      },
      {
        publisherOfferId: 'Bundle1',
        offerType: 'Bundle',
        enabled: true,
        offerDesignId: 'BundleOffer',
        products: { star: 0, RocketBaby: 0, SuperMoon: 0, MoonLanding: 20, SuperRocket: 40 },
      },
      {
        publisherOfferId: 'RollingOffer6',
        offerType: 'RollingOffer',
        enabled: true,
        offerDesignId: 'Default_RollingOffer',
        products: { star: 0, RocketBaby: 0, SuperMoon: 2, MoonLanding: 0, SuperRocket: 1 },
      },
      {
        publisherOfferId: 'SpecialOffer1',
        offerType: 'SpecialOffer',
        enabled: true,
        offerDesignId: 'Default',
        products: { star: 500, RocketBaby: 0, SuperMoon: 0, MoonLanding: 0, SuperRocket: 0 },
      },
      {
        publisherOfferId: 'Bundle2',
        offerType: 'Bundle',
        enabled: false,
        offerDesignId: 'BundleOffer',
        products: { star: 200, RocketBaby: 10, SuperMoon: 0, MoonLanding: 0, SuperRocket: 0 },
      },
    ],
  },
  {
    id: 'tier-gold',
    name: 'Gold',
    description: 'Mid-tier players with progression offers',
    productColumns: ['star', 'RocketBaby', 'SuperMoon', 'SuperRocket'],
    offerDesigns: ['Default', 'GoldOffer'],
    offers: [
      {
        publisherOfferId: 'GoldBundle1',
        offerType: 'Bundle',
        enabled: true,
        offerDesignId: 'GoldOffer',
        products: { star: 1000, RocketBaby: 0, SuperMoon: 50, SuperRocket: 0 },
      },
      {
        publisherOfferId: 'ProgressionPack',
        offerType: 'Bundle',
        enabled: true,
        offerDesignId: 'Default',
        products: { star: 0, RocketBaby: 20, SuperMoon: 0, SuperRocket: 10 },
      },
      {
        publisherOfferId: 'DailyDeal',
        offerType: 'RollingOffer',
        enabled: true,
        offerDesignId: 'Default',
        products: { star: 300, RocketBaby: 0, SuperMoon: 0, SuperRocket: 0 },
      },
    ],
  },
  {
    id: 'tier-bronze',
    name: 'Bronze',
    description: 'New players with starter packs',
    productColumns: ['star', 'RocketBaby'],
    offerDesigns: ['Default', 'FirstPurchase'],
    offers: [
      {
        publisherOfferId: 'StarterPack1',
        offerType: 'Bundle',
        enabled: true,
        offerDesignId: 'Default',
        products: { star: 500, RocketBaby: 0 },
      },
      {
        publisherOfferId: 'FirstPurchaseBonus',
        offerType: 'SpecialOffer',
        enabled: true,
        offerDesignId: 'FirstPurchase',
        products: { star: 200, RocketBaby: 10 },
      },
    ],
  },
];
