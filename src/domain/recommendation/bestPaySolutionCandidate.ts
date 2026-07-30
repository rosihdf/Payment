import type { TerminalType } from '../tariff/tariff';
import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import type { CommissionCalculationResult } from '../commission/commissionCalculation';
import type { CustomerCostProjection } from './customerCostProjection';

export type BestPayCandidateStatus =
  | 'eligible'
  | 'limited'
  | 'critical'
  | 'blocked'
  | 'excluded';

export interface BestPaySolutionCandidate {
  candidateId: string;
  candidateCode: string;

  contractTypeId: string | null;
  tariffId: string;
  tariffName: string;
  tariffProductCode: string;
  terminalType: TerminalType;

  hardwareProductIds: string[];
  hardwareProductNames: string[];
  accessoryItems: Array<{ productId: string; quantity: number }>;

  contractTermId: string | null;
  contractTermMonths: number | null;
  isStandardTerm: boolean;

  quantity: number;
  priceBookVersionId: string | null;

  pricingEvaluation: PricingEvaluationResult | null;
  commissionPreview: CommissionCalculationResult | null;
  costProjection: CustomerCostProjection;

  fulfilledRequirements: string[];
  unfulfilledRequirements: string[];
  hints: string[];
  warnings: string[];
  exclusionReasons: string[];

  status: BestPayCandidateStatus;
  rank: number | null;
}

export interface RecommendationScoreBreakdown {
  eligibilityScore: number;
  needFitScore: number;
  costScore: number;
  termScore: number;
  hardwareScore: number;
  riskScore: number;
  completenessScore: number;
  internalBusinessScore: number;
  totalScore: number;
}

export interface ScoredCandidate {
  candidate: BestPaySolutionCandidate;
  scoreBreakdown: RecommendationScoreBreakdown;
}
