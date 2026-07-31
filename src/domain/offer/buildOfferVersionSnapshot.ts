import { calculateOfferTotals } from './offerCalculations';
import type { Offer, OfferTotals } from './offer';
import type { OfferVersionSnapshot } from './offerVersion';
import { deriveContractModel, deriveTerminalSnapshot } from './deriveOfferSnapshotFields';

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildOfferVersionSnapshot(
  offer: Offer,
  totals: OfferTotals = calculateOfferTotals(offer),
  versionNumber = offer.currentVersionNumber || 1,
): OfferVersionSnapshot {
  const terminals = deriveTerminalSnapshot(offer.items);
  return {
    schemaVersion: 1,
    offerId: offer.id,
    offerNumber: offer.offerNumber,
    versionNumber,
    leadId: offer.leadId,
    customerSnapshot: copy(offer.customerSnapshot),
    tariffSnapshot: copy(offer.tariffSnapshot),
    items: copy(offer.items),
    title: offer.title,
    introductionText: offer.introductionText,
    internalNotes: offer.internalNotes,
    customerNotes: offer.customerNotes,
    validUntil: offer.validUntil,
    recommendationLink: copy(offer.recommendationLink),
    totals: copy(totals),
    sourceComparisonSessionId: offer.sourceComparisonSessionId,
    sourceScenarioId: offer.sourceScenarioId,
    contractModel: deriveContractModel(offer.items, offer.tariffSnapshot),
    termMonths: offer.tariffSnapshot?.contractDurationMonths ?? null,
    terminalCount: terminals.terminalCount,
    optionalTerminalCount: terminals.optionalTerminalCount,
    terminalLines: copy(terminals.terminalLines),
    accessoryLines: copy(terminals.accessoryLines),
    priceBookVersion: null,
    commissionReferenceId: null,
    approvalRequired: false,
    approvalReasons: [],
    costBaselineId: offer.recommendationLink.costBaselineId,
    savingsCents: null,
    createdByUserId: offer.createdByUserId,
    createdAt: offer.createdAt,
  };
}
