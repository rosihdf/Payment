import { isSupabaseDataMode, requireSupabaseEnv } from '../../config/dataMode';
import type { ActivationApplicationRepository } from '../interfaces/ActivationApplicationRepository';
import type { ActivationBlockerRepository } from '../interfaces/ActivationBlockerRepository';
import type { ActivationCaseRepository } from '../interfaces/ActivationCaseRepository';
import type { ActivationChecklistRepository } from '../interfaces/ActivationChecklistRepository';
import type { ActivationHardwareRepository } from '../interfaces/ActivationHardwareRepository';
import type { ApprovalRuleRepository } from '../interfaces/ApprovalRuleRepository';
import type { AuditRepository } from '../interfaces/AuditRepository';
import type { BestPayComparisonRepository } from '../interfaces/BestPayComparisonRepository';
import type { BillingImportRepository, BillingImportStoreData } from '../interfaces/BillingImportRepository';
import type { CommissionCalculationRepository } from '../interfaces/CommissionCalculationRepository';
import type { CommissionWorkflowRepository } from '../interfaces/CommissionWorkflowRepository';
import { LocalCommissionWorkflowRepository } from '../local/LocalCommissionWorkflowRepository';
import type { ContractRepository } from '../interfaces/ContractRepository';
import type { ContractTerminationRepository } from '../interfaces/ContractTerminationRepository';
import type { ContractVersionRepository } from '../interfaces/ContractVersionRepository';
import type { DocumentTemplateRepository } from '../interfaces/DocumentTemplateRepository';
import type { OfferDocumentRepository } from '../interfaces/OfferDocumentRepository';
import type { OfferRepository } from '../interfaces/OfferRepository';
import type { OfferVersionRepository } from '../interfaces/OfferVersionRepository';
import type { OfferWorkflowEventRepository } from '../interfaces/OfferWorkflowEventRepository';
import type { PricingCatalogRepository } from '../interfaces/PricingCatalogRepository';
import type { PricingEvaluationRepository } from '../interfaces/PricingEvaluationRepository';
import type { RecommendationRepository } from '../interfaces/RecommendationRepository';
import type { ContactRepository } from '../interfaces/ContactRepository';
import type { SalesActivityRepository } from '../interfaces/SalesActivityRepository';
import type { SalesDocumentRepository } from '../interfaces/SalesDocumentRepository';
import type { SalesTaskRepository } from '../interfaces/SalesTaskRepository';
import { LocalContactRepository } from '../local/LocalContactRepository';
import { LocalActivationApplicationRepository } from '../local/LocalActivationApplicationRepository';
import { LocalActivationBlockerRepository } from '../local/LocalActivationBlockerRepository';
import { LocalActivationCaseRepository } from '../local/LocalActivationCaseRepository';
import { LocalActivationChecklistRepository } from '../local/LocalActivationChecklistRepository';
import { LocalActivationHardwareRepository } from '../local/LocalActivationHardwareRepository';
import { LocalApprovalRuleRepository } from '../local/LocalApprovalRuleRepository';
import { LocalAuditRepository } from '../local/LocalAuditRepository';
import { LocalCommissionCalculationRepository } from '../local/LocalCommissionCalculationRepository';
import {
  LocalCommissionCatalogRepository,
  type CommissionCatalogRepository,
} from '../local/LocalCommissionCatalogRepository';
import { LocalContractRepository } from '../local/LocalContractRepository';
import { LocalContractTerminationRepository } from '../local/LocalContractTerminationRepository';
import { LocalContractVersionRepository } from '../local/LocalContractVersionRepository';
import { LocalDocumentTemplateRepository } from '../local/LocalDocumentTemplateRepository';
import { LocalOfferDocumentRepository } from '../local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../local/LocalOfferRepository';
import { LocalOfferVersionRepository } from '../local/LocalOfferVersionRepository';
import { LocalOfferWorkflowEventRepository } from '../local/LocalOfferWorkflowEventRepository';
import { LocalPricingCatalogRepository } from '../local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../local/LocalPricingEvaluationRepository';
import { LocalRecommendationRepository } from '../local/LocalRecommendationRepository';
import { LocalSalesActivityRepository } from '../local/LocalSalesActivityRepository';
import { LocalSalesDocumentRepository } from '../local/LocalSalesDocumentRepository';
import { LocalSalesTaskRepository } from '../local/LocalSalesTaskRepository';
import {
  readBillingImportStore,
  writeBillingImportStore,
} from '../local/billingImportStore';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  getActiveBestPayComparisonSessionId,
  readBestPayComparisonSessions,
  removeBestPayComparisonSession,
  saveBestPayComparisonSession,
  setActiveBestPayComparisonSessionId,
} from '../../services/bestPayComparisonStorageMigration';
import { migrateBillingImportStorageIfNeeded } from '../../services/billingImportStorageMigration';
import { SupabaseActivationApplicationRepository } from './SupabaseActivationApplicationRepository';
import { SupabaseActivationBlockerRepository } from './SupabaseActivationBlockerRepository';
import { SupabaseActivationCaseRepository } from './SupabaseActivationCaseRepository';
import { SupabaseActivationChecklistRepository } from './SupabaseActivationChecklistRepository';
import { SupabaseActivationHardwareRepository } from './SupabaseActivationHardwareRepository';
import { SupabaseApprovalRuleRepository } from './SupabaseApprovalRuleRepository';
import { SupabaseAuditRepository } from './SupabaseAuditRepository';
import { SupabaseBestPayComparisonRepository } from './SupabaseBestPayComparisonRepository';
import { SupabaseBillingImportRepository } from './SupabaseBillingImportRepository';
import { SupabaseCommissionCalculationRepository } from './SupabaseCommissionCalculationRepository';
import { SupabaseCommissionWorkflowRepository } from './SupabaseCommissionWorkflowRepository';
import { SupabaseCommissionCatalogRepository } from './SupabaseCommissionCatalogRepository';
import { SupabaseContractRepository } from './SupabaseContractRepository';
import { SupabaseContractTerminationRepository } from './SupabaseContractTerminationRepository';
import { SupabaseContractVersionRepository } from './SupabaseContractVersionRepository';
import { SupabaseDocumentTemplateRepository } from './SupabaseDocumentTemplateRepository';
import { SupabaseOfferDocumentRepository } from './SupabaseOfferDocumentRepository';
import { SupabaseOfferRepository } from './SupabaseOfferRepository';
import { SupabaseOfferVersionRepository } from './SupabaseOfferVersionRepository';
import { SupabaseOfferWorkflowEventRepository } from './SupabaseOfferWorkflowEventRepository';
import { SupabasePricingCatalogRepository } from './SupabasePricingCatalogRepository';
import { SupabasePricingEvaluationRepository } from './SupabasePricingEvaluationRepository';
import { SupabaseRecommendationRepository } from './SupabaseRecommendationRepository';
import { SupabaseContactRepository } from './SupabaseContactRepository';
import { SupabaseSalesActivityRepository } from './SupabaseSalesActivityRepository';
import { SupabaseSalesDocumentRepository } from './SupabaseSalesDocumentRepository';
import { SupabaseSalesTaskRepository } from './SupabaseSalesTaskRepository';

class LocalBestPayComparisonRepository implements BestPayComparisonRepository {
  async getAll(): Promise<BestPayComparisonSession[]> {
    return readBestPayComparisonSessions();
  }

  async getById(id: string): Promise<BestPayComparisonSession | null> {
    return readBestPayComparisonSessions().find((session) => session.id === id) ?? null;
  }

  async save(session: BestPayComparisonSession): Promise<BestPayComparisonSession> {
    saveBestPayComparisonSession(session);
    return session;
  }

  async delete(id: string): Promise<void> {
    removeBestPayComparisonSession(id);
  }

  async getActiveSessionId(_userId: string): Promise<string | null> {
    return getActiveBestPayComparisonSessionId();
  }

  async setActiveSessionId(_userId: string, sessionId: string | null): Promise<void> {
    setActiveBestPayComparisonSessionId(sessionId);
  }
}

class LocalBillingImportRepository implements BillingImportRepository {
  async readStore() {
    migrateBillingImportStorageIfNeeded();
    return readBillingImportStore();
  }

  async writeStore(store: BillingImportStoreData) {
    migrateBillingImportStorageIfNeeded();
    writeBillingImportStore(store);
  }
}

export interface OperationalRepositories {
  offerRepository: OfferRepository;
  offerVersionRepository: OfferVersionRepository;
  offerWorkflowEventRepository: OfferWorkflowEventRepository;
  offerDocumentRepository: OfferDocumentRepository;
  salesDocumentRepository: SalesDocumentRepository;
  pricingCatalogRepository: PricingCatalogRepository;
  pricingEvaluationRepository: PricingEvaluationRepository;
  commissionCatalogRepository: CommissionCatalogRepository;
  commissionCalculationRepository: CommissionCalculationRepository;
  commissionWorkflowRepository: CommissionWorkflowRepository;
  recommendationRepository: RecommendationRepository;
  contractRepository: ContractRepository;
  contractVersionRepository: ContractVersionRepository;
  contractTerminationRepository: ContractTerminationRepository;
  activationCaseRepository: ActivationCaseRepository;
  activationChecklistRepository: ActivationChecklistRepository;
  activationApplicationRepository: ActivationApplicationRepository;
  activationHardwareRepository: ActivationHardwareRepository;
  activationBlockerRepository: ActivationBlockerRepository;
  salesTaskRepository: SalesTaskRepository;
  salesActivityRepository: SalesActivityRepository;
  contactRepository: ContactRepository;
  auditRepository: AuditRepository;
  approvalRuleRepository: ApprovalRuleRepository;
  documentTemplateRepository: DocumentTemplateRepository;
  bestPayComparisonRepository: BestPayComparisonRepository;
  billingImportRepository: BillingImportRepository;
}

export function createOperationalRepositories(): OperationalRepositories {
  if (isSupabaseDataMode()) {
    requireSupabaseEnv();
    return {
      offerRepository: new SupabaseOfferRepository(),
      offerVersionRepository: new SupabaseOfferVersionRepository(),
      offerWorkflowEventRepository: new SupabaseOfferWorkflowEventRepository(),
      offerDocumentRepository: new SupabaseOfferDocumentRepository(),
      salesDocumentRepository: new SupabaseSalesDocumentRepository(),
      pricingCatalogRepository: new SupabasePricingCatalogRepository(),
      pricingEvaluationRepository: new SupabasePricingEvaluationRepository(),
      commissionCatalogRepository: new SupabaseCommissionCatalogRepository(),
      commissionCalculationRepository: new SupabaseCommissionCalculationRepository(),
      commissionWorkflowRepository: new SupabaseCommissionWorkflowRepository(),
      recommendationRepository: new SupabaseRecommendationRepository(),
      contractRepository: new SupabaseContractRepository(),
      contractVersionRepository: new SupabaseContractVersionRepository(),
      contractTerminationRepository: new SupabaseContractTerminationRepository(),
      activationCaseRepository: new SupabaseActivationCaseRepository(),
      activationChecklistRepository: new SupabaseActivationChecklistRepository(),
      activationApplicationRepository: new SupabaseActivationApplicationRepository(),
      activationHardwareRepository: new SupabaseActivationHardwareRepository(),
      activationBlockerRepository: new SupabaseActivationBlockerRepository(),
      salesTaskRepository: new SupabaseSalesTaskRepository(),
      salesActivityRepository: new SupabaseSalesActivityRepository(),
      contactRepository: new SupabaseContactRepository(),
      auditRepository: new SupabaseAuditRepository(),
      approvalRuleRepository: new SupabaseApprovalRuleRepository(),
      documentTemplateRepository: new SupabaseDocumentTemplateRepository(),
      bestPayComparisonRepository: new SupabaseBestPayComparisonRepository(),
      billingImportRepository: new SupabaseBillingImportRepository(),
    };
  }

  return {
    offerRepository: new LocalOfferRepository(),
    offerVersionRepository: new LocalOfferVersionRepository(),
    offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
    offerDocumentRepository: new LocalOfferDocumentRepository(),
    salesDocumentRepository: new LocalSalesDocumentRepository(),
    pricingCatalogRepository: new LocalPricingCatalogRepository(),
    pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
    commissionCatalogRepository: new LocalCommissionCatalogRepository(),
    commissionCalculationRepository: new LocalCommissionCalculationRepository(),
    commissionWorkflowRepository: new LocalCommissionWorkflowRepository(),
    recommendationRepository: new LocalRecommendationRepository(),
    contractRepository: new LocalContractRepository(),
    contractVersionRepository: new LocalContractVersionRepository(),
    contractTerminationRepository: new LocalContractTerminationRepository(),
    activationCaseRepository: new LocalActivationCaseRepository(),
    activationChecklistRepository: new LocalActivationChecklistRepository(),
    activationApplicationRepository: new LocalActivationApplicationRepository(),
    activationHardwareRepository: new LocalActivationHardwareRepository(),
    activationBlockerRepository: new LocalActivationBlockerRepository(),
    salesTaskRepository: new LocalSalesTaskRepository(),
    salesActivityRepository: new LocalSalesActivityRepository(),
    contactRepository: new LocalContactRepository(),
    auditRepository: new LocalAuditRepository(),
    approvalRuleRepository: new LocalApprovalRuleRepository(),
    documentTemplateRepository: new LocalDocumentTemplateRepository(),
    bestPayComparisonRepository: new LocalBestPayComparisonRepository(),
    billingImportRepository: new LocalBillingImportRepository(),
  };
}
