import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { RecommendationService } from '../services/recommendationService';
import { OfferService } from '../services/offerService';
import { BillingImportService } from '../services/billingImportService';
import { BestPayComparisonService } from '../services/bestPayComparisonService';
import { LeadService } from '../services/leadService';
import { SalesWizardService } from '../services/salesWizardService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import {
  getActiveBestPayComparisonSessionId,
  readBestPayComparisonStore,
  saveBestPayComparisonSession,
} from '../services/bestPayComparisonStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function createWizardService() {
  const leadRepository = new LocalLeadRepository();
  const offerRepository = new LocalOfferRepository();
  const billingImportService = new BillingImportService(offerRepository);
  const recommendationService = new RecommendationService(
    new LocalRecommendationRepository(),
    offerRepository,
    leadRepository,
    new LocalTariffRepository(),
    new LocalProductRepository(),
    new LocalPricingCatalogRepository(),
    new LocalCommissionCatalogRepository(),
    billingImportService,
  );
  const offerService = new OfferService(
    offerRepository,
    leadRepository,
    new LocalTariffRepository(),
    new LocalProductRepository(),
  );
  const bestPayComparisonService = new BestPayComparisonService(
    billingImportService,
    recommendationService,
    offerService,
    leadRepository,
    offerRepository,
  );
  const leadService = new LeadService(leadRepository);
  return {
    wizard: new SalesWizardService(bestPayComparisonService, recommendationService, leadService),
    bestPayComparisonService,
    leadService,
  };
}

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('B01 SalesWizardService', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('startet Wizard mit Autosave und Resume', () => {
    const { wizard } = createWizardService();
    const started = wizard.startWizard(context);
    expect(started.entryMode).toBe('wizard');
    expect(started.wizard.enabled).toBe(true);
    expect(started.wizard.currentStep).toBe('prospect');
    expect(getActiveBestPayComparisonSessionId()).toBe(started.id);

    wizard.updateProspectDraft(started.id, { companyName: 'Wizard Café' }, context);
    const resumed = wizard.resumeWizard(started.id, context);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }
    expect(resumed.session.wizard.prospectDraft.companyName).toBe('Wizard Café');
    expect(resumed.session.id).toBe(started.id);
  });

  it('navigiert Schritte vor und zurück mit Validierung', () => {
    const { wizard } = createWizardService();
    const session = wizard.startWizard(context);

    expect(wizard.goNext(session.id, context).ok).toBe(true);
    expect(wizard.getSession(session.id, context)?.wizard.currentStep).toBe('costs');

    const blocked = wizard.goNext(session.id, context);
    expect(blocked.ok).toBe(false);

    wizard.updateNeed(
      session.id,
      {
        monthlyTotalCostsCents: 450_00,
        monthlyCardVolumeCents: 5_000_000,
      },
      context,
    );
    expect(wizard.goNext(session.id, context).ok).toBe(true);
    expect(wizard.getSession(session.id, context)?.wizard.currentStep).toBe('need');

    const back = wizard.goBack(session.id, context);
    expect(back?.wizard.currentStep).toBe('costs');
  });

  it('legt Szenarien an, berechnet und wählt Variante', async () => {
    const { wizard } = createWizardService();
    const session = wizard.startWizard(context);
    wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
        preferredTermMonths: 36,
        paymentUsage: {
          stationary: false,
          mobile: true,
          ecommerce: false,
          softPos: false,
        },
      },
      context,
    );

    const classic = wizard.addScenario(session.id, context, 'Classic');
    expect(classic.ok).toBe(true);
    if (!classic.ok) {
      return;
    }
    const variable = wizard.addScenario(session.id, context, 'Variable 48');
    expect(variable.ok).toBe(true);
    if (!variable.ok) {
      return;
    }
    wizard.updateScenarioConfig(
      session.id,
      variable.scenarioId,
      { preferredTermMonths: 48 },
      context,
    );

    const calculated = await wizard.calculateScenario(session.id, classic.scenarioId, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }
    const scenario = calculated.session.wizard.scenarios.find(
      (entry) => entry.id === classic.scenarioId,
    );
    expect(scenario?.result?.variants.length).toBeGreaterThan(0);
    const candidateId = scenario!.selectedCandidateId!;
    const selected = wizard.selectScenarioVariant(
      session.id,
      classic.scenarioId,
      candidateId,
      context,
    );
    expect(selected?.selectedCandidateId).toBe(candidateId);
    expect(selected?.result?.variants.length).toBeGreaterThan(0);
    expect(selected?.wizard.selectedScenarioId).toBe(classic.scenarioId);

    const duplicated = wizard.duplicateScenario(session.id, classic.scenarioId, context);
    expect(duplicated.ok).toBe(true);
    const deleted = wizard.deleteScenario(session.id, variable.scenarioId, context);
    expect(deleted.ok).toBe(true);
    expect(
      deleted.ok && deleted.session.wizard.scenarios.some((entry) => entry.id === variable.scenarioId),
    ).toBe(false);
  });

  it('erzeugt Lead, Angebot und schließt Wizard ab', async () => {
    const { wizard } = createWizardService();
    const session = wizard.startWizard(context);
    wizard.updateProspectDraft(
      session.id,
      {
        companyName: 'B01 Test GmbH',
        contactFirstName: 'Anna',
        contactLastName: 'Muster',
        phone: '030123456',
        email: 'anna@example.com',
        industry: 'Gastronomie',
      },
      context,
    );
    const lead = await wizard.createLeadFromProspect(session.id, context);
    expect(lead.ok).toBe(true);
    if (!lead.ok) {
      return;
    }

    wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
      },
      context,
    );
    const scenario = wizard.addScenario(session.id, context, 'Standard');
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      return;
    }
    const calculated = await wizard.calculateScenario(session.id, scenario.scenarioId, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }
    const candidateId = calculated.session.wizard.scenarios[0]?.selectedCandidateId;
    expect(candidateId).toBeTruthy();
    wizard.selectScenarioVariant(session.id, scenario.scenarioId, candidateId!, context);

    wizard.setStep(session.id, 'offer', context);
    const offer = await wizard.createOffer(session.id, context);
    expect(offer.ok).toBe(true);
    if (!offer.ok) {
      return;
    }
    expect(offer.session.offerId).toBeTruthy();

    const approval = wizard.acknowledgeApproval(session.id, 'intern ok', context);
    expect(approval.ok).toBe(true);
    const completed = wizard.completeWizard(session.id, context);
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    expect(completed.session.wizard.wizardCompletedAt).toBeTruthy();
    expect(completed.session.wizard.currentStep).toBe('closing');

    const store = readBestPayComparisonStore();
    expect(store.sessions.some((entry) => entry.id === session.id && entry.entryMode === 'wizard')).toBe(
      true,
    );
  });

  it('überspringt Freigabe automatisch wenn nicht nötig', () => {
    const { wizard } = createWizardService();
    const session = wizard.startWizard(context);
    wizard.updateNeed(
      session.id,
      { monthlyTotalCostsCents: 100_00, monthlyCardVolumeCents: 1_000_000 },
      context,
    );
    const scenario = wizard.addScenario(session.id, context, 'Auto');
    if (!scenario.ok) {
      return;
    }
    const current = wizard.getSession(session.id, context)!;
    const target = current.wizard.scenarios[0]!;
    target.result = {
      recommendationRecordId: 'rec',
      recommendationVersion: 1,
      primaryCandidateId: 'c1',
      variants: [
        {
          candidateId: 'c1',
          tariffId: 't1',
          tariffName: 'Test',
          productId: null,
          productName: null,
          termMonths: 36,
          monthlyTotalCostsCents: 80_00,
          annualTotalCostsCents: 960_00,
          oneTimeCostsCents: 0,
          savingsMonthlyCents: 20_00,
          savingsAnnualCents: 240_00,
          savingsPercent: 20,
          isHigherCost: false,
          commissionTotalCents: 100_00,
          score: 90,
          rank: 1,
          primaryReasons: ['Passend'],
        },
      ],
      currentMonthlyCostsCents: 100_00,
      currentAnnualCostsCents: 1200_00,
      inputFingerprint: 'fp',
      calculatedAt: new Date().toISOString(),
      stale: false,
      staleReasons: [],
    };
    target.selectedCandidateId = 'c1';
    target.approval = {
      adminReviewRequired: false,
      quickReviewPossible: true,
      detailReviewRequired: false,
      approvalBlocked: false,
      reasons: [],
    };
    current.result = target.result;
    current.selectedCandidateId = 'c1';
    current.offerId = 'offer_test';
    current.wizard.selectedScenarioId = target.id;
    current.wizard.currentStep = 'offer';
    saveBestPayComparisonSession(current);

    const next = wizard.goNext(session.id, context);
    expect(next.ok).toBe(true);
    if (!next.ok) {
      return;
    }
    expect(next.session.wizard.currentStep).toBe('closing');
    expect(next.session.wizard.approvalAcknowledgedAt).toBeTruthy();
  });
});
