import type { Offer } from './offer';

const OFFER_NUMBER_PATTERN = /^BP-ANG-(\d{4})-(\d{4})$/;

export function parseOfferNumberSequence(offerNumber: string): { year: number; sequence: number } | null {
  const match = OFFER_NUMBER_PATTERN.exec(offerNumber.trim());
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

export function formatOfferNumber(year: number, sequence: number): string {
  return `BP-ANG-${year}-${String(sequence).padStart(4, '0')}`;
}

export function generateNextOfferNumber(existingOffers: Offer[], createdAtIso: string): string {
  const createdAt = new Date(createdAtIso);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();

  let maxSequence = 0;

  for (const offer of existingOffers) {
    const parsed = parseOfferNumberSequence(offer.offerNumber);
    if (!parsed || parsed.year !== year) {
      continue;
    }

    maxSequence = Math.max(maxSequence, parsed.sequence);
  }

  return formatOfferNumber(year, maxSequence + 1);
}

export function isValidOfferNumberFormat(offerNumber: string): boolean {
  return parseOfferNumberSequence(offerNumber) !== null;
}
