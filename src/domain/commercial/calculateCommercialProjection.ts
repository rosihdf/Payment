import type { CustomerNeed } from '../recommendation/customerNeed';
import type { CustomerCostProjection } from '../recommendation/customerCostProjection';
import { createEmptyCostProjection } from '../recommendation/customerCostProjection';
import { percentageOfCentsFromTenthsOfBasisPoint } from '../../utils/percentageAmount';
import { transactionCostsFromTenthsOfCent } from '../../utils/tenthsOfCent';
import type { CommercialConfig } from './commercialConfig';
import { commercialMissingEntry, type CommercialMissingEntry } from './commercialMissingData';

export interface CommercialProjectionBreakdown {
  monthlyTerminalRentalCents: number;
  monthlyServiceCents: number;
  monthlySimCents: number;
  monthlyAccountBaseCents: number;
  monthlyTransactionFixedCents: number;
  monthlyCardFeesCents: number;
  monthlyClearingCents: number;
  monthlyFixedTotalCents: number;
  monthlyVariableTotalCents: number;
  monthlyTotalCents: number;
  oneTimeSetupCents: number;
  oneTimeHardwareCents: number;
  oneTimeTotalCents: number;
}

export interface CommercialProjectionResult {
  projectionMonths: number;
  breakdown: CommercialProjectionBreakdown;
  monthlyTotalCents: number | null;
  oneTimeTotalCents: number | null;
  totalCostsCents: number | null;
  averageMonthlyCostsCents: number | null;
  isComplete: boolean;
  missingCommercialData: CommercialMissingEntry[];
  assumptions: string[];
}

function emptyBreakdown(): CommercialProjectionBreakdown {
  return {
    monthlyTerminalRentalCents: 0,
    monthlyServiceCents: 0,
    monthlySimCents: 0,
    monthlyAccountBaseCents: 0,
    monthlyTransactionFixedCents: 0,
    monthlyCardFeesCents: 0,
    monthlyClearingCents: 0,
    monthlyFixedTotalCents: 0,
    monthlyVariableTotalCents: 0,
    monthlyTotalCents: 0,
    oneTimeSetupCents: 0,
    oneTimeHardwareCents: 0,
    oneTimeTotalCents: 0,
  };
}

export function calculateCommercialProjection(
  need: CustomerNeed,
  config: CommercialConfig,
  options: { hardwareOneTimeCents?: number; hardwareMonthlyCents?: number } = {},
): CommercialProjectionResult {
  const projectionMonths = config.contractTermMonths;
  const missing: CommercialMissingEntry[] = [];
  const assumptions: string[] = [];
  const breakdown = emptyBreakdown();
  const terminalCount = Math.max(1, config.terminalCount);

  breakdown.monthlyAccountBaseCents = config.monthlyAccountBaseFeeCents;
  breakdown.monthlyTerminalRentalCents = terminalCount * config.monthlyTerminalRentalCents;
  breakdown.monthlyServiceCents = terminalCount * config.monthlyServiceFeePerTerminalCents;

  if (config.deploymentMode === 'mobile_sim') {
    if (config.simMonthlyFeeCents > 0) {
      breakdown.monthlySimCents = terminalCount * config.simMonthlyFeeCents;
    } else {
      missing.push(commercialMissingEntry('commercial.simPrice', 'warning'));
    }
    assumptions.push('Mobiler Betrieb mit optionaler SIM-Karte.');
  } else {
    assumptions.push('Stationärer Betrieb über Kunden-WLAN ohne SIM-Aufpreis.');
  }

  breakdown.oneTimeSetupCents = config.setupFeeCents;
  breakdown.oneTimeHardwareCents =
    (options.hardwareOneTimeCents ?? 0) + (options.hardwareMonthlyCents ?? 0) * projectionMonths;

  breakdown.monthlyFixedTotalCents =
    breakdown.monthlyAccountBaseCents +
    breakdown.monthlyTerminalRentalCents +
    breakdown.monthlyServiceCents +
    breakdown.monthlySimCents;

  let monthlyTransactionFixedCents: number | null = null;
  let monthlyCardFeesCents: number | null = null;
  let monthlyClearingCents: number | null = null;

  if (need.monthlyTransactions !== null) {
    monthlyTransactionFixedCents = Math.round(
      transactionCostsFromTenthsOfCent(
        need.monthlyTransactions,
        config.additionalTransactionFeeTenthsOfCent,
      ) ?? 0,
    );

    if (!config.girocardClearingIncluded && need.cardMix.girocardPercent !== null) {
      const giroTransactions = Math.round(
        (need.monthlyTransactions * need.cardMix.girocardPercent) / 100,
      );
      monthlyClearingCents = Math.round(
        transactionCostsFromTenthsOfCent(
          giroTransactions,
          config.girocardClearingFeeTenthsOfCent,
        ) ?? 0,
      );
    } else if (!config.girocardClearingIncluded && need.cardMix.girocardPercent === null) {
      missing.push(commercialMissingEntry('need.cardMix.girocardPercent', 'warning'));
      monthlyClearingCents = 0;
    } else {
      monthlyClearingCents = 0;
    }
  } else {
    missing.push(commercialMissingEntry('need.monthlyTransactions', 'error'));
  }

  if (need.monthlyCardVolumeCents !== null) {
    monthlyCardFeesCents = 0;
    const monthlyVolume = need.monthlyCardVolumeCents;

    if (need.cardMix.girocardPercent !== null) {
      const giroVolume = Math.round((monthlyVolume * need.cardMix.girocardPercent) / 100);
      monthlyCardFeesCents += percentageOfCentsFromTenthsOfBasisPoint(
        giroVolume,
        config.cardRates.girocard.percentageTenthsOfBasisPoint,
      );
    } else {
      missing.push(commercialMissingEntry('need.cardMix.girocardPercent', 'warning'));
    }

    if (need.cardMix.debitPercent !== null) {
      const debitVolume = Math.round((monthlyVolume * need.cardMix.debitPercent) / 100);
      monthlyCardFeesCents += percentageOfCentsFromTenthsOfBasisPoint(
        debitVolume,
        config.cardRates.debit.percentageTenthsOfBasisPoint,
      );
    } else {
      missing.push(commercialMissingEntry('need.cardMix.debitPercent', 'warning'));
    }

    if (need.cardMix.creditPercent !== null) {
      const creditVolume = Math.round((monthlyVolume * need.cardMix.creditPercent) / 100);
      monthlyCardFeesCents += percentageOfCentsFromTenthsOfBasisPoint(
        creditVolume,
        config.cardRates.credit.percentageTenthsOfBasisPoint,
      );
    } else {
      missing.push(commercialMissingEntry('need.cardMix.creditPercent', 'warning'));
    }

    if (need.cardMix.otherPercent !== null && need.cardMix.otherPercent > 0) {
      if (config.cardRates.other.percentageTenthsOfBasisPoint <= 0) {
        missing.push(commercialMissingEntry('need.cardMix.otherPercent', 'warning'));
      } else {
        const otherVolume = Math.round((monthlyVolume * need.cardMix.otherPercent) / 100);
        monthlyCardFeesCents += percentageOfCentsFromTenthsOfBasisPoint(
          otherVolume,
          config.cardRates.other.percentageTenthsOfBasisPoint,
        );
      }
    }
  } else {
    missing.push(commercialMissingEntry('need.monthlyCardVolumeCents', 'error'));
  }

  if (config.tariffProductCode.includes('FLAT')) {
    assumptions.push(
      'Flat Non-EWR- (+1,49 %) und Commercial-Card-Markups (+1,59 %) sind noch nicht in der Projektion enthalten.',
    );
  }

  breakdown.monthlyTransactionFixedCents = monthlyTransactionFixedCents ?? 0;
  breakdown.monthlyCardFeesCents = monthlyCardFeesCents ?? 0;
  breakdown.monthlyClearingCents = monthlyClearingCents ?? 0;
  breakdown.monthlyVariableTotalCents =
    breakdown.monthlyTransactionFixedCents +
    breakdown.monthlyCardFeesCents +
    breakdown.monthlyClearingCents;
  breakdown.monthlyTotalCents =
    breakdown.monthlyFixedTotalCents + breakdown.monthlyVariableTotalCents;
  breakdown.oneTimeTotalCents =
    breakdown.oneTimeSetupCents + breakdown.oneTimeHardwareCents;

  const blockingMissing = missing.filter((entry) => entry.severity === 'error');
  const isComplete =
    blockingMissing.length === 0 &&
    monthlyTransactionFixedCents !== null &&
    monthlyCardFeesCents !== null &&
    monthlyClearingCents !== null;

  const monthlyTotalCents = isComplete ? breakdown.monthlyTotalCents : null;
  const oneTimeTotalCents = breakdown.oneTimeTotalCents;
  const totalCostsCents = isComplete
    ? oneTimeTotalCents + breakdown.monthlyTotalCents * projectionMonths
    : null;
  const averageMonthlyCostsCents =
    isComplete && totalCostsCents !== null
      ? Math.round(totalCostsCents / projectionMonths)
      : null;

  return {
    projectionMonths,
    breakdown,
    monthlyTotalCents,
    oneTimeTotalCents,
    totalCostsCents,
    averageMonthlyCostsCents,
    isComplete,
    missingCommercialData: missing,
    assumptions,
  };
}

export function mapCommercialProjectionToCustomerCostProjection(
  result: CommercialProjectionResult,
): CustomerCostProjection {
  const projection = createEmptyCostProjection(
    'EUR',
    result.projectionMonths,
    'contract_term',
  );

  projection.oneTimeCostsCents = result.oneTimeTotalCents;
  projection.monthlyFixedCostsCents = result.breakdown.monthlyFixedTotalCents;
  projection.transactionCostsCents = isCompleteTransactionPart(result)
    ? (result.breakdown.monthlyTransactionFixedCents + result.breakdown.monthlyClearingCents) *
      result.projectionMonths
    : null;
  projection.volumeBasedCostsCents = isCompleteTransactionPart(result)
    ? result.breakdown.monthlyCardFeesCents * result.projectionMonths
    : null;
  projection.hardwareCostsCents = result.breakdown.oneTimeHardwareCents;
  projection.accessoryCostsCents = result.breakdown.monthlySimCents * result.projectionMonths;
  projection.totalCostsCents = result.totalCostsCents;
  projection.averageMonthlyCostsCents = result.averageMonthlyCostsCents;
  projection.isProjected = true;
  projection.isComplete = result.isComplete;
  projection.missingBasis = result.missingCommercialData.map((entry) => entry.code);
  projection.assumptions = result.assumptions;

  return projection;
}

function isCompleteTransactionPart(result: CommercialProjectionResult): boolean {
  return result.breakdown.monthlyTransactionFixedCents >= 0 && result.isComplete;
}
