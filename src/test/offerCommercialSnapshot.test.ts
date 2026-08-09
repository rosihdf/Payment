import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { normalizeOffer } from '../domain/offer/normalizeOffer';
import { createTestOffer } from './helpers/offerTestHelpers';
import {
  buildOfferCommercialSnapshot,
  validateOfferCommercialMaterialization,
} from '../domain/offer/buildOfferCommercialSnapshot';
import { buildCommercialSelectionHandoff } from '../domain/commercial/commercialHandoff';
import { buildCommercialConfig } from '../domain/commercial/commercialConfig';
import { calculateCommercialProjection } from '../domain/commercial/calculateCommercialProjection';
import { materializeCreateOfferItemsFromCommercialSnapshot } from '../domain/offer/materializeOfferFromCommercialSnapshot';
import { isFrozenCommercialSnapshot } from '../domain/offer/offerCommercialSnapshot';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import type { BestPaySolutionCandidate } from '../domain/recommendation/bestPaySolutionCandidate';
import { createEmptyCustomerSnapshot } from '../domain/offer/offerSnapshots';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

const tariffs = normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]);
const products = normalizeProducts([...BESTPAY_PRODUCTS_RAW]);
const productMap = new Map(products.map((product) => [product.id, product]));
const classicTariff = tariffs.find((entry) => entry.id === 'tariff_bestpay_a920_classic')!;

function baseCandidate(overrides: Partial<BestPaySolutionCandidate> = {}): BestPaySolutionCandidate {
  return {
    candidateId: 'candidate_test',
    candidateCode: 'test',
    contractTypeId: null,
    tariffId: classicTariff.id,
    tariffName: classicTariff.name,
    tariffProductCode: classicTariff.productCode,
    terminalType: 'stationary',
    hardwareProductIds: [],
    hardwareProductNames: [],
    accessoryItems: [],
    contractTermId: 'contract_term_24',
    contractTermMonths: 24,
    isStandardTerm: true,
    quantity: 1,
    priceBookVersionId: null,
    pricingEvaluation: null,
    commissionPreview: null,
    costProjection: {
      currency: 'EUR',
      projectionMonths: 24,
      projectionSource: 'contract_term',
      oneTimeCostsCents: null,
      monthlyFixedCostsCents: null,
      transactionCostsCents: null,
      volumeBasedCostsCents: null,
      hardwareCostsCents: null,
      accessoryCostsCents: null,
      totalCostsCents: null,
      averageMonthlyCostsCents: null,
      costPerTransactionCents: null,
      isProjected: false,
      isComplete: false,
      missingBasis: [],
      assumptions: [],
    },
    fulfilledRequirements: [],
    unfulfilledRequirements: [],
    hints: [],
    warnings: [],
    exclusionReasons: [],
    status: 'eligible',
    rank: null,
    ...overrides,
  };
}

function buildTestCommercialSnapshot() {
  const need = createTestCustomerNeed({
    terminalCount: 1,
    monthlyCardVolumeCents: 500_000,
    monthlyTransactions: 100,
    paymentUsage: { stationary: true, mobile: false, ecommerce: false, softPos: false },
    contractPreferences: {
      preferredTermMonths: 24,
      maxAcceptedTermMonths: null,
      preferLowFixedCosts: false,
      preferLowVariableCosts: false,
      preferLowInitialCosts: false,
      preferPriceStability: false,
      preferFlexibility: false,
      specialTermRequested: false,
    },
  });
  const candidate = baseCandidate({ contractTermMonths: 24, quantity: 1 });
  const config = buildCommercialConfig({
    need,
    candidate,
    tariff: classicTariff,
    products: productMap,
  });
  const projection = calculateCommercialProjection(need, config);
  const handoff = buildCommercialSelectionHandoff({
    commercialConfig: config,
    contractConfiguration: 'terminal_acq_long_term',
    projection,
    commissionPreview: null,
    need,
  });

  return buildOfferCommercialSnapshot({
    handoff,
    customerSnapshot: {
      ...createEmptyCustomerSnapshot(),
      leadId: 'lead_amrtech',
      companyName: 'AMRtech UG',
      contactFirstName: 'Max',
      contactLastName: 'Mustermann',
    },
    tariffName: classicTariff.name,
    productName: null,
    contractConfiguration: 'terminal_acq_long_term',
    commissionPlanKind: null,
    sources: {
      sourceComparisonSessionId: 'session_test',
      sourceScenarioId: null,
      recommendationRecordId: 'rec_test',
      recommendationVersion: 1,
      selectedCandidateId: candidate.candidateId,
      pricingEvaluationId: null,
      commissionCalculationId: null,
      catalogVersions: {
        tariffCatalogVersion: 1,
        productCatalogVersion: 1,
        pricingCatalogVersion: 1,
        commissionCatalogVersion: 1,
      },
    },
  });
}

function createComparisonService() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    service: services.bestPayComparisonService,
    offerRepository: repos.offerRepository,
    tariffRepository: repos.tariffRepository,
  };
}

describe('Phase 3 – Offer Commercial Snapshot', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('materialisiert Positionen aus Snapshot', () => {
    const snapshot = buildTestCommercialSnapshot();
    const validation = validateOfferCommercialMaterialization(snapshot);
    expect(validation.ok).toBe(true);

    const items = materializeCreateOfferItemsFromCommercialSnapshot(snapshot, productMap);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.name === 'Terminalmiete')).toBe(true);
    expect(items.some((item) => item.name === 'Transaktionsentgelt')).toBe(true);
  });

  it('F1: Preisänderung im Katalog verändert eingefrorenen Snapshot nicht', () => {
    const snapshot = buildTestCommercialSnapshot();
    const frozenRent = snapshot.commercialConfig.monthlyTerminalRentalCents;

    snapshot.commercialConfig.monthlyTerminalRentalCents = 99_999;
    expect(snapshot.commercialConfig.monthlyTerminalRentalCents).toBe(99_999);

    const restored = buildTestCommercialSnapshot();
    expect(restored.commercialConfig.monthlyTerminalRentalCents).toBe(frozenRent);
  });

  it('F3: Kunden-Snapshot bleibt dokumentiert', () => {
    const snapshot = buildTestCommercialSnapshot();
    expect(snapshot.customerSnapshot.companyName).toBe('AMRtech UG');
    expect(snapshot.customerSnapshot.leadId).toBe('lead_amrtech');
  });

  it('F5: Legacy-Angebot ohne Snapshot normalisiert fehlerfrei', () => {
    const legacy = normalizeOffer({
      ...createTestOffer(),
      commercialSnapshot: undefined,
      items: [],
    });
    expect(legacy.commercialSnapshot).toBeNull();
    expect(legacy.items).toEqual([]);
  });

  it('Realfall AMRtech UG – Offer aus Vergleich mit Items und Snapshot', async () => {
    const { service, offerRepository, tariffRepository } = createComparisonService();
    const session = await service.createSession(context);
    await service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 500_000,
        monthlyTransactions: 100,
        monthlyTotalCostsCents: 200_00,
        terminalCount: 1,
        preferredTermMonths: 24,
        paymentUsage: {
          stationary: true,
          mobile: true,
          ecommerce: false,
          softPos: false,
        },
        girocardPercent: 70,
        debitPercent: 10,
        creditPercent: 15,
        otherPercent: 5,
      },
      context,
    );

    const calculated = await service.calculate(session.id, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }
    expect(calculated.session.result?.variants.length).toBeGreaterThan(0);
    expect(calculated.session.selectedCandidateId).toBeTruthy();

    const assigned = await service.assignLead(session.id, 'lead_001', context);
    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.session.selectedCandidateId).toBeTruthy();
    }

    const created = await service.createOfferFromComparison(session.id, context, {
      creationToken: 'phase3_amrtech',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const offer = await offerRepository.getById(created.offerId);
    expect(offer).toBeTruthy();
    expect(offer!.items.length).toBeGreaterThan(0);
    expect(isFrozenCommercialSnapshot(offer!.commercialSnapshot)).toBe(true);
    expect(offer!.commercialSnapshot!.identity.contractTermMonths).toBeGreaterThan(0);
    expect(offer!.commercialSnapshot!.projection.isComplete).toBe(true);
    expect(offer!.offerNumber).toBeTruthy();
    expect(offer!.customerSnapshot.companyName.length).toBeGreaterThan(0);

    const frozenMonthlyTotal = offer!.commercialSnapshot!.projection.monthlyTotalCents;
    const originalRent = offer!.commercialSnapshot!.commercialConfig.monthlyTerminalRentalCents;

    const tariff = await tariffRepository.getById(classicTariff.id);
    expect(tariff).toBeTruthy();
    if (tariff) {
      await tariffRepository.update({
        ...tariff,
        monthlyTerminalRentalCents: originalRent + 50_00,
      });
    }

    const reloaded = await offerRepository.getById(created.offerId);
    expect(reloaded!.commercialSnapshot!.commercialConfig.monthlyTerminalRentalCents).toBe(originalRent);
    expect(reloaded!.commercialSnapshot!.projection.monthlyTotalCents).toBe(frozenMonthlyTotal);
  });

  it('createOfferFromComparison bleibt idempotent', async () => {
    const { service } = createComparisonService();
    const session = await service.createSession(context);
    await service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 500_000,
        monthlyTransactions: 100,
        monthlyTotalCostsCents: 200_00,
        terminalCount: 1,
      },
      context,
    );
    await service.calculate(session.id, context);
    await service.assignLead(session.id, 'lead_001', context);

    const first = await service.createOfferFromComparison(session.id, context, {
      creationToken: 'idem_phase3',
    });
    const second = await service.createOfferFromComparison(session.id, context, {
      creationToken: 'idem_phase3',
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.offerId).toBe(first.offerId);
    }
  });
});
