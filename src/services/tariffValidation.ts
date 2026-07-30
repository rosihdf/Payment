import { isValidBasisPoints } from '../utils/percentage';
import type { CardRate, CreateTariffInput, TariffCardRates } from '../domain/tariff/tariff';
import { CARD_RATE_KEYS, CARD_RATE_LABELS } from '../domain/tariff/tariff';

export type CreateTariffField = keyof CreateTariffInput | `cardRates.${string}`;

export type CreateTariffErrors = Partial<Record<CreateTariffField, string>>;

function validateNonNegativeCents(value: number, label: string): string | undefined {
  if (value < 0) {
    return `${label} darf nicht negativ sein.`;
  }

  return undefined;
}

function validateOptionalNonNegativeInteger(
  value: number | null,
  label: string,
): string | undefined {
  if (value === null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    return `${label} muss eine nicht negative ganze Zahl sein.`;
  }

  return undefined;
}

function validateCardRate(rate: CardRate, label: string): string | undefined {
  if (!isValidBasisPoints(rate.percentageBasisPoints)) {
    return `${label}: Der Prozentwert muss zwischen 0,00 % und 100,00 % liegen.`;
  }

  if (rate.fixedFeeCents < 0) {
    return `${label}: Das Fixentgelt darf nicht negativ sein.`;
  }

  return undefined;
}

function validateCardRates(cardRates: TariffCardRates): CreateTariffErrors {
  const errors: CreateTariffErrors = {};

  for (const key of CARD_RATE_KEYS) {
    const error = validateCardRate(cardRates[key], CARD_RATE_LABELS[key]);
    if (error) {
      errors[`cardRates.${key}`] = error;
    }
  }

  return errors;
}

export function validateCreateTariffInput(input: CreateTariffInput): CreateTariffErrors {
  const errors: CreateTariffErrors = {};

  if (!input.name.trim()) {
    errors.name = 'Bitte geben Sie einen Tarifnamen ein.';
  }

  if (!input.providerName.trim()) {
    errors.providerName = 'Bitte geben Sie einen Anbietername ein.';
  }

  if (!input.productCode.trim()) {
    errors.productCode = 'Bitte geben Sie einen Produktcode ein.';
  }

  if (input.supportedTerminalTypes.length === 0) {
    errors.supportedTerminalTypes = 'Bitte wählen Sie mindestens eine Einsatzart.';
  }

  const centFields: Array<[number, string, keyof CreateTariffInput]> = [
    [input.monthlyBaseFeeCents, 'Die monatliche Grundgebühr', 'monthlyBaseFeeCents'],
    [input.monthlyTerminalFeeCents, 'Die monatliche Terminalgebühr', 'monthlyTerminalFeeCents'],
    [input.setupFeeCents, 'Die Einrichtungsgebühr', 'setupFeeCents'],
    [input.additionalTransactionFeeCents, 'Der Preis je zusätzlicher Transaktion', 'additionalTransactionFeeCents'],
  ];

  for (const [value, label, field] of centFields) {
    const error = validateNonNegativeCents(value, label);
    if (error) {
      errors[field] = error;
    }
  }

  const integerFields: Array<[number | null, string, keyof CreateTariffInput]> = [
    [input.minimumMonthlyFeeCents, 'Das monatliche Mindestentgelt', 'minimumMonthlyFeeCents'],
    [input.minimumContractMonths, 'Die Mindestvertragslaufzeit', 'minimumContractMonths'],
    [input.noticePeriodMonths, 'Die Kündigungsfrist', 'noticePeriodMonths'],
    [input.includedTransactions, 'Die enthaltenen Transaktionen', 'includedTransactions'],
  ];

  for (const [value, label, field] of integerFields) {
    const error = validateOptionalNonNegativeInteger(value, label);
    if (error) {
      errors[field] = error;
    }
  }

  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) {
    errors.validUntil = 'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.';
  }

  Object.assign(errors, validateCardRates(input.cardRates));

  return errors;
}

export function normalizeProductCode(productCode: string): string {
  return productCode.trim();
}

export function isSameProductCode(left: string, right: string): boolean {
  return normalizeProductCode(left).toLowerCase() === normalizeProductCode(right).toLowerCase();
}
