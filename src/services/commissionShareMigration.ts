import type { CommissionAssignmentVersion } from '../domain/commission/commissionAssignmentVersion';
import type { CommissionRule } from '../domain/commission/commissionRule';
import { normalizeOverrideToShareTruth } from '../domain/commission/commissionRuleOverride';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

/** @deprecated Use normalizeOverrideToShareTruth – kept for tests. */
export function migrateLegacyOverrideToShare(
  override: Parameters<typeof normalizeOverrideToShareTruth>[0],
  rule: CommissionRule | undefined,
) {
  return normalizeOverrideToShareTruth(override, rule);
}

export function migrateAssignmentVersionOverridesIfNeeded(
  rules: CommissionRule[],
): void {
  const versions =
    readStorageItem<CommissionAssignmentVersion[]>(STORAGE_KEYS.commissionAssignmentVersions) ?? [];
  if (versions.length === 0) {
    return;
  }

  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  let changed = false;

  const migrated = versions.map((version) => {
    const nextOverrides = version.ruleOverrides.map((override) => {
      const migratedOverride = normalizeOverrideToShareTruth(
        override,
        ruleById.get(override.ruleId),
      );
      if (
        migratedOverride.sharePercent !== override.sharePercent ||
        migratedOverride.fixedAmountCents !== override.fixedAmountCents
      ) {
        changed = true;
      }
      return migratedOverride;
    });
    return { ...version, ruleOverrides: nextOverrides };
  });

  if (changed) {
    writeStorageItem(STORAGE_KEYS.commissionAssignmentVersions, migrated);
  }
}
