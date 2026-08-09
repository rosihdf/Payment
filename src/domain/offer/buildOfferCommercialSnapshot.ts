import type { CommissionCalculationResult } from '../commission/commissionCalculation';
import type { CommissionContractConfiguration } from '../commission/commissionContractConfiguration';
import type { CommissionPlanKind } from '../commission/commissionPlan';
import type { CommercialSelectionHandoff } from '../commercial/commercialHandoff';
import type { CommercialMissingEntry } from '../commercial/commercialMissingData';
import type { OfferCustomerSnapshot } from './offer';
import {
  OFFER_COMMERCIAL_SNAPSHOT_VERSION,
  type OfferCommercialCommissionSnapshot,
  type OfferCommercialSnapshot,
  type OfferCommercialSourceRefs,
} from './offerCommercialSnapshot';

export interface BuildOfferCommercialSnapshotInput {
  handoff: CommercialSelectionHandoff;
  customerSnapshot: OfferCustomerSnapshot;
  tariffName: string;
  productName: string | null;
  contractConfiguration: CommissionContractConfiguration | null;
  commissionPlanKind: CommissionPlanKind | null;
  sources: OfferCommercialSourceRefs;
}

export function hasBlockingCommercialMissingData(entries: CommercialMissingEntry[]): boolean {
  return entries.some((entry) => entry.severity === 'error');
}

export function buildOfferCommercialCommissionSnapshot(
  preview: CommissionCalculationResult | null,
  contractConfiguration: CommissionContractConfiguration | null,
  commissionPlanKind: CommissionPlanKind | null,
): OfferCommercialCommissionSnapshot | null {
  if (!preview) {
    return null;
  }

  const ruleIds = [
    ...new Set(
      preview.components
        .map((component) => component.commissionRuleId)
        .filter((ruleId): ruleId is string => Boolean(ruleId)),
    ),
  ];

  return {
    commissionPlanKind,
    contractConfiguration,
    calculatedAt: preview.calculatedAt,
    ruleIds,
    baseCommissionAmountCents: preview.baseCommissionAmountCents,
    accessoryCommissionAmountCents: preview.accessoryCommissionAmountCents,
    provisionalRecurringAmountCents: preview.provisionalRecurringAmountCents,
    confirmedRecurringAmountCents: preview.confirmedRecurringAmountCents,
    finalExpectedCommissionAmountCents: preview.finalExpectedCommissionAmountCents,
    currency: preview.currency,
    status: preview.status,
    preview,
  };
}

export function buildOfferCommercialSnapshot(
  input: BuildOfferCommercialSnapshotInput,
): OfferCommercialSnapshot {
  const { handoff, customerSnapshot, tariffName, productName, sources } = input;
  const config = handoff.commercialConfig;

  return {
    schemaVersion: OFFER_COMMERCIAL_SNAPSHOT_VERSION,
    status: 'frozen',
    frozenAt: handoff.selectedAt,
    identity: {
      tariffId: config.tariffId,
      tariffName,
      tariffProductCode: config.tariffProductCode,
      productId: config.productId,
      productName,
      terminalModel: config.terminalModel,
      deploymentMode: config.deploymentMode,
      contractConfiguration: input.contractConfiguration,
      contractTermMonths: config.contractTermMonths,
      contractTermId: config.contractTermId,
      terminalCount: config.terminalCount,
    },
    needSnapshot: handoff.needSnapshot,
    customerSnapshot,
    commercialConfig: config,
    projection: handoff.projection,
    commission: buildOfferCommercialCommissionSnapshot(
      handoff.commissionPreview,
      input.contractConfiguration,
      input.commissionPlanKind,
    ),
    sources,
    missingCommercialData: handoff.projection.missingCommercialData,
  };
}

export function validateOfferCommercialMaterialization(
  snapshot: OfferCommercialSnapshot,
): { ok: true } | { ok: false; message: string; missing: CommercialMissingEntry[] } {
  if (hasBlockingCommercialMissingData(snapshot.missingCommercialData)) {
    return {
      ok: false,
      message: 'Kaufmännische Daten unvollständig – Angebot kann nicht erzeugt werden.',
      missing: snapshot.missingCommercialData.filter((entry) => entry.severity === 'error'),
    };
  }

  if (!snapshot.projection.isComplete || snapshot.projection.monthlyTotalCents === null) {
    return {
      ok: false,
      message: 'Prognose unvollständig – Angebot kann nicht erzeugt werden.',
      missing: snapshot.missingCommercialData,
    };
  }

  return { ok: true };
}
