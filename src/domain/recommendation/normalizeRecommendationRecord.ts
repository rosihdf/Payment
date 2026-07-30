import type { RecommendationRecord } from './recommendationRecord';
import type { RecommendationSnapshot } from './recommendationSnapshot';
import type { RecommendationWeightSet } from './recommendationWeightSet';
import { DEFAULT_TIE_BREAKERS } from './recommendationWeightSet';
import { generateId, nowIso } from '../../utils/id';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

const RECORD_STATUSES = new Set([
  'draft',
  'complete',
  'incomplete',
  'blocked',
  'stale',
  'frozen',
  'superseded',
]);

export function normalizeRecommendationRecord(value: unknown): RecommendationRecord {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const timestamp = nowIso();
  const snapshotRaw = raw.snapshot;

  return {
    id: asString(raw.id) || generateId('recommendation_record'),
    leadId: asNullableString(raw.leadId),
    offerId: asNullableString(raw.offerId),
    version: asNumber(raw.version, 1),
    status: RECORD_STATUSES.has(asString(raw.status))
      ? (asString(raw.status) as RecommendationRecord['status'])
      : 'draft',
    inputFingerprint: asString(raw.inputFingerprint),
    snapshot: normalizeRecommendationSnapshot(snapshotRaw),
    primaryCandidateId: asNullableString(raw.primaryCandidateId),
    selectedCandidateId: asNullableString(raw.selectedCandidateId),
    selection: normalizeRecommendationSelection(raw.selection),
    createdByUserId: asString(raw.createdByUserId),
    createdAt: asString(raw.createdAt) || timestamp,
    updatedAt: asString(raw.updatedAt) || timestamp,
    frozenAt: asNullableString(raw.frozenAt),
    supersededAt: asNullableString(raw.supersededAt),
  };
}

export function normalizeRecommendationRecords(values: unknown[]): RecommendationRecord[] {
  return values.map((value) => normalizeRecommendationRecord(value));
}

function normalizeRecommendationSelection(value: unknown): RecommendationRecord['selection'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const selectionType = raw.selectionType === 'alternative' ? 'alternative' : 'primary';

  return {
    recommendationRecordId: asString(raw.recommendationRecordId),
    recommendationVersion: asNumber(raw.recommendationVersion, 1),
    selectedCandidateId: asString(raw.selectedCandidateId),
    selectionType,
    isDeviation: asBoolean(raw.isDeviation),
    deviationReason: asString(raw.deviationReason),
    selectedByUserId: asString(raw.selectedByUserId),
    selectedAt: asString(raw.selectedAt) || nowIso(),
  };
}

function normalizeRecommendationSnapshot(value: unknown): RecommendationSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const catalogRaw =
    raw.catalogVersions && typeof raw.catalogVersions === 'object'
      ? (raw.catalogVersions as Record<string, unknown>)
      : {};

  return {
    schemaVersion: asNumber(raw.schemaVersion, 1),
    engineVersion: asString(raw.engineVersion),
    evaluatedAt: asString(raw.evaluatedAt) || nowIso(),
    inputFingerprint: asString(raw.inputFingerprint),
    normalizedNeed: (raw.normalizedNeed as RecommendationSnapshot['normalizedNeed']) ?? {
      leadId: null,
      offerId: null,
      salesRepresentativeId: '',
      evaluationDate: new Date().toISOString().slice(0, 10),
      industry: '',
      locationCount: null,
      terminalCount: 1,
      paymentUsage: { stationary: false, mobile: true, ecommerce: false, softPos: false },
      cardMix: {
        girocardPercent: null,
        debitPercent: null,
        creditPercent: null,
        otherPercent: null,
        sumKnownPercent: null,
        isComplete: false,
        isPlausible: true,
      },
      monthlyCardVolumeCents: null,
      annualCardVolumeCents: null,
      monthlyTransactions: null,
      averageTransactionValueCents: null,
      contractPreferences: {
        preferredTermMonths: null,
        maxAcceptedTermMonths: null,
        preferLowFixedCosts: false,
        preferLowVariableCosts: false,
        preferLowInitialCosts: false,
        preferPriceStability: false,
        preferFlexibility: false,
        specialTermRequested: false,
      },
      currentSituation: null,
      requiredAccessoryProductIds: [],
    },
    catalogVersions: {
      tariffCatalogVersion:
        typeof catalogRaw.tariffCatalogVersion === 'number' ? catalogRaw.tariffCatalogVersion : null,
      productCatalogVersion:
        typeof catalogRaw.productCatalogVersion === 'number' ? catalogRaw.productCatalogVersion : null,
      pricingCatalogVersion:
        typeof catalogRaw.pricingCatalogVersion === 'number' ? catalogRaw.pricingCatalogVersion : null,
      commissionCatalogVersion:
        typeof catalogRaw.commissionCatalogVersion === 'number'
          ? catalogRaw.commissionCatalogVersion
          : null,
      recommendationCatalogVersion:
        typeof catalogRaw.recommendationCatalogVersion === 'number'
          ? catalogRaw.recommendationCatalogVersion
          : null,
    },
    weightSet: raw.weightSet ? normalizeRecommendationWeightSet(raw.weightSet) : null,
    candidates: Array.isArray(raw.candidates) ? (raw.candidates as RecommendationSnapshot['candidates']) : [],
    blockedCandidates: Array.isArray(raw.blockedCandidates)
      ? (raw.blockedCandidates as RecommendationSnapshot['blockedCandidates'])
      : [],
    excludedCandidates: Array.isArray(raw.excludedCandidates)
      ? (raw.excludedCandidates as RecommendationSnapshot['excludedCandidates'])
      : [],
    scoreBreakdowns:
      raw.scoreBreakdowns && typeof raw.scoreBreakdowns === 'object'
        ? (raw.scoreBreakdowns as RecommendationSnapshot['scoreBreakdowns'])
        : {},
    rankingOrder: Array.isArray(raw.rankingOrder)
      ? raw.rankingOrder.filter((entry): entry is string => typeof entry === 'string')
      : [],
    primaryCandidateId: asNullableString(raw.primaryCandidateId),
    alternativeCandidateIds: Array.isArray(raw.alternativeCandidateIds)
      ? raw.alternativeCandidateIds.filter((entry): entry is string => typeof entry === 'string')
      : [],
    reasons: Array.isArray(raw.reasons) ? (raw.reasons as RecommendationSnapshot['reasons']) : [],
    findings: Array.isArray(raw.findings) ? (raw.findings as RecommendationSnapshot['findings']) : [],
    tieBreakerUsed: asNullableString(raw.tieBreakerUsed),
    commissionTieBreakerActive: asBoolean(raw.commissionTieBreakerActive),
  };
}

export function normalizeRecommendationWeightSet(value: unknown): RecommendationWeightSet {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const weightsRaw =
    raw.weights && typeof raw.weights === 'object' ? (raw.weights as Record<string, unknown>) : {};
  const timestamp = nowIso();
  const statusRaw = asString(raw.status);

  return {
    id: asString(raw.id) || generateId('rec_weight_set'),
    versionNumber: asNumber(raw.versionNumber, 1),
    status:
      statusRaw === 'published' || statusRaw === 'archived'
        ? statusRaw
        : 'draft',
    validFrom: asNullableString(raw.validFrom),
    validUntil: asNullableString(raw.validUntil),
    weights: {
      eligibilityScore: asNumber(weightsRaw.eligibilityScore),
      needFitScore: asNumber(weightsRaw.needFitScore),
      costScore: asNumber(weightsRaw.costScore),
      termScore: asNumber(weightsRaw.termScore),
      hardwareScore: asNumber(weightsRaw.hardwareScore),
      riskScore: asNumber(weightsRaw.riskScore),
      completenessScore: asNumber(weightsRaw.completenessScore),
      internalBusinessScore: asNumber(weightsRaw.internalBusinessScore),
    },
    tieBreakers: Array.isArray(raw.tieBreakers)
      ? (raw.tieBreakers as RecommendationWeightSet['tieBreakers'])
      : DEFAULT_TIE_BREAKERS,
    commissionTieBreakerEnabled: asBoolean(raw.commissionTieBreakerEnabled),
    maxAlternatives: asNumber(raw.maxAlternatives, 2),
    defaultProjectionMonths:
      typeof raw.defaultProjectionMonths === 'number' ? raw.defaultProjectionMonths : null,
    createdByUserId: asString(raw.createdByUserId),
    publishedByUserId: asNullableString(raw.publishedByUserId),
    publishedAt: asNullableString(raw.publishedAt),
    createdAt: asString(raw.createdAt) || timestamp,
    updatedAt: asString(raw.updatedAt) || timestamp,
  };
}

export function normalizeRecommendationWeightSets(values: unknown[]): RecommendationWeightSet[] {
  return values.map((value) => normalizeRecommendationWeightSet(value));
}
