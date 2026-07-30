export class OfferNotFoundError extends Error {
  readonly offerId: string;

  constructor(offerId: string) {
    super(`Offer with id ${offerId} not found`);
    this.name = 'OfferNotFoundError';
    this.offerId = offerId;
  }
}
