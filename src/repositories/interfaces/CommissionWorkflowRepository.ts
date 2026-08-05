import type { CommissionAssignmentVersion } from '../../domain/commission/commissionAssignmentVersion';
import type { CommissionBonusPayment } from '../../domain/commission/commissionBonusPayment';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import type { CommissionPaymentRecord } from '../../domain/commission/commissionPaymentRecord';
import type {
  SaveCommissionAssignmentVersionInput,
  SaveCommissionAssignmentVersionResult,
} from '../../domain/commission/saveCommissionAssignmentVersion';

export interface CommissionWorkflowRepository {
  getCaseById(id: string): Promise<CommissionCase | null>;
  updateCase(record: CommissionCase): Promise<CommissionCase>;
  getEvents(): Promise<CommissionEvent[]>;
  getEventsByCaseId(caseId: string): Promise<CommissionEvent[]>;
  getAssignmentVersions(): Promise<CommissionAssignmentVersion[]>;
  getAssignmentVersionById(id: string): Promise<CommissionAssignmentVersion | null>;
  getAssignmentVersionsByIds(ids: string[]): Promise<CommissionAssignmentVersion[]>;
  getAssignmentVersionsByAssignmentId(assignmentId: string): Promise<CommissionAssignmentVersion[]>;
  countAssignmentVersions(assignmentId: string): Promise<number>;
  createAssignmentVersion(version: CommissionAssignmentVersion): Promise<CommissionAssignmentVersion>;
  /**
   * Atomarer Remote-Save (ein RPC). Local-Repos geben `null` zurück;
   * der Service nutzt dann den lokalen Mehrfach-Write-Pfad.
   */
  saveAssignmentVersionAtomic(
    input: SaveCommissionAssignmentVersionInput,
  ): Promise<SaveCommissionAssignmentVersionResult | null>;
  getBonusPayments(): Promise<CommissionBonusPayment[]>;
  getBonusPaymentsByRepresentativeId(repId: string): Promise<CommissionBonusPayment[]>;
  createBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment>;
  updateBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment>;
  getPaymentHistory(): Promise<CommissionPaymentRecord[]>;
  getPaymentHistoryByCaseId(caseId: string): Promise<CommissionPaymentRecord[]>;
  createPaymentRecord(record: CommissionPaymentRecord): Promise<CommissionPaymentRecord>;
}
