import type { CommissionAssignmentVersion } from '../../domain/commission/commissionAssignmentVersion';
import type { CommissionBonusPayment } from '../../domain/commission/commissionBonusPayment';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import type { CommissionPaymentRecord } from '../../domain/commission/commissionPaymentRecord';

export interface CommissionWorkflowRepository {
  getCaseById(id: string): Promise<CommissionCase | null>;
  updateCase(record: CommissionCase): Promise<CommissionCase>;
  getEvents(): Promise<CommissionEvent[]>;
  getEventsByCaseId(caseId: string): Promise<CommissionEvent[]>;
  getAssignmentVersions(): Promise<CommissionAssignmentVersion[]>;
  getAssignmentVersionsByAssignmentId(assignmentId: string): Promise<CommissionAssignmentVersion[]>;
  createAssignmentVersion(version: CommissionAssignmentVersion): Promise<CommissionAssignmentVersion>;
  getBonusPayments(): Promise<CommissionBonusPayment[]>;
  getBonusPaymentsByRepresentativeId(repId: string): Promise<CommissionBonusPayment[]>;
  createBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment>;
  updateBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment>;
  getPaymentHistory(): Promise<CommissionPaymentRecord[]>;
  getPaymentHistoryByCaseId(caseId: string): Promise<CommissionPaymentRecord[]>;
  createPaymentRecord(record: CommissionPaymentRecord): Promise<CommissionPaymentRecord>;
}
