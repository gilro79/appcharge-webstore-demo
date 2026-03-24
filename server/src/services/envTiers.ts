import { tierStore } from '../index.js';
import { seedTiers } from './seedData.js';
import type { Tier } from 'shared/src/types.js';

const SCOPE_SEP = '::';

/** Build a scoped tier ID: `envName::baseTierId` */
export function scopedTierId(envName: string, baseTierId: string): string {
  return `${envName}${SCOPE_SEP}${baseTierId}`;
}

/** Extract the base tier ID from a scoped ID (returns as-is if unscoped) */
export function baseTierIdFrom(scopedId: string): string {
  const idx = scopedId.indexOf(SCOPE_SEP);
  return idx >= 0 ? scopedId.slice(idx + SCOPE_SEP.length) : scopedId;
}

/** Extract the env name from a scoped tier ID (returns undefined if unscoped) */
export function envFromTierId(scopedId: string): string | undefined {
  const idx = scopedId.indexOf(SCOPE_SEP);
  return idx >= 0 ? scopedId.slice(0, idx) : undefined;
}

/** Get all tiers that belong to a given environment */
export function getTiersForEnv(envName: string): Tier[] {
  const prefix = `${envName}${SCOPE_SEP}`;
  return tierStore.filterBy((t) => t.id.startsWith(prefix));
}

/**
 * Ensure tiers exist for the given environment.
 * If no scoped tiers exist, clone seed tiers with scoped IDs.
 */
export function ensureTiersForEnv(envName: string): void {
  const existing = getTiersForEnv(envName);
  if (existing.length > 0) return;

  // Clone seed tiers with scoped IDs
  for (const seed of seedTiers) {
    const scoped: Tier = {
      ...seed,
      id: scopedTierId(envName, seed.id),
      offers: seed.offers.map((o) => ({ ...o })),
    };
    tierStore.create(scoped);
  }
}

/**
 * Migration: copy any unscoped (legacy) tiers into `Default::` prefix,
 * then delete the unscoped originals.
 */
export function migrateUnscopedTiers(): void {
  const allTiers = tierStore.getAll();
  const unscoped = allTiers.filter((t) => !t.id.includes(SCOPE_SEP));
  if (unscoped.length === 0) return;

  const defaultPrefix = `Default${SCOPE_SEP}`;
  // Only migrate if there are no Default-scoped tiers yet
  const hasDefault = allTiers.some((t) => t.id.startsWith(defaultPrefix));
  if (hasDefault) {
    // Already migrated; just delete unscoped leftovers
    for (const t of unscoped) tierStore.delete(t.id);
    return;
  }

  for (const t of unscoped) {
    const scoped: Tier = {
      ...t,
      id: scopedTierId('Default', t.id),
    };
    tierStore.create(scoped);
    tierStore.delete(t.id);
  }
}
