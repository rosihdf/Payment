import type { PricingEvaluationRecord } from '../../domain/pricing/pricingEvaluationRecord';

export interface PricingEvaluationRepository {
  getAll(): Promise<PricingEvaluationRecord[]>;
  getByOfferId(offerId: string): Promise<PricingEvaluationRecord[]>;
  getById(id: string): Promise<PricingEvaluationRecord | null>;
  create(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord>;
  update(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord>;
}
