import { useState, useEffect, useRef } from 'react';
import type { ApiLogEntry } from 'shared/types';

export function useApiLogs() {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Fetch existing logs
    fetch('/api/dashboard/logs')
      .then((r) => r.json())
      .then((data) => setLogs(data))
      .catch(() => {});

    // Connect SSE
    const es = new EventSource('/api/dashboard/logs/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: ApiLogEntry = JSON.parse(event.data);
        setLogs((prev) => [entry, ...prev]);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      es.close();
    };
  }, []);

  const clearLogs = async () => {
    await fetch('/api/dashboard/logs', { method: 'DELETE' });
    setLogs([]);
  };

  return { logs, clearLogs };
}
