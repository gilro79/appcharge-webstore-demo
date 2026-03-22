import { v4 as uuid } from 'uuid';
import type { ApiLogEntry, ApiLogCategory } from 'shared/src/types.js';
import { logStore } from '../index.js';
import { sseManager } from './sseManager.js';

/**
 * Logs an outbound API call to the API logs panel.
 */
export function logOutboundCall(opts: {
  method: string;
  url: string;
  category: ApiLogCategory;
  requestBody: unknown;
  responseStatus: number;
  responseBody: unknown;
  durationMs: number;
}): void {
  const entry: ApiLogEntry = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    direction: 'outbound',
    method: opts.method,
    path: opts.url,
    category: opts.category,
    requestBody: opts.requestBody,
    responseStatus: opts.responseStatus,
    responseBody: opts.responseBody,
    durationMs: opts.durationMs,
  };

  logStore.create(entry);
  sseManager.broadcast(entry);

  // Keep only the 20 most recent logs in the DB
  const all = logStore.getAll();
  if (all.length > 20) {
    const sorted = all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    for (const old of sorted.slice(20)) {
      logStore.delete(old.id);
    }
  }
}
