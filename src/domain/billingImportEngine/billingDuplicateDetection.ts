import type { BillingSourceDocument } from '../billingImport/billingSourceDocument';

export interface DuplicateDetectionResult {
  exactDuplicates: Array<{ documentId: string; duplicateOfDocumentId: string }>;
  possibleDuplicates: Array<{ documentId: string; duplicateOfDocumentId: string; reason: string }>;
}

export function detectBillingDuplicates(documents: BillingSourceDocument[]): DuplicateDetectionResult {
  const exactDuplicates: DuplicateDetectionResult['exactDuplicates'] = [];
  const possibleDuplicates: DuplicateDetectionResult['possibleDuplicates'] = [];

  for (let index = 0; index < documents.length; index += 1) {
    const current = documents[index]!;
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = documents[otherIndex]!;
      if (current.contentFingerprint === other.contentFingerprint) {
        exactDuplicates.push({
          documentId: current.id,
          duplicateOfDocumentId: other.id,
        });
        continue;
      }

      if (
        current.detectedInvoiceNumber &&
        other.detectedInvoiceNumber &&
        current.detectedInvoiceNumber === other.detectedInvoiceNumber &&
        current.documentType !== 'credit_note' &&
        other.documentType !== 'credit_note'
      ) {
        possibleDuplicates.push({
          documentId: current.id,
          duplicateOfDocumentId: other.id,
          reason: 'Gleiche Rechnungsnummer',
        });
      } else if (
        current.periodFrom &&
        current.periodTo &&
        current.periodFrom === other.periodFrom &&
        current.periodTo === other.periodTo &&
        current.currency &&
        other.currency &&
        current.currency === other.currency
      ) {
        possibleDuplicates.push({
          documentId: current.id,
          duplicateOfDocumentId: other.id,
          reason: 'Gleicher Abrechnungszeitraum',
        });
      }
    }
  }

  return { exactDuplicates, possibleDuplicates };
}
