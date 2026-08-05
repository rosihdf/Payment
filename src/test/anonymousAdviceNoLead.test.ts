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

async function prepareAnonymousRecommendation(
  wizard: ReturnType<typeof createWizardService>['wizard'],
) {
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
    throw new Error('scenario failed');
  }

  const calculated = await wizard.calculateScenario(session.id, scenario.scenarioId, context);
  expect(calculated.ok).toBe(true);
  if (!calculated.ok) {
    throw new Error('calculate failed');
  }

  const variantId = calculated.session.result?.variants[0]?.candidateId;
  expect(variantId).toBeTruthy();
  if (!variantId) {
    throw new Error('missing variant');
  }

  await wizard.selectScenarioVariant(session.id, scenario.scenarioId, variantId, context);
  return { sessionId: session.id, scenarioId: scenario.scenarioId };
}

describe('Anonymous advice without placeholder lead', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog({ withWeightSet: true });
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('keeps session without lead and blocks offer until a real customer is assigned', async () => {
    const { wizard, leadRepository, offerRepository } = createWizardService();
    const leadsBefore = await leadRepository.getAll();

    const { sessionId } = await prepareAnonymousRecommendation(wizard);

    const leadsAfterRecommendation = await leadRepository.getAll();
    expect(leadsAfterRecommendation.length).toBe(leadsBefore.length);
    expect(leadsAfterRecommendation.some((lead) => lead.companyName === 'Beratung ohne Kunde')).toBe(
      false,
    );

    const blocked = await wizard.createOffer(sessionId, context);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.message).toMatch(/Kunden zuordnen/i);

    await wizard.assignLead(sessionId, 'lead_001', context);
    const offerResult = await wizard.createOffer(sessionId, context);
    expect(offerResult.ok).toBe(true);
    if (!offerResult.ok) {
      return;
    }

    const leadsAfterOffer = await leadRepository.getAll();
    expect(leadsAfterOffer.length).toBe(leadsBefore.length);
    expect(leadsAfterOffer.some((lead) => lead.companyName === 'Beratung ohne Kunde')).toBe(false);

    const storedOffer = await offerRepository.getById(offerResult.offerId);
    expect(storedOffer?.leadId).toBe('lead_001');
    expect(storedOffer?.customerSnapshot.companyName).toBeTruthy();

    const refreshed = await wizard.getSession(sessionId, context);
    expect(refreshed?.leadId).toBe('lead_001');
    expect(refreshed?.offerId).toBe(offerResult.offerId);
  });
});
