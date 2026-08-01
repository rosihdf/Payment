import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import {
  getActiveBestPayComparisonSessionId,
  readBestPayComparisonStore,
  saveBestPayComparisonSession,
} from '../services/bestPayComparisonStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { createTestOffer } from './helpers/offerTestHelpers';

function createWizardService() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    wizard: services.salesWizardService,
    bestPayComparisonService: services.bestPayComparisonService,
    leadService: services.leadService,
    offerWorkflowService: services.offerWorkflowService,
    offerRepository: repos.offerRepository,
  };
}

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('B01 Sales Wizard Service', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog({ withWeightSet: true });
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('startet Wizard mit Persistenz und Wizard-Metadaten', async () => {
    const { wizard } = createWizardService();
    const started = await wizard.startWizard(context);
    expect(started.entryMode).toBe('wizard');
    expect(started.wizard.enabled).toBe(true);
    expect(started.wizard.currentStep).toBe('prospect');
    expect(await wizard.isWizardPersisted(started.id)).toBe(true);

    const resumed = await wizard.getSession(started.id, context);
    expect(resumed?.wizard.currentStep).toBe('prospect');
  });

  it('wechselt Schritte und persistiert Prospect-Draft', async () => {
    const { wizard } = createWizardService();
    const session = await wizard.startWizard(context);
    const updated = await wizard.updateProspectDraft(
      session.id,
      { companyName: 'Wizard GmbH', contactFirstName: 'Max', contactLastName: 'Muster' },
      context,
    );
    expect(updated?.customerLabel).toBe('Wizard GmbH');

    const moved = await wizard.setStep(session.id, 'costs', context);
    expect(moved?.wizard.currentStep).toBe('costs');
  });

  it('legt Szenario an, berechnet und wählt Variante', async () => {
    const { wizard } = createWizardService();
    const session = await wizard.startWizard(context);
    await wizard.assignLead(session.id, 'lead_001', context);
    await wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
      },
      context,
    );

    const scenario = await wizard.addScenario(session.id, context, 'Standard');
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      return;
    }

    const calculated = await wizard.calculateScenario(session.id, scenario.scenarioId, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }

    const scenarioAfter = calculated.session.wizard.scenarios.find(
      (entry) => entry.id === scenario.scenarioId,
    );
    const variantId =
      scenarioAfter?.selectedCandidateId ?? calculated.session.result?.variants[0]?.candidateId;
    expect(variantId).toBeTruthy();
    if (!variantId) {
      return;
    }

    const selected = await wizard.selectScenarioVariant(
      session.id,
      scenario.scenarioId,
      variantId,
      context,
    );
    expect(selected?.selectedCandidateId).toBe(variantId);
  });

  it('erzeugt Angebot aus Wizard-Szenario', async () => {
    const { wizard, offerRepository } = createWizardService();
    const session = await wizard.startWizard(context);
    await wizard.assignLead(session.id, 'lead_001', context);
    await wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
      },
      context,
    );
    const scenario = await wizard.addScenario(session.id, context, 'Angebot');
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      return;
    }
    const calculated = await wizard.calculateScenario(session.id, scenario.scenarioId, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }
    const variantId = calculated.session.result?.variants[0]?.candidateId;
    if (!variantId) {
      return;
    }
    await wizard.selectScenarioVariant(session.id, scenario.scenarioId, variantId, context);

    const offer = await wizard.createOffer(session.id, context);
    expect(offer.ok).toBe(true);
    if (!offer.ok) {
      return;
    }
    const stored = await offerRepository.getById(offer.offerId);
    expect(stored?.leadId).toBe('lead_001');
  });

  it('speichert Wizard-Session im Comparison-Store', async () => {
    const { wizard } = createWizardService();
    const session = await wizard.startWizard(context);
    await wizard.updateProspectDraft(session.id, { companyName: 'Store Test' }, context);
    const store = readBestPayComparisonStore();
    expect(store.sessions.some((entry) => entry.id === session.id)).toBe(true);
    expect(getActiveBestPayComparisonSessionId()).toBe(session.id);
  });

  it('verknüpft Wizard mit bestehendem Angebot', async () => {
    const { wizard, offerRepository, offerWorkflowService } = createWizardService();
    const offer = createTestOffer({ leadId: 'lead_001' });
    await offerRepository.create(offer);
    const session = await wizard.startWizard(context);
    await wizard.assignLead(session.id, offer.leadId, context);
    saveBestPayComparisonSession({
      ...session,
      offerId: offer.id,
      offerNumber: offer.offerNumber,
      offerTitle: offer.title,
    });

    const view = await offerWorkflowService.getWizardWorkflowView(offer.id);
    expect(view?.offer?.id).toBe(offer.id);
  });
});
