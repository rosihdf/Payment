import type { ApprovalRule } from '../../domain/approvalRule/approvalRule';

export interface ApprovalRuleRepository {
  getAll(): Promise<ApprovalRule[]>;
  getById(id: string): Promise<ApprovalRule | null>;
  save(rule: ApprovalRule): Promise<ApprovalRule>;
  saveAll(rules: ApprovalRule[]): Promise<ApprovalRule[]>;
}
