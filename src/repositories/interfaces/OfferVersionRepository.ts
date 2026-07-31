import type { OfferVersion } from '../../domain/offer/offerVersion';

export interface OfferVersionRepository {
  getAll(): Promise<OfferVersion[]>;
  getById(id: string): Promise<OfferVersion | null>;
  getByOfferId(offerId: string): Promise<OfferVersion[]>;
  create(version: OfferVersion): Promise<OfferVersion>;
  update(version: OfferVersion): Promise<OfferVersion>;
}
