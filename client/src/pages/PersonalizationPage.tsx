import { useState, useEffect } from 'react';
import { api } from '../hooks/api';
import type { Tier, TierOfferRow } from 'shared/types';

export default function PersonalizationPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [tier, setTier] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  // Load all tiers on mount
  useEffect(() => {
    api.getTiers().then((data) => {
      setTiers(data);
      if (data.length > 0 && !selectedTierId) {
        setSelectedTierId(data[0].id);
      }
    });
  }, []);

  // Load selected tier
  useEffect(() => {
    if (!selectedTierId) return;
    api.getTier(selectedTierId).then((data) => {
      setTier(data);
      setDirty(false);
    }).catch(() => setTier(null));
  }, [selectedTierId]);

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

  // ─── Offer row mutations ───

  const updateOffer = (index: number, updates: Partial<TierOfferRow>) => {
    if (!tier) return;
    const offers = [...tier.offers];
    offers[index] = { ...offers[index], ...updates };

    // Rolling offer constraint: only one RollingOffer can be enabled per tier
    if (updates.enabled && offers[index].offerType === 'RollingOffer') {
      for (let j = 0; j < offers.length; j++) {
        if (j !== index && offers[j].offerType === 'RollingOffer' && offers[j].enabled) {
          offers[j] = { ...offers[j], enabled: false };
        }
      }
    }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personalization</h1>
          <p className="text-gray-500 mt-1">Configure offers per tier for the personalization endpoint</p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <button
            onClick={handleRefreshStore}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Store
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Tier selector tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
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
        </div>

        {tier && (
          <div className="p-4 space-y-4">
            {tier.description && (
              <p className="text-sm text-gray-500">{tier.description}</p>
            )}

            {/* Rolling offer info */}
            {tier.offers.some((o) => o.offerType === 'RollingOffer') && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs">
                Only one Rolling Offer can be enabled per tier. Enabling a Rolling Offer will automatically disable any other enabled Rolling Offer.
              </div>
            )}

            {/* Offers table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Offer ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap">On/Off</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Offer Design</th>
                    {tier.productColumns.map((col) => (
                      <th key={col} className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap">
                        <span className="text-xs">{col}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tier.offers.length === 0 && (
                    <tr>
                      <td colSpan={4 + tier.productColumns.length} className="px-4 py-8 text-center text-gray-400">
                        No offers configured for this tier.
                      </td>
                    </tr>
                  )}
                  {tier.offers.map((offer, i) => (
                    <tr key={i} className={!offer.enabled ? 'bg-gray-50 opacity-60' : ''}>
                      {/* Offer ID */}
                      <td className="px-3 py-2">
                        <span className="text-sm text-gray-900">{offer.publisherOfferId}</span>
                      </td>
                      {/* Offer Type */}
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          offer.offerType === 'RollingOffer' ? 'bg-purple-100 text-purple-800' :
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
                      <td className="px-3 py-2">
                        <select
                          value={offer.offerDesignId}
                          onChange={(e) => updateOffer(i, { offerDesignId: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        >
                          {tier.offerDesigns.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      {/* Product quantity columns */}
                      {tier.productColumns.map((col) => (
                        <td key={col} className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={offer.products[col] ?? 0}
                            onChange={(e) => updateOfferProduct(i, col, parseInt(e.target.value) || 0)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Offer Designs list */}
            <div className="text-xs text-gray-400 mt-2">
              Available designs: {tier.offerDesigns.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
