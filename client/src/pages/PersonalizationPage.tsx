import { useState, useEffect, useMemo } from 'react';
import { api } from '../hooks/api';
import type { Tier, TierOfferRow, OfferType } from 'shared/types';
import CreatePage from './CreatePage';

type SubTab = 'offers' | 'create' | 'pricing';

interface PricePoint {
  priceInUsdCents: number;
  lastUpdate: string;
}

interface OfferDesign {
  name: string;
  externalId: string;
  offerUiType: string;
}

interface Badge {
  name: string;
  publisherBadgeId: string;
}

export default function PersonalizationPage() {
  const [subTab, setSubTab] = useState<SubTab>('offers');

  // ─── Offers state ───
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [tier, setTier] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [rollingExpanded, setRollingExpanded] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<OfferType | ''>('');
  const [filterEnabled, setFilterEnabled] = useState<'' | 'on' | 'off'>('');
  const [filterOfferId, setFilterOfferId] = useState('');
  const [filterPrice, setFilterPrice] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState<'type' | 'price' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── Offer Designs state ───
  const [offerDesigns, setOfferDesigns] = useState<OfferDesign[]>([]);

  // ─── Badges state ───
  const [badges, setBadges] = useState<Badge[]>([]);

  // ─── Design section collapse ───
  const [designExpanded, setDesignExpanded] = useState(true);

  // ─── Pricing Points state ───
  const [pricePoints, setPricePoints] = useState<PricePoint[]>([]);
  const [loadingPP, setLoadingPP] = useState(false);
  const [newPriceDollars, setNewPriceDollars] = useState('');
  const [creatingPP, setCreatingPP] = useState(false);

  // Load all tiers and offer designs on mount
  useEffect(() => {
    api.getTiers().then((data) => {
      setTiers(data);
      if (data.length > 0 && !selectedTierId) {
        setSelectedTierId(data[0].id);
      }
    });
    api.getOfferDesigns().then(setOfferDesigns).catch(() => {});
    api.getBadges().then(setBadges).catch(() => {});
  }, []);

  // Load selected tier
  useEffect(() => {
    if (!selectedTierId) return;
    api.getTier(selectedTierId).then((data) => {
      setTier(data);
      setDirty(false);
    }).catch(() => setTier(null));
  }, [selectedTierId]);

  // Load price points when switching to pricing tab
  useEffect(() => {
    if (subTab === 'pricing') loadPricePoints();
  }, [subTab]);

  const loadPricePoints = async () => {
    setLoadingPP(true);
    try {
      const data = await api.getPricePoints();
      setPricePoints(data.pricePoints || []);
    } catch {
      showMessage('Failed to load price points');
    } finally {
      setLoadingPP(false);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleSave = async () => {
    if (!tier) return;
    try {
      setSaving(true);
      const updated = await api.updateTier(tier.id, tier);
      setTier(updated);
      setDirty(false);
      setTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showMessage('Saved successfully! Click "Refresh Store" to push changes to Appcharge.');
    } catch (err: any) {
      showMessage(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshStore = async () => {
    try {
      const result = await api.refreshStore();
      showMessage(`Refresh sent! Response: ${JSON.stringify(result)}`);
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    try {
      const updatedTiers = await api.syncTiers();
      setTiers(updatedTiers);
      const current = updatedTiers.find((t: any) => t.id === selectedTierId);
      if (current) setTier(current);
      showMessage('Offers & products reloaded from Appcharge');
    } catch (err: any) {
      showMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const getDesignsForType = (offerType: string): OfferDesign[] => {
    return offerDesigns.filter((d) => d.offerUiType === offerType);
  };

  const handleCreatePricePoint = async () => {
    const dollars = parseFloat(newPriceDollars);
    if (isNaN(dollars) || dollars <= 0) {
      showMessage('Please enter a valid price in USD');
      return;
    }
    const cents = Math.round(dollars * 100);

    if (pricePoints.some((pp) => pp.priceInUsdCents === cents)) {
      showMessage(`Price point $${dollars.toFixed(2)} already exists`);
      return;
    }

    setCreatingPP(true);
    try {
      await api.createPricePoint(cents);
      setNewPriceDollars('');
      showMessage(`Price point $${dollars.toFixed(2)} created`);
      await loadPricePoints();
    } catch (err: any) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setCreatingPP(false);
    }
  };

  // ─── Split offers into rolling and non-rolling ───
  const rollingOffers = useMemo(
    () => tier?.offers.filter((o) => o.offerType === 'RollingOffer') || [],
    [tier],
  );
  const selectedRolling = useMemo(
    () => rollingOffers.find((o) => o.enabled),
    [rollingOffers],
  );
  const nonRollingOffers = useMemo(
    () => tier?.offers.filter((o) => o.offerType !== 'RollingOffer') || [],
    [tier],
  );

  // Should the rolling offer row be visible given current filters?
  const showRollingRow = useMemo(() => {
    if (rollingOffers.length === 0) return false;
    if (filterType && filterType !== 'RollingOffer') return false;
    if (filterEnabled === 'on' && !selectedRolling?.enabled) return false;
    if (filterEnabled === 'off' && selectedRolling?.enabled) return false;
    if (filterOfferId && !rollingOffers.some((ro) => ro.publisherOfferId.toLowerCase().includes(filterOfferId.toLowerCase()))) return false;
    return true;
  }, [rollingOffers, selectedRolling, filterType, filterEnabled, filterOfferId]);

  // ─── Filtered non-rolling offers (preserving original index for mutations) ───
  const filteredOffers = useMemo(() => {
    if (!tier) return [];
    let result = tier.offers
      .map((offer, index) => ({ offer, index }))
      .filter(({ offer }) => {
        if (offer.offerType === 'RollingOffer') return false; // handled separately
        if (filterType && offer.offerType !== filterType) return false;
        if (filterEnabled === 'on' && !offer.enabled) return false;
        if (filterEnabled === 'off' && offer.enabled) return false;
        if (filterOfferId && !offer.publisherOfferId.toLowerCase().includes(filterOfferId.toLowerCase())) return false;
        if (filterPrice) {
          const priceStr = offer.priceInUsdCents != null
            ? `$${(offer.priceInUsdCents / 100).toFixed(2)}`
            : '';
          if (!priceStr.includes(filterPrice)) return false;
        }
        return true;
      });

    // Sort
    if (sortCol) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'type') {
          cmp = a.offer.offerType.localeCompare(b.offer.offerType);
        } else if (sortCol === 'price') {
          cmp = (a.offer.priceInUsdCents ?? 0) - (b.offer.priceInUsdCents ?? 0);
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [tier, filterType, filterEnabled, filterOfferId, filterPrice, sortCol, sortDir]);

  const hasActiveFilters = filterType !== '' || filterEnabled !== '' || filterOfferId !== '' || filterPrice !== '';

  const toggleSort = (col: 'type' | 'price') => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIndicator = (col: 'type' | 'price') => {
    if (sortCol !== col) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  // ─── Offer row mutations ───

  const updateOffer = (index: number, updates: Partial<TierOfferRow>) => {
    if (!tier) return;
    const offers = [...tier.offers];
    offers[index] = { ...offers[index], ...updates };
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateOfferProduct = (offerIndex: number, productId: string, quantity: number) => {
    if (!tier) return;
    const offers = [...tier.offers];
    offers[offerIndex] = {
      ...offers[offerIndex],
      products: { ...offers[offerIndex].products, [productId]: quantity },
    };
    setTier({ ...tier, offers });
    setDirty(true);
  };

  // ─── Rolling offer mutations ───

  const selectRollingOffer = (publisherOfferId: string) => {
    if (!tier) return;
    const offers = tier.offers.map((o) => {
      if (o.offerType !== 'RollingOffer') return o;
      return { ...o, enabled: o.publisherOfferId === publisherOfferId };
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const toggleRollingOffer = (enabled: boolean) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId === selectedRolling.publisherOfferId) {
        return { ...o, enabled };
      }
      return o;
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateRollingDesign = (offerDesignId: string) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId === selectedRolling.publisherOfferId) {
        return { ...o, offerDesignId };
      }
      return o;
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateRollingBadge = (badgeId: string) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId === selectedRolling.publisherOfferId) {
        return { ...o, badgeId: badgeId || undefined };
      }
      return o;
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateRollingPriceDiscount = (value: number) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId === selectedRolling.publisherOfferId) {
        return { ...o, priceDiscount: value || undefined };
      }
      return o;
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateRollingProductSale = (sale: number, type: string) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId === selectedRolling.publisherOfferId) {
        return { ...o, productSale: sale || undefined, productSaleType: (type as TierOfferRow['productSaleType']) || 'percentage' };
      }
      return o;
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const updateSubOfferProduct = (blockIdx: number, productId: string, quantity: number) => {
    if (!tier || !selectedRolling) return;
    const offers = tier.offers.map((o) => {
      if (o.publisherOfferId !== selectedRolling.publisherOfferId) return o;
      const subs = [...(o.subOfferProducts || [])];
      subs[blockIdx] = { ...subs[blockIdx], [productId]: quantity };
      return { ...o, subOfferProducts: subs };
    });
    setTier({ ...tier, offers });
    setDirty(true);
  };

  const sortedPricePoints = useMemo(
    () => [...pricePoints].sort((a, b) => a.priceInUsdCents - b.priceInUsdCents),
    [pricePoints],
  );

  const colCount = 4 + (designExpanded ? 4 : 0) + (tier?.productColumns.length || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personalization</h1>
          <p className="text-gray-500 mt-1">Configure offers per tier for the personalization endpoint</p>
        </div>
        <div className="flex gap-2">
          {subTab === 'offers' && dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {subTab === 'offers' && (
            <button
              onClick={handleRefreshStore}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Refresh Store
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Sub-tab selector */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setSubTab('offers')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === 'offers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Offers
          </button>
          <button
            onClick={() => setSubTab('create')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === 'create'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setSubTab('pricing')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === 'pricing'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pricing Points
          </button>
        </nav>
      </div>

      {/* ════════════════ Offers tab ════════════════ */}
      {subTab === 'offers' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tier selector tabs + Reload button */}
          <div className="border-b border-gray-200 flex items-center justify-between">
            <nav className="flex -mb-px">
              {tiers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
                    setSelectedTierId(t.id);
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    selectedTierId === t.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </nav>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-4 py-2 text-sm font-medium disabled:opacity-50 mr-2"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Reloading...' : 'Reload Offers'}
            </button>
          </div>

          {tier && (
            <div className="p-4 space-y-4">
              {tier.description && (
                <p className="text-sm text-gray-500">{tier.description}</p>
              )}

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter by Offer ID..."
                  value={filterOfferId}
                  onChange={(e) => setFilterOfferId(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="Filter by Price..."
                  value={filterPrice}
                  onChange={(e) => setFilterPrice(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-36 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as OfferType | '')}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Types</option>
                  <option value="Bundle">Bundle</option>
                  <option value="SpecialOffer">SpecialOffer</option>
                  <option value="RollingOffer">RollingOffer</option>
                  <option value="PopUp">PopUp</option>
                  <option value="ProgressBar">ProgressBar</option>
                </select>
                <select
                  value={filterEnabled}
                  onChange={(e) => setFilterEnabled(e.target.value as '' | 'on' | 'off')}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">On &amp; Off</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilterType(''); setFilterEnabled(''); setFilterOfferId(''); setFilterPrice(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear filters
                  </button>
                )}
                {hasActiveFilters && (
                  <span className="text-xs text-gray-400">
                    {filteredOffers.length} of {nonRollingOffers.length} offers
                  </span>
                )}
              </div>

              {/* Offers table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Offer ID</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900" onClick={() => toggleSort('price')}>
                        Price{sortIndicator('price')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900" onClick={() => toggleSort('type')}>
                        Type{sortIndicator('type')}
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap">On/Off</th>
                      <th
                        className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900"
                        colSpan={designExpanded ? 4 : 1}
                        onClick={() => setDesignExpanded(!designExpanded)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <svg className={`w-3 h-3 transition-transform ${designExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Design
                        </span>
                      </th>
                      {tier.productColumns.map((col) => (
                        <th key={col} className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap">
                          <span className="text-xs">{col}</span>
                        </th>
                      ))}
                    </tr>
                    {designExpanded && (
                      <tr>
                        <th className="px-3 py-1" />
                        <th className="px-3 py-1" />
                        <th className="px-3 py-1" />
                        <th className="px-3 py-1" />
                        <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Offer Design</th>
                        <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Badge</th>
                        <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Price Discount</th>
                        <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Product Sale</th>
                        {tier.productColumns.map((col) => (
                          <th key={col} className="px-3 py-1" />
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">

                    {/* ── Rolling Offer row (first, respects filters) ── */}
                    {showRollingRow && (
                      <>
                        <tr className={`bg-purple-50 ${!selectedRolling?.enabled ? 'opacity-60' : ''}`}>
                          {/* Offer ID — dropdown of all rolling offers */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setRollingExpanded(!rollingExpanded)}
                                className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                                title={rollingExpanded ? 'Collapse sub-offers' : 'Expand sub-offers'}
                              >
                                <svg className={`w-4 h-4 transition-transform ${rollingExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              <select
                                value={selectedRolling?.publisherOfferId || ''}
                                onChange={(e) => selectRollingOffer(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                {!selectedRolling && <option value="">Select rolling offer...</option>}
                                {rollingOffers.map((ro) => (
                                  <option key={ro.publisherOfferId} value={ro.publisherOfferId}>
                                    {ro.publisherOfferId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          {/* Price */}
                          <td className="px-3 py-2 text-right">
                            <span className="text-sm text-gray-900">
                              {selectedRolling?.priceInUsdCents != null
                                ? `$${(selectedRolling.priceInUsdCents / 100).toFixed(2)}`
                                : '—'}
                            </span>
                          </td>
                          {/* Type */}
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              RollingOffer
                            </span>
                          </td>
                          {/* Toggle */}
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => toggleRollingOffer(!selectedRolling?.enabled)}
                              disabled={!selectedRolling}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                selectedRolling?.enabled ? 'bg-primary-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                                style={{ transform: selectedRolling?.enabled ? 'translateX(22px)' : 'translateX(3px)' }}
                              />
                            </button>
                          </td>
                          {/* Offer Design */}
                          {designExpanded ? (
                            <td className="px-3 py-2">
                              <select
                                value={selectedRolling?.offerDesignId || ''}
                                onChange={(e) => updateRollingDesign(e.target.value)}
                                disabled={!selectedRolling}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                {getDesignsForType('RollingOffer').length === 0 && selectedRolling && (
                                  <option value={selectedRolling.offerDesignId}>{selectedRolling.offerDesignId}</option>
                                )}
                                {getDesignsForType('RollingOffer').map((d) => (
                                  <option key={d.externalId} value={d.externalId}>{d.name}</option>
                                ))}
                              </select>
                            </td>
                          ) : (
                            <td className="px-3 py-2" />
                          )}
                          {/* Badge */}
                          {designExpanded && (
                            <td className="px-3 py-2">
                              <select
                                value={selectedRolling?.badgeId || ''}
                                onChange={(e) => updateRollingBadge(e.target.value)}
                                disabled={!selectedRolling}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                <option value="">None</option>
                                {badges.map((b) => (
                                  <option key={b.publisherBadgeId} value={b.publisherBadgeId}>{b.name}</option>
                                ))}
                              </select>
                            </td>
                          )}
                          {/* Price Discount */}
                          {designExpanded && (
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={selectedRolling?.priceDiscount ?? ''}
                                onChange={(e) => updateRollingPriceDiscount(parseFloat(e.target.value) || 0)}
                                disabled={!selectedRolling}
                                placeholder="%"
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          )}
                          {/* Product Sale */}
                          {designExpanded && (
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={selectedRolling?.productSale ?? ''}
                                  onChange={(e) => updateRollingProductSale(parseFloat(e.target.value) || 0, selectedRolling?.productSaleType || 'percentage')}
                                  disabled={!selectedRolling}
                                  placeholder="0"
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <select
                                  value={selectedRolling?.productSaleType || 'percentage'}
                                  onChange={(e) => updateRollingProductSale(selectedRolling?.productSale || 0, e.target.value)}
                                  disabled={!selectedRolling}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="percentage">%</option>
                                  <option value="multiplier">x</option>
                                  <option value="fixed_amount">$</option>
                                </select>
                              </div>
                            </td>
                          )}
                          {/* Product columns — empty for main row, sub-offers have them */}
                          {tier.productColumns.map((col) => (
                            <td key={col} className="px-3 py-2 text-center text-gray-300 text-xs">
                              —
                            </td>
                          ))}
                        </tr>

                        {/* ── Expanded sub-offer rows ── */}
                        {rollingExpanded && selectedRolling && (selectedRolling.subOfferProducts || []).map((blockProducts, blockIdx) => (
                          <tr key={`sub-${blockIdx}`} className="bg-purple-50/50">
                            {/* Sub-offer label */}
                            <td className="px-3 py-2 pl-10">
                              <span className="text-xs font-medium text-purple-600">Block {blockIdx + 1}</span>
                            </td>
                            {/* Price */}
                            <td className="px-3 py-2 text-right">
                              <span className="text-sm text-gray-900">
                                {selectedRolling.subOfferPrices?.[blockIdx] != null
                                  ? `$${(selectedRolling.subOfferPrices[blockIdx] / 100).toFixed(2)}`
                                  : '—'}
                              </span>
                            </td>
                            {/* Type — empty */}
                            <td className="px-3 py-2" />
                            {/* Toggle — empty */}
                            <td className="px-3 py-2" />
                            {/* Design columns — empty placeholder(s) */}
                            {designExpanded ? (
                              <>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2" />
                              </>
                            ) : (
                              <td className="px-3 py-2" />
                            )}
                            {/* Product quantity columns */}
                            {tier.productColumns.map((col) => {
                              const val = blockProducts[col] ?? 0;
                              return (
                                <td key={col} className={`px-1 py-1 text-center border-l border-gray-200 ${val > 0 ? 'bg-green-50' : ''}`}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={val}
                                    onChange={(e) => updateSubOfferProduct(blockIdx, col, parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent text-sm text-center outline-none focus:ring-1 focus:ring-primary-500 rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    )}

                    {/* ── Regular (non-rolling) offer rows ── */}
                    {filteredOffers.length === 0 && !showRollingRow && (
                      <tr>
                        <td colSpan={colCount} className="px-4 py-8 text-center text-gray-400">
                          {hasActiveFilters ? 'No offers match the current filters.' : 'No offers configured for this tier.'}
                        </td>
                      </tr>
                    )}
                    {filteredOffers.map(({ offer, index: i }, rowIdx) => (
                      <tr key={i} className={`${!offer.enabled ? 'opacity-50' : ''} ${rowIdx % 2 === 1 ? 'bg-gray-100' : 'bg-white'}`}>
                        {/* Offer ID */}
                        <td className="px-3 py-2">
                          <span className="text-sm text-gray-900">{offer.publisherOfferId}</span>
                        </td>
                        {/* Price */}
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm text-gray-900">
                            {offer.priceInUsdCents != null
                              ? `$${(offer.priceInUsdCents / 100).toFixed(2)}`
                              : '—'}
                          </span>
                        </td>
                        {/* Offer Type */}
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            offer.offerType === 'SpecialOffer' ? 'bg-green-100 text-green-800' :
                            offer.offerType === 'PopUp' ? 'bg-yellow-100 text-yellow-800' :
                            offer.offerType === 'ProgressBar' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {offer.offerType}
                          </span>
                        </td>
                        {/* Toggle */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => updateOffer(i, { enabled: !offer.enabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              offer.enabled ? 'bg-primary-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                              style={{ transform: offer.enabled ? 'translateX(22px)' : 'translateX(3px)' }}
                            />
                          </button>
                        </td>
                        {/* Offer Design dropdown */}
                        {designExpanded ? (
                          <td className="px-3 py-2">
                            <select
                              value={offer.offerDesignId}
                              onChange={(e) => updateOffer(i, { offerDesignId: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            >
                              {getDesignsForType(offer.offerType).length === 0 && (
                                <option value={offer.offerDesignId}>{offer.offerDesignId}</option>
                              )}
                              {getDesignsForType(offer.offerType).map((d) => (
                                <option key={d.externalId} value={d.externalId}>{d.name}</option>
                              ))}
                            </select>
                          </td>
                        ) : (
                          <td className="px-3 py-2" />
                        )}
                        {/* Badge dropdown */}
                        {designExpanded && (
                          <td className="px-3 py-2">
                            <select
                              value={offer.badgeId || ''}
                              onChange={(e) => updateOffer(i, { badgeId: e.target.value || undefined })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="">None</option>
                              {badges.map((b) => (
                                <option key={b.publisherBadgeId} value={b.publisherBadgeId}>{b.name}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        {/* Price Discount */}
                        {designExpanded && (
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={offer.priceDiscount ?? ''}
                              onChange={(e) => updateOffer(i, { priceDiscount: parseFloat(e.target.value) || undefined })}
                              placeholder="%"
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                        )}
                        {/* Product Sale */}
                        {designExpanded && (
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={offer.productSale ?? ''}
                                onChange={(e) => updateOffer(i, { productSale: parseFloat(e.target.value) || undefined })}
                                placeholder="0"
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <select
                                value={offer.productSaleType || 'percentage'}
                                onChange={(e) => updateOffer(i, { productSaleType: e.target.value as TierOfferRow['productSaleType'] })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                <option value="percentage">%</option>
                                <option value="multiplier">x</option>
                                <option value="fixed_amount">$</option>
                              </select>
                            </div>
                          </td>
                        )}
                        {/* Product quantity columns */}
                        {tier.productColumns.map((col) => {
                          const val = offer.products[col] ?? 0;
                          return (
                            <td key={col} className={`px-1 py-1 text-center border-l border-gray-200 ${val > 0 ? 'bg-green-50' : ''}`}>
                              <input
                                type="number"
                                min={0}
                                value={val}
                                onChange={(e) => updateOfferProduct(i, col, parseInt(e.target.value) || 0)}
                                className="w-full bg-transparent text-sm text-center outline-none focus:ring-1 focus:ring-primary-500 rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ Create tab ════════════════ */}
      {subTab === 'create' && <CreatePage />}

      {/* ════════════════ Pricing Points tab ════════════════ */}
      {subTab === 'pricing' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 space-y-4">
            {/* Add new price point */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={newPriceDollars}
                  onChange={(e) => setNewPriceDollars(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePricePoint(); }}
                  className="border border-gray-300 rounded px-3 py-1.5 pl-7 text-sm w-32 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                onClick={handleCreatePricePoint}
                disabled={creatingPP}
                className="inline-flex items-center gap-1 bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
              >
                {creatingPP ? 'Adding...' : 'Add Price Point'}
              </button>
            </div>

            {/* Price points table */}
            {loadingPP ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading price points...</div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Price (USD)</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Price (cents)</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedPricePoints.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                          No price points configured.
                        </td>
                      </tr>
                    )}
                    {sortedPricePoints.map((pp) => (
                      <tr key={pp.priceInUsdCents}>
                        <td className="px-4 py-2 text-gray-900 font-medium">
                          ${(pp.priceInUsdCents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {pp.priceInUsdCents}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(pp.lastUpdate).toLocaleDateString()} {new Date(pp.lastUpdate).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-gray-400">
              {sortedPricePoints.length} price point{sortedPricePoints.length !== 1 ? 's' : ''} configured
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
