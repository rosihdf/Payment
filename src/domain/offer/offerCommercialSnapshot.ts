import type { CommissionCalculationResult } from '../commission/commissionCalculation';
import type { CommissionContractConfiguration } from '../commission/commissionContractConfiguration';
import type { CommissionPlanKind } from '../commission/commissionPlan';
import type { CommercialConfig, CommercialDeploymentMode } from '../commercial/commercialConfig';
import type { CommercialProjectionBreakdown, CommercialProjectionResult } from '../commercial/calculateCommercialProjection';
import type { CommercialMissingEntry } from '../commercial/commercialMissingData';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { OfferCustomerSnapshot } from './offer';

export const OFFER_COMMERCIAL_SNAPSHOT_VERSION = 1;

export type OfferCommercialSnapshotStatus = 'frozen' | 'legacy_unfrozen';

export type OfferCommercialLineKind =
  | 'fixed_monthly'
  | 'usage_based'
  | 'percentage_based'
  | 'one_time';

export interface OfferCommercialIdentitySnapshot {
  tariffId: string;
  tariffName: string;
  tariffProductCode: string;
  productId: string | null;
  productName: string | null;
  terminalModel: string;
  deploymentMode: CommercialDeploymentMode;
  contractConfiguration: CommissionContractConfiguration | null;
  contractTermMonths: number;
  contractTermId: string | null;
  terminalCount: number;
}

export interface OfferCommercialCommissionSnapshot {
  commissionPlanKind: CommissionPlanKind | null;
  contractConfiguration: CommissionContractConfiguration | null;
  calculatedAt: string;
  ruleIds: string[];
  baseCommissionAmountCents: number;
  accessoryCommissionAmountCents: number;
  provisionalRecurringAmountCents: number;
  confirmedRecurringAmountCents: number;
  finalExpectedCommissionAmountCents: number;
  currency: string;
  status: CommissionCalculationResult['status'];
  preview: CommissionCalculationResult;
}

export interface OfferCommercialSourceRefs {
  sourceComparisonSessionId: string;
  sourceScenarioId: string | null;
  recommendationRecordId: string | null;
  recommendationVersion: number | null;
  selectedCandidateId: string;
  pricingEvaluationId: string | null;
  commissionCalculationId: string | null;
  catalogVersions: {
    tariffCatalogVersion: number | null;
    productCatalogVersion: number | null;
    pricingCatalogVersion: number | null;
    commissionCatalogVersion: number | null;
  };
}

export interface OfferCommercialSnapshot {
  schemaVersion: typeof OFFER_COMMERCIAL_SNAPSHOT_VERSION;
  status: OfferCommercialSnapshotStatus;
  frozenAt: string;
  identity: OfferCommercialIdentitySnapshot;
  needSnapshot: CustomerNeed;
  customerSnapshot: OfferCustomerSnapshot;
  commercialConfig: CommercialConfig;
  projection: CommercialProjectionResult;
  commission: OfferCommercialCommissionSnapshot | null;
  sources: OfferCommercialSourceRefs;
  missingCommercialData: CommercialMissingEntry[];
}

export function isFrozenCommercialSnapshot(
  snapshot: OfferCommercialSnapshot | null | undefined,
): snapshot is OfferCommercialSnapshot {
  return snapshot?.status === 'frozen' && snapshot.schemaVersion === OFFER_COMMERCIAL_SNAPSHOT_VERSION;
}

export function summarizeCommercialBreakdown(
  breakdown: CommercialProjectionBreakdown,
): { projectedMonthlyTotalCents: number; oneTimeTotalCents: number } {
  return {
    projectedMonthlyTotalCents: breakdown.monthlyTotalCents,
    oneTimeTotalCents: breakdown.oneTimeTotalCents,
  };
}
