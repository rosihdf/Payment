import type { LeadDraftRepository } from '../repositories/interfaces/LeadDraftRepository';
import type { LeadEditDraftRepository } from '../repositories/interfaces/LeadEditDraftRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferDocumentRepository } from '../repositories/interfaces/OfferDocumentRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import type { OfferWorkflowEventRepository } from '../repositories/interfaces/OfferWorkflowEventRepository';
import type { SalesDocumentRepository } from '../repositories/interfaces/SalesDocumentRepository';
import type { PricingCatalogRepository } from '../repositories/interfaces/PricingCatalogRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { SalesActivityRepository } from '../repositories/interfaces/SalesActivityRepository';
import type { SalesTaskRepository } from '../repositories/interfaces/SalesTaskRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import type { UserRepository } from '../repositories/interfaces/UserRepository';
import type { AuditRepository } from '../repositories/interfaces/AuditRepository';
import type { ApprovalRuleRepository } from '../repositories/interfaces/ApprovalRuleRepository';
import type { DocumentTemplateRepository } from '../repositories/interfaces/DocumentTemplateRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { ContractVersionRepository } from '../repositories/interfaces/ContractVersionRepository';
import type { ContractTerminationRepository } from '../repositories/interfaces/ContractTerminationRepository';
import type { ActivationCaseRepository } from '../repositories/interfaces/ActivationCaseRepository';
import type { ActivationChecklistRepository } from '../repositories/interfaces/ActivationChecklistRepository';
import type { ActivationApplicationRepository } from '../repositories/interfaces/ActivationApplicationRepository';
import type { ActivationHardwareRepository } from '../repositories/interfaces/ActivationHardwareRepository';
import type { ActivationBlockerRepository } from '../repositories/interfaces/ActivationBlockerRepository';
import type { BestPayComparisonRepository } from '../repositories/interfaces/BestPayComparisonRepository';
import type { BillingImportRepository } from '../repositories/interfaces/BillingImportRepository';
import type { CommissionCalculationRepository } from '../repositories/interfaces/CommissionCalculationRepository';
import type { CommissionWorkflowRepository } from '../repositories/interfaces/CommissionWorkflowRepository';
import type { CommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import type { RecommendationRepository } from '../repositories/interfaces/RecommendationRepository';
import { AdminOverviewService } from './adminOverviewService';
import { AdminUserService } from './adminUserService';
import { ApprovalRuleService } from './approvalRuleService';
import { ActivationService } from './activationService';
import { AuditService } from './auditService';
import { CommissionCalculationService } from './commissionCalculationService';
import { CommissionAdminService } from './commissionAdminService';
import { CommissionCatalogAdminService } from './commissionCatalogAdminService';
import { ContractService } from './contractService';
import { DataDiagnosticService } from './dataDiagnosticService';
import { DataExportService, DataRestoreService } from './dataExportService';
import { SupabaseDataMigrationService } from './supabaseDataMigrationService';
import { ProductionCatalogBootstrapService } from './productionCatalogBootstrapService';
import { DocumentTemplateService } from './documentTemplateService';
import { RecommendationService } from './recommendationService';
import { BillingImportService } from './billingImportService';
import { BestPayComparisonService } from './bestPayComparisonService';
import { LeadDraftService } from './leadDraftService';
import { LeadEditDraftService } from './leadEditDraftService';
import { LeadService } from './leadService';
import { createOfferDocumentService } from './offerDocumentService';
import { OfferService } from './offerService';
import { OfferWorkflowService } from './offerWorkflowService';
import { PricingEvaluationService } from './pricingEvaluationService';
import { ProductService } from './productService';
import { SalesActivityService } from './salesActivityService';
import { SalesTaskService } from './salesTaskService';
import { SalesWizardService } from './salesWizardService';
import { SalesWorkspaceService } from './salesWorkspaceService';
import { SystemStatusService } from './systemStatusService';
import { TariffService } from './tariffService';
import { UserService } from './userService';

export interface AppServices {
  userService: UserService;
  adminUserService: AdminUserService;
  auditService: AuditService;
  approvalRuleService: ApprovalRuleService;
  documentTemplateService: DocumentTemplateService;
  dataExportService: DataExportService;
  dataRestoreService: DataRestoreService;
  supabaseDataMigrationService: SupabaseDataMigrationService;
  productionCatalogBootstrapService: ProductionCatalogBootstrapService;
  dataDiagnosticService: DataDiagnosticService;
  systemStatusService: SystemStatusService;
  adminOverviewService: AdminOverviewService;
  commissionCatalogAdminService: CommissionCatalogAdminService;
  commissionAdminService: CommissionAdminService;
  leadService: LeadService;
  leadDraftService: LeadDraftService;
  leadEditDraftService: LeadEditDraftService;
  tariffService: TariffService;
  productService: ProductService;
  offerService: OfferService;
  offerWorkflowService: OfferWorkflowService;
  offerDocumentService: ReturnType<typeof createOfferDocumentService>;
  pricingEvaluationService: PricingEvaluationService;
  commissionCalculationService: CommissionCalculationService;
  recommendationService: RecommendationService;
  billingImportService: BillingImportService;
  bestPayComparisonService: BestPayComparisonService;
  salesWizardService: SalesWizardService;
  salesTaskService: SalesTaskService;
  salesActivityService: SalesActivityService;
  salesWorkspaceService: SalesWorkspaceService;
  contractService: ContractService;
  activationService: ActivationService;
}

export interface AppRepositories {
  userRepository: UserRepository;
  auditRepository: AuditRepository;
  approvalRuleRepository: ApprovalRuleRepository;
  documentTemplateRepository: DocumentTemplateRepository;
  leadRepository: LeadRepository;
  leadDraftRepository: LeadDraftRepository;
  leadEditDraftRepository: LeadEditDraftRepository;
  tariffRepository: TariffRepository;
  productRepository: ProductRepository;
  offerRepository: OfferRepository;
  offerVersionRepository: OfferVersionRepository;
  offerWorkflowEventRepository: OfferWorkflowEventRepository;
  salesDocumentRepository: SalesDocumentRepository;
  offerDocumentRepository: OfferDocumentRepository;
  pricingCatalogRepository: PricingCatalogRepository;
  pricingEvaluationRepository: PricingEvaluationRepository;
  commissionCatalogRepository: CommissionCatalogRepository;
  commissionCalculationRepository: CommissionCalculationRepository;
  commissionWorkflowRepository: CommissionWorkflowRepository;
  recommendationRepository: RecommendationRepository;
  billingImportRepository: BillingImportRepository;
  bestPayComparisonRepository: BestPayComparisonRepository;
  salesTaskRepository: SalesTaskRepository;
  salesActivityRepository: SalesActivityRepository;
  contractRepository: ContractRepository;
  contractVersionRepository: ContractVersionRepository;
  contractTerminationRepository: ContractTerminationRepository;
  activationCaseRepository: ActivationCaseRepository;
  activationChecklistRepository: ActivationChecklistRepository;
  activationApplicationRepository: ActivationApplicationRepository;
  activationHardwareRepository: ActivationHardwareRepository;
  activationBlockerRepository: ActivationBlockerRepository;
}

export function createServices(repositories: AppRepositories): AppServices {
  const auditService = new AuditService(repositories.auditRepository);
  const adminUserService = new AdminUserService(repositories.userRepository, auditService);
  const approvalRuleService = new ApprovalRuleService(repositories.approvalRuleRepository, auditService);
  const documentTemplateService = new DocumentTemplateService(
    repositories.documentTemplateRepository,
    auditService,
  );
  const dataExportService = new DataExportService(auditService);
  const dataRestoreService = new DataRestoreService(auditService);
  const supabaseDataMigrationService = new SupabaseDataMigrationService(auditService);
  const productionCatalogBootstrapService = new ProductionCatalogBootstrapService(
    repositories.tariffRepository,
    repositories.productRepository,
    repositories.commissionCatalogRepository,
    repositories.pricingCatalogRepository,
    repositories.recommendationRepository,
    repositories.approvalRuleRepository,
    repositories.documentTemplateRepository,
    auditService,
  );
  const dataDiagnosticService = new DataDiagnosticService(auditService);
  const systemStatusService = new SystemStatusService(dataExportService, dataDiagnosticService);
  const commissionCatalogAdminService = new CommissionCatalogAdminService(
    repositories.commissionCatalogRepository,
    auditService,
  );
  const adminOverviewService = new AdminOverviewService(
    adminUserService,
    repositories.tariffRepository,
    repositories.productRepository,
    repositories.commissionCatalogRepository,
    approvalRuleService,
    dataDiagnosticService,
    dataExportService,
  );

  const offerService = new OfferService(
    repositories.offerRepository,
    repositories.leadRepository,
    repositories.tariffRepository,
    repositories.productRepository,
  );
  const billingImportService = new BillingImportService(
    repositories.offerRepository,
    repositories.billingImportRepository,
  );
  const recommendationService = new RecommendationService(
    repositories.recommendationRepository,
    repositories.offerRepository,
    repositories.leadRepository,
    repositories.tariffRepository,
    repositories.productRepository,
    repositories.pricingCatalogRepository,
    repositories.commissionCatalogRepository,
    billingImportService,
  );
  const bestPayComparisonService = new BestPayComparisonService(
    billingImportService,
    recommendationService,
    offerService,
    repositories.leadRepository,
    repositories.offerRepository,
    repositories.bestPayComparisonRepository,
  );
  const leadService = new LeadService(repositories.leadRepository);
  const salesTaskService = new SalesTaskService(repositories.salesTaskRepository);
  const salesActivityService = new SalesActivityService(repositories.salesActivityRepository);
  salesTaskService.setActivityService(salesActivityService);
  const offerWorkflowService = new OfferWorkflowService(
    repositories.offerRepository,
    repositories.offerVersionRepository,
    repositories.offerWorkflowEventRepository,
    repositories.salesDocumentRepository,
    repositories.pricingEvaluationRepository,
    repositories.commissionCalculationRepository,
  );
  offerWorkflowService.setSalesTaskService(salesTaskService);
  offerWorkflowService.setSalesActivityService(salesActivityService);
  offerService.setWorkflowService(offerWorkflowService);
  const salesWizardService = new SalesWizardService(
    bestPayComparisonService,
    recommendationService,
    leadService,
    offerWorkflowService,
    offerService,
    repositories.bestPayComparisonRepository,
  );
  const salesWorkspaceService = new SalesWorkspaceService(
    repositories.leadRepository,
    repositories.offerRepository,
    repositories.salesTaskRepository,
    repositories.salesActivityRepository,
    salesTaskService,
    salesActivityService,
    repositories.bestPayComparisonRepository,
    repositories.commissionCalculationRepository,
    repositories.pricingEvaluationRepository,
    repositories.contractRepository,
    repositories.activationCaseRepository,
    repositories.activationBlockerRepository,
  );
  const contractService = new ContractService(
    repositories.contractRepository,
    repositories.contractVersionRepository,
    repositories.contractTerminationRepository,
    repositories.offerRepository,
    repositories.offerVersionRepository,
    repositories.salesDocumentRepository,
    repositories.salesTaskRepository,
    repositories.commissionCalculationRepository,
    auditService,
  );
  contractService.setSalesTaskService(salesTaskService);
  contractService.setSalesActivityService(salesActivityService);
  offerWorkflowService.setContractService(contractService);

  const activationService = new ActivationService(
    repositories.activationCaseRepository,
    repositories.activationChecklistRepository,
    repositories.activationApplicationRepository,
    repositories.activationHardwareRepository,
    repositories.activationBlockerRepository,
    repositories.contractRepository,
    repositories.contractVersionRepository,
    repositories.offerRepository,
    repositories.salesTaskRepository,
    repositories.salesDocumentRepository,
    auditService,
  );
  activationService.setSalesTaskService(salesTaskService);
  activationService.setSalesActivityService(salesActivityService);
  activationService.setContractService(contractService);

  return {
    userService: new UserService(repositories.userRepository),
    adminUserService,
    auditService,
    approvalRuleService,
    documentTemplateService,
    dataExportService,
    dataRestoreService,
    supabaseDataMigrationService,
    productionCatalogBootstrapService,
    dataDiagnosticService,
    systemStatusService,
    adminOverviewService,
    commissionCatalogAdminService,
    leadService,
    leadDraftService: new LeadDraftService(repositories.leadDraftRepository),
    leadEditDraftService: new LeadEditDraftService(repositories.leadEditDraftRepository),
    tariffService: new TariffService(repositories.tariffRepository),
    productService: new ProductService(repositories.productRepository),
    offerService,
    offerWorkflowService,
    offerDocumentService: createOfferDocumentService(
      repositories.offerDocumentRepository,
      repositories.offerRepository,
      offerService,
    ),
    pricingEvaluationService: new PricingEvaluationService(
      repositories.pricingCatalogRepository,
      repositories.pricingEvaluationRepository,
      repositories.offerRepository,
    ),
    commissionCalculationService: new CommissionCalculationService(
      repositories.commissionCatalogRepository,
      repositories.commissionCalculationRepository,
      repositories.offerRepository,
      repositories.pricingEvaluationRepository,
      repositories.commissionWorkflowRepository,
    ),
    commissionAdminService: new CommissionAdminService(
      repositories.commissionCatalogRepository,
      repositories.commissionCalculationRepository,
      repositories.commissionWorkflowRepository,
      repositories.userRepository,
      repositories.offerRepository,
      repositories.contractRepository,
      repositories.activationCaseRepository,
      repositories.activationBlockerRepository,
      auditService,
    ),
    billingImportService,
    recommendationService,
    bestPayComparisonService,
    salesWizardService,
    salesTaskService,
    salesActivityService,
    salesWorkspaceService,
    contractService,
    activationService,
  };
}
