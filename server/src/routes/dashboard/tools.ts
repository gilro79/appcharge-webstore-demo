import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchAll, createEntity, deleteEntity } from '../../services/envDuplication.js';
import type {
  DupFetchSourceRequest,
  DupFetchSourceResponse,
  DupDuplicateRequest,
  DupEntityType,
  DupProgressEvent,
  DupDuplicationSummary,
  DupApiLogEntry,
  DupApiLogger,
} from 'shared/src/types.js';

const router = Router();

// Helper: set up SSE + logger for streaming endpoints
function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (event: DupProgressEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const sendApiLog = (entry: DupApiLogEntry) => {
    res.write(`event: apiLog\ndata: ${JSON.stringify(entry)}\n\n`);
  };
  const sendDone = (summary: DupDuplicationSummary) => {
    res.write(`event: done\ndata: ${JSON.stringify(summary)}\n\n`);
    res.end();
  };
  const logger: DupApiLogger = (entry) => sendApiLog(entry);

  return { sendEvent, sendDone, logger };
}

// Build a map from source offerUiId (_id) to target externalId
function buildOfferUiIdMap(
  sourceDesigns: Record<string, unknown>[],
  targetDesigns: Record<string, unknown>[]
): Map<string, string> {
  const map = new Map<string, string>();

  const sourceById = new Map<string, { externalId: string; offerUiType: string }>();
  for (const sd of sourceDesigns) {
    const id = String(sd._id || '');
    const externalId = String(sd.externalId || '');
    const offerUiType = String(sd.offerUiType || '');
    if (id) sourceById.set(id, { externalId, offerUiType });
  }

  const targetByExternalId = new Map<string, string>();
  const targetByType = new Map<string, string>();
  for (const td of targetDesigns) {
    const externalId = String(td.externalId || '');
    const offerUiType = String(td.offerUiType || '');
    if (externalId) targetByExternalId.set(externalId, externalId);
    if (offerUiType && !targetByType.has(offerUiType)) targetByType.set(offerUiType, externalId);
  }

  for (const [sourceId, { externalId, offerUiType }] of sourceById) {
    const targetExternalId = targetByExternalId.get(externalId);
    if (targetExternalId) {
      map.set(sourceId, targetExternalId);
    } else {
      const fallback = targetByType.get(offerUiType);
      if (fallback) map.set(sourceId, fallback);
    }
  }

  return map;
}

// POST /fetch-source — fetch all entities from a source env
router.post('/fetch-source', async (req: Request, res: Response) => {
  const { envType, publisherToken } = req.body as DupFetchSourceRequest;

  if (!envType || !publisherToken) {
    res.status(400).json({ error: 'envType and publisherToken are required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const logger: DupApiLogger = (entry) => {
    res.write(`event: apiLog\ndata: ${JSON.stringify(entry)}\n\n`);
  };

  try {
    const [products, offerDesigns, badges, offers, pricePoints, assets] = await Promise.all([
      fetchAll(envType, publisherToken, 'product', logger),
      fetchAll(envType, publisherToken, 'offerDesign', logger),
      fetchAll(envType, publisherToken, 'badge', logger),
      fetchAll(envType, publisherToken, 'offer', logger),
      fetchAll(envType, publisherToken, 'pricePoint', logger),
      fetchAll(envType, publisherToken, 'asset', logger),
    ]);

    const result: DupFetchSourceResponse = { products, offerDesigns, badges, offers, pricePoints, assets };
    res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
  } catch (err: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Failed to fetch source data' })}\n\n`);
  }

  res.end();
});

// POST /duplicate — duplicate all entities (4-step flow)
router.post('/duplicate', async (req: Request, res: Response) => {
  const { target, sourceData } = req.body as DupDuplicateRequest;

  if (!target?.envType || !target?.publisherToken || !sourceData) {
    res.status(400).json({ error: 'target config and sourceData are required' });
    return;
  }

  const { sendEvent, sendDone, logger } = setupSSE(res);
  const summary: DupDuplicationSummary = { success: 0, skipped: 0, failed: 0 };

  let offerUiIdMap = new Map<string, string>();
  try {
    const targetDesigns = await fetchAll(target.envType, target.publisherToken, 'offerDesign', logger);
    offerUiIdMap = buildOfferUiIdMap(sourceData.offerDesigns, targetDesigns);
  } catch (err: any) {
    sendEvent({ entityType: 'offerDesign', name: 'system', status: 'failed', message: `Warning: could not fetch target offer designs: ${err.message}` });
  }

  async function duplicateEntities(entities: Record<string, unknown>[], entityType: DupEntityType, nameField: string) {
    for (const entity of entities) {
      const name = String((entity as any)[nameField] || (entity as any).name || (entity as any).publisherOfferId || 'unknown');
      const result = await createEntity(target.envType, target.publisherToken, entityType, entity, entityType === 'offer' ? offerUiIdMap : undefined, logger);

      if (result.success) {
        summary.success++;
        const verb = (result as any).updated ? 'Updated' : 'Created';
        sendEvent({ entityType, name, status: 'success', message: `${verb} ${entityType} "${name}"` });
      } else if (result.status === 409 || result.error?.toLowerCase().includes('already exists') || result.error?.toLowerCase().includes('duplicate')) {
        summary.skipped++;
        sendEvent({ entityType, name, status: 'skipped', message: `Skipped ${entityType} "${name}": already exists` });
      } else {
        summary.failed++;
        sendEvent({ entityType, name, status: 'failed', message: `Failed ${entityType} "${name}": ${result.error}` });
      }
    }
  }

  const sendStepEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const steps = [
    { step: 1, label: 'Assets', run: () => duplicateEntities(sourceData.assets, 'asset', 'name') },
    { step: 2, label: 'Products + Offer Designs + Badges', run: () => Promise.all([
      duplicateEntities(sourceData.products, 'product', 'publisherProductId'),
      duplicateEntities(sourceData.offerDesigns, 'offerDesign', 'name'),
      duplicateEntities(sourceData.badges, 'badge', 'name'),
    ]) },
    { step: 3, label: 'Price Points', run: () => sourceData.pricePoints?.length ? duplicateEntities(sourceData.pricePoints, 'pricePoint', 'priceInUsdCents') : Promise.resolve() },
    { step: 4, label: 'Offers', run: () => duplicateEntities(sourceData.offers, 'offer', 'publisherOfferId') },
  ];

  for (const { step, run } of steps) {
    sendStepEvent('stepStart', { step });
    try {
      await run();
      sendStepEvent('stepComplete', { step });
    } catch (err: any) {
      sendStepEvent('stepFailed', { step });
      sendEvent({ entityType: 'product', name: 'system', status: 'failed', message: `Step ${step} failed: ${err.message}` });
    }
  }

  sendDone(summary);
});

// POST /duplicate-type — duplicate specific entity type
router.post('/duplicate-type', async (req: Request, res: Response) => {
  const { target, sourceData, entityType, offerType } = req.body as DupDuplicateRequest & { entityType: DupEntityType; offerType?: string };

  if (!target?.envType || !target?.publisherToken || !sourceData || !entityType) {
    res.status(400).json({ error: 'target, sourceData, and entityType are required' });
    return;
  }

  const { sendEvent, sendDone, logger } = setupSSE(res);
  const summary: DupDuplicationSummary = { success: 0, skipped: 0, failed: 0 };

  let offerUiIdMap = new Map<string, string>();
  if (entityType === 'offer') {
    try {
      const targetDesigns = await fetchAll(target.envType, target.publisherToken, 'offerDesign', logger);
      offerUiIdMap = buildOfferUiIdMap(sourceData.offerDesigns, targetDesigns);
    } catch (err: any) {
      sendEvent({ entityType: 'offerDesign', name: 'system', status: 'failed', message: `Warning: could not fetch target offer designs: ${err.message}` });
    }
  }

  const entityMap: Record<DupEntityType, { data: Record<string, unknown>[]; nameField: string }> = {
    product: { data: sourceData.products, nameField: 'publisherProductId' },
    offerDesign: { data: sourceData.offerDesigns, nameField: 'name' },
    badge: { data: sourceData.badges, nameField: 'name' },
    offer: { data: sourceData.offers, nameField: 'publisherOfferId' },
    pricePoint: { data: sourceData.pricePoints || [], nameField: 'priceInUsdCents' },
    asset: { data: sourceData.assets || [], nameField: 'name' },
  };

  let { data: entities, nameField } = entityMap[entityType];

  if (entityType === 'offer' && offerType) {
    entities = entities.filter((e) => (e as any).type === offerType);
  }

  try {
    for (const entity of entities) {
      const name = String((entity as any)[nameField] || (entity as any).name || 'unknown');
      const result = await createEntity(target.envType, target.publisherToken, entityType, entity, entityType === 'offer' ? offerUiIdMap : undefined, logger);

      if (result.success) {
        summary.success++;
        const verb = (result as any).updated ? 'Updated' : 'Created';
        sendEvent({ entityType, name, status: 'success', message: `${verb} ${entityType} "${name}"` });
      } else if (result.status === 409 || result.error?.toLowerCase().includes('already exists') || result.error?.toLowerCase().includes('duplicate')) {
        summary.skipped++;
        sendEvent({ entityType, name, status: 'skipped', message: `Skipped ${entityType} "${name}": already exists` });
      } else {
        summary.failed++;
        sendEvent({ entityType, name, status: 'failed', message: `Failed ${entityType} "${name}": ${result.error}` });
      }
    }
  } catch (err: any) {
    sendEvent({ entityType, name: 'system', status: 'failed', message: `Unexpected error: ${err.message}` });
  }

  sendDone(summary);
});

// POST /delete-entities — delete entities
router.post('/delete-entities', async (req: Request, res: Response) => {
  const { envType, publisherToken, entityType, assetTypes } = req.body as { envType: string; publisherToken: string; entityType: DupEntityType; assetTypes?: string[] };

  if (!envType || !publisherToken || !entityType) {
    res.status(400).json({ error: 'envType, publisherToken, and entityType are required' });
    return;
  }

  const { sendEvent, sendDone, logger } = setupSSE(res);
  const summary: DupDuplicationSummary = { success: 0, skipped: 0, failed: 0 };

  try {
    let entities = await fetchAll(envType as any, publisherToken, entityType, logger);

    if (entityType === 'asset' && assetTypes && assetTypes.length > 0) {
      const typeSet = new Set(assetTypes);
      entities = entities.filter((e) => typeSet.has(String((e as any).type || '')));
    }

    if (entities.length === 0) {
      sendEvent({ entityType, name: 'system', status: 'skipped', message: `No ${entityType}s found to delete` });
      sendDone(summary);
      return;
    }

    for (const entity of entities) {
      let id: string;
      if (entityType === 'asset') {
        id = String((entity as any).name || '');
      } else if (entityType === 'offer') {
        id = String((entity as any).publisherOfferId || '');
      } else if (entityType === 'pricePoint') {
        id = String((entity as any).priceInUsdCents || '');
      } else {
        id = String((entity as any).publisherProductId || (entity as any).publisherBadgeId || '');
      }
      const name = String((entity as any).publisherProductId || (entity as any).publisherOfferId || (entity as any).priceInUsdCents || (entity as any).name || id);

      if (!id) {
        summary.failed++;
        sendEvent({ entityType, name, status: 'failed', message: `Cannot delete ${entityType} "${name}": no identifier found` });
        continue;
      }

      const result = await deleteEntity(envType as any, publisherToken, entityType, id, logger);

      if (result.success) {
        summary.success++;
        sendEvent({ entityType, name, status: 'success', message: `Deleted ${entityType} "${name}"` });
      } else {
        summary.failed++;
        sendEvent({ entityType, name, status: 'failed', message: `Failed to delete ${entityType} "${name}": ${result.error}` });
      }
    }
  } catch (err: any) {
    sendEvent({ entityType, name: 'system', status: 'failed', message: `Error: ${err.message}` });
  }

  sendDone(summary);
});

export default router;
