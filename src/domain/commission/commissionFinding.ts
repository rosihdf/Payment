export type CommissionFindingSeverity = 'info' | 'warning' | 'error' | 'blocking';

export type CommissionFindingCategory =
  | 'configuration'
  | 'plan'
  | 'assignment'
  | 'rule'
  | 'term'
  | 'pricing'
  | 'calculation'
  | 'reduction'
  | 'permission'
  | 'data_quality'
  | 'lifecycle';

export const COMMISSION_FINDING_CODES = {
  COMMISSION_PLAN_NOT_FOUND: 'COMMISSION_PLAN_NOT_FOUND',
  COMMISSION_PLAN_NOT_PUBLISHED: 'COMMISSION_PLAN_NOT_PUBLISHED',
  COMMISSION_PLAN_OUTSIDE_VALIDITY: 'COMMISSION_PLAN_OUTSIDE_VALIDITY',
  COMMISSION_PLAN_ASSIGNMENT_AMBIGUOUS: 'COMMISSION_PLAN_ASSIGNMENT_AMBIGUOUS',
  COMMISSION_RULE_NOT_FOUND: 'COMMISSION_RULE_NOT_FOUND',
  COMMISSION_RULE_AMBIGUOUS: 'COMMISSION_RULE_AMBIGUOUS',
  COMMISSION_RULE_CONFLICT: 'COMMISSION_RULE_CONFLICT',
  COMMISSION_RULE_INVALID: 'COMMISSION_RULE_INVALID',
  COMMISSION_INPUT_MISSING: 'COMMISSION_INPUT_MISSING',
  COMMISSION_PRICING_EVALUATION_MISSING: 'COMMISSION_PRICING_EVALUATION_MISSING',
  COMMISSION_PRICING_EVALUATION_STALE: 'COMMISSION_PRICING_EVALUATION_STALE',
  COMMISSION_TERM_AMBIGUOUS_36_MONTHS: 'COMMISSION_TERM_AMBIGUOUS_36_MONTHS',
  COMMISSION_COMPONENT_NOT_CALCULABLE: 'COMMISSION_COMPONENT_NOT_CALCULABLE',
  COMMISSION_EXTERNAL_DATA_REQUIRED: 'COMMISSION_EXTERNAL_DATA_REQUIRED',
  COMMISSION_REDUCTION_REVIEW_REQUIRED: 'COMMISSION_REDUCTION_REVIEW_REQUIRED',
  COMMISSION_REDUCTION_REASON_REQUIRED: 'COMMISSION_REDUCTION_REASON_REQUIRED',
  COMMISSION_REDUCTION_EXCEEDS_LIMIT: 'COMMISSION_REDUCTION_EXCEEDS_LIMIT',
  COMMISSION_CALCULATION_BLOCKED: 'COMMISSION_CALCULATION_BLOCKED',
  COMMISSION_SNAPSHOT_OUTDATED: 'COMMISSION_SNAPSHOT_OUTDATED',
} as const;

export type CommissionFindingCode =
  (typeof COMMISSION_FINDING_CODES)[keyof typeof COMMISSION_FINDING_CODES];

export interface CommissionFinding {
  code: CommissionFindingCode;
  severity: CommissionFindingSeverity;
  category: CommissionFindingCategory;
  field: string | null;
  ruleId: string | null;
  blocking: boolean;
  internalDescription: string;
  salesDescription: string | null;
  requiredAction: string | null;
  context: Record<string, string | number | boolean | null>;
}

export function createCommissionFinding(
  partial: Omit<CommissionFinding, 'context'> & { context?: CommissionFinding['context'] },
): CommissionFinding {
  return {
    ...partial,
    context: partial.context ?? {},
  };
}
