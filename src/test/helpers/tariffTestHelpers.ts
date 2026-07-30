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
    monthlyBaseFeeCents: 990,
    monthlyTerminalFeeCents: 490,
    setupFeeCents: 0,
    minimumMonthlyFeeCents: null,
    minimumContractMonths: 12,
    noticePeriodMonths: 3,
    includedTransactions: 500,
    additionalTransactionFeeCents: 5,
    cardRates: {
      girocard: { percentageBasisPoints: 25, fixedFeeCents: 9 },
      debit: { percentageBasisPoints: 119, fixedFeeCents: 12 },
      credit: { percentageBasisPoints: 189, fixedFeeCents: 12 },
      other: { ...DEFAULT_CARD_RATES.other },
    },
    billingInterval: 'monthly',
    validFrom: '2026-01-01',
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
