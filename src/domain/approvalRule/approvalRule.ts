export type ApprovalRuleType =
  | 'price_below_minimum'
  | 'discount_above_threshold'
  | 'contract_term_deviation'
  | 'contract_model_deviation'
  | 'hardware_condition_deviation'
  | 'transaction_fee_deviation'
  | 'clearing_fee_deviation'
  | 'commission_deviation'
  | 'missing_required_data'
  | 'special_condition';

export type ApprovalRuleStatus = 'active' | 'inactive';

export interface ApprovalRule {
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  type: ApprovalRuleType;
  status: ApprovalRuleStatus;
  priority: number;
  thresholdValue: number | null;
  thresholdUnit: 'cents' | 'percent_tenths' | 'months' | 'none';
  tariffId: string | null;
  requiredReviewerRole: 'admin' | 'reviewer' | 'sales_lead';
  fourEyesRequired: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

export const APPROVAL_RULE_SCHEMA_VERSION = 1;

export const APPROVAL_RULE_TYPE_LABELS: Record<ApprovalRuleType, string> = {
  price_below_minimum: 'Preis unter Mindestgrenze',
  discount_above_threshold: 'Rabatt über Schwelle',
  contract_term_deviation: 'Abweichende Laufzeit',
  contract_model_deviation: 'Abweichendes Vertragsmodell',
  hardware_condition_deviation: 'Abweichende Hardwarekondition',
  transaction_fee_deviation: 'Abweichende Transaktionsgebühr',
  clearing_fee_deviation: 'Abweichende Clearinggebühr',
  commission_deviation: 'Abweichende Provision',
  missing_required_data: 'Fehlende Pflichtdaten',
  special_condition: 'Sonderkondition',
};

export interface ApprovalSimulationInput {
  requestedPriceCents: number | null;
  listPriceCents: number | null;
  discountPercentTenths: number | null;
  contractTermMonths: number | null;
  contractModelCode: string | null;
  tariffId: string | null;
  hasMissingRequiredData: boolean;
}

export interface ApprovalSimulationResult {
  approvalRequired: boolean;
  triggeredRules: ApprovalRule[];
  reasons: string[];
  requiredReviewerRole: ApprovalRule['requiredReviewerRole'] | null;
  fourEyesRequired: boolean;
}
