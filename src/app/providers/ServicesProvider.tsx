import { type ReactNode, useMemo } from 'react';
import { getDataMode } from '../../config/dataMode';
import { LocalLeadDraftRepository } from '../../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../../repositories/local/LocalLeadEditDraftRepository';
import { LocalOfferDocumentRepository } from '../../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../../repositories/local/LocalOfferRepository';
import { LocalOfferVersionRepository } from '../../repositories/local/LocalOfferVersionRepository';
import { LocalOfferWorkflowEventRepository } from '../../repositories/local/LocalOfferWorkflowEventRepository';
import { LocalSalesDocumentRepository } from '../../repositories/local/LocalSalesDocumentRepository';
import { LocalRecommendationRepository } from '../../repositories/local/LocalRecommendationRepository';
import { LocalCommissionCalculationRepository } from '../../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../../repositories/local/LocalCommissionCatalogRepository';
import { LocalPricingCatalogRepository } from '../../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../../repositories/local/LocalPricingEvaluationRepository';
import { LocalSalesActivityRepository } from '../../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../../repositories/local/LocalSalesTaskRepository';
import { LocalAuditRepository } from '../../repositories/local/LocalAuditRepository';
import { LocalApprovalRuleRepository } from '../../repositories/local/LocalApprovalRuleRepository';
import { LocalDocumentTemplateRepository } from '../../repositories/local/LocalDocumentTemplateRepository';
import { LocalContractRepository } from '../../repositories/local/LocalContractRepository';
import { LocalContractVersionRepository } from '../../repositories/local/LocalContractVersionRepository';
import { LocalContractTerminationRepository } from '../../repositories/local/LocalContractTerminationRepository';
import { LocalActivationCaseRepository } from '../../repositories/local/LocalActivationCaseRepository';
import { LocalActivationChecklistRepository } from '../../repositories/local/LocalActivationChecklistRepository';
import { LocalActivationApplicationRepository } from '../../repositories/local/LocalActivationApplicationRepository';
import { LocalActivationHardwareRepository } from '../../repositories/local/LocalActivationHardwareRepository';
import { LocalActivationBlockerRepository } from '../../repositories/local/LocalActivationBlockerRepository';
import { createServices } from '../../services';
import { seedDemoData } from '../../services/demoDataService';
import { ServicesContext } from '../../hooks/useServices';
import { createCoreRepositories } from './createCoreRepositories';

interface ServicesProviderProps {
  children: ReactNode;
}

export function ServicesProvider({ children }: ServicesProviderProps) {
  const services = useMemo(() => {
    const dataMode = getDataMode();
    if (dataMode === 'local') {
      seedDemoData();
    }

    const core = createCoreRepositories();

    return createServices({
      userRepository: core.userRepository,
      auditRepository: new LocalAuditRepository(),
      approvalRuleRepository: new LocalApprovalRuleRepository(),
      documentTemplateRepository: new LocalDocumentTemplateRepository(),
      leadRepository: core.leadRepository,
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
      tariffRepository: core.tariffRepository,
      productRepository: core.productRepository,
      offerRepository: new LocalOfferRepository(),
      offerVersionRepository: new LocalOfferVersionRepository(),
      offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
      salesDocumentRepository: new LocalSalesDocumentRepository(),
      offerDocumentRepository: new LocalOfferDocumentRepository(),
      pricingCatalogRepository: new LocalPricingCatalogRepository(),
      pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
      commissionCatalogRepository: new LocalCommissionCatalogRepository(),
      commissionCalculationRepository: new LocalCommissionCalculationRepository(),
      recommendationRepository: new LocalRecommendationRepository(),
      salesTaskRepository: new LocalSalesTaskRepository(),
      salesActivityRepository: new LocalSalesActivityRepository(),
      contractRepository: new LocalContractRepository(),
      contractVersionRepository: new LocalContractVersionRepository(),
      contractTerminationRepository: new LocalContractTerminationRepository(),
      activationCaseRepository: new LocalActivationCaseRepository(),
      activationChecklistRepository: new LocalActivationChecklistRepository(),
      activationApplicationRepository: new LocalActivationApplicationRepository(),
      activationHardwareRepository: new LocalActivationHardwareRepository(),
      activationBlockerRepository: new LocalActivationBlockerRepository(),
    });
  }, []);

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  );
}
