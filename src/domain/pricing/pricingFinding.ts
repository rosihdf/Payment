export type PricingFindingSeverity = 'info' | 'warning' | 'error' | 'blocking';

export type PricingFindingCategory =
  | 'configuration'
  | 'price'
  | 'term'
  | 'product'
  | 'contract'
  | 'data_quality'
  | 'rule_conflict'
  | 'approval'
  | 'permission';

export type PricingReviewClass = 'standard' | 'attention' | 'critical';

export const PRICING_FINDING_CODES = {
  PRICE_BOOK_NOT_FOUND: 'PRICE_BOOK_NOT_FOUND',
  PRICE_BOOK_NOT_PUBLISHED: 'PRICE_BOOK_NOT_PUBLISHED',
  PRICE_BOOK_OUTSIDE_VALIDITY: 'PRICE_BOOK_OUTSIDE_VALIDITY',
  PRICE_BOOK_AMBIGUOUS: 'PRICE_BOOK_AMBIGUOUS',
  PRICE_RULE_NOT_FOUND: 'PRICE_RULE_NOT_FOUND',
  PRICE_RULE_AMBIGUOUS: 'PRICE_RULE_AMBIGUOUS',
  PRICE_RULE_CONFLICT: 'PRICE_RULE_CONFLICT',
  CONTRACT_TERM_NOT_FOUND: 'CONTRACT_TERM_NOT_FOUND',
  CONTRACT_TERM_INACTIVE: 'CONTRACT_TERM_INACTIVE',
  SPECIAL_TERM_REQUESTED: 'SPECIAL_TERM_REQUESTED',
  SPECIAL_TERM_REASON_REQUIRED: 'SPECIAL_TERM_REASON_REQUIRED',
  PRICE_BELOW_TARGET: 'PRICE_BELOW_TARGET',
  PRICE_AT_MINIMUM: 'PRICE_AT_MINIMUM',
  PRICE_BELOW_MINIMUM: 'PRICE_BELOW_MINIMUM',
  DISCOUNT_LIMIT_EXCEEDED: 'DISCOUNT_LIMIT_EXCEEDED',
  MANUAL_OVERRIDE_REQUIRES_REASON: 'MANUAL_OVERRIDE_REQUIRES_REASON',
  REQUIRED_INPUT_MISSING: 'REQUIRED_INPUT_MISSING',
  UNSUPPORTED_PRODUCT_COMBINATION: 'UNSUPPORTED_PRODUCT_COMBINATION',
  EVALUATION_BLOCKED: 'EVALUATION_BLOCKED',
} as const;

export type PricingFindingCode = (typeof PRICING_FINDING_CODES)[keyof typeof PRICING_FINDING_CODES];

export interface PricingFinding {
  code: PricingFindingCode;
  severity: PricingFindingSeverity;
  category: PricingFindingCategory;
  field: string | null;
  ruleId: string | null;
  blocking: boolean;
  internalDescription: string;
  salesDescription: string | null;
  requiredAction: string | null;
  context: Record<string, string | number | boolean | null>;
}

export function createFinding(
  partial: Omit<PricingFinding, 'context'> & { context?: PricingFinding['context'] },
): PricingFinding {
  return {
    ...partial,
    context: partial.context ?? {},
  };
}
