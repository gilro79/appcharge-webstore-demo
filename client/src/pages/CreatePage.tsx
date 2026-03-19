import { useState, useEffect } from 'react';
import { api } from '../hooks/api';
import type { Tier } from 'shared/types';

const PRODUCT_TYPES = ['Quantity', 'Time'] as const;
const OFFER_TYPES = ['Bundle', 'SpecialOffer', 'RollingOffer', 'PopUp', 'ProgressBar'] as const;

interface OfferUi {
  offerUiId: string;
  name: string;
  type: string;
}

export default function CreatePage() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [offerUis, setOfferUis] = useState<OfferUi[]>([]);

  useEffect(() => {
    api.getTiers().then((tiers: Tier[]) => {
      const ids = new Set<string>();
      for (const t of tiers) {
        for (const col of t.productColumns) ids.add(col);
      }
      setProductIds(Array.from(ids).sort());
    });
    api.getOfferUis().then(setOfferUis).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create</h1>
        <p className="text-gray-500 mt-1">Create products and offers via the Appcharge API</p>
      </div>
      <CreateProductSection />
      <CreateOfferSection productIds={productIds} offerUis={offerUis} />
    </div>
  );
}

// ─── Create Product ───

function CreateProductSection() {
  const [form, setForm] = useState({
    name: '',
    publisherProductId: '',
    type: 'Quantity' as string,
    textFontColorHex: '#ffffff',
    productImageUrl: '',
    displayName: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        publisherProductId: form.publisherProductId,
        type: form.type,
        textFontColorHex: form.textFontColorHex,
        productImageUrl: form.productImageUrl,
      };
      if (form.displayName) payload.displayName = form.displayName;
      if (form.description) payload.description = form.description;

      await api.createAppchargeProduct(payload);
      setMessage({ type: 'success', text: 'Product created and synced successfully.' });
      setForm({ name: '', publisherProductId: '', type: 'Quantity', textFontColorHex: '#ffffff', productImageUrl: '', displayName: '', description: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create product' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Product</h2>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Publisher Product ID *" value={form.publisherProductId} onChange={(v) => setForm({ ...form, publisherProductId: v })} required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          >
            {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Field label="Text Font Color (hex) *" value={form.textFontColorHex} onChange={(v) => setForm({ ...form, textFontColorHex: v })} required />
        <Field label="Product Image URL *" value={form.productImageUrl} onChange={(v) => setForm({ ...form, productImageUrl: v })} required />
        <Field label="Display Name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
        <div className="md:col-span-2">
          <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={submitting} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Create Offer ───

interface SequenceBlock {
  products: { publisherProductId: string; quantity: number }[];
  priceInUsdCents: number;
}

function makeEmptyBlock(): SequenceBlock {
  return { products: [{ publisherProductId: '', quantity: 1 }], priceInUsdCents: 0 };
}

function CreateOfferSection({ productIds, offerUis }: { productIds: string[]; offerUis: OfferUi[] }) {
  const [form, setForm] = useState({
    publisherOfferId: '',
    name: '',
    type: 'Bundle' as string,
    offerUiId: '',
  });
  const [blocks, setBlocks] = useState<SequenceBlock[]>([makeEmptyBlock()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isRolling = form.type === 'RollingOffer';

  const setBlockCount = (count: number) => {
    const clamped = Math.max(1, Math.min(10, count));
    setBlocks((prev) => {
      if (clamped <= prev.length) return prev.slice(0, clamped);
      return [...prev, ...Array.from({ length: clamped - prev.length }, makeEmptyBlock)];
    });
  };

  const filteredOfferUis = offerUis.filter((ui) => ui.type === form.type);

  const handleTypeChange = (newType: string) => {
    setForm({ ...form, type: newType, offerUiId: '' });
    // Reset to 1 block when switching away from RollingOffer
    if (newType !== 'RollingOffer') {
      setBlocks([blocks[0] || makeEmptyBlock()]);
    }
  };

  const updateBlock = (blockIdx: number, updates: Partial<SequenceBlock>) => {
    const updated = [...blocks];
    updated[blockIdx] = { ...updated[blockIdx], ...updates };
    setBlocks(updated);
  };

  const addProductToBlock = (blockIdx: number) => {
    const updated = [...blocks];
    updated[blockIdx] = {
      ...updated[blockIdx],
      products: [...updated[blockIdx].products, { publisherProductId: '', quantity: 1 }],
    };
    setBlocks(updated);
  };

  const removeProductFromBlock = (blockIdx: number, prodIdx: number) => {
    const updated = [...blocks];
    updated[blockIdx] = {
      ...updated[blockIdx],
      products: updated[blockIdx].products.filter((_, i) => i !== prodIdx),
    };
    setBlocks(updated);
  };

  const updateProductInBlock = (blockIdx: number, prodIdx: number, updates: Partial<{ publisherProductId: string; quantity: number }>) => {
    const updated = [...blocks];
    const prods = [...updated[blockIdx].products];
    prods[prodIdx] = { ...prods[prodIdx], ...updates };
    updated[blockIdx] = { ...updated[blockIdx], products: prods };
    setBlocks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const productsSequence = blocks.map((block, idx) => ({
        index: idx + 1,
        products: block.products
          .filter((p) => p.publisherProductId)
          .map((p, pIdx) => ({
            publisherProductId: p.publisherProductId,
            quantity: p.quantity,
            priority: pIdx === 0 ? 'Main' : 'Sub',
          })),
        priceInUsdCents: block.priceInUsdCents,
      }));

      const payload: Record<string, unknown> = {
        publisherOfferId: form.publisherOfferId,
        name: form.name,
        type: form.type,
        offerUiId: form.offerUiId,
        active: true,
        segments: [],
        productsSequence,
      };

      await api.createAppchargeOffer(payload);
      setMessage({ type: 'success', text: 'Offer created and synced successfully.' });
      setForm({ publisherOfferId: '', name: '', type: 'Bundle', offerUiId: '' });
      setBlocks([makeEmptyBlock()]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create offer' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Offer</h2>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Publisher Offer ID *" value={form.publisherOfferId} onChange={(v) => setForm({ ...form, publisherOfferId: v })} required />
          <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              {OFFER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offer UI *</label>
            <select
              value={form.offerUiId}
              onChange={(e) => setForm({ ...form, offerUiId: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select offer UI...</option>
              {filteredOfferUis.map((ui) => (
                <option key={ui.offerUiId} value={ui.offerUiId}>{ui.name}</option>
              ))}
            </select>
            {filteredOfferUis.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No offer UIs found for type "{form.type}"</p>
            )}
          </div>
          {isRolling && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Blocks *</label>
              <input
                type="number"
                min={2}
                max={10}
                value={blocks.length}
                onChange={(e) => setBlockCount(parseInt(e.target.value) || 2)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">Rolling offers require at least 2 blocks</p>
            </div>
          )}
        </div>

        {/* Sequence blocks */}
        <div className="space-y-4">
          {blocks.map((block, bIdx) => (
            <div key={bIdx} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  {blocks.length > 1 ? `Block ${bIdx + 1}` : 'Products & Price'}
                </h3>
                <button type="button" onClick={() => addProductToBlock(bIdx)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add Product</button>
              </div>
              <div className="space-y-2">
                {block.products.map((p, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <select
                      value={p.publisherProductId}
                      onChange={(e) => updateProductInBlock(bIdx, pIdx, { publisherProductId: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select product...</option>
                      {productIds.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={p.quantity}
                      onChange={(e) => updateProductInBlock(bIdx, pIdx, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    />
                    {block.products.length > 1 && (
                      <button type="button" onClick={() => removeProductFromBlock(bIdx, pIdx)} className="text-red-400 hover:text-red-600 text-sm px-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price (USD cents)</label>
                <input
                  type="number"
                  min={0}
                  value={block.priceInUsdCents}
                  onChange={(e) => updateBlock(bIdx, { priceInUsdCents: parseInt(e.target.value) || 0 })}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {submitting ? 'Creating...' : 'Create Offer'}
        </button>
      </form>
    </div>
  );
}

// ─── Shared Field component ───

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}
