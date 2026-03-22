import { useState, useEffect, useMemo } from 'react';
import { api } from '../hooks/api';
import type { AppchargeEvent } from 'shared/types';
import JsonViewer from '../components/logs/JsonViewer';

export default function EventsPage() {
  const [events, setEvents] = useState<AppchargeEvent[]>([]);

  const loadEvents = () => {
    api.getEvents().then(setEvents).catch(() => {});
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    await api.clearEvents();
    setEvents([]);
  };

  const webstoreEvents = useMemo(
    () => events
      .filter((e) => !e.category || e.category === 'webstore')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [events],
  );
  const orderEvents = useMemo(
    () => events
      .filter((e) => e.category === 'order')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [events],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">Events received from Appcharge (max 20 per category saved to DB)</p>
        </div>
        <button
          onClick={handleClear}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Clear All
        </button>
      </div>

      {/* Webstore Events */}
      <EventTable
        title="Webstore Events"
        badge="webstore"
        events={webstoreEvents}
      />

      {/* Order Events */}
      <EventTable
        title="Order Events"
        badge="order"
        events={orderEvents}
      />
    </div>
  );
}

function EventTable({ title, badge, events }: {
  title: string;
  badge: 'webstore' | 'order';
  events: AppchargeEvent[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collect unique data keys across these events, excluding "type" (already shown)
  const dataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of events) {
      for (const key of Object.keys(e.data)) {
        if (key !== 'type') keys.add(key);
      }
    }
    return Array.from(keys);
  }, [events]);

  const badgeClass = badge === 'order'
    ? 'bg-green-100 text-green-800'
    : 'bg-yellow-100 text-yellow-800';

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {events.length}
        </span>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {events.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-10">
            No {badge} events received yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Player ID</th>
                  {dataKeys.map((key) => (
                    <th key={key} className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      {key}
                    </th>
                  ))}
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((event, idx) => (
                  <>
                    <tr key={event.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                        {event.playerId || '—'}
                      </td>
                      {dataKeys.map((key) => {
                        const val = event.data[key];
                        return (
                          <td key={key} className="px-4 py-2 text-gray-600 text-xs max-w-[200px] truncate">
                            {val === null || val === undefined
                              ? '—'
                              : typeof val === 'object'
                                ? JSON.stringify(val)
                                : String(val)}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-4 h-4 transition-transform ${expandedId === event.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    {expandedId === event.id && (
                      <tr key={`${event.id}-detail`}>
                        <td colSpan={4 + dataKeys.length} className="px-4 py-3 bg-gray-50">
                          <JsonViewer data={event.data} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
