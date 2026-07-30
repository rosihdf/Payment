import type { CreateTariffInput, Tariff } from './tariff';

export function tariffToFormInput(tariff: Tariff): CreateTariffInput {
  return {
    name: tariff.name,
    providerName: tariff.providerName,
    productCode: tariff.productCode,
    description: tariff.description,
    status: tariff.status,
    supportedTerminalTypes: [...tariff.supportedTerminalTypes],
    monthlyAccountBaseFeeCents: tariff.monthlyAccountBaseFeeCents,
    monthlyTerminalRentalCents: tariff.monthlyTerminalRentalCents,
    monthlyServiceFeePerTerminalCents: tariff.monthlyServiceFeePerTerminalCents,
    setupFeeCents: tariff.setupFeeCents,
    minimumMonthlyFeeCents: tariff.minimumMonthlyFeeCents,
    minimumContractMonths: tariff.minimumContractMonths,
    noticePeriodMonths: tariff.noticePeriodMonths,
    includedTransactions: tariff.includedTransactions,
    additionalTransactionFeeTenthsOfCent: tariff.additionalTransactionFeeTenthsOfCent,
    girocardClearingFeeTenthsOfCent: tariff.girocardClearingFeeTenthsOfCent,
    girocardClearingIncluded: tariff.girocardClearingIncluded,
    cardRates: {
      girocard: { ...tariff.cardRates.girocard },
      debit: { ...tariff.cardRates.debit },
      credit: { ...tariff.cardRates.credit },
      other: { ...tariff.cardRates.other },
    },
    billingInterval: tariff.billingInterval,
    validFrom: tariff.validFrom,
    validUntil: tariff.validUntil,
    notes: tariff.notes,
  };
}

export function isSameTariffInput(left: CreateTariffInput, right: CreateTariffInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
