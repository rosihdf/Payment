import type { CurrentPaymentConditions } from '../domain/calculator/comparison';
import { isValidTenthsOfBasisPoint } from '../utils/percentage';

export interface PaymentComparisonValidationErrors {
  terminalCount?: string;
  contractDurationYears?: string;
  terminalRentalPerUnitCents?: string;
  transactionFeeTenthsOfCent?: string;
  girocardTransactionCountMonthly?: string;
  acquiringTransactionCountMonthly?: string;
  girocardClearingFeeTenthsOfCent?: string;
  girocardRateTenthsOfBasisPoint?: string;
  girocardVolumeMonthlyCents?: string;
  creditCardRateTenthsOfBasisPoint?: string;
  creditCardVolumeMonthlyCents?: string;
  debitCardRateTenthsOfBasisPoint?: string;
  debitCardVolumeMonthlyCents?: string;
  tariffId?: string;
}

function validateNonNegativeInteger(value: number, label: string): string | undefined {
  if (!Number.isInteger(value) || value < 0) {
    return `${label} muss eine nicht negative ganze Zahl sein.`;
  }

  return undefined;
}

function validateNonNegativeCents(value: number, label: string): string | undefined {
  if (!Number.isInteger(value) || value < 0) {
    return `${label} darf nicht negativ sein.`;
  }

  return undefined;
}

function validateNonNegativeTenths(value: number, label: string): string | undefined {
  if (!Number.isInteger(value) || value < 0) {
    return `${label} darf nicht negativ sein.`;
  }

  return undefined;
}

export function validateCurrentPaymentConditions(
  current: CurrentPaymentConditions,
): PaymentComparisonValidationErrors {
  const errors: PaymentComparisonValidationErrors = {};

  if (!Number.isInteger(current.terminalCount) || current.terminalCount < 1) {
    errors.terminalCount = 'Bitte geben Sie mindestens 1 Terminal an.';
  }

  if (
    !Number.isInteger(current.contractDurationYears) ||
    current.contractDurationYears < 1 ||
    current.contractDurationYears > 10
  ) {
    errors.contractDurationYears = 'Die Vertragslaufzeit muss zwischen 1 und 10 Jahren liegen.';
  }

  const centFields: Array<[number, string, keyof PaymentComparisonValidationErrors]> = [
    [current.terminalRentalPerUnitCents, 'Die Terminalmiete', 'terminalRentalPerUnitCents'],
    [current.girocardVolumeMonthlyCents, 'Das Girocard-Volumen', 'girocardVolumeMonthlyCents'],
    [
      current.creditCardVolumeMonthlyCents,
      'Das Kreditkarten-Volumen',
      'creditCardVolumeMonthlyCents',
    ],
    [current.debitCardVolumeMonthlyCents, 'Das Debitkarten-Volumen', 'debitCardVolumeMonthlyCents'],
  ];

  for (const [value, label, field] of centFields) {
    const error = validateNonNegativeCents(value, label);
    if (error) {
      errors[field] = error;
    }
  }

  const integerFields: Array<[number, string, keyof PaymentComparisonValidationErrors]> = [
    [
      current.girocardTransactionCountMonthly,
      'Die Girocard-Transaktionen',
      'girocardTransactionCountMonthly',
    ],
    [
      current.acquiringTransactionCountMonthly,
      'Die sonstigen Kartentransaktionen',
      'acquiringTransactionCountMonthly',
    ],
  ];

  for (const [value, label, field] of integerFields) {
    const error = validateNonNegativeInteger(value, label);
    if (error) {
      errors[field] = error;
    }
  }

  const tenthsFields: Array<[number, string, keyof PaymentComparisonValidationErrors]> = [
    [current.transactionFeeTenthsOfCent, 'Der Transaktionspreis', 'transactionFeeTenthsOfCent'],
    [
      current.girocardClearingFeeTenthsOfCent,
      'Das Girocard-Clearing',
      'girocardClearingFeeTenthsOfCent',
    ],
  ];

  for (const [value, label, field] of tenthsFields) {
    const error = validateNonNegativeTenths(value, label);
    if (error) {
      errors[field] = error;
    }
  }

  const rateFields: Array<[number, keyof PaymentComparisonValidationErrors]> = [
    [current.girocardRateTenthsOfBasisPoint, 'girocardRateTenthsOfBasisPoint'],
    [current.creditCardRateTenthsOfBasisPoint, 'creditCardRateTenthsOfBasisPoint'],
    [current.debitCardRateTenthsOfBasisPoint, 'debitCardRateTenthsOfBasisPoint'],
  ];

  for (const [value, field] of rateFields) {
    if (!isValidTenthsOfBasisPoint(value)) {
      errors[field] = 'Der Prozentwert muss zwischen 0,000 % und 100,000 % liegen.';
    }
  }

  return errors;
}

export function validateTariffSelection(
  tariffId: string | null,
  activeTariffIds: string[],
): Pick<PaymentComparisonValidationErrors, 'tariffId'> {
  if (!tariffId) {
    return { tariffId: 'Bitte wählen Sie einen BestPay-Tarif.' };
  }

  if (!activeTariffIds.includes(tariffId)) {
    return { tariffId: 'Der gewählte Tarif ist nicht verfügbar oder nicht aktiv.' };
  }

  return {};
}

export function hasValidationErrors(errors: PaymentComparisonValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
