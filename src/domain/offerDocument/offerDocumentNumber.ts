import type { OfferDocument } from './offerDocument';

const DOCUMENT_NUMBER_PATTERN = /^BP-ANG-\d{4}-\d{4}-V(\d+)$/;

export function formatOfferDocumentNumber(offerNumber: string, version: number): string {
  return `${offerNumber}-V${version}`;
}

export function parseOfferDocumentVersion(documentNumber: string): number | null {
  const match = DOCUMENT_NUMBER_PATTERN.exec(documentNumber.trim());
  if (!match) {
    return null;
  }

  const version = Number(match[1]);
  return Number.isInteger(version) && version >= 1 ? version : null;
}

export function getNextDocumentVersion(existingDocuments: OfferDocument[]): number {
  if (existingDocuments.length === 0) {
    return 1;
  }

  const maxVersion = existingDocuments.reduce(
    (max, document) => Math.max(max, document.version),
    0,
  );

  return maxVersion + 1;
}

export function isValidOfferDocumentNumber(documentNumber: string, offerNumber: string, version: number): boolean {
  return documentNumber === formatOfferDocumentNumber(offerNumber, version);
}
