import type { Offer } from '../../domain/offer/offer';
import type { OfferListItem, OfferListQuery } from '../../domain/offer/offerListItem';

export interface OfferRepository {
  getAll(): Promise<Offer[]>;
  listItems(query?: OfferListQuery): Promise<OfferListItem[]>;
  getByLeadId(leadId: string): Promise<Offer[]>;
  getById(id: string): Promise<Offer | null>;
  create(offer: Offer): Promise<Offer>;
  update(offer: Offer): Promise<Offer>;
  delete(id: string): Promise<void>;
}
