export interface PricingEvaluationInput {
  evaluationDate: string;
  salesRepresentativeId: string;
  leadId: string | null;
  offerId: string | null;
  currency: string;

  contractTypeId: string | null;
  productId: string | null;
  tariffId: string | null;
  hardwareProductIds: string[];
  accessoryItems: Array<{ productId: string; quantity: number; requestedUnitPriceCents: number | null }>;

  contractTermId: string | null;
  requestedSpecialTermMonths: number | null;
  specialTermReason: string;

  quantity: number;
  annualCardVolumeCents: number | null;
  monthlyCardVolumeCents: number | null;
  transactionCount: number | null;
  averageTicketCents: number | null;
  girocardSharePercent: number | null;
  creditCardSharePercent: number | null;
  industryId: string | null;

  requestedUnitPriceCents: number | null;
  requestedTotalPriceCents: number | null;
  manualPriceOverride: boolean;
  overrideReason: string;
}

export interface PricingEvaluationPositionResult {
  positionKey: string;
  productId: string | null;
  tariffId: string | null;
  quantity: number;
  listPriceCents: number | null;
  targetPriceCents: number | null;
  minimumPriceCents: number | null;
  requestedPriceCents: number | null;
  evaluatedPriceCents: number | null;
  appliedRuleIds: string[];
}

export interface PricingEvaluationSnapshot {
  schemaVersion: number;
  engineVersion: string;
  evaluatedAt: string;
  input: PricingEvaluationInput;
  priceBookVersionId: string | null;
  priceBookVersionNumber: number | null;
  contractTermMonths: number | null;
  appliedRuleIds: string[];
  rejectedRuleIds: string[];
  positions: PricingEvaluationPositionResult[];
  findings: import('./pricingFinding').PricingFinding[];
  reviewClass: import('./pricingFinding').PricingReviewClass;
}

export interface ApprovalPreparation {
  reviewClass: import('./pricingFinding').PricingReviewClass;
  adminReviewRequired: true;
  quickReviewPossible: boolean;
  detailReviewRequired: boolean;
  approvalBlocked: boolean;
  requiredAdminRole: 'admin';
  reasons: string[];
  warnings: string[];
  violations: string[];
  requiredJustifications: string[];
  priceSummary: string;
  termSummary: string;
  configurationSummary: string;
  internalRecommendation: string;
}

export interface PricingEvaluationResult {
  evaluationId: string;
  evaluatedAt: string;
  engineVersion: string;
  inputFingerprint: string;

  priceBookVersionId: string | null;
  priceBookVersionNumber: number | null;
  appliedRules: Array<{ id: string; name: string; priority: number }>;
  rejectedRules: Array<{ id: string; name: string; reason: string }>;

  listPriceCents: number | null;
  targetPriceCents: number | null;
  minimumPriceCents: number | null;
  maxDiscountPercentTenths: number | null;
  recommendedPriceCents: number | null;
  requestedPriceCents: number | null;
  evaluatedPriceCents: number | null;
  absoluteDeviationCents: number | null;
  percentDeviationTenths: number | null;
  currency: string;
  unit: string;

  termMonths: number | null;
  isStandardTerm: boolean;
  isSpecialTerm: boolean;
  termAllowed: boolean;
  specialTermReason: string;

  reviewClass: import('./pricingFinding').PricingReviewClass;
  approval: ApprovalPreparation;

  findings: import('./pricingFinding').PricingFinding[];
  snapshot: PricingEvaluationSnapshot;
  stale: boolean;
}

export const PRICING_ENGINE_VERSION = '1.0.0';
export const PRICING_EVALUATION_SNAPSHOT_SCHEMA_VERSION = 1;
