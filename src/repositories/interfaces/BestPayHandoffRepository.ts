import type { BestPayHandoff } from '../../domain/offer/bestPayHandoff';

export interface BestPayHandoffRepository {
  getAll(): Promise<BestPayHandoff[]>;
  getById(id: string): Promise<BestPayHandoff | null>;
  getByOfferId(offerId: string): Promise<BestPayHandoff[]>;
  getByOfferVersionId(offerVersionId: string): Promise<BestPayHandoff | null>;
  create(handoff: BestPayHandoff): Promise<BestPayHandoff>;
  update(handoff: BestPayHandoff): Promise<BestPayHandoff>;
}
