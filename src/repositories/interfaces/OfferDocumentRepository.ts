import type { OfferDocument } from '../../domain/offerDocument/offerDocument';

export interface OfferDocumentRepository {
  getAll(): Promise<OfferDocument[]>;
  getById(id: string): Promise<OfferDocument | null>;
  getByOfferId(offerId: string): Promise<OfferDocument[]>;
  create(document: OfferDocument): Promise<OfferDocument>;
  markSuperseded(id: string): Promise<OfferDocument>;
}
