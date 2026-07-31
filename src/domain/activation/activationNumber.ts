import type { ActivationCase } from './activationCase';

const ACTIVATION_NUMBER_PATTERN = /^A-(\d{4})-(\d{5})$/;

export function parseActivationNumberSequence(
  activationNumber: string,
): { year: number; sequence: number } | null {
  const match = ACTIVATION_NUMBER_PATTERN.exec(activationNumber.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) {
    return null;
  }
  return { year, sequence };
}

export function formatActivationNumber(year: number, sequence: number): string {
  return `A-${year}-${String(sequence).padStart(5, '0')}`;
}

export function generateNextActivationNumber(
  existingCases: ActivationCase[],
  createdAtIso: string,
): string {
  const createdAt = new Date(createdAtIso);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();

  let maxSequence = 0;
  for (const activationCase of existingCases) {
    const parsed = parseActivationNumberSequence(activationCase.activationNumber);
    if (!parsed || parsed.year !== year) {
      continue;
    }
    maxSequence = Math.max(maxSequence, parsed.sequence);
  }

  return formatActivationNumber(year, maxSequence + 1);
}

export function isValidActivationNumberFormat(activationNumber: string): boolean {
  return parseActivationNumberSequence(activationNumber) !== null;
}

/** Stable idempotency key for the single initial activation of a contract. */
export function buildActivationSourceKey(contractId: string): string {
  return `contract:${contractId}:initial-activation`;
}
