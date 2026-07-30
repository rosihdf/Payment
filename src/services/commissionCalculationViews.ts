import type { CommissionCalculationResult } from '../domain/commission/commissionCalculation';

export interface SalesCommissionCalculationView {
  calculationId: string;
  calculatedAt: string;
  status: CommissionCalculationResult['status'];
  statusLabel: string;
  isPreview: boolean;
  oneTimeCommissionAmountCents: number;
  accessoryCommissionAmountCents: number;
  provisionalRecurringHint: string | null;
  finalExpectedCommissionAmountCents: number;
  currency: string;
  reductionReviewRequired: boolean;
  calculationBlocked: boolean;
  stale: boolean;
  actionableFindings: Array<{
    code: string;
    salesDescription: string;
    requiredAction: string | null;
  }>;
}

export interface AdminCommissionCalculationView extends CommissionCalculationResult {}

const STATUS_LABELS: Record<CommissionCalculationResult['status'], string> = {
  preview: 'Provisionsvorschau',
  complete: 'Berechnung vollständig',
  incomplete: 'Berechnung unvollständig',
  blocked: 'Berechnung blockiert',
  frozen: 'Eingefrorene Berechnung',
};

export function toSalesCommissionCalculationView(
  result: CommissionCalculationResult,
): SalesCommissionCalculationView {
  return {
    calculationId: result.calculationId,
    calculatedAt: result.calculatedAt,
    status: result.status,
    statusLabel: result.stale ? 'Provisionsvorschau veraltet' : STATUS_LABELS[result.status],
    isPreview: result.status === 'preview' || result.status === 'incomplete',
    oneTimeCommissionAmountCents: result.baseCommissionAmountCents,
    accessoryCommissionAmountCents: result.accessoryCommissionAmountCents,
    provisionalRecurringHint:
      result.provisionalRecurringAmountCents > 0
        ? 'Laufende Beteiligungen sind vorläufig und noch nicht abschließend berechenbar.'
        : null,
    finalExpectedCommissionAmountCents: result.finalExpectedCommissionAmountCents,
    currency: result.currency,
    reductionReviewRequired: result.reductionReviewRequired,
    calculationBlocked: result.calculationBlocked,
    stale: result.stale,
    actionableFindings: result.findings
      .filter((finding) => finding.salesDescription)
      .map((finding) => ({
        code: finding.code,
        salesDescription: finding.salesDescription!,
        requiredAction: finding.requiredAction,
      })),
  };
}

export function toAdminCommissionCalculationView(
  result: CommissionCalculationResult,
): AdminCommissionCalculationView {
  return { ...result };
}
