import type { ApprovalRule } from '../domain/approvalRule/approvalRule';
import { createProductionApprovalRules } from '../domain/catalog/approvalRuleCatalogSeed';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_APPROVAL_RULE_STORAGE_VERSION = 1;

export function migrateApprovalRulesIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.approvalRuleStorageVersion) ?? 0;
  const existing = readStorageItem<ApprovalRule[]>(STORAGE_KEYS.approvalRules);

  if (!existing || existing.length === 0) {
    writeStorageItem(STORAGE_KEYS.approvalRules, createProductionApprovalRules());
  }

  if (currentVersion < CURRENT_APPROVAL_RULE_STORAGE_VERSION) {
    writeStorageItem(STORAGE_KEYS.approvalRuleStorageVersion, CURRENT_APPROVAL_RULE_STORAGE_VERSION);
  }
}

export function resetApprovalRulesForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.approvalRules);
  localStorage.removeItem(STORAGE_KEYS.approvalRuleStorageVersion);
}
