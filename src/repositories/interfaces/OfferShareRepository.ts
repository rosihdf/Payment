import type { OfferShare } from '../../domain/offer/offerShare';

export interface OfferShareRepository {
  getAll(): Promise<OfferShare[]>;
  getById(id: string): Promise<OfferShare | null>;
  getByOfferId(offerId: string): Promise<OfferShare[]>;
  getByOfferVersionId(offerVersionId: string): Promise<OfferShare[]>;
  getByTokenHash(tokenHash: string): Promise<OfferShare | null>;
  create(share: OfferShare): Promise<OfferShare>;
  update(share: OfferShare): Promise<OfferShare>;
}
