import type { OfferChangeRequest } from '../../domain/offer/offerChangeRequest';

export interface OfferChangeRequestRepository {
  getAll(): Promise<OfferChangeRequest[]>;
  getById(id: string): Promise<OfferChangeRequest | null>;
  getByOfferId(offerId: string): Promise<OfferChangeRequest[]>;
  getByOfferVersionId(offerVersionId: string): Promise<OfferChangeRequest[]>;
  create(request: OfferChangeRequest): Promise<OfferChangeRequest>;
  update(request: OfferChangeRequest): Promise<OfferChangeRequest>;
}
