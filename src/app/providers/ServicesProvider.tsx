import { type ReactNode, useMemo } from 'react';
import { LocalLeadDraftRepository } from '../../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../../repositories/local/LocalLeadEditDraftRepository';
import { LocalLeadRepository } from '../../repositories/local/LocalLeadRepository';
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
import { LocalProductRepository } from '../../repositories/local/LocalProductRepository';
import { LocalSalesActivityRepository } from '../../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../../repositories/local/LocalSalesTaskRepository';
import { LocalTariffRepository } from '../../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../../repositories/local/LocalUserRepository';
import { LocalAuditRepository } from '../../repositories/local/LocalAuditRepository';
import { LocalApprovalRuleRepository } from '../../repositories/local/LocalApprovalRuleRepository';
import { LocalDocumentTemplateRepository } from '../../repositories/local/LocalDocumentTemplateRepository';
import { createServices } from '../../services';
import { seedDemoData } from '../../services/demoDataService';
import { ServicesContext } from '../../hooks/useServices';

interface ServicesProviderProps {
  children: ReactNode;
}

export function ServicesProvider({ children }: ServicesProviderProps) {
  const services = useMemo(() => {
    seedDemoData();

    return createServices({
      userRepository: new LocalUserRepository(),
      auditRepository: new LocalAuditRepository(),
      approvalRuleRepository: new LocalApprovalRuleRepository(),
      documentTemplateRepository: new LocalDocumentTemplateRepository(),
      leadRepository: new LocalLeadRepository(),
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
      tariffRepository: new LocalTariffRepository(),
      productRepository: new LocalProductRepository(),
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
    });
  }, []);

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  );
}
