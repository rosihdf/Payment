import { generateId, nowIso } from '../../utils/id';
import { calculateOfferTotals } from './offerCalculations';
import { deriveContractModel, deriveTerminalSnapshot } from './deriveOfferSnapshotFields';
import { mapLegacyOfferStatus, type OfferWorkflowStatus } from './offerWorkflow';
import type { OfferContractModel } from './offerContractModel';
import type { OfferItem, OfferTariffSnapshot, OfferTotals } from './offer';
import { normalizeOffer } from './normalizeOffer';
import {
  CURRENT_OFFER_VERSION_SCHEMA_VERSION,
  type OfferVersion,
  type OfferVersionSnapshot,
} from './offerVersion';

const STATUSES: OfferWorkflowStatus[] = [
  'draft', 'approval_required', 'in_approval', 'changes_requested', 'approved', 'ready_to_send',
  'sent', 'accepted', 'declined', 'expired', 'activation_pending', 'activated', 'released',
  'accounted', 'paid', 'cancelled',
];

const CONTRACT_MODELS: OfferContractModel[] = [
  'rental', 'purchase', 'acq_only', 'terminal_plus_acq', 'not_specified',
];

const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const asNonNegativeInteger = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

function normalizeContractModel(
  value: unknown,
  items: OfferItem[],
  tariffSnapshot: OfferTariffSnapshot | null,
): OfferContractModel {
  return CONTRACT_MODELS.includes(value as OfferContractModel)
    ? value as OfferContractModel
    : deriveContractModel(items, tariffSnapshot);
}

function normalizeOfferTotals(
  raw: unknown,
  items: OfferItem[],
  tariffSnapshot: OfferTariffSnapshot | null,
): OfferTotals {
  if (raw && typeof raw === 'object') {
    const totals = raw as Record<string, unknown>;
    if (
      typeof totals.monthlyItemsTotalCents === 'number' &&
      typeof totals.oneTimeItemsTotalCents === 'number' &&
      typeof totals.tariffMonthlyFixedTotalCents === 'number' &&
      typeof totals.tariffSetupTotalCents === 'number' &&
      typeof totals.monthlyTotalCents === 'number' &&
      typeof totals.oneTimeTotalCents === 'number'
    ) {
      return {
        monthlyItemsTotalCents: asNonNegativeInteger(totals.monthlyItemsTotalCents),
        oneTimeItemsTotalCents: asNonNegativeInteger(totals.oneTimeItemsTotalCents),
        tariffMonthlyFixedTotalCents: asNonNegativeInteger(totals.tariffMonthlyFixedTotalCents),
        tariffSetupTotalCents: asNonNegativeInteger(totals.tariffSetupTotalCents),
        monthlyTotalCents: asNonNegativeInteger(totals.monthlyTotalCents),
        oneTimeTotalCents: asNonNegativeInteger(totals.oneTimeTotalCents),
        hasOnRequestItems: totals.hasOnRequestItems === true,
        onRequestItemCount: asNonNegativeInteger(totals.onRequestItemCount),
      };
    }
  }

  return calculateOfferTotals({ items, tariffSnapshot });
}

export function normalizeOfferVersion(value: unknown): OfferVersion | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();
  const snapshotRaw = (raw.snapshot ?? {}) as Record<string, unknown>;
  const source = normalizeOffer({
    ...(snapshotRaw && typeof snapshotRaw === 'object' ? snapshotRaw : {}),
    id: 'snapshot',
    offerNumber: '',
    status: 'draft',
  });
  const terminals = deriveTerminalSnapshot(source.items);
  const totals = normalizeOfferTotals(snapshotRaw.totals, source.items, source.tariffSnapshot);
  const contractModel = normalizeContractModel(snapshotRaw.contractModel, source.items, source.tariffSnapshot);
  const termMonths =
    asNumber(snapshotRaw.termMonths) ??
    source.tariffSnapshot?.contractDurationMonths ??
    null;

  const snapshot: OfferVersionSnapshot = {
    schemaVersion: asNonNegativeInteger(snapshotRaw.schemaVersion, CURRENT_OFFER_VERSION_SCHEMA_VERSION) || CURRENT_OFFER_VERSION_SCHEMA_VERSION,
    offerId: nullable(snapshotRaw.offerId) ?? (typeof raw.offerId === 'string' ? raw.offerId : ''),
    offerNumber: text(snapshotRaw.offerNumber),
    versionNumber: Math.max(1, Number(snapshotRaw.versionNumber) || Number(raw.versionNumber) || 1),
    leadId: source.leadId,
    customerSnapshot: source.customerSnapshot,
    tariffSnapshot: source.tariffSnapshot,
    items: source.items,
    title: source.title,
    introductionText: source.introductionText,
    internalNotes: source.internalNotes,
    customerNotes: source.customerNotes,
    validUntil: source.validUntil,
    recommendationLink: source.recommendationLink,
    totals,
    sourceComparisonSessionId: nullable(snapshotRaw.sourceComparisonSessionId),
    sourceScenarioId: nullable(snapshotRaw.sourceScenarioId),
    contractModel,
    termMonths,
    terminalCount: typeof snapshotRaw.terminalCount === 'number'
      ? asNonNegativeInteger(snapshotRaw.terminalCount)
      : terminals.terminalCount,
    optionalTerminalCount: typeof snapshotRaw.optionalTerminalCount === 'number'
      ? asNonNegativeInteger(snapshotRaw.optionalTerminalCount)
      : terminals.optionalTerminalCount,
    terminalLines: terminals.terminalLines,
    accessoryLines: terminals.accessoryLines,
    priceBookVersion: nullable(snapshotRaw.priceBookVersion),
    pricingEvaluationId: nullable(snapshotRaw.pricingEvaluationId),
    commissionReferenceId: nullable(snapshotRaw.commissionReferenceId),
    approvalRequired: snapshotRaw.approvalRequired === true,
    approvalReasons: Array.isArray(snapshotRaw.approvalReasons)
      ? snapshotRaw.approvalReasons
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [],
    costBaselineId: nullable(snapshotRaw.costBaselineId) ?? source.recommendationLink.costBaselineId,
    savingsCents: asNumber(snapshotRaw.savingsCents),
    createdByUserId: text(snapshotRaw.createdByUserId) || text(raw.createdByUserId),
    createdAt: text(snapshotRaw.createdAt) || text(raw.createdAt) || timestamp,
  };

  const workflowStatus = STATUSES.includes(raw.workflowStatus as OfferWorkflowStatus)
    ? raw.workflowStatus as OfferWorkflowStatus
    : mapLegacyOfferStatus('draft');

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('offer_version'),
    offerId: typeof raw.offerId === 'string' ? raw.offerId : '',
    versionNumber: Math.max(1, Number(raw.versionNumber) || 1),
    workflowStatus,
    snapshot,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : timestamp,
    createdByUserId: typeof raw.createdByUserId === 'string' ? raw.createdByUserId : '',
    createdByDisplayName: typeof raw.createdByDisplayName === 'string' ? raw.createdByDisplayName : '',
    approvedAt: nullable(raw.approvedAt),
    approvedByUserId: nullable(raw.approvedByUserId),
    sentAt: nullable(raw.sentAt),
    acceptedAt: nullable(raw.acceptedAt),
    declinedAt: nullable(raw.declinedAt),
    activatedAt: nullable(raw.activatedAt),
    supersededAt: nullable(raw.supersededAt),
  };
}

export function normalizeOfferVersions(values: unknown[]): OfferVersion[] {
  return values.map(normalizeOfferVersion).filter((value): value is OfferVersion => value !== null);
}
