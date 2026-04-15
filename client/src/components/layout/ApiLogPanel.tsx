import { useState, useEffect } from 'react';
import { useApiLogs } from '../../hooks/useApiLogs';
import { api } from '../../hooks/api';
import type { AppchargeEvent } from 'shared/types';
import JsonViewer from '../logs/JsonViewer';

const categoryColors: Record<string, string> = {
  auth: 'bg-blue-100 text-blue-800',
  personalization: 'bg-purple-100 text-purple-800',
  award: 'bg-green-100 text-green-800',
  event: 'bg-yellow-100 text-yellow-800',
  refresh: 'bg-orange-100 text-orange-800',
  sync: 'bg-cyan-100 text-cyan-800',
};

type PanelTab = 'apis' | 'events';

export default function ApiLogPanel() {
  const { logs, clearLogs } = useApiLogs();
  const [isOpen, setIsOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>('apis');

  // Events state
  const [events, setEvents] = useState<AppchargeEvent[]>([]);

  useEffect(() => {
    const load = () => api.getEvents().then(setEvents).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearEvents = async () => {
    await api.clearEvents();
    setEvents([]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-sidebar text-white px-2 py-4 rounded-l-lg text-xs writing-mode-vertical"
        style={{ writingMode: 'vertical-rl' }}
      >
        API Logs ({logs.length})
      </button>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <aside className="w-96 bg-gray-900 text-gray-100 flex flex-col min-h-screen border-l border-gray-700">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('apis')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              tab === 'apis' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            APIs ({logs.filter((l) => l.category !== 'event').length})
          </button>
          <button
            onClick={() => setTab('events')}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              tab === 'events' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Events ({events.length})
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={tab === 'apis' ? clearLogs : clearEvents}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* APIs tab */}
      {tab === 'apis' && (
        <div className="flex-1 overflow-y-auto">
          {logs.filter((l) => l.category !== 'event').length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-8">No API calls yet</p>
          )}
          {logs.filter((l) => l.category !== 'event').map((log) => (
            <div
              key={log.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full text-left p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[log.category] || 'bg-gray-600 text-gray-200'}`}>
                    {log.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {log.direction === 'inbound' ? '\u2190' : '\u2192'}
                  </span>
                  <span className={`text-xs font-mono ${log.responseStatus < 400 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.responseStatus}
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-nowrap scrollbar-thin">
                  {log.method} {log.path}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(log.timestamp).toLocaleTimeString()} · {log.durationMs}ms
                </div>
              </button>
              {expandedId === log.id && (
                <div className="px-3 pb-3 space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Request Body</p>
                    <JsonViewer data={log.requestBody} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Response Body</p>
                    <JsonViewer data={log.responseBody} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <div className="flex-1 overflow-y-auto">
          {sortedEvents.length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-8">No events yet</p>
          )}
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <button
                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                className="w-full text-left p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    event.category === 'order' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {event.category || 'webstore'}
                  </span>
                  {event.playerId && (
                    <span className="text-xs text-gray-400 font-mono">
                      {event.playerId}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-gray-300">
                  {event.type}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </button>
              {expandedId === event.id && (
                <div className="px-3 pb-3">
                  <JsonViewer data={event.data} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
