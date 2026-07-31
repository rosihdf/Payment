import { normalizeApprovalRules } from '../../domain/approvalRule/normalizeApprovalRule';
import type { ApprovalRule } from '../../domain/approvalRule/approvalRule';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ApprovalRuleRepository } from '../interfaces/ApprovalRuleRepository';

export class LocalApprovalRuleRepository implements ApprovalRuleRepository {
  async getAll(): Promise<ApprovalRule[]> {
    return normalizeApprovalRules(readStorageItem<unknown[]>(STORAGE_KEYS.approvalRules));
  }

  async getById(id: string): Promise<ApprovalRule | null> {
    const rules = await this.getAll();
    return rules.find((rule) => rule.id === id) ?? null;
  }

  async save(rule: ApprovalRule): Promise<ApprovalRule> {
    const rules = await this.getAll();
    const index = rules.findIndex((entry) => entry.id === rule.id);
    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.push(rule);
    }
    writeStorageItem(STORAGE_KEYS.approvalRules, rules);
    return rule;
  }

  async saveAll(rules: ApprovalRule[]): Promise<ApprovalRule[]> {
    writeStorageItem(STORAGE_KEYS.approvalRules, rules);
    return rules;
  }
}
