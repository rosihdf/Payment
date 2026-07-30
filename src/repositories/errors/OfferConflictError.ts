export class OfferConflictError extends Error {
  readonly reason: 'duplicate_id' | 'duplicate_offer_number';

  constructor(reason: 'duplicate_id' | 'duplicate_offer_number', message: string) {
    super(message);
    this.name = 'OfferConflictError';
    this.reason = reason;
  }
}
