export type PricingEvaluationRecordStatus = 'draft' | 'submitted' | 'superseded';

export interface PricingEvaluationRecord {
  id: string;
  offerId: string;
  status: PricingEvaluationRecordStatus;
  inputFingerprint: string;
  result: import('./pricingEvaluation').PricingEvaluationResult;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
