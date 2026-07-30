export interface CustomerCostProjection {
  currency: string;
  projectionMonths: number;
  projectionSource: 'contract_term' | 'configured_period' | 'explicit';

  oneTimeCostsCents: number | null;
  monthlyFixedCostsCents: number | null;
  transactionCostsCents: number | null;
  volumeBasedCostsCents: number | null;
  hardwareCostsCents: number | null;
  accessoryCostsCents: number | null;

  totalCostsCents: number | null;
  averageMonthlyCostsCents: number | null;
  costPerTransactionCents: number | null;

  isProjected: boolean;
  isComplete: boolean;
  missingBasis: string[];
  assumptions: string[];
}

export function createEmptyCostProjection(
  currency: string,
  projectionMonths: number,
  projectionSource: CustomerCostProjection['projectionSource'],
): CustomerCostProjection {
  return {
    currency,
    projectionMonths,
    projectionSource,
    oneTimeCostsCents: null,
    monthlyFixedCostsCents: null,
    transactionCostsCents: null,
    volumeBasedCostsCents: null,
    hardwareCostsCents: null,
    accessoryCostsCents: null,
    totalCostsCents: null,
    averageMonthlyCostsCents: null,
    costPerTransactionCents: null,
    isProjected: false,
    isComplete: false,
    missingBasis: [],
    assumptions: [],
  };
}
