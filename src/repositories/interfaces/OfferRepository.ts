import type { Offer } from '../../domain/offer/offer';

export interface OfferRepository {
  getAll(): Promise<Offer[]>;
  getById(id: string): Promise<Offer | null>;
  create(offer: Offer): Promise<Offer>;
  update(offer: Offer): Promise<Offer>;
}
