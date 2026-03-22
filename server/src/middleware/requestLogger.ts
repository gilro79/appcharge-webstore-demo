import type { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import type { ApiLogEntry, ApiLogCategory } from 'shared/src/types.js';
import { sseManager } from '../services/sseManager.js';
import { logStore } from '../index.js';

function categorize(path: string): ApiLogCategory {
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/personalization')) return 'personalization';
  if (path.includes('/award')) return 'award';
  if (path.includes('/event')) return 'event';
  if (path.includes('/refresh')) return 'refresh';
  return 'event';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  let responseBody: unknown = null;

  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const entry: ApiLogEntry = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      direction: req.originalUrl.includes('/appcharge/') ? 'inbound' : 'outbound',
      method: req.method,
      path: req.originalUrl,
      category: categorize(req.originalUrl),
      requestBody: req.body || null,
      responseStatus: res.statusCode,
      responseBody,
      durationMs: Date.now() - start,
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
  });

  next();
}
