import type { CommissionCalculationRecord } from '../../domain/commission/commissionCalculation';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';

export interface CommissionCalculationRepository {
  getCalculations(): Promise<CommissionCalculationRecord[]>;
  getCalculationsByOfferId(offerId: string): Promise<CommissionCalculationRecord[]>;
  getCalculationById(id: string): Promise<CommissionCalculationRecord | null>;
  createCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord>;
  updateCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord>;
  getAllCases(): Promise<CommissionCase[]>;
  getCasesByOfferId(offerId: string): Promise<CommissionCase[]>;
  createCase(record: CommissionCase): Promise<CommissionCase>;
  createEvent(event: CommissionEvent): Promise<CommissionEvent>;
}
