import type { OfferCustomerQuestion } from '../../domain/offer/offerCustomerQuestion';

export interface OfferCustomerQuestionRepository {
  getAll(): Promise<OfferCustomerQuestion[]>;
  getById(id: string): Promise<OfferCustomerQuestion | null>;
  getByOfferId(offerId: string): Promise<OfferCustomerQuestion[]>;
  getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerQuestion[]>;
  create(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion>;
  update(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion>;
}
