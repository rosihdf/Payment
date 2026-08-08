import type { CustomerNeed } from '../recommendation/customerNeed';
import type { CommissionCalculationResult } from '../commission/commissionCalculation';
import type { CommissionContractConfiguration } from '../commission/commissionContractConfiguration';
import type { CommissionPlanKind } from '../commission/commissionPlan';
import type { CommercialConfig } from './commercialConfig';
import type { CommercialProjectionResult } from './calculateCommercialProjection';

/** Handoff für Angebotserstellung – vollständige Commercial Truth ohne erneute Rekonstruktion. */
export interface CommercialSelectionHandoff {
  commercialConfig: CommercialConfig;
  contractConfiguration: CommissionContractConfiguration | null;
  commissionPlanKind: CommissionPlanKind | null;
  projection: CommercialProjectionResult;
  commissionPreview: CommissionCalculationResult | null;
  needSnapshot: CustomerNeed;
  selectedAt: string;
}

export function buildCommercialSelectionHandoff(input: {
  commercialConfig: CommercialConfig;
  contractConfiguration: CommissionContractConfiguration | null;
  commissionPlanKind?: CommissionPlanKind | null;
  projection: CommercialProjectionResult;
  commissionPreview: CommissionCalculationResult | null;
  need: CustomerNeed;
}): CommercialSelectionHandoff {
  return {
    commercialConfig: input.commercialConfig,
    contractConfiguration: input.contractConfiguration,
    commissionPlanKind: input.commissionPlanKind ?? null,
    projection: input.projection,
    commissionPreview: input.commissionPreview,
    needSnapshot: input.need,
    selectedAt: new Date().toISOString(),
  };
}
