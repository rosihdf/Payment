import type {
  ApprovalRule,
  ApprovalSimulationInput,
  ApprovalSimulationResult,
} from '../domain/approvalRule/approvalRule';
import { normalizeApprovalRules } from '../domain/approvalRule/normalizeApprovalRule';
import { APPROVAL_RULE_SCHEMA_VERSION } from '../domain/approvalRule/approvalRule';
import type { UserContext } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { ApprovalRuleRepository } from '../repositories/interfaces/ApprovalRuleRepository';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';

export interface ApprovalRuleFilter {
  query?: string;
  status?: ApprovalRule['status'] | 'all';
  type?: ApprovalRule['type'] | 'all';
  tariffId?: string | 'all';
}

export class ApprovalRuleService {
  private readonly approvalRuleRepository: ApprovalRuleRepository;
  private readonly auditService: AuditService;

  constructor(approvalRuleRepository: ApprovalRuleRepository, auditService: AuditService) {
    this.approvalRuleRepository = approvalRuleRepository;
    this.auditService = auditService;
  }

  filterRules(rules: ApprovalRule[], filter: ApprovalRuleFilter): ApprovalRule[] {
    return rules.filter((rule) => {
      if (filter.status && filter.status !== 'all' && rule.status !== filter.status) {
        return false;
      }
      if (filter.type && filter.type !== 'all' && rule.type !== filter.type) {
        return false;
      }
      if (filter.tariffId && filter.tariffId !== 'all') {
        if (rule.tariffId && rule.tariffId !== filter.tariffId) {
          return false;
        }
      }
      if (filter.query) {
        const query = filter.query.toLowerCase();
        if (!`${rule.name} ${rule.description}`.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }

  async getRules(context: UserContext, filter: ApprovalRuleFilter = {}): Promise<ApprovalRule[] | { error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.approval_rules');
    if (!guard.ok) {
      return { error: 'forbidden' };
    }
    const rules = await this.approvalRuleRepository.getAll();
    return this.filterRules(rules, filter);
  }

  detectConflicts(rules: ApprovalRule[]): string[] {
    const conflicts: string[] = [];
    const activeRules = rules.filter((rule) => rule.status === 'active');

    for (const rule of activeRules) {
      if (rule.type === 'missing_required_data' && rule.thresholdValue === 0) {
        conflicts.push(`Regel "${rule.name}" blockiert möglicherweise alle Angebote.`);
      }
    }

    const overlappingDiscounts = activeRules.filter((rule) => rule.type === 'discount_above_threshold');
    if (overlappingDiscounts.length > 1) {
      const thresholds = new Set(overlappingDiscounts.map((rule) => rule.thresholdValue));
      if (thresholds.size > 1) {
        conflicts.push('Mehrere aktive Rabatt-Schwellen mit unterschiedlichen Werten.');
      }
    }

    return conflicts;
  }

  simulateApproval(input: ApprovalSimulationInput, rules: ApprovalRule[]): ApprovalSimulationResult {
    const activeRules = rules
      .filter((rule) => rule.status === 'active')
      .filter((rule) => !rule.tariffId || rule.tariffId === input.tariffId)
      .sort((left, right) => left.priority - right.priority);

    const triggeredRules: ApprovalRule[] = [];
    const reasons: string[] = [];

    for (const rule of activeRules) {
      let triggered = false;

      switch (rule.type) {
        case 'price_below_minimum':
          triggered =
            input.requestedPriceCents !== null &&
            input.listPriceCents !== null &&
            input.requestedPriceCents < input.listPriceCents;
          break;
        case 'discount_above_threshold':
          triggered =
            input.discountPercentTenths !== null &&
            rule.thresholdValue !== null &&
            input.discountPercentTenths >= rule.thresholdValue;
          break;
        case 'missing_required_data':
          triggered = input.hasMissingRequiredData;
          break;
        case 'contract_term_deviation':
          triggered = input.contractTermMonths !== null && input.contractTermMonths !== 36;
          break;
        case 'contract_model_deviation':
          triggered = Boolean(input.contractModelCode && input.contractModelCode !== 'terminal_plus_acq');
          break;
        default:
          break;
      }

      if (triggered) {
        triggeredRules.push(rule);
        reasons.push(rule.description || rule.name);
      }
    }

    const primaryRule = triggeredRules[0] ?? null;

    return {
      approvalRequired: triggeredRules.length > 0,
      triggeredRules,
      reasons,
      requiredReviewerRole: primaryRule?.requiredReviewerRole ?? null,
      fourEyesRequired: triggeredRules.some((rule) => rule.fourEyesRequired),
    };
  }

  async saveRule(
    context: UserContext,
    rule: ApprovalRule,
  ): Promise<{ ok: true; rule: ApprovalRule } | { ok: false; error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.approval_rules');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const saved = await this.approvalRuleRepository.save({
      ...rule,
      updatedAt: nowIso(),
    });

    await this.auditService.logChange({
      context,
      action: 'approval_rule_changed',
      entityType: 'approval_rule',
      entityId: saved.id,
      summary: `Freigaberegel ${saved.name} gespeichert`,
    });

    return { ok: true, rule: saved };
  }

  createDraftRule(context: UserContext): ApprovalRule {
    const timestamp = nowIso();
    return {
      id: generateId('approval_rule'),
      schemaVersion: APPROVAL_RULE_SCHEMA_VERSION,
      name: 'Neue Freigaberegel',
      description: '',
      type: 'special_condition',
      status: 'inactive',
      priority: 100,
      thresholdValue: null,
      thresholdUnit: 'none',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: true,
      validFrom: null,
      validUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: context.userId,
    };
  }
}

export { normalizeApprovalRules };
