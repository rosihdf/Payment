import type { Contract } from './contract';

const CONTRACT_NUMBER_PATTERN = /^V-(\d{4})-(\d{5})$/;

export function parseContractNumberSequence(
  contractNumber: string,
): { year: number; sequence: number } | null {
  const match = CONTRACT_NUMBER_PATTERN.exec(contractNumber.trim());
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

export function formatContractNumber(year: number, sequence: number): string {
  return `V-${year}-${String(sequence).padStart(5, '0')}`;
}

export function generateNextContractNumber(existingContracts: Contract[], createdAtIso: string): string {
  const createdAt = new Date(createdAtIso);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();

  let maxSequence = 0;
  for (const contract of existingContracts) {
    const parsed = parseContractNumberSequence(contract.contractNumber);
    if (!parsed || parsed.year !== year) {
      continue;
    }
    maxSequence = Math.max(maxSequence, parsed.sequence);
  }

  return formatContractNumber(year, maxSequence + 1);
}

export function isValidContractNumberFormat(contractNumber: string): boolean {
  return parseContractNumberSequence(contractNumber) !== null;
}

/** Stable source key for idempotent contract creation from an accepted offer version. */
export function buildContractSourceKey(offerId: string, acceptedOfferVersionId: string): string {
  return `offer:${offerId}:version:${acceptedOfferVersionId}`;
}
