import { nowIso } from '../../utils/id';
import { normalizePricingEvaluationInput } from './pricingEvaluationDefaults';
import type { PricingEvaluationRecord, PricingEvaluationRecordStatus } from './pricingEvaluationRecord';
import type { PricingEvaluationResult } from './pricingEvaluation';

const VALID_STATUSES = new Set<PricingEvaluationRecordStatus>(['draft', 'submitted', 'superseded']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeResult(value: unknown): PricingEvaluationResult {
  const record = asRecord(value);
  const snapshot = asRecord(record.snapshot);
  const approval = asRecord(record.approval);

  return {
    evaluationId: asString(record.evaluationId),
    evaluatedAt: asString(record.evaluatedAt),
    engineVersion: asString(record.engineVersion),
    inputFingerprint: asString(record.inputFingerprint),
    priceBookVersionId: asNullableString(record.priceBookVersionId),
    priceBookVersionNumber:
      record.priceBookVersionNumber === null || record.priceBookVersionNumber === undefined
        ? null
        : Number(record.priceBookVersionNumber),
    appliedRules: Array.isArray(record.appliedRules)
      ? record.appliedRules.map((entry) => {
          const rule = asRecord(entry);
          return {
            id: asString(rule.id),
            name: asString(rule.name),
            priority: Number(rule.priority) || 0,
          };
        })
      : [],
    rejectedRules: Array.isArray(record.rejectedRules)
      ? record.rejectedRules.map((entry) => {
          const rule = asRecord(entry);
          return {
            id: asString(rule.id),
            name: asString(rule.name),
            reason: asString(rule.reason),
          };
        })
      : [],
    listPriceCents: asNullableNumber(record.listPriceCents),
    targetPriceCents: asNullableNumber(record.targetPriceCents),
    minimumPriceCents: asNullableNumber(record.minimumPriceCents),
    maxDiscountPercentTenths: asNullableNumber(record.maxDiscountPercentTenths),
    recommendedPriceCents: asNullableNumber(record.recommendedPriceCents),
    requestedPriceCents: asNullableNumber(record.requestedPriceCents),
    evaluatedPriceCents: asNullableNumber(record.evaluatedPriceCents),
    absoluteDeviationCents: asNullableNumber(record.absoluteDeviationCents),
    percentDeviationTenths: asNullableNumber(record.percentDeviationTenths),
    currency: asString(record.currency) || 'EUR',
    unit: asString(record.unit) || 'monthly',
    termMonths: asNullableNumber(record.termMonths),
    isStandardTerm: Boolean(record.isStandardTerm),
    isSpecialTerm: Boolean(record.isSpecialTerm),
    termAllowed: Boolean(record.termAllowed),
    specialTermReason: asString(record.specialTermReason),
    reviewClass:
      record.reviewClass === 'attention' || record.reviewClass === 'critical'
        ? record.reviewClass
        : 'standard',
    approval: {
      reviewClass:
        approval.reviewClass === 'attention' || approval.reviewClass === 'critical'
          ? approval.reviewClass
          : 'standard',
      adminReviewRequired: true,
      quickReviewPossible: Boolean(approval.quickReviewPossible),
      detailReviewRequired: Boolean(approval.detailReviewRequired),
      approvalBlocked: Boolean(approval.approvalBlocked),
      requiredAdminRole: 'admin',
      reasons: Array.isArray(approval.reasons) ? approval.reasons.map(String) : [],
      warnings: Array.isArray(approval.warnings) ? approval.warnings.map(String) : [],
      violations: Array.isArray(approval.violations) ? approval.violations.map(String) : [],
      requiredJustifications: Array.isArray(approval.requiredJustifications)
        ? approval.requiredJustifications.map(String)
        : [],
      priceSummary: asString(approval.priceSummary),
      termSummary: asString(approval.termSummary),
      configurationSummary: asString(approval.configurationSummary),
      internalRecommendation: asString(approval.internalRecommendation),
    },
    findings: Array.isArray(record.findings) ? record.findings : [],
    snapshot: {
      schemaVersion: Number(snapshot.schemaVersion) || 1,
      engineVersion: asString(snapshot.engineVersion),
      evaluatedAt: asString(snapshot.evaluatedAt),
      input: normalizePricingEvaluationInput(asRecord(snapshot.input)),
      priceBookVersionId: asNullableString(snapshot.priceBookVersionId),
      priceBookVersionNumber: asNullableNumber(snapshot.priceBookVersionNumber),
      contractTermMonths: asNullableNumber(snapshot.contractTermMonths),
      appliedRuleIds: Array.isArray(snapshot.appliedRuleIds)
        ? snapshot.appliedRuleIds.map(String)
        : [],
      rejectedRuleIds: Array.isArray(snapshot.rejectedRuleIds)
        ? snapshot.rejectedRuleIds.map(String)
        : [],
      positions: Array.isArray(snapshot.positions) ? snapshot.positions : [],
      findings: Array.isArray(snapshot.findings) ? snapshot.findings : [],
      reviewClass:
        snapshot.reviewClass === 'attention' || snapshot.reviewClass === 'critical'
          ? snapshot.reviewClass
          : 'standard',
    },
    stale: Boolean(record.stale),
  };
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePricingEvaluationRecord(value: unknown): PricingEvaluationRecord {
  const record = asRecord(value);
  const timestamp = nowIso();
  const status = VALID_STATUSES.has(record.status as PricingEvaluationRecordStatus)
    ? (record.status as PricingEvaluationRecordStatus)
    : 'draft';

  return {
    id: asString(record.id),
    offerId: asString(record.offerId),
    status,
    inputFingerprint: asString(record.inputFingerprint),
    result: normalizeResult(record.result),
    createdByUserId: asString(record.createdByUserId),
    createdAt: asString(record.createdAt) || timestamp,
    updatedAt: asString(record.updatedAt) || timestamp,
  };
}

export function normalizePricingEvaluationRecords(values: unknown[]): PricingEvaluationRecord[] {
  return values.map((value) => normalizePricingEvaluationRecord(value));
}
