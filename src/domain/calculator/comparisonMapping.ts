import type { Tariff } from '../tariff/tariff';
import type { BestPayComparisonConditions } from './comparison';

export function mapTariffToBestPayComparisonConditions(
  tariff: Tariff,
): BestPayComparisonConditions {
  return {
    tariffId: tariff.id,
    tariffName: tariff.name,
    productCode: tariff.productCode,
    monthlyAccountBaseFeeCents: tariff.monthlyAccountBaseFeeCents,
    monthlyTerminalRentalCents: tariff.monthlyTerminalRentalCents,
    monthlyServiceFeePerTerminalCents: tariff.monthlyServiceFeePerTerminalCents,
    transactionFeeTenthsOfCent: tariff.additionalTransactionFeeTenthsOfCent,
    girocardClearingFeeTenthsOfCent: tariff.girocardClearingIncluded
      ? 0
      : tariff.girocardClearingFeeTenthsOfCent,
    girocardRateTenthsOfBasisPoint: tariff.cardRates.girocard.percentageTenthsOfBasisPoint,
    creditCardRateTenthsOfBasisPoint: tariff.cardRates.credit.percentageTenthsOfBasisPoint,
    debitCardRateTenthsOfBasisPoint: tariff.cardRates.debit.percentageTenthsOfBasisPoint,
  };
}
