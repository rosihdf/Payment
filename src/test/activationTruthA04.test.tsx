import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
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
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  createTestOffer,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';

function createHarness() {
  const offerRepository = new LocalOfferRepository();
  const offerWorkflowEventRepository = new LocalOfferWorkflowEventRepository();
  const activationCaseRepository = new LocalActivationCaseRepository();
  const salesTaskRepository = new LocalSalesTaskRepository();
  const services = createServices({
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
    offerWorkflowEventRepository,
    salesDocumentRepository: new LocalSalesDocumentRepository(),
    offerDocumentRepository: new LocalOfferDocumentRepository(),
    pricingCatalogRepository: new LocalPricingCatalogRepository(),
    pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
    commissionCatalogRepository: new LocalCommissionCatalogRepository(),
    commissionCalculationRepository: new LocalCommissionCalculationRepository(),
    recommendationRepository: new LocalRecommendationRepository(),
    salesTaskRepository,
    salesActivityRepository: new LocalSalesActivityRepository(),
    contractRepository: new LocalContractRepository(),
    contractVersionRepository: new LocalContractVersionRepository(),
    contractTerminationRepository: new LocalContractTerminationRepository(),
    activationCaseRepository,
    activationChecklistRepository: new LocalActivationChecklistRepository(),
    activationApplicationRepository: new LocalActivationApplicationRepository(),
    activationHardwareRepository: new LocalActivationHardwareRepository(),
    activationBlockerRepository: new LocalActivationBlockerRepository(),
  });
  return {
    services,
    offerRepository,
    offerWorkflowEventRepository,
    activationCaseRepository,
    salesTaskRepository,
  };
}

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const field = createUserContext({
  id: 'user_001',
  name: 'Laura',
  role: 'field_service',
  status: 'active',
});
const admin = createUserContext({
  id: 'user_004',
  name: 'Admin',
  role: 'admin',
  status: 'active',
});

async function createAcceptedOfferWithContract(harness: ReturnType<typeof createHarness>) {
  const offer = await harness.offerRepository.create(
    createTestOffer({ workflowStatus: 'sent', createdByUserId: owner.userId }),
  );
  await harness.services.offerWorkflowService.ensureInitialVersion(offer);
  await harness.services.offerWorkflowService.acceptOffer(offer.id, owner, {
    acceptedByName: 'Kunde',
    acceptanceType: 'digital_confirmation',
    otherText: null,
    note: '',
  });
  const contract = await harness.services.contractService.getByOfferId(offer.id, field);
  return { offer: (await harness.offerRepository.getById(offer.id))!, contract };
}

function renderOffer(offerId: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/offers/${offerId}`] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Aufräumblock 4 – ActivationCase als operative Wahrheit', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('angenommenes Angebot erzeugt keinen ActivationCase', async () => {
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    expect(contract).toBeTruthy();
    expect(await harness.activationCaseRepository.getAll()).toHaveLength(0);
    expect(offer.workflowStatus).toBe('accepted');
  });

  it('Vertrag führt zu genau einem ActivationCase und Start ist idempotent', async () => {
    const harness = createHarness();
    const { contract } = await createAcceptedOfferWithContract(harness);
    expect(contract).toBeTruthy();
    if (!contract) return;

    const first = await harness.services.activationService.startFromContract(contract.id, field);
    const second = await harness.services.activationService.startFromContract(contract.id, field);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(await harness.activationCaseRepository.getAll()).toHaveLength(1);
  });

  it('historische OfferActivation erzeugt keine zweite Aktivierung', async () => {
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    if (!contract) return;

    await harness.services.offerWorkflowService.prepareActivation(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      checks: { docs: true },
    });
    await harness.services.offerWorkflowService.activate(offer.id, owner, {
      externalReference: 'HIST-1',
    });

    expect(await harness.activationCaseRepository.getAll()).toHaveLength(0);

    const started = await harness.services.activationService.startFromContract(contract.id, field);
    expect(started.ok).toBe(true);
    const events = await harness.offerWorkflowEventRepository.getByOfferId(offer.id);
    expect(events.some((event) => event.type === 'activation')).toBe(true);
    expect(await harness.activationCaseRepository.getAll()).toHaveLength(1);
  });

  it('automatische Aufgaben werden nicht doppelt aus Offer- und Activation-Pfad erzeugt', async () => {
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    if (!contract) return;

    await harness.services.salesWorkspaceService.syncAutomaticTasks(field);
    await harness.services.salesWorkspaceService.syncAutomaticTasks(field);
    const tasks = await harness.salesTaskRepository.getAll();
    const startKeys = tasks.filter(
      (task) => task.sourceKey === `auto:start_activation:${contract.id}`,
    );
    expect(startKeys).toHaveLength(1);
    expect(tasks.some((task) => task.sourceKey === `auto:prepare_activation:${offer.id}`)).toBe(
      false,
    );

    const started = await harness.services.activationService.startFromContract(contract.id, field);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await harness.services.activationService.ensureAutomaticTasks(started.value, field);
    await harness.services.activationService.ensureAutomaticTasks(started.value, field);
    const after = await harness.salesTaskRepository.getAll();
    const stepKeys = after.filter(
      (task) =>
        task.sourceKey === `auto:activation_step:${started.value.id}:${started.value.status}`,
    );
    expect(stepKeys).toHaveLength(1);
  });

  it('Diagnose erkennt Doppelwahrheiten', async () => {
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    if (!contract) return;
    await harness.services.contractService.transitionStatus(contract.id, 'activation', field);
    await harness.services.offerWorkflowService.prepareActivation(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      checks: { docs: true },
    });

    const findings = await harness.services.dataDiagnosticService.runDiagnostics(admin);
    expect(Array.isArray(findings)).toBe(true);
    if (!Array.isArray(findings)) return;
    expect(
      findings.some((finding) =>
        finding.description.includes('Contract in activation ohne ActivationCase'),
      ),
    ).toBe(true);
    expect(
      findings.some((finding) =>
        finding.description.includes('OfferActivation ohne passenden ActivationCase'),
      ),
    ).toBe(true);
  });

  it('OfferDetail zeigt nur Status und Link, kein Go-live/Hardware', async () => {
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    if (!contract) return;
    await harness.services.activationService.startFromContract(contract.id, field);

    renderOffer(offer.id);
    expect(await screen.findByRole('heading', { name: 'Vertrag & Aktivierung' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Vertrag öffnen' })).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Aktivierung öffnen' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aktivierung vorbereiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aktivierung dokumentieren' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Go-live/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Seriennummer|Testzahlung/i)).not.toBeInTheDocument();
  });

  it('OfferDetail startet Aktivierung idempotent über ActivationService', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    const { offer, contract } = await createAcceptedOfferWithContract(harness);
    expect(contract).toBeTruthy();

    renderOffer(offer.id);
    const start = await screen.findByRole('button', { name: 'Aktivierung starten' });
    await user.click(start);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Aktivierung öffnen' })).toBeInTheDocument();
    });
    expect(await harness.activationCaseRepository.getAll()).toHaveLength(1);
  });
});
