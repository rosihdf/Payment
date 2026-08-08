import { beforeEach, describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { deriveScenarioConfigFromNeed } from '../domain/bestPayComparison/deriveScenarioConfig';
import { buildCustomerNeedForComparison } from '../domain/bestPayComparison/buildCustomerNeedForComparison';
import { getMissingAdviceInputsFromSession } from '../domain/bestPayComparison/getMissingAdviceInputs';
import {
  bumpMaxReachedStep,
  canJumpToWizardStep,
  normalizeWizardMaxReachedStep,
} from '../domain/bestPayComparison/salesWizard';
import {
  getLeadDisplayName,
  preferNonPlaceholderCustomerLabel,
  UNNAMED_LEAD_DISPLAY_NAME,
} from '../domain/lead/getLeadDisplayName';
import { normalizeBestPayComparisonSession } from '../services/bestPayComparisonStorageMigration';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { createTestLead } from './helpers/leadTestHelpers';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

function createWizardService() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    wizard: services.salesWizardService,
    leadService: services.leadService,
    leadRepository: repos.leadRepository,
  };
}

describe('Phase 1 – Need-/Session-Wahrheit', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog({ withWeightSet: true });
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('bevorzugt echte Kundenlabels gegenüber Unbenannter Kunde beim Merge', () => {
    expect(
      preferNonPlaceholderCustomerLabel(UNNAMED_LEAD_DISPLAY_NAME, 'AMRtech UG'),
    ).toBe('AMRtech UG');
    expect(
      preferNonPlaceholderCustomerLabel('AMRtech UG', UNNAMED_LEAD_DISPLAY_NAME),
    ).toBe('AMRtech UG');
  });

  it('hydratisiert maxReachedStep aus currentStep für alte Entwürfe', () => {
    const legacy = normalizeBestPayComparisonSession({
      id: 'bestpay_comparison_legacy',
      createdByUserId: 'user_001',
      wizard: {
        enabled: true,
        currentStep: 'need',
        prospectDraft: { companyName: 'Alt GmbH' },
        scenarios: [],
      },
      manualInput: {},
    });
    expect(legacy?.wizard.maxReachedStep).toBe('need');
    expect(normalizeWizardMaxReachedStep(legacy!.wizard)).toBe('need');
  });

  it('erlaubt Sprung zu bereits erreichten Schritten (3→1→3)', () => {
    const maxReached = bumpMaxReachedStep('need', 'prospect');
    expect(maxReached).toBe('need');
    expect(canJumpToWizardStep('need', maxReached)).toBe(true);
    expect(canJumpToWizardStep('variants', maxReached)).toBe(false);
  });

  it('überschreibt Need nicht mehr über scenario.config bei Neuberechnung', async () => {
    const { wizard } = createWizardService();
    const session = await wizard.startWizard(context);
    await wizard.assignLead(session.id, 'lead_001', context);
    await wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 500_000,
        monthlyTransactions: 100,
        monthlyTotalCostsCents: 200_00,
        terminalCount: 1,
        preferredTermMonths: 24,
        girocardPercent: 60,
        debitPercent: 10,
        creditPercent: 25,
        otherPercent: 5,
        paymentUsage: {
          stationary: false,
          mobile: true,
          ecommerce: false,
          softPos: false,
        },
      },
      context,
    );

    const scenario = await wizard.addScenario(session.id, context, 'Standard');
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      return;
    }

    const staleConfig = await wizard.updateScenarioConfig(
      session.id,
      scenario.scenarioId,
      { preferredTermMonths: 36, terminalCount: 4 },
      context,
    );
    expect(staleConfig?.wizard.scenarios[0]?.config.preferredTermMonths).toBe(36);

    await wizard.updateNeed(session.id, { preferredTermMonths: 24, terminalCount: 1 }, context);

    const calculated = await wizard.calculateScenario(session.id, scenario.scenarioId, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }

    expect(calculated.session.manualInput.preferredTermMonths).toBe(24);
    expect(calculated.session.manualInput.terminalCount).toBe(1);
    expect(calculated.session.wizard.scenarios[0]?.config.preferredTermMonths).toBe(24);
    expect(calculated.session.wizard.scenarios[0]?.config.terminalCount).toBe(1);
  });

  it('realer Regressionsfall AMRtech UG – Kunde, Need, Navigation, Reload', async () => {
    const { wizard, leadRepository } = createWizardService();
    const lead = await leadRepository.create(
      createTestLead({
        id: 'lead_amrtech',
        companyName: 'AMRtech UG',
        contactFirstName: 'Max',
        contactLastName: 'Mustermann',
        currentProvider: 'VR Payment',
      }),
    );

    let session = await wizard.startWizard(context);
    const assigned = await wizard.assignLead(session.id, lead.id, context);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }
    session = assigned.session;
    expect(session.leadId).toBe(lead.id);
    expect(getLeadDisplayName({ companyName: 'AMRtech UG', contactFirstName: 'Max', contactLastName: 'Mustermann', city: 'Berlin' })).toBe(
      'AMRtech UG',
    );
    expect(session.customerLabel).toBe('AMRtech UG');

    await wizard.updateProspectDraft(session.id, { companyName: '', contactFirstName: '', contactLastName: '' }, context);
    const afterEmptyProspect = await wizard.getSession(session.id, context);
    expect(afterEmptyProspect?.leadId).toBe(lead.id);
    expect(afterEmptyProspect?.customerLabel).toBe('AMRtech UG');

    await wizard.goNext(session.id, context);
    await wizard.updateCostCaptureMode(session.id, 'manual', context);
    await wizard.updateNeed(
      session.id,
      { monthlyTotalCostsCents: 200_00 },
      context,
    );
    await wizard.updateProspectDraft(
      session.id,
      { currentProviderCode: 'VR Payment', currentProviderOther: '' },
      context,
    );
    await wizard.goNext(session.id, context);

    await wizard.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: 500_000,
        monthlyTransactions: 100,
        terminalCount: 1,
        preferredTermMonths: 24,
        girocardPercent: 60,
        debitPercent: 10,
        creditPercent: 25,
        otherPercent: 5,
      },
      context,
    );
    await wizard.goNext(session.id, context);

    expect((await wizard.getSession(session.id, context))?.wizard.maxReachedStep).toBe('variants');

    await wizard.setStep(session.id, 'prospect', context);
    const jumpToNeed = await wizard.setStep(session.id, 'need', context);
    expect(jumpToNeed?.wizard.currentStep).toBe('need');
    expect(jumpToNeed?.manualInput.monthlyCardVolumeCents).toBe(500_000);
    expect(jumpToNeed?.manualInput.terminalCount).toBe(1);
    expect(jumpToNeed?.manualInput.girocardPercent).toBe(60);
    expect(jumpToNeed?.leadId).toBe(lead.id);
    expect(jumpToNeed?.customerLabel).toBe('AMRtech UG');

    const reloaded = await wizard.getSession(session.id, context);
    expect(reloaded?.wizard.maxReachedStep).toBe('variants');
    expect(reloaded?.manualInput.preferredTermMonths).toBe(24);

    const need = buildCustomerNeedForComparison({
      manualInput: reloaded!.manualInput,
      baseline: null,
      salesRepresentativeId: context.userId,
      leadId: reloaded!.leadId,
    });
    expect(need.monthlyCardVolumeCents).toBe(500_000);
    expect(need.monthlyTransactions).toBe(100);
    expect(need.terminalCount).toBe(1);
    expect(need.cardMix.girocardPercent).toBe(60);
    expect(need.contractPreferences.preferredTermMonths).toBe(24);

    const missing = getMissingAdviceInputsFromSession(reloaded!);
    expect(missing.some((entry) => entry.field === 'monthlyCardVolumeCents' && entry.severity === 'error')).toBe(
      false,
    );
  });

  it('deriveScenarioConfig liest ausschließlich aus manualInput', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.preferredTermMonths = 24;
    session.manualInput.terminalCount = 2;
    session.manualInput.paymentUsage.mobile = true;

    const config = deriveScenarioConfigFromNeed(session, 'Test');
    expect(config.preferredTermMonths).toBe(24);
    expect(config.terminalCount).toBe(2);
    expect(config.paymentUsage.mobile).toBe(true);
  });
});
