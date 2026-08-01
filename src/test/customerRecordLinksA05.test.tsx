import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalActivationApplicationRepository } from '../repositories/local/LocalActivationApplicationRepository';
import { LocalActivationBlockerRepository } from '../repositories/local/LocalActivationBlockerRepository';
import { LocalActivationCaseRepository } from '../repositories/local/LocalActivationCaseRepository';
import { LocalActivationChecklistRepository } from '../repositories/local/LocalActivationChecklistRepository';
import { LocalActivationHardwareRepository } from '../repositories/local/LocalActivationHardwareRepository';
import { LocalApprovalRuleRepository } from '../repositories/local/LocalApprovalRuleRepository';
import { LocalAuditRepository } from '../repositories/local/LocalAuditRepository';
import { LocalContractRepository } from '../repositories/local/LocalContractRepository';
import { LocalContractTerminationRepository } from '../repositories/local/LocalContractTerminationRepository';
import { LocalContractVersionRepository } from '../repositories/local/LocalContractVersionRepository';
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalDocumentTemplateRepository } from '../repositories/local/LocalDocumentTemplateRepository';
import { LocalLeadDraftRepository } from '../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../repositories/local/LocalLeadEditDraftRepository';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferDocumentRepository } from '../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalOfferVersionRepository } from '../repositories/local/LocalOfferVersionRepository';
import { LocalOfferWorkflowEventRepository } from '../repositories/local/LocalOfferWorkflowEventRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../repositories/local/LocalPricingEvaluationRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesDocumentRepository } from '../repositories/local/LocalSalesDocumentRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { createServices } from '../services';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';
import { createTestOffer, resetOfferTestSequence } from './helpers/offerTestHelpers';

function createHarness() {
  const offerRepository = new LocalOfferRepository();
  const salesTaskRepository = new LocalSalesTaskRepository();
  const salesActivityRepository = new LocalSalesActivityRepository();
  return {
    offerRepository,
    salesTaskRepository,
    salesActivityRepository,
    services: createServices({
      userRepository: new LocalUserRepository(),
      auditRepository: new LocalAuditRepository(),
      approvalRuleRepository: new LocalApprovalRuleRepository(),
      documentTemplateRepository: new LocalDocumentTemplateRepository(),
      leadRepository: new LocalLeadRepository(),
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
      tariffRepository: new LocalTariffRepository(),
      productRepository: new LocalProductRepository(),
      offerRepository,
      offerVersionRepository: new LocalOfferVersionRepository(),
      offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
      salesDocumentRepository: new LocalSalesDocumentRepository(),
      offerDocumentRepository: new LocalOfferDocumentRepository(),
      pricingCatalogRepository: new LocalPricingCatalogRepository(),
      pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
      commissionCatalogRepository: new LocalCommissionCatalogRepository(),
      commissionCalculationRepository: new LocalCommissionCalculationRepository(),
      recommendationRepository: new LocalRecommendationRepository(),
      salesTaskRepository,
      salesActivityRepository,
      contractRepository: new LocalContractRepository(),
      contractVersionRepository: new LocalContractVersionRepository(),
      contractTerminationRepository: new LocalContractTerminationRepository(),
      activationCaseRepository: new LocalActivationCaseRepository(),
      activationChecklistRepository: new LocalActivationChecklistRepository(),
      activationApplicationRepository: new LocalActivationApplicationRepository(),
      activationHardwareRepository: new LocalActivationHardwareRepository(),
      activationBlockerRepository: new LocalActivationBlockerRepository(),
    }),
  };
}

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const field = createUserContext({
  id: 'user_001',
  name: 'Laura',
  role: 'field_service',
  status: 'active',
});

function renderAt(route: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Aufräumblock 5 – Links zur Kundenakte', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('OfferDetail, ContractDetail und ActivationDetail verlinken zur Kundenakte', async () => {
    const harness = createHarness();
    const offer = await harness.offerRepository.create(
      createTestOffer({
        workflowStatus: 'sent',
        leadId: 'lead_001',
        createdByUserId: owner.userId,
      }),
    );
    await harness.services.offerWorkflowService.ensureInitialVersion(offer);
    await harness.services.offerWorkflowService.acceptOffer(offer.id, owner, {
      acceptedByName: 'Kunde',
      acceptanceType: 'digital_confirmation',
      otherText: null,
      note: '',
    });
    const contract = await harness.services.contractService.getByOfferId(offer.id, field);
    expect(contract).toBeTruthy();
    if (!contract) return;
    const started = await harness.services.activationService.startFromContract(contract.id, field);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    cleanup();
    renderAt(`/offers/${offer.id}`);
    const offerLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(offerLinks.some((link) => link.getAttribute('href') === '/leads/lead_001')).toBe(true);

    cleanup();
    renderAt(`/contracts/${contract.id}`);
    const contractLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(contractLinks.some((link) => link.getAttribute('href') === '/leads/lead_001')).toBe(true);

    cleanup();
    renderAt(`/activations/${started.value.id}`);
    const activationLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(activationLinks.some((link) => link.getAttribute('href') === '/leads/lead_001')).toBe(
      true,
    );
  });

  it('Rendern der Kundenakte erzeugt keine neuen Aufgaben oder Aktivitäten', async () => {
    const harness = createHarness();
    const beforeTasks = (readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? []).length;
    const beforeActivities = (readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? []).length;

    renderAt('/leads/lead_001');
    expect(await screen.findByText('Kundenakte')).toBeInTheDocument();

    expect((readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? []).length).toBe(beforeTasks);
    expect((readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? []).length).toBe(
      beforeActivities,
    );
    void harness;
  });
});
