import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { createDefaultCommissionCatalog } from './commissionCatalogSeed';
import { migrateAssignmentVersionOverridesIfNeeded } from './commissionShareMigration';
import type { CommissionRule } from '../domain/commission/commissionRule';
import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';

export const CURRENT_COMMISSION_CATALOG_VERSION = 3;

function mergeMissingRules(
  existing: CommissionRule[],
  seedRules: CommissionRule[],
): CommissionRule[] {
  const byId = new Map(existing.map((rule) => [rule.id, rule]));
  for (const seed of seedRules) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, seed);
    }
  }
  return Array.from(byId.values());
}

function mergeMissingPlans(
  existing: CommissionPlan[],
  seedPlans: CommissionPlan[],
): CommissionPlan[] {
  const byId = new Map(existing.map((plan) => [plan.id, plan]));
  for (const seed of seedPlans) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, seed);
    }
  }
  return Array.from(byId.values());
}

function mergeMissingPlanVersions(
  existing: CommissionPlanVersion[],
  seedVersions: CommissionPlanVersion[],
): CommissionPlanVersion[] {
  const byId = new Map(existing.map((version) => [version.id, version]));
  for (const seed of seedVersions) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, seed);
    }
  }
  return Array.from(byId.values());
}

export function migrateCommissionCatalogIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.commissionCatalogVersion) ?? 0;

  if (!readStorageItem(STORAGE_KEYS.commissionPlans)) {
    writeStorageItem(STORAGE_KEYS.commissionPlans, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionPlanVersions)) {
    writeStorageItem(STORAGE_KEYS.commissionPlanVersions, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionRules)) {
    writeStorageItem(STORAGE_KEYS.commissionRules, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionAssignments)) {
    writeStorageItem(STORAGE_KEYS.commissionAssignments, []);
  }

  if (currentVersion < 3) {
    const seed = createDefaultCommissionCatalog('system');
    const plans = readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? [];
    const planVersions =
      readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? [];
    const rules = readStorageItem<CommissionRule[]>(STORAGE_KEYS.commissionRules) ?? [];
    const assignments =
      readStorageItem<SalesRepresentativeCommissionAssignment[]>(
        STORAGE_KEYS.commissionAssignments,
      ) ?? [];

    // Bestehende Katalogdaten behalten; fehlende Standardregeln/Pläne ergänzen.
    if (plans.length > 0 || rules.length > 0) {
      writeStorageItem(STORAGE_KEYS.commissionPlans, mergeMissingPlans(plans, seed.plans));
      writeStorageItem(
        STORAGE_KEYS.commissionPlanVersions,
        mergeMissingPlanVersions(planVersions, seed.planVersions),
      );
      writeStorageItem(STORAGE_KEYS.commissionRules, mergeMissingRules(rules, seed.rules));
    }

    writeStorageItem(STORAGE_KEYS.commissionAssignments, assignments);
    migrateAssignmentVersionOverridesIfNeeded(
      readStorageItem<CommissionRule[]>(STORAGE_KEYS.commissionRules) ?? [],
    );
  }

  writeStorageItem(STORAGE_KEYS.commissionCatalogVersion, CURRENT_COMMISSION_CATALOG_VERSION);
}

export function resetCommissionCatalogForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.commissionCatalogVersion);
  localStorage.removeItem(STORAGE_KEYS.commissionPlans);
  localStorage.removeItem(STORAGE_KEYS.commissionPlanVersions);
  localStorage.removeItem(STORAGE_KEYS.commissionRules);
  localStorage.removeItem(STORAGE_KEYS.commissionAssignments);
  localStorage.removeItem(STORAGE_KEYS.commissionAssignmentVersions);
}
