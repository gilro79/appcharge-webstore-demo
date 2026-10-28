import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type {
  DupEnvType,
  DupEntityType,
  DupFetchSourceResponse,
  DupProgressEvent,
  DupDuplicationSummary,
  DupApiLogEntry,
} from 'shared/src/types';
import { api } from '../hooks/api';
import { useAuth } from '../context/AuthContext';

// ─── SSE Stream Reader ───

async function readSSEStream(
  res: Response,
  onEvent: (event: DupProgressEvent) => void,
  onSummary: (summary: DupDuplicationSummary) => void,
  onApiLog: (entry: DupApiLogEntry) => void,
  onCustomEvent?: (eventType: string, data: unknown) => void
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let nextEventType = '';

  function handleLine(line: string) {
    if (line.startsWith('event: ')) {
      nextEventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        if (nextEventType === 'apiLog') {
          onApiLog(data as DupApiLogEntry);
        } else if (onCustomEvent && nextEventType && nextEventType !== 'done') {
          onCustomEvent(nextEventType, data);
        } else if (nextEventType === 'done' || ('success' in data && 'skipped' in data && 'failed' in data)) {
          onSummary(data as DupDuplicationSummary);
        } else {
          onEvent(data as DupProgressEvent);
        }
      } catch { /* ignore */ }
      nextEventType = '';
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) handleLine(line);
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) handleLine(line);
  }
}

// ─── Stepper types ───

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface StepConfig {
  step: number;
  label: string;
  types: { entityType: DupEntityType; label: string }[];
}

const STEPS: StepConfig[] = [
  { step: 1, label: 'Assets', types: [{ entityType: 'asset', label: 'Assets' }] },
  { step: 2, label: 'Products + Offer Designs + Badges', types: [
    { entityType: 'product', label: 'Products' },
    { entityType: 'offerDesign', label: 'Offer Designs' },
    { entityType: 'badge', label: 'Badges' },
  ]},
  { step: 3, label: 'Price Points', types: [{ entityType: 'pricePoint', label: 'Price Points' }] },
  { step: 4, label: 'Offers', types: [{ entityType: 'offer', label: 'Offers' }] },
];

const OFFER_TYPES = ['Bundle', 'SpecialOffer', 'PopUp', 'RollingOffer', 'ProgressBar'];

// ─── Entity Card config ───

interface CardConfig {
  key: keyof DupFetchSourceResponse;
  label: string;
  nameField: string;
  imageField?: string;
}

const CARD_ORDER: CardConfig[] = [
  { key: 'assets', label: 'Assets', nameField: 'name', imageField: 'imageUrl' },
  { key: 'products', label: 'Products', nameField: 'publisherProductId', imageField: 'productImageUrl' },
  { key: 'offerDesigns', label: 'Offer Designs', nameField: 'name', imageField: 'backgroundImageUrl' },
  { key: 'badges', label: 'Badges', nameField: 'name', imageField: 'badgeImageUrl' },
  { key: 'pricePoints', label: 'Price Points', nameField: 'priceInUsdCents' },
  { key: 'offers', label: 'Offers', nameField: 'publisherOfferId' },
];

// ─── Sub-components ───

function EnvConfigPanel({
  title,
  envType,
  token,
  onEnvTypeChange,
  onTokenChange,
  actionButton,
}: {
  title: string;
  envType: DupEnvType;
  token: string;
  onEnvTypeChange: (envType: DupEnvType) => void;
  onTokenChange: (token: string) => void;
  actionButton?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
          <select
            value={envType}
            onChange={(e) => onEnvTypeChange(e.target.value as DupEnvType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="staging">Staging</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Publisher Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="Enter publisher token"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {actionButton && <div className="flex-shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}

function EntityCard({
  config,
  items,
  onRemove,
}: {
  config: CardConfig;
  items: Record<string, unknown>[];
  onRemove: (indices: number[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((_, i) => i)));
    }
  }

  function handleRemove() {
    const indices = Array.from(selected).sort((a, b) => b - a);
    onRemove(indices);
    setSelected(new Set());
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9658;</span>
        <span className="font-medium text-sm text-gray-700">{config.label}</span>
        <span className="ml-auto bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2 max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">No items</div>
          ) : (
            <>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100 mb-1">
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                  Select all
                </label>
                {selected.size > 0 && (
                  <button
                    className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                  >
                    Remove {selected.size} item{selected.size > 1 ? 's' : ''}
                  </button>
                )}
              </div>
              {items.map((item, i) => {
                const name = String(
                  (item as any)[config.nameField] || (item as any).name || (item as any).publisherOfferId || `Item ${i + 1}`
                );
                const imgUrl = config.imageField ? String((item as any)[config.imageField] || '') : '';

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 py-1.5 px-1 rounded text-sm ${selected.has(i) ? 'bg-blue-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleItem(i)}
                      className="rounded"
                    />
                    {imgUrl && (
                      <img
                        src={imgUrl}
                        alt=""
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <span className="text-gray-700 truncate">{name}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EntityCards({
  data,
  onRemoveItems,
}: {
  data: DupFetchSourceResponse;
  onRemoveItems: (key: keyof DupFetchSourceResponse, indices: number[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
      {CARD_ORDER.map((config) => (
        <EntityCard
          key={config.key}
          config={config}
          items={data[config.key] || []}
          onRemove={(indices) => onRemoveItems(config.key, indices)}
        />
      ))}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <span className="text-green-500">&#10003;</span>;
  if (status === 'failed') return <span className="text-red-500">&#10007;</span>;
  if (status === 'in_progress') return <span className="text-blue-500 animate-pulse">&#9678;</span>;
  return <span className="text-gray-300">&#9675;</span>;
}

function DuplicationStepper({
  stepStatuses,
  busy,
  canDuplicate,
  onDuplicateAll,
  onDuplicateType,
}: {
  stepStatuses: Record<number, StepStatus>;
  busy: boolean;
  canDuplicate: boolean;
  onDuplicateAll: () => void;
  onDuplicateType: (entityType: DupEntityType, offerType?: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-700">Duplication Flow</span>
        <button
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={!canDuplicate}
          onClick={onDuplicateAll}
        >
          {busy ? 'Working...' : 'Duplicate All'}
        </button>
      </div>

      <div className="space-y-3">
        {STEPS.map(({ step, label, types }) => {
          const status = stepStatuses[step] || 'pending';
          return (
            <div key={step} className="flex items-start gap-3">
              <div className="mt-0.5 text-lg w-6 text-center">
                <StepIcon status={status} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {types.map(({ entityType, label: btnLabel }) => (
                    <button
                      key={entityType}
                      className="px-2.5 py-1 text-xs font-medium text-green-700 border border-green-300 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={!canDuplicate}
                      onClick={() => onDuplicateType(entityType)}
                    >
                      {btnLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs font-medium text-gray-500 mb-2">Offer Sub-Types</div>
        <div className="flex flex-wrap gap-1.5">
          {OFFER_TYPES.map((type) => (
            <button
              key={type}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!canDuplicate}
              onClick={() => onDuplicateType('offer', type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATUS_ICONS: Record<string, string> = {
  success: '\u2713',
  skipped: '\u2013',
  failed: '\u2717',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-600',
  skipped: 'text-yellow-600',
  failed: 'text-red-600',
};

function DuplicationLog({ logs, summary }: { logs: DupProgressEvent[]; summary: DupDuplicationSummary | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-gray-700 mb-2">Progress Log</div>
      {summary && (
        <div className="flex gap-4 mb-2 text-xs font-medium">
          <span className="text-green-600">{summary.success} created</span>
          <span className="text-yellow-600">{summary.skipped} skipped</span>
          <span className="text-red-600">{summary.failed} failed</span>
        </div>
      )}
      <div ref={containerRef} className="bg-gray-50 rounded-lg border border-gray-200 max-h-72 overflow-y-auto p-3 space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={`font-bold flex-shrink-0 ${STATUS_COLORS[log.status] || 'text-gray-400'}`}>
              {STATUS_ICONS[log.status]}
            </span>
            <span className="text-gray-600">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ToolsPage ───

export default function ToolsPage() {
  const { user, logout } = useAuth();
  const [toolTab, setToolTab] = useState<'duplication' | 'personalization'>('duplication');

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Standalone header */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to Home">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-700">Tools</span>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
            )}
            <span className="text-sm text-gray-700">{user.name}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Sign out</button>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col overflow-hidden p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4 flex-shrink-0">Tools</h1>

      {/* Top-level tool tabs */}
      <div className="flex border-b border-gray-200 mb-6 flex-shrink-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            toolTab === 'duplication'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setToolTab('duplication')}
        >
          Duplication Tool
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            toolTab === 'personalization'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setToolTab('personalization')}
        >
          Personalization
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
      {toolTab === 'duplication' && <DuplicationTool />}
      {toolTab === 'personalization' && <PersonalizationTool />}
      </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ─── Wizard types ───

interface WizardOffer {
  publisherOfferId: string;
  productsSequence: { index: number; products: { publisherProductId: string; quantity: number | string; priority: string }[] }[];
  designMode: 'none' | 'offerDesignOverride' | 'dynamicOfferUi';
  designId: string;
  badges: string[];
  priceDiscountEnabled: boolean;
  priceDiscount: number;
  priceDiscountType: string;
  productSaleEnabled: boolean;
  productSale: number;
  productSaleType: string;
}

interface WizardState {
  version: number;
  status: string;
  offersOrder: string;
  sectionsOrder: string[];
  offers: WizardOffer[];
  balances: { publisherProductId: string; quantity: number }[];
  storeTheme: { bgImageMobile: string; bgImageDesktop: string; bannerImage: string };
  sessionMetadata: { key: string; value: string }[];
  attributes: { key: string; value: string }[];
}

interface AppchargeData {
  offers: Record<string, unknown>[];
  products: Record<string, unknown>[];
  offerDesigns: Record<string, unknown>[];
  badges: Record<string, unknown>[];
  assets: Record<string, unknown>[];
}

function defaultWizardState(): WizardState {
  return {
    version: 2,
    status: 'valid',
    offersOrder: 'publisherOrder',
    sectionsOrder: [],
    offers: [],
    balances: [],
    storeTheme: { bgImageMobile: '', bgImageDesktop: '', bannerImage: '' },
    sessionMetadata: [],
    attributes: [],
  };
}

function buildPayloadFromWizard(ws: WizardState): string {
  const payload: Record<string, unknown> = {
    version: ws.version,
    status: ws.status,
  };

  if (ws.offersOrder) payload.offersOrder = ws.offersOrder;
  if (ws.sectionsOrder.length > 0) payload.sectionsOrder = ws.sectionsOrder;

  if (ws.offers.length > 0) {
    payload.offers = ws.offers.map((o) => {
      const offer: Record<string, unknown> = {
        publisherOfferId: o.publisherOfferId,
        productsSequence: o.productsSequence,
      };
      if (o.designMode === 'offerDesignOverride' && o.designId) {
        offer.offerDesignOverride = { offerDesignId: o.designId };
      } else if (o.designMode === 'dynamicOfferUi' && o.designId) {
        offer.dynamicOfferUi = { offerDesignId: o.designId };
      }
      if (o.badges.length > 0) {
        offer.badges = o.badges.map((b) => ({ publisherBadgeId: b }));
      }
      if (o.priceDiscountEnabled && o.priceDiscount > 0) {
        offer.priceDiscount = { discount: o.priceDiscount, type: o.priceDiscountType };
      }
      if (o.productSaleEnabled && o.productSale > 0) {
        offer.productSale = { sale: o.productSale, type: o.productSaleType };
      }
      return offer;
    });
  }

  if (ws.balances.length > 0) {
    payload.balances = ws.balances;
  }

  const hasTheme = ws.storeTheme.bgImageMobile || ws.storeTheme.bgImageDesktop || ws.storeTheme.bannerImage;
  if (hasTheme) {
    const theme: Record<string, string> = {};
    if (ws.storeTheme.bgImageMobile) theme.bgImageMobile = ws.storeTheme.bgImageMobile;
    if (ws.storeTheme.bgImageDesktop) theme.bgImageDesktop = ws.storeTheme.bgImageDesktop;
    if (ws.storeTheme.bannerImage) theme.bannerImage = ws.storeTheme.bannerImage;
    payload.storeTheme = theme;
  }

  if (ws.sessionMetadata.length > 0) {
    const meta: Record<string, string> = {};
    ws.sessionMetadata.forEach((m) => { if (m.key) meta[m.key] = m.value; });
    if (Object.keys(meta).length > 0) payload.sessionMetadata = meta;
  }

  if (ws.attributes.length > 0) {
    const attrs: Record<string, string> = {};
    ws.attributes.forEach((a) => { if (a.key) attrs[a.key] = a.value; });
    if (Object.keys(attrs).length > 0) payload.attributes = attrs;
  }

  return JSON.stringify(payload, null, 2);
}

// ─── Wizard sub-components ───

function CollapsibleSection({ title, badge, expanded, onToggle, children }: {
  title: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 flex-shrink-0">
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
        onClick={onToggle}
      >
        <span className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9658;</span>
        <span className="font-medium text-sm text-gray-700">{title}</span>
        {badge && <span className="ml-auto bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {expanded && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function PapiEnvConfig({ envType, token, fetching, fetchError, summary, onEnvTypeChange, onTokenChange, onFetch }: {
  envType: string;
  token: string;
  fetching: boolean;
  fetchError: string;
  summary: string;
  onEnvTypeChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  onFetch: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
      <div className="flex items-end gap-3">
        <div className="flex-shrink-0 w-[140px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
          <select
            value={envType}
            onChange={(e) => onEnvTypeChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="staging">Staging</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Publisher Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="Enter publisher token"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
          disabled={!token || fetching}
          onClick={onFetch}
        >
          {fetching ? 'Fetching...' : 'Fetch Data'}
        </button>
      </div>
      {fetchError && (
        <div className="mt-2 text-xs text-red-600">{fetchError}</div>
      )}
      {summary && (
        <div className="mt-2 text-xs text-green-700">{summary}</div>
      )}
    </div>
  );
}

function WizardSectionGeneral({ ws, onChange }: { ws: WizardState; onChange: (ws: WizardState) => void }) {
  const orderOptions = ['publisherOrder', 'priceHighToLow', 'priceLowToHigh'] as const;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">Offers Order</label>
      <div className="flex gap-1.5">
        {orderOptions.map((opt) => (
          <button
            key={opt}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              ws.offersOrder === opt
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            onClick={() => onChange({ ...ws, offersOrder: opt })}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function WizardSectionOffers({ ws, onChange, appData }: { ws: WizardState; onChange: (ws: WizardState) => void; appData: AppchargeData | null }) {
  const availableOffers = appData?.offers || [];
  const availableProducts = appData?.products || [];
  const availableDesigns = appData?.offerDesigns || [];
  const availableBadges = appData?.badges || [];

  function addOffer(publisherOfferId: string) {
    const apiOffer = availableOffers.find((o: any) => o.publisherOfferId === publisherOfferId) as any;
    const productsSequence = apiOffer?.productsSequence
      ? (apiOffer.productsSequence as any[]).map((block: any, idx: number) => ({
          index: block.index ?? idx,
          products: (block.products || []).map((p: any) => ({
            publisherProductId: p.publisherProductId || '',
            quantity: p.quantity ?? 1,
            priority: p.priority || 'Main',
          })),
        }))
      : [{ index: 0, products: [{ publisherProductId: '', quantity: 1, priority: 'Main' }] }];

    const newOffer: WizardOffer = {
      publisherOfferId,
      productsSequence,
      designMode: 'none',
      designId: '',
      badges: [],
      priceDiscountEnabled: false,
      priceDiscount: 0,
      priceDiscountType: 'percentage',
      productSaleEnabled: false,
      productSale: 0,
      productSaleType: 'percentage',
    };
    onChange({ ...ws, offers: [...ws.offers, newOffer] });
  }

  function updateOffer(idx: number, updates: Partial<WizardOffer>) {
    const offers = [...ws.offers];
    offers[idx] = { ...offers[idx], ...updates };
    onChange({ ...ws, offers });
  }

  function removeOffer(idx: number) {
    onChange({ ...ws, offers: ws.offers.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      {/* Add Offer */}
      <div>
        <select
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value=""
          onChange={(e) => { if (e.target.value) addOffer(e.target.value); }}
        >
          <option value="">+ Add Offer...</option>
          {availableOffers
            .filter((o: any) => !ws.offers.some((wo) => wo.publisherOfferId === o.publisherOfferId))
            .map((o: any) => (
              <option key={o.publisherOfferId} value={o.publisherOfferId}>
                {o.publisherOfferId} ({o.type || 'unknown'})
              </option>
            ))}
        </select>
      </div>

      {/* Offer cards */}
      {ws.offers.map((offer, oi) => (
        <div key={oi} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{offer.publisherOfferId}</span>
            <button
              className="text-xs text-red-500 hover:text-red-700"
              onClick={() => removeOffer(oi)}
            >
              Remove
            </button>
          </div>

          {/* Products per sequence block */}
          {offer.productsSequence.map((block, bi) => (
            <div key={bi} className="mb-2 pl-2 border-l-2 border-gray-300">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Block {block.index}</span>
                <div className="flex gap-1">
                  {offer.productsSequence.length > 1 && (
                    <button
                      className="text-[10px] text-red-400 hover:text-red-600"
                      onClick={() => {
                        const seq = offer.productsSequence.filter((_, i) => i !== bi);
                        updateOffer(oi, { productsSequence: seq });
                      }}
                    >
                      Remove Block
                    </button>
                  )}
                </div>
              </div>
              {block.products.map((prod, pi) => (
                <div key={pi} className="flex items-center gap-2 mb-1">
                  <select
                    value={prod.publisherProductId}
                    onChange={(e) => {
                      const seq = [...offer.productsSequence];
                      const prods = [...seq[bi].products];
                      prods[pi] = { ...prods[pi], publisherProductId: e.target.value };
                      seq[bi] = { ...seq[bi], products: prods };
                      updateOffer(oi, { productsSequence: seq });
                    }}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select product...</option>
                    {availableProducts.map((p: any) => (
                      <option key={p.publisherProductId} value={p.publisherProductId}>
                        {p.publisherProductId}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={prod.quantity}
                    onChange={(e) => {
                      const seq = [...offer.productsSequence];
                      const prods = [...seq[bi].products];
                      prods[pi] = { ...prods[pi], quantity: Number(e.target.value) };
                      seq[bi] = { ...seq[bi], products: prods };
                      updateOffer(oi, { productsSequence: seq });
                    }}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Qty"
                    min={1}
                  />
                  <select
                    value={prod.priority}
                    onChange={(e) => {
                      const seq = [...offer.productsSequence];
                      const prods = [...seq[bi].products];
                      prods[pi] = { ...prods[pi], priority: e.target.value };
                      seq[bi] = { ...seq[bi], products: prods };
                      updateOffer(oi, { productsSequence: seq });
                    }}
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Main">Main</option>
                    <option value="Sub">Sub</option>
                  </select>
                  {block.products.length > 1 && (
                    <button
                      className="text-red-400 hover:text-red-600 text-xs"
                      onClick={() => {
                        const seq = [...offer.productsSequence];
                        const prods = seq[bi].products.filter((_, i) => i !== pi);
                        seq[bi] = { ...seq[bi], products: prods };
                        updateOffer(oi, { productsSequence: seq });
                      }}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              <button
                className="text-[10px] text-blue-500 hover:text-blue-700 mt-1"
                onClick={() => {
                  const seq = [...offer.productsSequence];
                  const prods = [...seq[bi].products, { publisherProductId: '', quantity: 1, priority: 'Main' }];
                  seq[bi] = { ...seq[bi], products: prods };
                  updateOffer(oi, { productsSequence: seq });
                }}
              >
                + Add Product
              </button>
            </div>
          ))}
          <button
            className="text-xs text-blue-500 hover:text-blue-700 mb-2"
            onClick={() => {
              const newIndex = offer.productsSequence.length;
              const seq = [...offer.productsSequence, { index: newIndex, products: [{ publisherProductId: '', quantity: 1, priority: 'Main' }] }];
              updateOffer(oi, { productsSequence: seq });
            }}
          >
            + Add Sequence Block
          </button>

          {/* Offer design */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500 w-16">Design:</label>
            <select
              value={offer.designMode}
              onChange={(e) => updateOffer(oi, { designMode: e.target.value as WizardOffer['designMode'] })}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">None</option>
              <option value="offerDesignOverride">offerDesignOverride</option>
              <option value="dynamicOfferUi">dynamicOfferUi</option>
            </select>
            {offer.designMode !== 'none' && (
              <select
                value={offer.designId}
                onChange={(e) => updateOffer(oi, { designId: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select design...</option>
                {availableDesigns.map((d: any) => (
                  <option key={d.externalId || d._id} value={d.externalId || d._id}>
                    {d.name || d.externalId || d._id}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-start gap-2 mb-2">
            <label className="text-xs text-gray-500 w-16 pt-1">Badges:</label>
            <div className="flex flex-wrap gap-1 flex-1">
              {availableBadges.map((b: any) => {
                const id = b.publisherBadgeId || b.name;
                const isSelected = offer.badges.includes(id);
                return (
                  <button
                    key={id}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    onClick={() => {
                      const badges = isSelected ? offer.badges.filter((x) => x !== id) : [...offer.badges, id];
                      updateOffer(oi, { badges });
                    }}
                  >
                    {b.name || id}
                  </button>
                );
              })}
              {availableBadges.length === 0 && <span className="text-[10px] text-gray-400">No badges available</span>}
            </div>
          </div>

          {/* Price discount */}
          <div className="flex items-center gap-2 mb-1">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={offer.priceDiscountEnabled}
                onChange={(e) => updateOffer(oi, { priceDiscountEnabled: e.target.checked })}
                className="rounded"
              />
              Price Discount
            </label>
            {offer.priceDiscountEnabled && (
              <>
                <input
                  type="number"
                  value={offer.priceDiscount}
                  onChange={(e) => updateOffer(oi, { priceDiscount: Number(e.target.value) })}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min={0}
                />
                <select
                  value={offer.priceDiscountType}
                  onChange={(e) => updateOffer(oi, { priceDiscountType: e.target.value })}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="percentage">percentage</option>
                  <option value="fixed_amount">fixed_amount</option>
                </select>
              </>
            )}
          </div>

          {/* Product sale */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={offer.productSaleEnabled}
                onChange={(e) => updateOffer(oi, { productSaleEnabled: e.target.checked })}
                className="rounded"
              />
              Product Sale
            </label>
            {offer.productSaleEnabled && (
              <>
                <input
                  type="number"
                  value={offer.productSale}
                  onChange={(e) => updateOffer(oi, { productSale: Number(e.target.value) })}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min={0}
                />
                <select
                  value={offer.productSaleType}
                  onChange={(e) => updateOffer(oi, { productSaleType: e.target.value })}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="percentage">percentage</option>
                  <option value="multiplier">multiplier</option>
                  <option value="fixed_amount">fixed_amount</option>
                </select>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function WizardSectionBalances({ ws, onChange, appData }: { ws: WizardState; onChange: (ws: WizardState) => void; appData: AppchargeData | null }) {
  const availableProducts = appData?.products || [];

  return (
    <div className="space-y-2">
      {ws.balances.map((bal, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={bal.publisherProductId}
            onChange={(e) => {
              const balances = [...ws.balances];
              balances[i] = { ...balances[i], publisherProductId: e.target.value };
              onChange({ ...ws, balances });
            }}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select product...</option>
            {availableProducts.map((p: any) => (
              <option key={p.publisherProductId} value={p.publisherProductId}>
                {p.publisherProductId}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={bal.quantity}
            onChange={(e) => {
              const balances = [...ws.balances];
              balances[i] = { ...balances[i], quantity: Number(e.target.value) };
              onChange({ ...ws, balances });
            }}
            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Quantity"
            min={0}
          />
          <button
            className="text-red-400 hover:text-red-600 text-sm"
            onClick={() => onChange({ ...ws, balances: ws.balances.filter((_, j) => j !== i) })}
          >
            x
          </button>
        </div>
      ))}
      <button
        className="text-xs text-blue-500 hover:text-blue-700"
        onClick={() => onChange({ ...ws, balances: [...ws.balances, { publisherProductId: '', quantity: 0 }] })}
      >
        + Add Balance
      </button>
    </div>
  );
}

function WizardSectionStoreTheme({ ws, onChange, appData }: { ws: WizardState; onChange: (ws: WizardState) => void; appData: AppchargeData | null }) {
  const availableAssets = appData?.assets || [];
  const fields: { key: keyof WizardState['storeTheme']; label: string }[] = [
    { key: 'bgImageMobile', label: 'BG Image Mobile' },
    { key: 'bgImageDesktop', label: 'BG Image Desktop' },
    { key: 'bannerImage', label: 'Banner Image' },
  ];

  return (
    <div className="space-y-3">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ws.storeTheme[key]}
              onChange={(e) => onChange({ ...ws, storeTheme: { ...ws.storeTheme, [key]: e.target.value } })}
              placeholder="URL..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {availableAssets.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onChange({ ...ws, storeTheme: { ...ws.storeTheme, [key]: e.target.value } });
                }}
                className="w-40 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Pick asset...</option>
                {availableAssets.map((a: any, i: number) => (
                  <option key={i} value={a.imageUrl || ''}>
                    {a.name || `Asset ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          {ws.storeTheme[key] && (
            <img
              src={ws.storeTheme[key]}
              alt={label}
              className="mt-1 h-12 rounded border border-gray-200 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function KeyValueEditor({ entries, onChange, keyPlaceholder, valuePlaceholder }: {
  entries: { key: string; value: string }[];
  onChange: (entries: { key: string; value: string }[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={entry.key}
            onChange={(e) => {
              const updated = [...entries];
              updated[i] = { ...updated[i], key: e.target.value };
              onChange(updated);
            }}
            placeholder={keyPlaceholder || 'Key'}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={entry.value}
            onChange={(e) => {
              const updated = [...entries];
              updated[i] = { ...updated[i], value: e.target.value };
              onChange(updated);
            }}
            placeholder={valuePlaceholder || 'Value'}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            className="text-red-400 hover:text-red-600 text-sm"
            onClick={() => onChange(entries.filter((_, j) => j !== i))}
          >
            x
          </button>
        </div>
      ))}
      <button
        className="text-xs text-blue-500 hover:text-blue-700"
        onClick={() => onChange([...entries, { key: '', value: '' }])}
      >
        + Add
      </button>
    </div>
  );
}

// ─── PersonalizationTool (Wizard) ───

function PersonalizationTool() {
  const [wizardState, setWizardState] = useState<WizardState>(defaultWizardState);
  const [appchargeData, setAppchargeData] = useState<AppchargeData | null>(null);

  // Fetch config
  const [fetchEnvType, setFetchEnvType] = useState('staging');
  const [fetchToken, setFetchToken] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Payload state
  const [payload, setPayload] = useState('{}');
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  // Events & logs
  const [events, setEvents] = useState<{ id: string; timestamp: string; body: Record<string, unknown> }[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Right panel
  const [rightTab, setRightTab] = useState<'payload' | 'events' | 'apiLogs'>('payload');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Wizard sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general']));

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Build payload whenever wizard state changes
  useEffect(() => {
    const built = buildPayloadFromWizard(wizardState);
    setPayload(built);
    setSaved(false);
  }, [wizardState]);

  // Data fetching
  async function fetchData() {
    try {
      const data = await api.getToolsPersonalization();
      setPayload(data.payload);
      setEvents(data.events || []);
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const allLogs = await api.getLogs();
      const toolsLogs = allLogs.filter((l: any) => l.path?.includes('/api/tools/'));
      setApiLogs(toolsLogs);
    } catch {
      // ignore
    }
  }

  useEffect(() => { fetchData(); fetchLogs(); }, []);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getToolsPersonalization();
        setEvents(data.events || []);
      } catch { /* ignore */ }
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleFetchAppcharge() {
    setFetching(true);
    setFetchError('');
    try {
      const data = await api.fetchToolsAppchargeData(fetchEnvType, fetchToken);
      setAppchargeData(data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch');
    } finally {
      setFetching(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateToolsPersonalization(payload);
      setSaved(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const [refreshing, setRefreshing] = useState(false);

  async function handleRefreshStore() {
    if (!fetchToken) return;
    setRefreshing(true);
    try {
      await api.toolsRefreshStore(fetchEnvType, fetchToken);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }

  async function handleClearEvents() {
    try { await api.clearToolsEvents(); setEvents([]); } catch { /* ignore */ }
  }

  function handleResetPayload() {
    const built = buildPayloadFromWizard(wizardState);
    setPayload(built);
    setSaved(false);
  }

  function handleResetAll() {
    const ws = defaultWizardState();
    setWizardState(ws);
    setPayload(buildPayloadFromWizard(ws));
    setSaved(false);
  }

  function toggleEvent(id: string) {
    setExpandedEvents((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleLog(id: string) {
    setExpandedLogs((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>;

  const personalizationUrl = `${window.location.origin}/api/tools/personalization`;
  const eventsUrl = `${window.location.origin}/api/tools/events`;

  const fetchSummary = appchargeData
    ? `${appchargeData.offers.length} offers, ${appchargeData.products.length} products, ${appchargeData.offerDesigns.length} designs, ${appchargeData.badges.length} badges, ${appchargeData.assets.length} assets`
    : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left — Wizard */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1 pb-4" style={{ scrollbarWidth: 'thin' }}>
        {/* Env config bar */}
        <PapiEnvConfig
          envType={fetchEnvType}
          token={fetchToken}
          fetching={fetching}
          fetchError={fetchError}
          summary={fetchSummary}
          onEnvTypeChange={setFetchEnvType}
          onTokenChange={setFetchToken}
          onFetch={handleFetchAppcharge}
        />

        {/* Wizard sections */}
        <CollapsibleSection title="General Settings" expanded={expandedSections.has('general')} onToggle={() => toggleSection('general')}>
          <WizardSectionGeneral ws={wizardState} onChange={setWizardState} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Offers"
          badge={ws_offers_badge(wizardState)}
          expanded={expandedSections.has('offers')}
          onToggle={() => toggleSection('offers')}
        >
          <WizardSectionOffers ws={wizardState} onChange={setWizardState} appData={appchargeData} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Balances"
          badge={wizardState.balances.length > 0 ? String(wizardState.balances.length) : undefined}
          expanded={expandedSections.has('balances')}
          onToggle={() => toggleSection('balances')}
        >
          <WizardSectionBalances ws={wizardState} onChange={setWizardState} appData={appchargeData} />
        </CollapsibleSection>

        <CollapsibleSection title="Store Theme" expanded={expandedSections.has('storeTheme')} onToggle={() => toggleSection('storeTheme')}>
          <WizardSectionStoreTheme ws={wizardState} onChange={setWizardState} appData={appchargeData} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Session Metadata"
          badge={wizardState.sessionMetadata.length > 0 ? String(wizardState.sessionMetadata.length) : undefined}
          expanded={expandedSections.has('metadata')}
          onToggle={() => toggleSection('metadata')}
        >
          <KeyValueEditor
            entries={wizardState.sessionMetadata}
            onChange={(entries) => setWizardState({ ...wizardState, sessionMetadata: entries })}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Attributes"
          badge={wizardState.attributes.length > 0 ? String(wizardState.attributes.length) : undefined}
          expanded={expandedSections.has('attributes')}
          onToggle={() => toggleSection('attributes')}
        >
          <KeyValueEditor
            entries={wizardState.attributes}
            onChange={(entries) => setWizardState({ ...wizardState, attributes: entries })}
            keyPlaceholder="Attribute key"
            valuePlaceholder="Attribute value"
          />
        </CollapsibleSection>
      </div>

      {/* Right — Tabbed pane: Payload / Events / API Calls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-3">
          {(['payload', 'events', 'apiLogs'] as const).map((tab) => {
            const labels: Record<string, string> = { payload: 'Payload', events: 'Events', apiLogs: 'API Calls' };
            const counts: Record<string, number> = { payload: 0, events: events.length, apiLogs: apiLogs.length };
            return (
              <button
                key={tab}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  rightTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setRightTab(tab)}
              >
                {labels[tab]}
                {counts[tab] > 0 && (
                  <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{counts[tab]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Payload tab */}
        {rightTab === 'payload' && (
          <div className="flex flex-col flex-1">
            <div className="mb-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between">
              <code className="text-xs text-gray-600 truncate">{personalizationUrl}</code>
              <CopyButton text={personalizationUrl} />
            </div>
            <textarea
              className="w-full flex-1 min-h-[300px] px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              value={payload}
              onChange={(e) => { setPayload(e.target.value); setSaved(false); }}
              placeholder="{}"
              spellCheck={false}
            />
            <div className="flex gap-2 mt-2">
              <button
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={saving || saved}
                onClick={handleSave}
              >
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
              </button>
              <button
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={refreshing || !fetchToken}
                onClick={handleRefreshStore}
              >
                {refreshing ? 'Refreshing...' : 'Refresh Store'}
              </button>
              <button
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                onClick={handleResetPayload}
              >
                Reset Payload
              </button>
              <button
                className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                onClick={handleResetAll}
              >
                Reset All
              </button>
            </div>
          </div>
        )}

        {/* Events tab */}
        {rightTab === 'events' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200 flex-1 mr-2">
                <code className="text-xs text-gray-600 truncate">{eventsUrl}</code>
                <CopyButton text={eventsUrl} />
              </div>
              <button
                className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                disabled={events.length === 0}
                onClick={handleClearEvents}
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md min-h-[300px]">
              {events.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  No events received yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {events.map((event) => {
                    const isExpanded = expandedEvents.has(event.id);
                    const eventName = (event.body as any).eventName || (event.body as any).type || 'event';
                    return (
                      <div key={event.id}>
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => toggleEvent(event.id)}
                        >
                          <span className={`text-gray-400 text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9658;</span>
                          <span className="text-xs font-medium text-gray-700 truncate flex-1">{eventName}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all font-mono bg-gray-50 rounded p-2">
                              {JSON.stringify(event.body, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* API Calls tab */}
        {rightTab === 'apiLogs' && (
          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md min-h-[300px]">
            {apiLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No API calls logged yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {apiLogs.map((log: any) => {
                  const isExpanded = expandedLogs.has(log.id);
                  return (
                    <div key={log.id}>
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => toggleLog(log.id)}
                      >
                        <span className={`text-gray-400 text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9658;</span>
                        <span className="text-xs font-semibold text-gray-700">{log.method}</span>
                        <span className="text-xs text-gray-500 font-mono truncate flex-1">{log.path}</span>
                        <span className={`text-xs font-medium flex-shrink-0 ${log.responseStatus < 400 ? 'text-green-600' : 'text-red-600'}`}>
                          {log.responseStatus}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-2 space-y-2">
                          <div>
                            <div className="text-[10px] font-medium text-gray-500 mb-0.5">Request Body</div>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all font-mono bg-gray-50 rounded p-2">
                              {log.requestBody ? JSON.stringify(log.requestBody, null, 2) : '-'}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-gray-500 mb-0.5">Response Body</div>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all font-mono bg-gray-50 rounded p-2">
                              {log.responseBody ? JSON.stringify(log.responseBody, null, 2) : '-'}
                            </pre>
                          </div>
                          <div className="text-[10px] text-gray-400">{log.durationMs}ms</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ws_offers_badge(ws: WizardState): string | undefined {
  return ws.offers.length > 0 ? `${ws.offers.length} configured` : undefined;
}

function ApiLogStatusBadge({ status }: { status: number }) {
  const color = status >= 200 && status < 300 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${color}`}>{status}</span>;
}

function ApiLogEntryRow({ entry }: { entry: DupApiLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const methodColor: Record<string, string> = {
    get: 'text-green-400', post: 'text-yellow-400', put: 'text-blue-400', delete: 'text-red-400',
  };

  return (
    <div className="border-b border-gray-700/50 last:border-0">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-700/50 text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`font-mono font-bold uppercase w-10 flex-shrink-0 ${methodColor[entry.method.toLowerCase()] || 'text-gray-400'}`}>
          {entry.method}
        </span>
        <span className="text-gray-300 truncate flex-1 font-mono">
          {entry.url.replace(/https?:\/\/[^/]+/, '')}
        </span>
        <ApiLogStatusBadge status={entry.status} />
      </div>
      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          {entry.requestBody != null && (
            <div>
              <div className="text-[10px] text-gray-500 font-medium mb-0.5">Request Body:</div>
              <pre className="text-[10px] text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                {JSON.stringify(entry.requestBody, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <div className="text-[10px] text-gray-500 font-medium mb-0.5">Response:</div>
            <pre className="text-[10px] text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
              {JSON.stringify(entry.responseBody, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DupApiLogPanel({
  fetchLogs,
  duplicateLogs,
  onClearFetch,
  onClearDuplicate,
}: {
  fetchLogs: DupApiLogEntry[];
  duplicateLogs: DupApiLogEntry[];
  onClearFetch: () => void;
  onClearDuplicate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'fetch' | 'duplicate'>('fetch');
  const logs = activeTab === 'fetch' ? fetchLogs : duplicateLogs;

  return (
    <div className="bg-gray-800 rounded-lg flex flex-col h-full overflow-hidden">
      <div className="flex items-center border-b border-gray-700 flex-shrink-0">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'fetch' ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('fetch')}
        >
          Fetch ({fetchLogs.length})
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'duplicate' ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('duplicate')}
        >
          Duplicate ({duplicateLogs.length})
        </button>
        {logs.length > 0 && (
          <button
            className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => activeTab === 'fetch' ? onClearFetch() : onClearDuplicate()}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-xs text-gray-500 p-3">No API calls yet</div>
        ) : (
          logs.map((entry, i) => <ApiLogEntryRow key={i} entry={entry} />)
        )}
      </div>
    </div>
  );
}

function DuplicationTool() {
  const [activeTab, setActiveTab] = useState<'duplicate' | 'delete'>('duplicate');
  const [dupSubTab, setDupSubTab] = useState<'source' | 'target'>('source');

  const [sourceEnv, setSourceEnv] = useState<DupEnvType>('sandbox');
  const [sourceToken, setSourceToken] = useState('');
  const [targetEnv, setTargetEnv] = useState<DupEnvType>('sandbox');
  const [targetToken, setTargetToken] = useState('');

  const [deleteEnv, setDeleteEnv] = useState<DupEnvType>('sandbox');
  const [deleteToken, setDeleteToken] = useState('');

  const [sourceData, setSourceData] = useState<DupFetchSourceResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<DupProgressEvent[]>([]);
  const [summary, setSummary] = useState<DupDuplicationSummary | null>(null);
  const [fetchApiLogs, setFetchApiLogs] = useState<DupApiLogEntry[]>([]);
  const [duplicateApiLogs, setDuplicateApiLogs] = useState<DupApiLogEntry[]>([]);

  const [stepStatuses, setStepStatuses] = useState<Record<number, StepStatus>>({
    1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending',
  });

  function handleStepEvent(eventType: string, data: unknown) {
    const { step } = data as { step: number };
    if (eventType === 'stepStart') {
      setStepStatuses((prev) => ({ ...prev, [step]: 'in_progress' }));
    } else if (eventType === 'stepComplete') {
      setStepStatuses((prev) => ({ ...prev, [step]: 'completed' }));
    } else if (eventType === 'stepFailed') {
      setStepStatuses((prev) => ({ ...prev, [step]: 'failed' }));
    }
  }

  function runSSE(res: Response) {
    return readSSEStream(
      res,
      (event) => setLogs((prev) => [...prev, event]),
      (s) => setSummary(s),
      (entry) => setDuplicateApiLogs((prev) => [entry, ...prev]),
      handleStepEvent
    );
  }

  function resetLogs() {
    setLogs([]);
    setSummary(null);
  }

  function resetSteps() {
    setStepStatuses({ 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending' });
  }

  function handleRemoveSourceItems(key: keyof DupFetchSourceResponse, indices: number[]) {
    if (!sourceData) return;
    const items = [...sourceData[key]];
    for (const i of indices) {
      items.splice(i, 1);
    }
    setSourceData({ ...sourceData, [key]: items });
  }

  async function handleFetch() {
    setFetching(true);
    setFetchError('');
    setSourceData(null);
    resetLogs();

    try {
      const res = await api.toolsFetchSource(sourceEnv, sourceToken);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      let fetchedData: DupFetchSourceResponse | null = null;
      let fetchErr: string | null = null;

      await readSSEStream(
        res,
        () => {},
        () => {},
        (entry) => setFetchApiLogs((prev) => [entry, ...prev]),
        (eventType, data) => {
          if (eventType === 'result') fetchedData = data as DupFetchSourceResponse;
          else if (eventType === 'error') fetchErr = (data as any).error;
        }
      );

      if (fetchErr) throw new Error(fetchErr);
      if (fetchedData) setSourceData(fetchedData);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch source');
    } finally {
      setFetching(false);
    }
  }

  async function handleDuplicate() {
    if (!sourceData) return;
    setBusy(true);
    resetLogs();
    resetSteps();

    try {
      const res = await api.toolsDuplicate({
        source: { envType: sourceEnv, publisherToken: sourceToken },
        target: { envType: targetEnv, publisherToken: targetToken },
        sourceData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await runSSE(res);
    } catch (err: any) {
      setLogs((prev) => [...prev, { entityType: 'product' as DupEntityType, name: 'system', status: 'failed', message: `Connection error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicateType(entityType: DupEntityType, offerType?: string) {
    if (!sourceData) return;
    setBusy(true);
    resetLogs();

    try {
      const res = await api.toolsDuplicateType({
        source: { envType: sourceEnv, publisherToken: sourceToken },
        target: { envType: targetEnv, publisherToken: targetToken },
        sourceData,
        entityType,
        offerType,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await runSSE(res);
    } catch (err: any) {
      setLogs((prev) => [...prev, { entityType, name: 'system', status: 'failed', message: `Connection error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entityType: DupEntityType) {
    const label = entityType === 'offerDesign' ? 'offer designs' : entityType === 'pricePoint' ? 'price points' : `${entityType}s`;
    if (!confirm(`Delete ALL ${label} from the target environment?`)) return;

    setBusy(true);
    resetLogs();

    try {
      const res = await api.toolsDeleteEntities({ envType: deleteEnv, publisherToken: deleteToken, entityType });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await runSSE(res);
    } catch (err: any) {
      setLogs((prev) => [...prev, { entityType, name: 'system', status: 'failed', message: `Connection error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAll() {
    if (!confirm('Delete ALL offers, badges, products, price points, and assets from the target environment?')) return;

    setBusy(true);
    resetLogs();

    const totalSummary: DupDuplicationSummary = { success: 0, skipped: 0, failed: 0 };

    for (const entityType of ['offer', 'badge', 'product', 'pricePoint', 'asset'] as DupEntityType[]) {
      try {
        const res = await api.toolsDeleteEntities({ envType: deleteEnv, publisherToken: deleteToken, entityType });
        await readSSEStream(
          res,
          (event) => setLogs((prev) => [...prev, event]),
          (s) => { totalSummary.success += s.success; totalSummary.skipped += s.skipped; totalSummary.failed += s.failed; },
          (entry) => setDuplicateApiLogs((prev) => [entry, ...prev])
        );
      } catch (err: any) {
        setLogs((prev) => [...prev, { entityType, name: 'system', status: 'failed', message: `Connection error: ${err.message}` }]);
      }
    }

    setSummary(totalSummary);
    setBusy(false);
  }

  // Asset type multi-select for deletion
  const [assetDeleteOpen, setAssetDeleteOpen] = useState(false);
  const [assetTypeOptions, setAssetTypeOptions] = useState<{ type: string; count: number }[]>([]);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<Set<string>>(new Set());
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(false);

  async function handleOpenAssetDelete() {
    if (assetDeleteOpen) {
      setAssetDeleteOpen(false);
      return;
    }
    setLoadingAssetTypes(true);
    setAssetDeleteOpen(true);
    try {
      const res = await api.toolsFetchSource(deleteEnv, deleteToken);
      if (!res.ok) throw new Error('Failed to fetch');
      let data: DupFetchSourceResponse | null = null;
      await readSSEStream(res, () => {}, () => {}, () => {}, (eventType, d) => {
        if (eventType === 'result') data = d as DupFetchSourceResponse;
      });
      if (!data) throw new Error('No data');
      const fetched = data as DupFetchSourceResponse;
      const counts: Record<string, number> = {};
      for (const a of fetched.assets || []) {
        const t = String((a as any).type || 'Unknown');
        counts[t] = (counts[t] || 0) + 1;
      }
      const options = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({ type, count }));
      setAssetTypeOptions(options);
      setSelectedAssetTypes(new Set(options.map((o) => o.type)));
    } catch {
      setAssetTypeOptions([]);
      setSelectedAssetTypes(new Set());
    } finally {
      setLoadingAssetTypes(false);
    }
  }

  function toggleAssetType(type: string) {
    setSelectedAssetTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleDeleteAssets() {
    const types = Array.from(selectedAssetTypes);
    if (types.length === 0) return;
    const label = types.length === assetTypeOptions.length ? 'ALL assets' : `assets of type: ${types.join(', ')}`;
    if (!confirm(`Delete ${label} from the target environment?`)) return;

    setAssetDeleteOpen(false);
    setBusy(true);
    resetLogs();

    try {
      const res = await api.toolsDeleteEntities({ envType: deleteEnv, publisherToken: deleteToken, entityType: 'asset', assetTypes: types });
      await runSSE(res);
    } catch (err: any) {
      setLogs((prev) => [...prev, { entityType: 'asset' as DupEntityType, name: 'system', status: 'failed', message: `Connection error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const canFetch = sourceToken.length > 0 && !fetching;
  const canDuplicate = sourceData !== null && targetToken.length > 0 && !busy;
  const canDelete = deleteToken.length > 0 && !busy;

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Duplicate / Delete tabs */}
        <div className="flex gap-1 mb-4">
          <button
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'duplicate'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('duplicate')}
          >
            Duplicate
          </button>
          <button
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'delete'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('delete')}
          >
            Delete
          </button>
        </div>

        {activeTab === 'duplicate' && (
          <>
            {/* Source / Target sub-tabs */}
            <div className="flex gap-1 mb-4">
              <button
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  dupSubTab === 'source'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => setDupSubTab('source')}
              >
                Source
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  dupSubTab === 'target'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => setDupSubTab('target')}
              >
                Target
              </button>
            </div>

            {dupSubTab === 'source' && (
              <>
                <EnvConfigPanel
                  title="Source Environment"
                  envType={sourceEnv}
                  token={sourceToken}
                  onEnvTypeChange={setSourceEnv}
                  onTokenChange={setSourceToken}
                  actionButton={
                    <button
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      disabled={!canFetch}
                      onClick={handleFetch}
                    >
                      {fetching ? 'Fetching...' : 'Fetch Source'}
                    </button>
                  }
                />

                {fetchError && (
                  <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                    {fetchError}
                  </div>
                )}
                {fetching && (
                  <div className="mt-3 text-sm text-gray-500">Fetching entities from source...</div>
                )}

                {sourceData && <EntityCards data={sourceData} onRemoveItems={handleRemoveSourceItems} />}
              </>
            )}

            {dupSubTab === 'target' && (
              <>
                <EnvConfigPanel
                  title="Target Environment"
                  envType={targetEnv}
                  token={targetToken}
                  onEnvTypeChange={setTargetEnv}
                  onTokenChange={setTargetToken}
                />

                <DuplicationStepper
                  stepStatuses={stepStatuses}
                  busy={busy}
                  canDuplicate={canDuplicate}
                  onDuplicateAll={handleDuplicate}
                  onDuplicateType={handleDuplicateType}
                />

                <DuplicationLog logs={logs} summary={summary} />
              </>
            )}
          </>
        )}

        {activeTab === 'delete' && (
          <>
            <EnvConfigPanel
              title="Target Environment"
              envType={deleteEnv}
              token={deleteToken}
              onEnvTypeChange={setDeleteEnv}
              onTokenChange={setDeleteToken}
            />

            <div className="mt-4 flex flex-wrap gap-2 items-start">
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled={!canDelete} onClick={() => handleDelete('product')}>Delete Products</button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled={!canDelete} onClick={() => handleDelete('badge')}>Delete Badges</button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled={!canDelete} onClick={() => handleDelete('offer')}>Delete Offers</button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled={!canDelete} onClick={() => handleDelete('pricePoint')}>Delete Price Points</button>

              {/* Asset delete with type selector */}
              <div className="relative">
                <button
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={!canDelete}
                  onClick={handleOpenAssetDelete}
                >
                  Delete Assets {assetDeleteOpen ? '\u25B4' : '\u25BE'}
                </button>
                {assetDeleteOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px] p-3">
                    {loadingAssetTypes ? (
                      <div className="text-xs text-gray-400 py-2">Loading types...</div>
                    ) : assetTypeOptions.length === 0 ? (
                      <div className="text-xs text-gray-400 py-2">No assets found</div>
                    ) : (
                      <>
                        <div className="space-y-1.5 mb-2">
                          {assetTypeOptions.map(({ type, count }) => (
                            <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedAssetTypes.has(type)}
                                onChange={() => toggleAssetType(type)}
                                className="rounded"
                              />
                              <span className="text-gray-700">{type}</span>
                              <span className="text-gray-400 ml-auto">({count})</span>
                            </label>
                          ))}
                        </div>
                        <button
                          className="w-full px-2 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          disabled={selectedAssetTypes.size === 0}
                          onClick={handleDeleteAssets}
                        >
                          Delete Selected ({selectedAssetTypes.size})
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!canDelete}
                onClick={handleDeleteAll}
              >
                Delete All
              </button>
            </div>

            <DuplicationLog logs={logs} summary={summary} />
          </>
        )}
      </div>

      {/* API Log Panel */}
      <div className="w-[380px] flex-shrink-0">
        <DupApiLogPanel
          fetchLogs={fetchApiLogs}
          duplicateLogs={duplicateApiLogs}
          onClearFetch={() => setFetchApiLogs([])}
          onClearDuplicate={() => setDuplicateApiLogs([])}
        />
      </div>
    </div>
  );
}
