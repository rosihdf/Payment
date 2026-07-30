import { validateCardMix } from '../domain/lead/cardMixValidation';
import { DEFAULT_CARD_MIX } from '../domain/lead/defaults';
import type { CardMix, CreateLeadInput } from '../domain/lead/lead';

export type CreateLeadField = keyof CreateLeadInput | 'cardMix';

export type CreateLeadErrors = Partial<Record<CreateLeadField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_PATTERN = /^\d{5}$/;

function validateOptionalCents(value: number | null, fieldLabel: string): string | undefined {
  if (value === null) {
    return undefined;
  }

  if (value < 0) {
    return `${fieldLabel} darf nicht negativ sein.`;
  }

  return undefined;
}

function validateOptionalInteger(value: number | null, fieldLabel: string): string | undefined {
  if (value === null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    return `${fieldLabel} muss eine nicht negative ganze Zahl sein.`;
  }

  return undefined;
}

export function validateCreateLeadInput(input: CreateLeadInput): CreateLeadErrors {
  const errors: CreateLeadErrors = {};

  if (!input.companyName.trim()) {
    errors.companyName = 'Bitte geben Sie einen Firmennamen ein.';
  }

  if (!input.contactFirstName.trim()) {
    errors.contactFirstName = 'Bitte geben Sie einen Vornamen ein.';
  }

  if (!input.contactLastName.trim()) {
    errors.contactLastName = 'Bitte geben Sie einen Nachnamen ein.';
  }

  if (!input.phone.trim()) {
    errors.phone = 'Bitte geben Sie eine Telefonnummer ein.';
  }

  const email = input.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  }

  const postalCode = input.postalCode.trim();
  if (postalCode && !POSTAL_CODE_PATTERN.test(postalCode)) {
    errors.postalCode = 'Die PLZ muss aus genau fünf Ziffern bestehen.';
  }

  const turnoverError = validateOptionalCents(
    input.monthlyCardTurnoverCents,
    'Der monatliche Kartenumsatz',
  );
  if (turnoverError) {
    errors.monthlyCardTurnoverCents = turnoverError;
  }

  const transactionsError = validateOptionalInteger(
    input.monthlyTransactions,
    'Die monatlichen Transaktionen',
  );
  if (transactionsError) {
    errors.monthlyTransactions = transactionsError;
  }

  const averageBonError = validateOptionalCents(
    input.averageTransactionValueCents,
    'Der durchschnittliche Bon',
  );
  if (averageBonError) {
    errors.averageTransactionValueCents = averageBonError;
  }

  const terminalCountError = validateOptionalInteger(
    input.currentTerminalCount,
    'Die Terminalanzahl',
  );
  if (terminalCountError) {
    errors.currentTerminalCount = terminalCountError;
  }

  if (!Number.isInteger(input.requiredTerminalCount) || input.requiredTerminalCount < 1) {
    errors.requiredTerminalCount = 'Es wird mindestens ein Terminal benötigt.';
  }

  const cardMixValidation = validateCardMix(input.cardMix);
  if (!cardMixValidation.isValid) {
    errors.cardMix = cardMixValidation.message;
  }

  return errors;
}

export function getCardMixSummary(cardMix: CardMix = DEFAULT_CARD_MIX): string {
  const result = validateCardMix(cardMix);

  if (result.isValid && result.sum === 100) {
    return 'Summe: 100 % — vollständig';
  }

  if (result.isValid) {
    return 'Summe: 0 % — vollständig';
  }

  return `Summe: ${result.sum} %`;
}

export function getCardMixSum(cardMix: CardMix = DEFAULT_CARD_MIX): number {
  return validateCardMix(cardMix).sum;
}

export function isCardMixValid(cardMix: CardMix): boolean {
  return validateCardMix(cardMix).isValid;
}
