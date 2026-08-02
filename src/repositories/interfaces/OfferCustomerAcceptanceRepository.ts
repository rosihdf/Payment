import type { OfferCustomerAcceptance } from '../../domain/offer/offerCustomerAcceptance';

export interface OfferCustomerAcceptanceRepository {
  getAll(): Promise<OfferCustomerAcceptance[]>;
  getById(id: string): Promise<OfferCustomerAcceptance | null>;
  getByOfferId(offerId: string): Promise<OfferCustomerAcceptance[]>;
  getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerAcceptance | null>;
  create(acceptance: OfferCustomerAcceptance): Promise<OfferCustomerAcceptance>;
}
