import type { OfferWorkflowEvent } from '../../domain/offer/offerWorkflowEvents';

export interface OfferWorkflowEventRepository {
  getAll(): Promise<OfferWorkflowEvent[]>;
  getByOfferId(offerId: string): Promise<OfferWorkflowEvent[]>;
  create(event: OfferWorkflowEvent): Promise<OfferWorkflowEvent>;
}
