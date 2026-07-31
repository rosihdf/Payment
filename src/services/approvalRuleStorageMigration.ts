import type { ApprovalRule } from '../domain/approvalRule/approvalRule';
import { generateId } from '../utils/id';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_APPROVAL_RULE_STORAGE_VERSION = 1;

function createDefaultApprovalRules(): ApprovalRule[] {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return [
    {
      id: generateId('approval_rule'),
      schemaVersion: 1,
      name: 'Preis unter Mindestgrenze',
      description: 'Freigabe bei Unterschreitung der Mindestpreisgrenze',
      type: 'price_below_minimum',
      status: 'active',
      priority: 10,
      thresholdValue: null,
      thresholdUnit: 'none',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: true,
      validFrom: null,
      validUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'system',
    },
    {
      id: generateId('approval_rule'),
      schemaVersion: 1,
      name: 'Rabatt über Schwelle',
      description: 'Freigabe bei Rabatt über 10 %',
      type: 'discount_above_threshold',
      status: 'active',
      priority: 20,
      thresholdValue: 1000,
      thresholdUnit: 'percent_tenths',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: true,
      validFrom: null,
      validUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'system',
    },
    {
      id: generateId('approval_rule'),
      schemaVersion: 1,
      name: 'Fehlende Pflichtdaten',
      description: 'Freigabe blockiert bei fehlenden Pflichtangaben',
      type: 'missing_required_data',
      status: 'active',
      priority: 5,
      thresholdValue: null,
      thresholdUnit: 'none',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: false,
      validFrom: null,
      validUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'system',
    },
  ];
}

export function migrateApprovalRulesIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.approvalRuleStorageVersion) ?? 0;
  const existing = readStorageItem<ApprovalRule[]>(STORAGE_KEYS.approvalRules);

  if (!existing || existing.length === 0) {
    writeStorageItem(STORAGE_KEYS.approvalRules, createDefaultApprovalRules());
  }

  if (currentVersion < CURRENT_APPROVAL_RULE_STORAGE_VERSION) {
    writeStorageItem(STORAGE_KEYS.approvalRuleStorageVersion, CURRENT_APPROVAL_RULE_STORAGE_VERSION);
  }
}

export function resetApprovalRulesForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.approvalRules);
  localStorage.removeItem(STORAGE_KEYS.approvalRuleStorageVersion);
}
