export class OfferDocumentConflictError extends Error {
  readonly reason: 'duplicate_id' | 'duplicate_document_number' | 'duplicate_version';

  constructor(
    reason: 'duplicate_id' | 'duplicate_document_number' | 'duplicate_version',
    message: string,
  ) {
    super(message);
    this.name = 'OfferDocumentConflictError';
    this.reason = reason;
  }
}
