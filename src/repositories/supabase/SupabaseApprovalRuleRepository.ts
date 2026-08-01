import { normalizeApprovalRule, normalizeApprovalRules } from '../../domain/approvalRule/normalizeApprovalRule';
import type { ApprovalRule } from '../../domain/approvalRule/approvalRule';
import type { ApprovalRuleRepository } from '../interfaces/ApprovalRuleRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  sbUpsertMany,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'approval_rules';

function ruleToRow(rule: ApprovalRule): Record<string, unknown> {
  return {
    id: rule.id,
    data: rule,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

function rowToRule(row: JsonTableRow): ApprovalRule {
  const normalized = normalizeApprovalRule(rowData(row, { id: row.id }));
  if (!normalized) {
    throw new Error(`ApprovalRule konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseApprovalRuleRepository implements ApprovalRuleRepository {
  async getAll(): Promise<ApprovalRule[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeApprovalRules(rows.map((row) => rowToRule(row)));
  }

  async getById(id: string): Promise<ApprovalRule | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToRule(row) : null;
  }

  async save(rule: ApprovalRule): Promise<ApprovalRule> {
    const existing = await this.getById(rule.id);
    const rowPayload = ruleToRow(rule);
    if (existing) {
      const row = await sbUpdate(TABLE, rule.id, rowPayload);
      return rowToRule(row);
    }
    const row = await sbInsert(TABLE, rowPayload);
    return rowToRule(row);
  }

  async saveAll(rules: ApprovalRule[]): Promise<ApprovalRule[]> {
    await sbUpsertMany(TABLE, rules.map(ruleToRow));
    return rules;
  }
}
