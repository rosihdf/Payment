import type { SalesDocument } from '../../domain/salesDocument/salesDocument';

export interface SalesDocumentRepository {
  getAll(): Promise<SalesDocument[]>;
  getByOfferId(offerId: string): Promise<SalesDocument[]>;
  create(document: SalesDocument): Promise<SalesDocument>;
}
