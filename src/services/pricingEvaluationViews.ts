import type { PricingFinding, PricingReviewClass } from '../domain/pricing/pricingFinding';
import type { ApprovalPreparation, PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';

export interface SalesPricingEvaluationView {
  evaluationId: string;
  evaluatedAt: string;
  reviewClass: PricingReviewClass;
  reviewClassLabel: string;
  adminReviewRequired: true;
  recommendedPriceCents: number | null;
  requestedPriceCents: number | null;
  evaluatedPriceCents: number | null;
  currency: string;
  termMonths: number | null;
  isSpecialTerm: boolean;
  termStatusLabel: string;
  approvalBlocked: boolean;
  stale: boolean;
  actionableFindings: Array<{
    code: string;
    salesDescription: string;
    requiredAction: string | null;
    field: string | null;
  }>;
}

export interface AdminPricingEvaluationView extends PricingEvaluationResult {
  approval: ApprovalPreparation;
}

const REVIEW_CLASS_LABELS: Record<PricingReviewClass, string> = {
  standard: 'Regulär – Adminprüfung erforderlich',
  attention: 'Auffällig – Sonderprüfung erforderlich',
  critical: 'Kritisch – Sonderprüfung erforderlich',
};

function isSalesVisibleFinding(finding: PricingFinding): boolean {
  return finding.salesDescription !== null || finding.requiredAction !== null;
}

export function toSalesPricingEvaluationView(
  result: PricingEvaluationResult,
): SalesPricingEvaluationView {
  return {
    evaluationId: result.evaluationId,
    evaluatedAt: result.evaluatedAt,
    reviewClass: result.reviewClass,
    reviewClassLabel: REVIEW_CLASS_LABELS[result.reviewClass],
    adminReviewRequired: true,
    recommendedPriceCents: result.recommendedPriceCents,
    requestedPriceCents: result.requestedPriceCents,
    evaluatedPriceCents: result.evaluatedPriceCents,
    currency: result.currency,
    termMonths: result.termMonths,
    isSpecialTerm: result.isSpecialTerm,
    termStatusLabel: result.isSpecialTerm
      ? 'Sonderlaufzeit – Adminprüfung erforderlich'
      : result.isStandardTerm
        ? 'Standardlaufzeit'
        : 'Laufzeit unvollständig',
    approvalBlocked: result.approval.approvalBlocked,
    stale: result.stale,
    actionableFindings: result.findings
      .filter(isSalesVisibleFinding)
      .map((finding) => ({
        code: finding.code,
        salesDescription: finding.salesDescription ?? finding.internalDescription,
        requiredAction: finding.requiredAction,
        field: finding.field,
      })),
  };
}

export function toAdminPricingEvaluationView(
  result: PricingEvaluationResult,
): AdminPricingEvaluationView {
  return {
    ...result,
    approval: result.approval,
  };
}

export function getReviewClassLabel(reviewClass: PricingReviewClass): string {
  return REVIEW_CLASS_LABELS[reviewClass];
}
