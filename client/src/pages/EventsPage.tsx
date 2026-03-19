import { useState, useEffect } from 'react';
import { api } from '../hooks/api';
import type { AppchargeEvent } from 'shared/types';
import JsonViewer from '../components/logs/JsonViewer';

export default function EventsPage() {
  const [events, setEvents] = useState<AppchargeEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

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

  const filtered = events.filter((e) =>
    !filter || e.type.toLowerCase().includes(filter.toLowerCase()) ||
    (e.playerId && e.playerId.includes(filter))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">Events received from Appcharge</p>
        </div>
        <button
          onClick={handleClear}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Clear All
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Filter by type or player ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-12">No events received yet</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((event) => (
              <div key={event.id}>
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                        {event.type}
                      </span>
                      {event.playerId && (
                        <span className="text-xs text-gray-500 font-mono">
                          Player: {event.playerId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                </button>
                {expandedId === event.id && (
                  <div className="px-4 pb-4">
                    <JsonViewer data={event.data} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
