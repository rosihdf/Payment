import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';

function createWizardService() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    wizard: services.salesWizardService,
    leadRepository: repos.leadRepository,
    offerRepository: repos.offerRepository,
  };
}

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('Anonymous advice without placeholder lead', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog({ withWeightSet: true });
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('creates offer draft without creating a lead for anonymous consultation', async () => {
    const { wizard, leadRepository, offerRepository } = createWizardService();
    const leadsBefore = await leadRepository.getAll();

    const session = await wizard.startWizard(context);
    await wizard.goNext(session.id, context);
    await wizard.updateCostCaptureMode(session.id, 'no_current_costs', context);
    await wizard.goNext(session.id, context);
    await wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        terminalCount: 2,
      },
      context,
    );

    const scenario = await wizard.addScenario(session.id, context, 'Anonym');
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
    expect(variantId).toBeTruthy();
    if (!variantId) {
      return;
    }

    await wizard.selectScenarioVariant(session.id, scenario.scenarioId, variantId, context);
    const offerResult = await wizard.createOffer(session.id, context);
    expect(offerResult.ok).toBe(true);
    if (!offerResult.ok) {
      return;
    }

    const leadsAfter = await leadRepository.getAll();
    expect(leadsAfter.length).toBe(leadsBefore.length);
    expect(leadsAfter.some((lead) => lead.companyName === 'Beratung ohne Kunde')).toBe(false);

    const storedOffer = await offerRepository.getById(offerResult.offerId);
    expect(storedOffer?.leadId).toBe('');
    expect(storedOffer?.customerSnapshot.companyName).toBe('');

    const refreshed = await wizard.getSession(session.id, context);
    expect(refreshed?.leadId).toBeNull();
    expect(refreshed?.offerId).toBe(offerResult.offerId);
  });

  it('links offer to real lead when customer is assigned later', async () => {
    const { wizard, offerRepository } = createWizardService();
    const anonymousSession = await wizard.startWizard(context);
    await wizard.goNext(anonymousSession.id, context);
    await wizard.updateCostCaptureMode(anonymousSession.id, 'no_current_costs', context);
    await wizard.goNext(anonymousSession.id, context);
    await wizard.updateNeed(
      anonymousSession.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        terminalCount: 2,
      },
      context,
    );
    const anonScenario = await wizard.addScenario(anonymousSession.id, context, 'Später zuordnen');
    if (!anonScenario.ok) {
      return;
    }
    const anonCalc = await wizard.calculateScenario(anonymousSession.id, anonScenario.scenarioId, context);
    if (!anonCalc.ok) {
      return;
    }
    const anonVariant = anonCalc.session.result?.variants[0]?.candidateId;
    if (!anonVariant) {
      return;
    }
    await wizard.selectScenarioVariant(anonymousSession.id, anonScenario.scenarioId, anonVariant, context);
    const offerResult = await wizard.createOffer(anonymousSession.id, context);
    expect(offerResult.ok).toBe(true);
    if (!offerResult.ok) {
      return;
    }

    await wizard.assignLead(anonymousSession.id, 'lead_001', context);
    const storedOffer = await offerRepository.getById(offerResult.offerId);
    expect(storedOffer?.leadId).toBe('lead_001');
    expect(storedOffer?.customerSnapshot.companyName).toBeTruthy();
  });
});
