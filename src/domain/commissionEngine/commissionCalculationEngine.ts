import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import { PRICING_FINDING_CODES } from '../pricing/pricingFinding';
import type { CommissionCalculationContext, CommissionCalculationInput } from '../commission/commissionCalculationInput';
import {
  COMMISSION_ENGINE_VERSION,
  COMMISSION_SNAPSHOT_SCHEMA_VERSION,
  type CommissionCalculationResult,
  type CommissionComponent,
} from '../commission/commissionCalculation';
import {
  COMMISSION_FINDING_CODES,
  createCommissionFinding,
  type CommissionFinding,
} from '../commission/commissionFinding';
import type { CommissionReductionDecision } from '../commission/commissionReduction';
import {
  maxAllowedReductionAmountCents,
  remainingCommissionAfterReduction,
} from '../commission/commissionReduction';
import type { CommissionSnapshot } from '../commission/commissionSnapshot';
import { generateId } from '../../utils/id';
import {
  aggregateCommissionAmounts,
  calculateCommissionComponents,
} from './componentCalculation';
import { resolveCommissionPlanAssignment } from './planResolution';
import { selectCommissionRules } from './ruleMatching';
import { applyRuleOverrides } from './applyRuleOverrides';
import { resolveCommissionContractConfiguration } from '../commission/commissionContractConfiguration';
import {
  pricingEvaluationBlocksCommission,
  pricingRequiresReductionReview,
} from '../commission/buildCommissionInputFromOffer';

function createReductionProposal(
  originalCommissionAmountCents: number,
  pricing: PricingEvaluationResult,
): CommissionReductionDecision | null {
  if (!pricingRequiresReductionReview(pricing) || originalCommissionAmountCents <= 0) {
    return null;
  }

  const maxReduction = maxAllowedReductionAmountCents(originalCommissionAmountCents);
  let proposedReduction = 0;

  if (
    pricing.findings.some((finding) => finding.code === PRICING_FINDING_CODES.PRICE_BELOW_MINIMUM)
  ) {
    proposedReduction = maxReduction;
  } else if (
    pricing.findings.some((finding) => finding.code === PRICING_FINDING_CODES.PRICE_BELOW_TARGET)
  ) {
    proposedReduction = Math.min(maxReduction, Math.floor(originalCommissionAmountCents * 0.1));
  }

  if (proposedReduction <= 0) {
    return null;
  }

  return {
    id: generateId('commission_reduction'),
    proposedReductionAmountCents: proposedReduction,
    proposedReductionPercentTenths: Math.round((proposedReduction * 10000) / originalCommissionAmountCents),
    originalCommissionAmountCents,
    remainingCommissionAmountCents: remainingCommissionAfterReduction(
      originalCommissionAmountCents,
      proposedReduction,
    ),
    maxAllowedReductionAmountCents: maxReduction,
    status: 'proposed',
    adminUserId: null,
    reason: '',
    decidedAt: null,
    pricingDeviationContext: {
      listPriceCents: pricing.listPriceCents,
      targetPriceCents: pricing.targetPriceCents,
      minimumPriceCents: pricing.minimumPriceCents,
      requestedPriceCents: pricing.requestedPriceCents,
    },
  };
}

function applyApprovedReduction(
  originalCommissionAmountCents: number,
  reductionDecision: CommissionReductionDecision | null,
): number {
  if (!reductionDecision || reductionDecision.status !== 'approved') {
    return 0;
  }

  return Math.min(
    reductionDecision.proposedReductionAmountCents,
    maxAllowedReductionAmountCents(originalCommissionAmountCents),
  );
}

export function evaluateCommission(
  input: CommissionCalculationInput,
  context: CommissionCalculationContext,
  approvedReduction: CommissionReductionDecision | null = null,
): CommissionCalculationResult {
  const calculatedAt = new Date().toISOString();
  const calculationId = generateId('commission_calc');
  const findings: CommissionFinding[] = [];
  const termMonths = input.pricingEvaluationResult.termMonths;
  const contractConfiguration = resolveCommissionContractConfiguration({
    contractConfiguration: input.contractConfiguration,
    contractTypeCode: input.contractTypeCode,
    termMonths,
  });
  const enrichedInput: CommissionCalculationInput = {
    ...input,
    contractConfiguration,
  };

  if (input.pricingEvaluationResult.stale) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_PRICING_EVALUATION_STALE,
        severity: 'blocking',
        category: 'pricing',
        field: 'pricingEvaluationRecordId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Die Preisbewertung ist veraltet.',
        salesDescription: 'Bitte berechnen Sie zuerst eine aktuelle Preisbewertung.',
        requiredAction: 'Preisbewertung aktualisieren',
      }),
    );
  }

  const planResolution = resolveCommissionPlanAssignment(
    context.assignments,
    context.commissionPlanVersions,
    input.salesRepresentativeId,
    input.evaluationDate,
  );
  findings.push(...planResolution.findings);

  let selectedRules: ReturnType<typeof selectCommissionRules> = {
    selectedRules: [],
    rejectedRules: [],
    ambiguous: false,
    conflicting: false,
  };
  let components: CommissionComponent[] = [];

  if (planResolution.planVersion) {
    const planRules = applyRuleOverrides(
      context.commissionRules.filter(
        (rule) => rule.commissionPlanVersionId === planResolution.planVersion!.id,
      ),
      context.ruleOverrides,
    );

    selectedRules = selectCommissionRules(
      planRules,
      planResolution.planVersion.id,
      enrichedInput,
      termMonths,
    );

    if (selectedRules.conflicting || selectedRules.ambiguous) {
      findings.push(
        createCommissionFinding({
          code: COMMISSION_FINDING_CODES.COMMISSION_RULE_AMBIGUOUS,
          severity: 'blocking',
          category: 'rule',
          field: null,
          ruleId: null,
          blocking: true,
          internalDescription: 'Mehrdeutige oder widersprüchliche Provisionsregeln.',
          salesDescription: 'Die Provisionsregeln sind nicht eindeutig.',
          requiredAction: 'Admin kontaktieren',
        }),
      );
    } else if (selectedRules.selectedRules.length === 0) {
      findings.push(
        createCommissionFinding({
          code: COMMISSION_FINDING_CODES.COMMISSION_RULE_NOT_FOUND,
          severity: 'blocking',
          category: 'rule',
          field: null,
          ruleId: null,
          blocking: true,
          internalDescription: 'Keine passende Provisionsregel gefunden.',
          salesDescription: 'Für diese Kombination liegt keine Provisionsregel vor.',
          requiredAction: 'Konfiguration prüfen',
        }),
      );
    } else {
      components = calculateCommissionComponents(selectedRules.selectedRules, enrichedInput);
    }
  }

  const totals = aggregateCommissionAmounts(components);
  const reductionProposal = createReductionProposal(
    totals.originalCommissionAmountCents,
    input.pricingEvaluationResult,
  );
  const reductionDecision = approvedReduction ?? reductionProposal;

  if (pricingRequiresReductionReview(input.pricingEvaluationResult)) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_REDUCTION_REVIEW_REQUIRED,
        severity: 'warning',
        category: 'reduction',
        field: null,
        ruleId: null,
        blocking: false,
        internalDescription: 'Preisabweichung erfordert Provisionskürzungsprüfung.',
        salesDescription: 'Die Provision kann einer Adminprüfung unterliegen.',
        requiredAction: 'Adminprüfung abwarten',
      }),
    );
  }

  const approvedReductionAmountCents = applyApprovedReduction(
    totals.originalCommissionAmountCents,
    reductionDecision,
  );

  const calculationBlocked =
    findings.some((finding) => finding.blocking) ||
    pricingEvaluationBlocksCommission(input.pricingEvaluationResult) ||
    !planResolution.planVersion;

  const hasProvisionalOnlyRecurring =
    totals.provisionalRecurringAmountCents > 0 && totals.confirmedRecurringAmountCents === 0;

  const finalExpectedCommissionAmountCents = Math.max(
    0,
    totals.originalCommissionAmountCents - approvedReductionAmountCents,
  );

  const status: CommissionCalculationResult['status'] = calculationBlocked
    ? 'blocked'
    : hasProvisionalOnlyRecurring && totals.originalCommissionAmountCents === 0
      ? 'incomplete'
      : reductionDecision?.status === 'proposed'
        ? 'incomplete'
        : 'preview';

  const plan = planResolution.planVersion
    ? context.commissionPlans.find(
        (entry) => entry.id === planResolution.planVersion!.commissionPlanId,
      ) ?? null
    : null;

  const snapshot: CommissionSnapshot = {
    schemaVersion: COMMISSION_SNAPSHOT_SCHEMA_VERSION,
    engineVersion: COMMISSION_ENGINE_VERSION,
    calculatedAt,
    evaluationDate: input.evaluationDate,
    offerId: input.offerId,
    offerVersionKey: input.offerVersionKey,
    pricingEvaluationRecordId: input.pricingEvaluationRecordId,
    pricingEvaluationSnapshot: input.pricingEvaluationResult.snapshot,
    salesRepresentativeId: input.salesRepresentativeId,
    commissionPlanId: plan?.id ?? null,
    commissionPlanVersionId: planResolution.planVersion?.id ?? null,
    commissionPlanVersionNumber: planResolution.planVersion?.versionNumber ?? null,
    assignmentId: planResolution.assignment?.id ?? null,
    contractTypeCode: input.contractTypeCode,
    contractConfiguration,
    termMonths,
    appliedRuleIds: selectedRules.selectedRules.map((rule) => rule.id),
    rejectedRuleIds: selectedRules.rejectedRules.map((rule) => rule.id),
    components,
    originalCommissionAmountCents: totals.originalCommissionAmountCents,
    proposedReductionAmountCents: reductionDecision?.proposedReductionAmountCents ?? 0,
    approvedReductionAmountCents,
    finalExpectedCommissionAmountCents,
    currency: 'EUR',
    findings,
    reductionDecision,
  };

  return {
    calculationId,
    engineVersion: COMMISSION_ENGINE_VERSION,
    calculatedAt,
    evaluationDate: input.evaluationDate,
    offerId: input.offerId,
    offerVersionKey: input.offerVersionKey,
    pricingEvaluationRecordId: input.pricingEvaluationRecordId,
    pricingEvaluationId: input.pricingEvaluationResult.evaluationId,
    salesRepresentativeId: input.salesRepresentativeId,
    assignmentId: planResolution.assignment?.id ?? null,
    commissionPlanId: plan?.id ?? null,
    commissionPlanVersionId: planResolution.planVersion?.id ?? null,
    commissionPlanVersionNumber: planResolution.planVersion?.versionNumber ?? null,
    components,
    rejectedRules: selectedRules.rejectedRules,
    baseCommissionAmountCents: totals.baseCommissionAmountCents,
    provisionalRecurringAmountCents: totals.provisionalRecurringAmountCents,
    confirmedRecurringAmountCents: totals.confirmedRecurringAmountCents,
    accessoryCommissionAmountCents: totals.accessoryCommissionAmountCents,
    bonusAmountCents: totals.bonusAmountCents,
    malusAmountCents: totals.malusAmountCents,
    originalCommissionAmountCents: totals.originalCommissionAmountCents,
    proposedReductionAmountCents: reductionDecision?.proposedReductionAmountCents ?? 0,
    approvedReductionAmountCents,
    correctionAmountCents: 0,
    finalExpectedCommissionAmountCents,
    currency: 'EUR',
    status,
    adminReviewRequired: true,
    reductionReviewRequired: Boolean(reductionDecision?.status === 'proposed'),
    canFreeze: !calculationBlocked && status !== 'blocked',
    calculationBlocked,
    requiredJustifications:
      reductionDecision?.status === 'proposed' ? ['Provisionskürzung durch Admin entscheiden'] : [],
    findings,
    reductionDecision,
    snapshot,
    stale: false,
  };
}
