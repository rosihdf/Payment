export class OfferDocumentNotFoundError extends Error {
  readonly documentId: string;

  constructor(documentId: string) {
    super(`Offer document with id ${documentId} not found`);
    this.name = 'OfferDocumentNotFoundError';
    this.documentId = documentId;
  }
}
