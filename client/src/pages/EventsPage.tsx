import { useState, useEffect, useMemo } from 'react';
import { api } from '../hooks/api';
import type { AppchargeEvent } from 'shared/types';
import JsonViewer from '../components/logs/JsonViewer';

type Tab = 'webstore' | 'payment';

export default function EventsPage() {
  const [events, setEvents] = useState<AppchargeEvent[]>([]);
  const [tab, setTab] = useState<Tab>('webstore');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    () => events.filter((e) => !e.category || e.category === 'webstore'),
    [events],
  );
  const paymentEvents = useMemo(
    () => events.filter((e) => e.category === 'payment'),
    [events],
  );

  const activeEvents = tab === 'webstore' ? webstoreEvents : paymentEvents;

  // Collect all unique data keys across active events for table columns
  const dataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of activeEvents) {
      for (const key of Object.keys(e.data)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [activeEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">Events received from Appcharge</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {webstoreEvents.length} webstore, {paymentEvents.length} payment
          </span>
          <button
            onClick={handleClear}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setTab('webstore')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'webstore'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Webstore Events
            {webstoreEvents.length > 0 && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {webstoreEvents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('payment')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'payment'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payment Events
            {paymentEvents.length > 0 && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {paymentEvents.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Events table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {activeEvents.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-12">
            No {tab} events received yet
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
                  <th className="px-4 py-2 text-center font-medium text-gray-600 whitespace-nowrap w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeEvents.map((event, idx) => (
                  <>
                    <tr key={event.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          tab === 'payment' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
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
                      <td className="px-4 py-2 text-center">
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
                      <tr key={`${event.id}-detail`} className="bg-gray-50">
                        <td colSpan={4 + dataKeys.length} className="px-4 py-3">
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
