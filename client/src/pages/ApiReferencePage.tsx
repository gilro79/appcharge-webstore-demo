import { useState, useEffect, useMemo } from 'react';
import { api } from '../hooks/api';
import JsonViewer from '../components/logs/JsonViewer';

interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  method: string;
  path: string;
  category: string;
  requestBody: unknown;
  responseStatus: number;
  responseBody: unknown;
  durationMs: number;
}

interface ApiSection {
  id: string;
  title: string;
  description: string;
  method: string;
  endpoint: string;
  direction: 'inbound' | 'outbound';
  pathMatch: (path: string) => boolean;
  demoRequest: unknown;
  demoResponse: unknown;
}

const API_SECTIONS: ApiSection[] = [
  // ─── Appcharge Webhook Endpoints (inbound) ───
  {
    id: 'auth',
    title: 'Authentication',
    description: 'Called by Appcharge when a player opens the webstore. Validates the player and returns their profile info, name, and avatar. If the player is not recognized, return status "invalid".',
    method: 'POST',
    endpoint: '/api/appcharge/auth',
    direction: 'inbound',
    pathMatch: (p) => p.includes('/appcharge/auth'),
    demoRequest: {
      publisherPlayerId: '1234',
      token: 'session-token-abc',
    },
    demoResponse: {
      status: 'valid',
      publisherPlayerId: '1234',
      playerName: 'Naama',
      playerProfileImage: 'https://res.cloudinary.com/dewxyzl9a/image/upload/v1770802835/Naama_m1vkou.png',
      sessionMetadata: { abTest: 'group1', locale: 'en-US' },
    },
  },
  {
    id: 'personalization',
    title: 'Personalization',
    description: 'Called by Appcharge after authentication to fetch the player\'s personalized offers. Returns which offers to show, their product contents, quantities, and optional design overrides based on the player\'s tier.',
    method: 'POST',
    endpoint: '/api/appcharge/personalization',
    direction: 'inbound',
    pathMatch: (p) => p.includes('/appcharge/personalization'),
    demoRequest: {
      publisherPlayerId: '1234',
    },
    demoResponse: {
      version: 2,
      status: 'valid',
      sessionMetadata: { abTest: 'group1', locale: 'en-US' },
      offersOrder: 'priceLowToHigh',
      offers: [
        {
          publisherOfferId: 'CrownsBundle',
          productsSequence: [
            {
              index: 1,
              products: [
                { publisherProductId: 'CrownSub', quantity: 5, priority: 'Main' },
              ],
              priceInUsdCents: 2000,
            },
          ],
          offerDesignOverride: { offerDesignId: 'BundleOffer' },
        },
      ],
    },
  },
  {
    id: 'award',
    title: 'Award',
    description: 'Called by Appcharge after a successful purchase to award the player their items. The publisher should grant the purchased products to the player\'s account and return a unique purchase ID for reconciliation.',
    method: 'POST',
    endpoint: '/api/appcharge/award',
    direction: 'inbound',
    pathMatch: (p) => p.includes('/appcharge/award'),
    demoRequest: {
      orderId: 'ord-abc123',
      publisherPlayerId: '1234',
      offer: {
        publisherOfferId: 'CrownsBundle',
        products: [
          { publisherProductId: 'CrownSub', quantity: 5 },
        ],
      },
    },
    demoResponse: {
      publisherPurchaseId: 'pur-xyz789',
    },
  },
  {
    id: 'events',
    title: 'Events Webhook',
    description: 'Called by Appcharge to notify the publisher about lifecycle events such as store opened, offer clicked, checkout started, purchase completed, etc. These can be used for analytics and tracking.',
    method: 'POST',
    endpoint: '/api/appcharge/events',
    direction: 'inbound',
    pathMatch: (p) => p.includes('/appcharge/events') && !p.includes('/dashboard/'),
    demoRequest: {
      type: 'purchase.completed',
      playerId: '1234',
      data: {
        orderId: 'ord-abc123',
        offerId: 'CrownsBundle',
        amount: 2000,
        currency: 'USD',
      },
    },
    demoResponse: {
      received: true,
    },
  },

  // ─── Appcharge Platform APIs (outbound) ───
  {
    id: 'get-offers',
    title: 'Get Offers',
    description: 'Fetches all configured offers from the Appcharge platform. Returns offer IDs, types (Bundle, SpecialOffer, RollingOffer, etc.), pricing, product sequences, and associated offer UIs. Used during sync to populate the personalization table.',
    method: 'GET',
    endpoint: 'https://api-sandbox.appcharge.com/v2/offer',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/v2/offer') && !p.includes('/v2/offer/'),
    demoRequest: null,
    demoResponse: {
      offers: [
        {
          publisherOfferId: 'CrownsBundle',
          name: 'CrownsBundle',
          type: 'Bundle',
          active: true,
          productsSequence: [
            { index: 1, products: [{ publisherProductId: 'CrownSub', quantity: 1, priority: 'Main' }], priceInUsdCents: 2000 },
          ],
          offerUi: { offerUiId: '698...', name: 'BundleOffer', offerUiType: 'Bundle' },
        },
      ],
    },
  },
  {
    id: 'create-offer',
    title: 'Create Offer',
    description: 'Creates a new offer on the Appcharge platform. Requires a publisher offer ID, name, type, offer UI, and at least one product sequence block with pricing. The offer will appear in the personalization table after sync.',
    method: 'POST',
    endpoint: 'https://api-sandbox.appcharge.com/v2/offer',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/v2/offer') && !p.includes('/v2/offer/'),
    demoRequest: {
      publisherOfferId: 'new_bundle_offer',
      name: 'New Bundle',
      type: 'Bundle',
      offerUiId: '698...',
      active: true,
      segments: [],
      productsSequence: [
        { index: 1, products: [{ publisherProductId: 'CoinsBag', quantity: 100, priority: 'Main' }], priceInUsdCents: 999 },
      ],
    },
    demoResponse: {
      publisherOfferId: 'new_bundle_offer',
      name: 'New Bundle',
      type: 'Bundle',
      offerId: '69c...',
      createdAt: '2026-03-20T10:00:00.000Z',
    },
  },
  {
    id: 'get-products',
    title: 'Get Products',
    description: 'Fetches all registered products from Appcharge. Products are the virtual items (coins, gems, shields, etc.) that can be included in offers. Used during sync to build product columns in the personalization table.',
    method: 'GET',
    endpoint: 'https://api-sandbox.appcharge.com/components/v1/product',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/components/v1/product'),
    demoRequest: null,
    demoResponse: [
      { publisherProductId: 'CoinsBag', name: 'CoinsBag', type: 'Quantity', productId: '69b...' },
      { publisherProductId: 'CrownSub', name: 'CrownSub', type: 'Quantity', productId: '69b...' },
    ],
  },
  {
    id: 'create-product',
    title: 'Create Product',
    description: 'Registers a new product on the Appcharge platform. Products represent virtual items that can be bundled into offers. After creation, the product becomes available as a column in the personalization table.',
    method: 'POST',
    endpoint: 'https://api-sandbox.appcharge.com/components/v1/product',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/components/v1/product'),
    demoRequest: {
      name: 'DiamondPack',
      publisherProductId: 'DiamondPack',
      type: 'Quantity',
      textFontColorHex: '#ffffff',
      productImageUrl: 'https://example.com/diamond.png',
    },
    demoResponse: {
      publisherProductId: 'DiamondPack',
      name: 'DiamondPack',
      productId: '69c...',
      createdAt: '2026-03-20T10:00:00.000Z',
    },
  },
  {
    id: 'get-offer-designs',
    title: 'Get Offer Designs',
    description: 'Fetches all offer design templates from Appcharge. Each design is tied to an offer type (Bundle, SpecialOffer, RollingOffer, etc.) and controls the visual appearance of the offer in the webstore. Used in the personalization table\'s design dropdown.',
    method: 'GET',
    endpoint: 'https://api-sandbox.appcharge.com/components/v1/offer-design',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/components/v1/offer-design'),
    demoRequest: null,
    demoResponse: [
      { name: 'BundleOffer', externalId: 'BundleOffer', offerUiType: 'Bundle' },
      { name: 'Default RollingOffer', externalId: 'Default_RollingOffer', offerUiType: 'RollingOffer' },
      { name: 'Default SpecialOffer', externalId: 'Default_SpecialOffer', offerUiType: 'SpecialOffer' },
    ],
  },
  {
    id: 'get-price-points',
    title: 'Get Price Points',
    description: 'Fetches all configured price points from Appcharge. Price points define the valid USD prices that can be assigned to offers. Each price point is stored in cents (e.g., 999 = $9.99).',
    method: 'GET',
    endpoint: 'https://api-sandbox.appcharge.com/v1/price-points',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/v1/price-points'),
    demoRequest: null,
    demoResponse: {
      pricePoints: [
        { priceInUsdCents: 199, lastUpdate: '2026-02-08T09:55:40.054Z' },
        { priceInUsdCents: 999, lastUpdate: '2026-02-08T09:55:50.320Z' },
        { priceInUsdCents: 1999, lastUpdate: '2026-02-08T09:56:46.344Z' },
      ],
    },
  },
  {
    id: 'create-price-point',
    title: 'Create Price Point',
    description: 'Creates a new price point on the Appcharge platform. The price is specified in USD cents. If the price point already exists, the API returns an error. New price points become immediately available for assigning to offers.',
    method: 'POST',
    endpoint: 'https://api-sandbox.appcharge.com/v1/price-points',
    direction: 'outbound',
    pathMatch: (p) => p.includes('/v1/price-points'),
    demoRequest: {
      priceInUsdCents: 4999,
    },
    demoResponse: {
      priceInUsdCents: 4999,
      lastUpdate: '2026-03-20T12:00:00.000Z',
    },
  },
];

export default function ApiReferencePage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.getLogs().then(setLogs).catch(() => {});
  }, []);

  // Find the latest matching log for each section
  const latestLogs = useMemo(() => {
    const map = new Map<string, LogEntry>();
    for (const section of API_SECTIONS) {
      // Find matching logs by method + path
      const matching = logs.filter(
        (l) => l.method === section.method && section.pathMatch(l.path),
      );
      if (matching.length > 0) {
        // Already sorted newest-first from server
        map.set(section.id, matching[0]);
      }
    }
    return map;
  }, [logs]);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Reference</h1>
        <p className="text-gray-500 mt-1">All Appcharge integration endpoints with live request/response examples</p>
      </div>

      {/* Quick nav */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Quick Navigation</h2>
        <div className="flex flex-wrap gap-2">
          {API_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#api-${s.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                s.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {s.method}
              </span>
              {s.title}
              {latestLogs.has(s.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Has live data" />
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Webhook endpoints header */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-gray-900">Appcharge Webhook Endpoints</h2>
        <p className="text-sm text-gray-500 mt-1">These endpoints are called by Appcharge and must be configured in the Appcharge dashboard</p>
      </div>

      {API_SECTIONS.filter((s) => s.direction === 'inbound').map((section) => (
        <ApiSectionCard
          key={section.id}
          section={section}
          latestLog={latestLogs.get(section.id)}
          expanded={expandedId === section.id}
          onToggle={() => toggle(section.id)}
        />
      ))}

      {/* Platform APIs header */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold text-gray-900">Appcharge Platform APIs</h2>
        <p className="text-sm text-gray-500 mt-1">Outbound API calls to the Appcharge platform for managing offers, products, designs, and pricing</p>
      </div>

      {API_SECTIONS.filter((s) => s.direction === 'outbound').map((section) => (
        <ApiSectionCard
          key={section.id}
          section={section}
          latestLog={latestLogs.get(section.id)}
          expanded={expandedId === section.id}
          onToggle={() => toggle(section.id)}
        />
      ))}
    </div>
  );
}

function ApiSectionCard({
  section,
  latestLog,
  expanded,
  onToggle,
}: {
  section: ApiSection;
  latestLog?: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasLive = !!latestLog;
  const requestData = hasLive ? latestLog.requestBody : section.demoRequest;
  const responseData = hasLive ? latestLog.responseBody : section.demoResponse;

  return (
    <div id={`api-${section.id}`} className="bg-white rounded-lg shadow-sm border border-gray-200 scroll-mt-4">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${
            section.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}>
            {section.method}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{section.endpoint}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasLive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live data
            </span>
          )}
          {!hasLive && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
              Demo data
            </span>
          )}
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Description */}
          <p className="text-sm text-gray-600 mt-4 mb-4 leading-relaxed">{section.description}</p>

          {/* Endpoint */}
          <div className="mb-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Endpoint</span>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono text-gray-800">{section.method} {section.endpoint}</code>
              {section.direction === 'inbound' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Webhook</span>
              )}
            </div>
          </div>

          {/* Metadata from live log */}
          {hasLive && latestLog && (
            <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
              <span>Status: <span className={`font-medium ${latestLog.responseStatus < 400 ? 'text-green-600' : 'text-red-600'}`}>{latestLog.responseStatus}</span></span>
              <span>Duration: <span className="font-medium text-gray-700">{latestLog.durationMs}ms</span></span>
              <span>Time: <span className="font-medium text-gray-700">{new Date(latestLog.timestamp).toLocaleString()}</span></span>
            </div>
          )}

          {/* Request / Response side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Request */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {section.direction === 'inbound' ? 'Request Body' : 'Request'}
                </span>
                {!hasLive && <span className="text-[10px] text-gray-400 italic">example</span>}
              </div>
              {requestData ? (
                <JsonViewer data={requestData} />
              ) : (
                <div className="text-xs text-gray-400 italic bg-gray-950 rounded p-3">No request body (GET request)</div>
              )}
            </div>

            {/* Response */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response</span>
                {!hasLive && <span className="text-[10px] text-gray-400 italic">example</span>}
              </div>
              <JsonViewer data={responseData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
