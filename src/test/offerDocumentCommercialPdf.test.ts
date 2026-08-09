import { beforeEach, describe, expect, it } from 'vitest';
import { buildCommercialConfig } from '../domain/commercial/commercialConfig';
import { buildCommercialSelectionHandoff } from '../domain/commercial/commercialHandoff';
import { calculateCommercialProjection } from '../domain/commercial/calculateCommercialProjection';
import { buildOfferCommercialSnapshot } from '../domain/offer/buildOfferCommercialSnapshot';
import { createOfferDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import {
  buildOfferDocumentCommercialSnapshot,
  resolveOfferDocumentCommercialSnapshot,
} from '../domain/offerDocument/offerDocumentCommercialSnapshot';
import { evaluateFinalDocumentGate } from '../domain/offerDocument/finalDocumentGate';
import { isFrozenCommercialSnapshot } from '../domain/offer/offerCommercialSnapshot';
import { createEmptyCustomerSnapshot, createTariffSnapshotFromTariff } from '../domain/offer/offerSnapshots';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import type { BestPaySolutionCandidate } from '../domain/recommendation/bestPaySolutionCandidate';
import { evaluateOfferPublicationReadiness } from '../domain/offer/offerPublicationReadiness';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import { renderOfferPdf } from '../services/offerPdfRenderer';
import { createTestOffer } from './helpers/offerTestHelpers';
import {
  createOfferServicesForTests,
  FIELD_SERVICE_CONTEXT,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';
import { generateId } from '../utils/id';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';

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

function buildTestCommercialSnapshot(deploymentMode: 'stationary_wifi' | 'mobile_sim' = 'stationary_wifi') {
  const need = createTestCustomerNeed({
    terminalCount: 1,
    monthlyCardVolumeCents: 500_000,
    monthlyTransactions: 100,
    paymentUsage: {
      stationary: deploymentMode === 'stationary_wifi',
      mobile: deploymentMode === 'mobile_sim',
      ecommerce: false,
      softPos: false,
    },
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
  const configWithMode = { ...config, deploymentMode };
  const projection = calculateCommercialProjection(need, configWithMode);
  const handoff = buildCommercialSelectionHandoff({
    commercialConfig: configWithMode,
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

function createFrozenOffer(deploymentMode: 'stationary_wifi' | 'mobile_sim' = 'stationary_wifi') {
  const commercialSnapshot = buildTestCommercialSnapshot(deploymentMode);

  return createTestOffer({
    title: 'Commercial PDF Test',
    workflowStatus: 'ready_to_send',
    status: 'draft',
    customerSnapshot: commercialSnapshot.customerSnapshot,
    commercialSnapshot,
    tariffSnapshot: createTariffSnapshotFromTariff(classicTariff),
  });
}

describe('Phase 4C – PDF commercial snapshot', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('P1: frozen offer embeds commercial snapshot in document snapshot', async () => {
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    expect(snapshot.commercial).not.toBeNull();
    expect(snapshot.schemaVersion).toBe(2);
    expect(isFrozenCommercialSnapshot(offer.commercialSnapshot)).toBe(true);
    expect(snapshot.commercial?.tariffName).toBe(classicTariff.name);
  });

  it('P2: catalog change does not alter stored document snapshot', async () => {
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });
    const originalRent = snapshot.commercial!.breakdown.monthlyTerminalRentalCents;

    classicTariff.monthlyTerminalRentalCents = 99_999;
    expect(snapshot.commercial!.breakdown.monthlyTerminalRentalCents).toBe(originalRent);
  });

  it('P3: customer change on offer does not alter stored document customer', async () => {
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    offer.customerSnapshot.companyName = 'Neuer Kunde AG';
    expect(snapshot.customer.companyName).toBe('AMRtech UG');
  });

  it('P4: publication gate blocks draft without approval', () => {
    const draft = createTestOffer({ workflowStatus: 'draft' });
    const errors = evaluateFinalDocumentGate(draft, null, 'create');
    expect(errors.status).toBeTruthy();
  });

  it('P4b: publication gate allows legacy completed offers', () => {
    const legacy = createTestOffer({ status: 'completed', workflowStatus: 'accepted' });
    expect(evaluateFinalDocumentGate(legacy, null, 'create')).toEqual({});
  });

  it('P5: preview validation allows draft', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const repository = new LocalOfferRepository();
    const offer = await repository.create(createFrozenOffer());
    const result = await offerDocumentService.createPreviewSnapshot(offer.id, FIELD_SERVICE_CONTEXT);
    expect(result.ok).toBe(true);
  });

  it('P8: deployment mode appears in PDF text', async () => {
    const wifiOffer = createFrozenOffer('stationary_wifi');
    const simOffer = createFrozenOffer('mobile_sim');
    const wifiDoc = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer: wifiOffer,
      offerVersionId: 'ver_wifi',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });
    const simDoc = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer: simOffer,
      offerVersionId: 'ver_sim',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const wifiText = new TextDecoder('latin1').decode(renderOfferPdf(wifiDoc, { isPreview: false }));
    const simText = new TextDecoder('latin1').decode(renderOfferPdf(simDoc, { isPreview: false }));
    expect(wifiText).toContain('Kunden-WLAN');
    expect(simText).toContain('SIM');
  });

  it('P9: projection section appears in commercial PDF', async () => {
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });
    const text = new TextDecoder('latin1').decode(renderOfferPdf(snapshot, { isPreview: false }));
    expect(text).toContain('Kostenprognose');
    expect(text).toContain('Transaktionen');
  });

  it('P10: commission data is not rendered in customer PDF', async () => {
    const commercial = buildTestCommercialSnapshot();
    expect(commercial.commission).toBeNull();
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });
    const text = new TextDecoder('latin1').decode(renderOfferPdf(snapshot, { isPreview: false }));
    expect(text).not.toMatch(/commission|Provision/i);
  });

  it('P7: manipulated snapshot fails integrity check', async () => {
    const offer = createFrozenOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      offerVersionId: 'ver_test',
      generatedAt: new Date().toISOString(),
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const { computeOfferDocumentContentHash } = await import('../domain/offerDocument/offerDocumentHash');
    const tampered = { ...snapshot, title: 'Manipuliert' };
    const { contentHash, ...withoutHash } = tampered;
    const actualHash = await computeOfferDocumentContentHash(withoutHash);
    expect(actualHash).not.toBe(contentHash);
    expect(contentHash.length).toBe(64);
  });
});

describe('Phase 4C – final document gate with readiness', () => {
  it('blocks ready_to_send without publication readiness', () => {
    const offer = createFrozenOffer();
    offer.workflowStatus = 'ready_to_send';
    const version = {
      id: 'ver_1',
      offerId: offer.id,
      versionNumber: 1,
      workflowStatus: 'ready_to_send' as const,
      snapshot: buildOfferVersionSnapshot(offer, undefined, 1),
      createdAt: offer.createdAt,
      createdByUserId: offer.createdByUserId,
      createdByDisplayName: offer.createdByDisplayName,
      approvedAt: null,
      approvedByUserId: null,
      sentAt: null,
      acceptedAt: null,
      declinedAt: null,
      activatedAt: null,
      supersededAt: null,
    };
    const readiness = evaluateOfferPublicationReadiness({
      offer: { ...offer, currentVersionId: version.id },
      version,
      approvalRequired: false,
      hasApprovalForVersion: true,
      hasCounselingConfirmation: false,
      pricingStale: false,
      recommendationStale: false,
    });
    const errors = evaluateFinalDocumentGate(
      { ...offer, currentVersionId: version.id },
      readiness,
      'create',
    );
    expect(errors.publication).toBeTruthy();
  });
});

describe('offerDocumentCommercialSnapshot builder', () => {
  it('includes flat markup disclosures for FLAT tariff code', () => {
    const commercial = buildTestCommercialSnapshot();
    commercial.commercialConfig.tariffProductCode = 'BP-A920-FLAT';
    const docCommercial = buildOfferDocumentCommercialSnapshot(commercial);
    expect(docCommercial.flatMarkupDisclosures.length).toBeGreaterThan(0);
  });

  it('returns null for legacy unfrozen offers', () => {
    expect(resolveOfferDocumentCommercialSnapshot(null)).toBeNull();
  });
});
