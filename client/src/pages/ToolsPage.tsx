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
    <div className="min-h-screen bg-gray-50">
      {/* Standalone header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
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

      <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Tools</h1>

      {/* Top-level tool tabs */}
      <div className="flex border-b border-gray-200 mb-6">
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

      {toolTab === 'duplication' && <DuplicationTool />}
      {toolTab === 'personalization' && (
        <div className="text-sm text-gray-400 italic">Personalization tool coming soon.</div>
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
      () => {},
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
        () => {},
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
          () => {}
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
    <>
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
    </>
  );
}
