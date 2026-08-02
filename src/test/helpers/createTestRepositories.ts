import { LocalActivationApplicationRepository } from '../../repositories/local/LocalActivationApplicationRepository';
import { LocalActivationBlockerRepository } from '../../repositories/local/LocalActivationBlockerRepository';
import { LocalActivationCaseRepository } from '../../repositories/local/LocalActivationCaseRepository';
import { LocalActivationChecklistRepository } from '../../repositories/local/LocalActivationChecklistRepository';
import { LocalActivationHardwareRepository } from '../../repositories/local/LocalActivationHardwareRepository';
import { LocalApprovalRuleRepository } from '../../repositories/local/LocalApprovalRuleRepository';
import { LocalAuditRepository } from '../../repositories/local/LocalAuditRepository';
import { LocalCommissionCalculationRepository } from '../../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionWorkflowRepository } from '../../repositories/local/LocalCommissionWorkflowRepository';
import { LocalCommissionCatalogRepository } from '../../repositories/local/LocalCommissionCatalogRepository';
import { LocalContractRepository } from '../../repositories/local/LocalContractRepository';
import { LocalContractTerminationRepository } from '../../repositories/local/LocalContractTerminationRepository';
import { LocalContractVersionRepository } from '../../repositories/local/LocalContractVersionRepository';
import { LocalDocumentTemplateRepository } from '../../repositories/local/LocalDocumentTemplateRepository';
import { LocalLeadDraftRepository } from '../../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../../repositories/local/LocalLeadEditDraftRepository';
import { LocalLeadRepository } from '../../repositories/local/LocalLeadRepository';
import { LocalOfferDocumentRepository } from '../../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../../repositories/local/LocalOfferRepository';
import { LocalBestPayHandoffRepository } from '../../repositories/local/LocalBestPayHandoffRepository';
import { LocalOfferCustomerAcceptanceRepository } from '../../repositories/local/LocalOfferCustomerAcceptanceRepository';
import { LocalOfferChangeRequestRepository } from '../../repositories/local/LocalOfferChangeRequestRepository';
import { LocalOfferCustomerQuestionRepository } from '../../repositories/local/LocalOfferCustomerQuestionRepository';
import { LocalOfferShareRepository } from '../../repositories/local/LocalOfferShareRepository';
import { LocalOfferVersionRepository } from '../../repositories/local/LocalOfferVersionRepository';
import { LocalOfferWorkflowEventRepository } from '../../repositories/local/LocalOfferWorkflowEventRepository';
import { LocalPricingCatalogRepository } from '../../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../../repositories/local/LocalPricingEvaluationRepository';
import { LocalProductRepository } from '../../repositories/local/LocalProductRepository';
import { LocalRecommendationRepository } from '../../repositories/local/LocalRecommendationRepository';
import { LocalContactRepository } from '../../repositories/local/LocalContactRepository';
import { LocalSalesActivityRepository } from '../../repositories/local/LocalSalesActivityRepository';
import { LocalSalesDocumentRepository } from '../../repositories/local/LocalSalesDocumentRepository';
import { LocalSalesTaskRepository } from '../../repositories/local/LocalSalesTaskRepository';
import { LocalTariffRepository } from '../../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../../repositories/local/LocalUserRepository';
import type { BestPayComparisonRepository } from '../../repositories/interfaces/BestPayComparisonRepository';
import type { BillingImportRepository } from '../../repositories/interfaces/BillingImportRepository';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  getActiveBestPayComparisonSessionId,
  readBestPayComparisonSessions,
  removeBestPayComparisonSession,
  saveBestPayComparisonSession,
  setActiveBestPayComparisonSessionId,
} from '../../services/bestPayComparisonStorageMigration';
import {
  readBillingImportStore,
  writeBillingImportStore,
} from '../../repositories/local/billingImportStore';
import { migrateBillingImportStorageIfNeeded } from '../../services/billingImportStorageMigration';
import type { BillingImportStoreData } from '../../repositories/interfaces/BillingImportRepository';
import { SalesActivityService } from '../../services/salesActivityService';
import { SalesTaskService } from '../../services/salesTaskService';
import { SalesWorkspaceService } from '../../services/salesWorkspaceService';

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
  async readStore(): Promise<BillingImportStoreData> {
    migrateBillingImportStorageIfNeeded();
    return readBillingImportStore();
  }

  async writeStore(store: BillingImportStoreData): Promise<void> {
    migrateBillingImportStorageIfNeeded();
    writeBillingImportStore(store);
  }
}

import type { AppRepositories } from '../../services';

/** Tests nutzen immer LocalStorage-Repositories – unabhängig vom Vite-Datenmodus. */
export function createTestRepositories(): AppRepositories {
  return {
    userRepository: new LocalUserRepository(),
    leadRepository: new LocalLeadRepository(),
    tariffRepository: new LocalTariffRepository(),
    productRepository: new LocalProductRepository(),
    auditRepository: new LocalAuditRepository(),
    approvalRuleRepository: new LocalApprovalRuleRepository(),
    documentTemplateRepository: new LocalDocumentTemplateRepository(),
    offerRepository: new LocalOfferRepository(),
    offerVersionRepository: new LocalOfferVersionRepository(),
    offerShareRepository: new LocalOfferShareRepository(),
    offerCustomerQuestionRepository: new LocalOfferCustomerQuestionRepository(),
    offerChangeRequestRepository: new LocalOfferChangeRequestRepository(),
    offerCustomerAcceptanceRepository: new LocalOfferCustomerAcceptanceRepository(),
    bestPayHandoffRepository: new LocalBestPayHandoffRepository(),
    offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
    salesDocumentRepository: new LocalSalesDocumentRepository(),
    offerDocumentRepository: new LocalOfferDocumentRepository(),
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
    bestPayComparisonRepository: new LocalBestPayComparisonRepository(),
    billingImportRepository: new LocalBillingImportRepository(),
    leadDraftRepository: new LocalLeadDraftRepository(),
    leadEditDraftRepository: new LocalLeadEditDraftRepository(),
  };
}

/** Erzeugt SalesWorkspaceService mit allen Test-Repositories. */
export function createTestWorkspace(repos: AppRepositories = createTestRepositories()) {
  const taskService = new SalesTaskService(repos.salesTaskRepository);
  const activityService = new SalesActivityService(repos.salesActivityRepository);
  taskService.setActivityService(activityService);
  return new SalesWorkspaceService(
    repos.leadRepository,
    repos.offerRepository,
    repos.salesTaskRepository,
    repos.salesActivityRepository,
    taskService,
    activityService,
    repos.bestPayComparisonRepository,
    repos.commissionCalculationRepository,
    repos.pricingEvaluationRepository,
    repos.contractRepository,
    repos.activationCaseRepository,
    repos.activationBlockerRepository,
    repos.offerCustomerQuestionRepository,
    repos.offerChangeRequestRepository,
  );
}
