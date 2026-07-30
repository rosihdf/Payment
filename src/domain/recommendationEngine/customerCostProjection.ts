import type { Tariff } from '../tariff/tariff';
import type { Product } from '../product/product';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import {
  createEmptyCostProjection,
  type CustomerCostProjection,
} from '../recommendation/customerCostProjection';
import { percentageOfCentsFromTenthsOfBasisPoint } from '../../utils/percentageAmount';
import { transactionCostsFromTenthsOfCent } from '../../utils/tenthsOfCent';

function resolveProjectionMonths(
  candidate: BestPaySolutionCandidate,
  configuredMonths: number | null,
): number {
  if (candidate.contractTermMonths !== null && candidate.contractTermMonths > 0) {
    return candidate.contractTermMonths;
  }

  if (configuredMonths !== null && configuredMonths > 0) {
    return configuredMonths;
  }

  return 24;
}

export function projectCustomerCosts(
  need: CustomerNeed,
  candidate: BestPaySolutionCandidate,
  tariff: Tariff | null,
  products: Map<string, Product>,
  configuredProjectionMonths: number | null,
): CustomerCostProjection {
  const projectionMonths = resolveProjectionMonths(candidate, configuredProjectionMonths);
  const projection = createEmptyCostProjection('EUR', projectionMonths, 'contract_term');
  const missingBasis: string[] = [];
  const assumptions: string[] = [];

  if (!tariff) {
    missingBasis.push('tariff');
    projection.missingBasis = missingBasis;
    return projection;
  }

  const terminalCount = candidate.quantity;
  const oneTimeCents = tariff.setupFeeCents;
  let hardwareOneTimeCents = 0;
  let hardwareMonthlyCents = 0;

  for (const productId of candidate.hardwareProductIds) {
    const product = products.get(productId);
    if (!product) {
      missingBasis.push(`hardware:${productId}`);
      continue;
    }

    if (product.priceType === 'one_time' && product.priceCents !== null) {
      hardwareOneTimeCents += product.priceCents * terminalCount;
    } else if (product.priceType === 'monthly' && product.priceCents !== null) {
      hardwareMonthlyCents += product.priceCents * terminalCount;
    } else if (product.priceType === 'on_request') {
      missingBasis.push(`hardware_price:${productId}`);
    }
  }

  const monthlyFixedCents =
    tariff.monthlyAccountBaseFeeCents +
    terminalCount * (tariff.monthlyTerminalRentalCents + tariff.monthlyServiceFeePerTerminalCents) +
    hardwareMonthlyCents;

  projection.oneTimeCostsCents = oneTimeCents + hardwareOneTimeCents;
  projection.monthlyFixedCostsCents = monthlyFixedCents;
  projection.hardwareCostsCents = hardwareOneTimeCents + hardwareMonthlyCents * projectionMonths;

  let transactionCostsCents: number | null = null;
  let volumeBasedCostsCents: number | null = null;

  if (need.monthlyTransactions !== null) {
    const totalTransactions = need.monthlyTransactions * projectionMonths;
    transactionCostsCents = transactionCostsFromTenthsOfCent(
      totalTransactions,
      tariff.additionalTransactionFeeTenthsOfCent,
    );

    if (!tariff.girocardClearingIncluded && need.cardMix.girocardPercent !== null) {
      const giroTransactions = Math.round(
        (need.monthlyTransactions * need.cardMix.girocardPercent) / 100,
      );
      transactionCostsCents += transactionCostsFromTenthsOfCent(
        giroTransactions * projectionMonths,
        tariff.girocardClearingFeeTenthsOfCent,
      );
    }
  } else {
    missingBasis.push('monthlyTransactions');
  }

  if (need.monthlyCardVolumeCents !== null) {
    volumeBasedCostsCents = 0;
    const monthlyVolume = need.monthlyCardVolumeCents;

    if (need.cardMix.girocardPercent !== null) {
      const giroVolume = Math.round((monthlyVolume * need.cardMix.girocardPercent) / 100);
      volumeBasedCostsCents += percentageOfCentsFromTenthsOfBasisPoint(
        giroVolume * projectionMonths,
        tariff.cardRates.girocard.percentageTenthsOfBasisPoint,
      );
    } else {
      missingBasis.push('girocardSharePercent');
    }

    if (need.cardMix.debitPercent !== null) {
      const debitVolume = Math.round((monthlyVolume * need.cardMix.debitPercent) / 100);
      volumeBasedCostsCents += percentageOfCentsFromTenthsOfBasisPoint(
        debitVolume * projectionMonths,
        tariff.cardRates.debit.percentageTenthsOfBasisPoint,
      );
    }

    if (need.cardMix.creditPercent !== null) {
      const creditVolume = Math.round((monthlyVolume * need.cardMix.creditPercent) / 100);
      volumeBasedCostsCents += percentageOfCentsFromTenthsOfBasisPoint(
        creditVolume * projectionMonths,
        tariff.cardRates.credit.percentageTenthsOfBasisPoint,
      );
    }
  } else {
    missingBasis.push('monthlyCardVolumeCents');
  }

  projection.transactionCostsCents = transactionCostsCents;
  projection.volumeBasedCostsCents = volumeBasedCostsCents;

  const fixedTotal = monthlyFixedCents * projectionMonths;
  const partialParts = [projection.oneTimeCostsCents, fixedTotal];

  if (transactionCostsCents !== null) {
    partialParts.push(transactionCostsCents);
  }
  if (volumeBasedCostsCents !== null) {
    partialParts.push(volumeBasedCostsCents);
  }

  const isComplete =
    missingBasis.length === 0 &&
    transactionCostsCents !== null &&
    volumeBasedCostsCents !== null;

  projection.isComplete = isComplete;
  projection.isProjected = true;
  projection.missingBasis = missingBasis;
  projection.assumptions = assumptions;

  if (isComplete) {
    projection.totalCostsCents = partialParts.reduce((sum, value) => sum + (value ?? 0), 0);
    projection.averageMonthlyCostsCents = Math.round(
      projection.totalCostsCents / projectionMonths,
    );

    if (need.monthlyTransactions !== null && need.monthlyTransactions > 0) {
      const totalTransactions = need.monthlyTransactions * projectionMonths;
      projection.costPerTransactionCents = Math.round(
        projection.totalCostsCents / totalTransactions,
      );
    }
  } else if (partialParts.every((value) => value !== null)) {
    projection.totalCostsCents = null;
  }

  return projection;
}
