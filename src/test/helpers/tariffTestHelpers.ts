import type { CreateTariffInput, Tariff } from '../../domain/tariff/tariff';
import { DEFAULT_CARD_RATES } from '../../domain/tariff/defaults';
import { nowIso } from '../../utils/id';

export function createValidTariffInput(
  overrides: Partial<CreateTariffInput> = {},
): CreateTariffInput {
  return {
    name: 'Test Tarif',
    providerName: 'BestPay',
    productCode: 'BP-TEST-001',
    description: 'Testbeschreibung',
    status: 'active',
    supportedTerminalTypes: ['stationary'],
    monthlyAccountBaseFeeCents: 0,
    monthlyTerminalRentalCents: 990,
    monthlyServiceFeePerTerminalCents: 490,
    setupFeeCents: 0,
    minimumMonthlyFeeCents: null,
    minimumContractMonths: null,
    noticePeriodMonths: null,
    includedTransactions: null,
    additionalTransactionFeeTenthsOfCent: 50,
    girocardClearingFeeTenthsOfCent: 0,
    girocardClearingIncluded: false,
    cardRates: {
      girocard: { percentageTenthsOfBasisPoint: 250, fixedFeeTenthsOfCent: 0 },
      debit: { percentageTenthsOfBasisPoint: 1190, fixedFeeTenthsOfCent: 0 },
      credit: { percentageTenthsOfBasisPoint: 1890, fixedFeeTenthsOfCent: 0 },
      other: { ...DEFAULT_CARD_RATES.other },
    },
    billingInterval: 'monthly',
    validFrom: null,
    validUntil: null,
    notes: 'Interne Notiz',
    ...overrides,
  };
}

export function createTestTariff(overrides: Partial<Tariff> = {}): Tariff {
  const timestamp = nowIso();

  return {
    id: 'tariff_test',
    ...createValidTariffInput(),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createUniqueTariffInput(suffix: string): CreateTariffInput {
  return createValidTariffInput({
    name: `Test Tarif ${suffix}`,
    productCode: `BP-TEST-${suffix}`,
  });
}

export function createTariffWithId(id: string, input?: Partial<CreateTariffInput>): Tariff {
  const timestamp = nowIso();
  return {
    id,
    ...createValidTariffInput(input),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
