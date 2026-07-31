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
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { AdminOverviewService } from './adminOverviewService';
import { AdminUserService } from './adminUserService';
import { ApprovalRuleService } from './approvalRuleService';
import { AuditService } from './auditService';
import { CommissionCalculationService } from './commissionCalculationService';
import { CommissionCatalogAdminService } from './commissionCatalogAdminService';
import { DataDiagnosticService } from './dataDiagnosticService';
import { DataExportService, DataRestoreService } from './dataExportService';
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
  dataDiagnosticService: DataDiagnosticService;
  systemStatusService: SystemStatusService;
  adminOverviewService: AdminOverviewService;
  commissionCatalogAdminService: CommissionCatalogAdminService;
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
  commissionCatalogRepository: LocalCommissionCatalogRepository;
  commissionCalculationRepository: LocalCommissionCalculationRepository;
  recommendationRepository: LocalRecommendationRepository;
  salesTaskRepository: SalesTaskRepository;
  salesActivityRepository: SalesActivityRepository;
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
  const billingImportService = new BillingImportService(repositories.offerRepository);
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
  );
  const salesWorkspaceService = new SalesWorkspaceService(
    repositories.leadRepository,
    repositories.offerRepository,
    repositories.salesTaskRepository,
    repositories.salesActivityRepository,
    salesTaskService,
    salesActivityService,
  );

  return {
    userService: new UserService(repositories.userRepository),
    adminUserService,
    auditService,
    approvalRuleService,
    documentTemplateService,
    dataExportService,
    dataRestoreService,
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
    ),
    billingImportService,
    recommendationService,
    bestPayComparisonService,
    salesWizardService,
    salesTaskService,
    salesActivityService,
    salesWorkspaceService,
  };
}
