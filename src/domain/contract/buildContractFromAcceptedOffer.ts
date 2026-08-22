import { getLeadDisplayName } from '../lead/getLeadDisplayName';
import type { Offer } from '../offer/offer';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';
import type { OfferVersion } from '../offer/offerVersion';
import type { Contract } from './contract';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from './contract';
import {
  computeEarliestTerminationDate,
  toIsoDateOnly,
  validateContractDateRange,
} from './contractDates';
import { buildContractSourceKey, generateNextContractNumber } from './contractNumber';
import type { ContractStatus } from './contractStatus';
import type { ContractVersion } from './contractVersion';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from './contractVersion';
import { buildContractVersionSnapshotFromOfferVersion } from './buildContractVersionFromOffer';
import { deriveContractNextDeadline } from './deriveContractDeadline';
import { generateId, nowIso } from '../../utils/id';

export const ACCEPTED_OFFER_WORKFLOW_STATUSES: OfferWorkflowStatus[] = [
  'accepted',
  'activation_pending',
  'activated',
  'released',
  'accounted',
  'paid',
];

export function resolveContractStatusFromOfferWorkflow(
  workflowStatus: OfferWorkflowStatus,
): ContractStatus {
  if (workflowStatus === 'activation_pending') {
    return 'activation';
  }
  if (
    workflowStatus === 'activated' ||
    workflowStatus === 'released' ||
    workflowStatus === 'accounted' ||
    workflowStatus === 'paid'
  ) {
    return 'active';
  }
  return 'preparation';
}

export type BuildContractFromAcceptedOfferInput = {
  offer: Pick<
    Offer,
    'id' | 'leadId' | 'workflowStatus' | 'createdByUserId' | 'currentVersionId'
  >;
  offerVersion: OfferVersion;
  existingContracts: Contract[];
  commissionCase: { id: string; expectedAmountCents: number | null } | null;
  context: { userId: string; displayName: string };
  options?: { startDate?: string | null; timestamp?: string };
};

export type BuildContractFromAcceptedOfferResult =
  | { ok: true; contract: Contract; version: ContractVersion; sourceKey: string }
  | { ok: false; error: 'not_accepted' | 'validation'; message: string };

export function buildContractFromAcceptedOffer(
  input: BuildContractFromAcceptedOfferInput,
): BuildContractFromAcceptedOfferResult {
  const { offer, offerVersion, existingContracts, commissionCase, context, options = {} } = input;

  if (!ACCEPTED_OFFER_WORKFLOW_STATUSES.includes(offer.workflowStatus)) {
    return {
      ok: false,
      error: 'not_accepted',
      message: 'Vertrag nur aus angenommenen Angeboten möglich.',
    };
  }

  const versionId = offer.currentVersionId ?? offerVersion.id;
  const sourceKey = buildContractSourceKey(offer.id, versionId);
  const timestamp = options.timestamp ?? nowIso();
  const snapshot = buildContractVersionSnapshotFromOfferVersion(offerVersion, {
    startDate: options.startDate ?? toIsoDateOnly(new Date()),
    commissionCaseId: commissionCase?.id ?? null,
    expectedCommissionCents: commissionCase?.expectedAmountCents ?? null,
  });
  const dateError = validateContractDateRange(snapshot.startDate, snapshot.endDate);
  if (dateError) {
    return { ok: false, error: 'validation', message: dateError };
  }

  const contractNumber = generateNextContractNumber(existingContracts, timestamp);
  const contractId = generateId('contract');
  const version: ContractVersion = {
    id: generateId('contract_version'),
    schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
    contractId,
    versionNumber: 1,
    status: 'active',
    validFrom: snapshot.startDate,
    validTo: null,
    changeReason: 'initial',
    changeNote: 'Initialversion aus angenommenem Angebot',
    previousVersionId: null,
    sourceOfferVersionId: offerVersion.id,
    snapshot,
    approvalRequired: false,
    approvalReasons: [],
    approvedAt: timestamp,
    approvedByUserId: context.userId,
    activatedAt: timestamp,
    discardedAt: null,
    createdAt: timestamp,
    createdByUserId: context.userId,
    createdByDisplayName: context.displayName,
  };

  const earliestTerminationDate =
    snapshot.endDate && snapshot.noticePeriodMonths != null
      ? computeEarliestTerminationDate(snapshot.endDate, snapshot.noticePeriodMonths)
      : null;

  const contract: Contract = {
    id: contractId,
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    contractNumber,
    sourceKey,
    leadId: offer.leadId,
    sourceOfferId: offer.id,
    acceptedOfferVersionId: offerVersion.id,
    currentVersionId: version.id,
    status: resolveContractStatusFromOfferWorkflow(offer.workflowStatus),
    ownerUserId: offer.createdByUserId || context.userId,
    startDate: snapshot.startDate,
    termMonths: snapshot.termMonths,
    endDate: snapshot.endDate,
    noticePeriodMonths: snapshot.noticePeriodMonths,
    earliestTerminationDate,
    autoRenewal: snapshot.autoRenewal,
    renewalMonths: snapshot.renewalMonths,
    activationOfferId: offer.id,
    commissionCaseId: commissionCase?.id ?? null,
    expectedCommissionCents: commissionCase?.expectedAmountCents ?? null,
    hardwareCount: snapshot.hardware.reduce((sum, line) => sum + line.quantity, 0),
    tariffName: snapshot.tariffSnapshot?.name ?? null,
    customerCompanyName: getLeadDisplayName(snapshot.customerSnapshot),
    nextDeadlineAt: null,
    nextDeadlineLabel: null,
    plannedChangeAt: null,
    terminationId: null,
    createdAt: timestamp,
    createdByUserId: context.userId,
    createdByDisplayName: context.displayName,
    updatedAt: timestamp,
    updatedByUserId: context.userId,
  };

  const deadline = deriveContractNextDeadline(contract);
  contract.nextDeadlineAt = deadline.at;
  contract.nextDeadlineLabel = deadline.label;

  return { ok: true, contract, version, sourceKey };
}
