import { beforeEach, describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import {
  filterAndSortBestPayComparisons,
  resolveBestPayComparisonTitle,
  toBestPayComparisonSummary,
} from '../domain/bestPayComparison/bestPayComparisonSummary';
import {
  CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION,
  migrateBestPayComparisonStorageIfNeeded,
  readBestPayComparisonStore,
  saveBestPayComparisonSession,
} from '../services/bestPayComparisonStorageMigration';
import { BestPayComparisonService } from '../services/bestPayComparisonService';
import { BillingImportService } from '../services/billingImportService';
import { RecommendationService } from '../services/recommendationService';
import { OfferService } from '../services/offerService';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';

function createService() {
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
  return new BestPayComparisonService(
    billingImportService,
    recommendationService,
    offerService,
    leadRepository,
    offerRepository,
  );
}

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('A11.5 BestPayComparison History', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('migriert A11.4-Einzelsessions in den Mehrfachstore', () => {
    localStorage.clear();
    writeStorageItem(STORAGE_KEYS.bestPayComparisonStorageVersion, 1);
    const legacy = createBestPayComparisonSession('user_001', {
      schemaVersion: 1,
      title: null,
      offerId: 'offer_legacy',
      leadId: 'lead_001',
      customerLabel: 'Café Test',
      result: {
        recommendationRecordId: 'rec_1',
        recommendationVersion: 1,
        primaryCandidateId: 'c1',
        variants: [
          {
            candidateId: 'c1',
            tariffId: 't1',
            tariffName: 'BestPay Classic',
            productId: null,
            productName: null,
            termMonths: 36,
            monthlyTotalCostsCents: 100_00,
            annualTotalCostsCents: 1200_00,
            oneTimeCostsCents: 0,
            savingsMonthlyCents: 50_00,
            savingsAnnualCents: 600_00,
            savingsPercent: 33.3,
            isHigherCost: false,
            commissionTotalCents: 300_00,
            score: 90,
            rank: 1,
            primaryReasons: ['Passend'],
          },
        ],
        currentMonthlyCostsCents: 150_00,
        currentAnnualCostsCents: 1800_00,
        inputFingerprint: 'fp',
        calculatedAt: '2026-07-01T10:00:00.000Z',
        stale: true,
        staleReasons: ['Tarifversion geändert'],
      },
    } as never);

    writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, [legacy]);
    migrateBestPayComparisonStorageIfNeeded();

    const store = readBestPayComparisonStore();
    expect(readStorageItem(STORAGE_KEYS.bestPayComparisonStorageVersion)).toBe(
      CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION,
    );
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]?.id).toBe(legacy.id);
    expect(store.sessions[0]?.offerId).toBe('offer_legacy');
    expect(store.sessions[0]?.leadId).toBe('lead_001');
    expect(store.sessions[0]?.result?.stale).toBe(true);
    expect(store.sessions[0]?.schemaVersion).toBe(3);
    expect(store.sessions[0]?.title).toContain('Café Test');
  });

  it('isoliert beschädigte Sessions und behält gültige', () => {
    localStorage.clear();
    writeStorageItem(STORAGE_KEYS.bestPayComparisonStorageVersion, 1);
    writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, [
      { broken: true },
      createBestPayComparisonSession('user_001', { customerLabel: 'Gültig GmbH' }),
    ]);
    migrateBestPayComparisonStorageIfNeeded();
    const store = readBestPayComparisonStore();
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]?.customerLabel).toBe('Gültig GmbH');
  });

  it('filtert, sucht und sortiert Summaries', () => {
    const older = createBestPayComparisonSession('user_001', {
      id: 's_old',
      customerLabel: 'Alpha Markt',
      updatedAt: '2026-07-01T10:00:00.000Z',
      createdAt: '2026-07-01T09:00:00.000Z',
      status: 'draft',
    });
    const newer = createBestPayComparisonSession('user_001', {
      id: 's_new',
      customerLabel: 'Beta Laden',
      offerNumber: 'ANG-2026-0009',
      offerTitle: 'BestPay Angebot Beta',
      updatedAt: '2026-07-20T10:00:00.000Z',
      createdAt: '2026-07-19T09:00:00.000Z',
      status: 'calculated',
      result: {
        recommendationRecordId: 'r1',
        recommendationVersion: 1,
        primaryCandidateId: 'c1',
        variants: [
          {
            candidateId: 'c1',
            tariffId: 't1',
            tariffName: 'BestPay Variable',
            productId: null,
            productName: null,
            termMonths: 36,
            monthlyTotalCostsCents: 80_00,
            annualTotalCostsCents: 960_00,
            oneTimeCostsCents: 0,
            savingsMonthlyCents: 40_00,
            savingsAnnualCents: 480_00,
            savingsPercent: 33.3,
            isHigherCost: false,
            commissionTotalCents: null,
            score: 88,
            rank: 1,
            primaryReasons: [],
          },
        ],
        currentMonthlyCostsCents: 120_00,
        currentAnnualCostsCents: 1440_00,
        inputFingerprint: 'x',
        calculatedAt: '2026-07-20T10:00:00.000Z',
        stale: false,
        staleReasons: [],
      },
      selectedCandidateId: 'c1',
    });
    const archived = createBestPayComparisonSession('user_001', {
      id: 's_arch',
      customerLabel: 'Archiv Laden',
      archivedAt: '2026-07-21T10:00:00.000Z',
      updatedAt: '2026-07-21T10:00:00.000Z',
      status: 'calculated',
    });

    const defaultList = filterAndSortBestPayComparisons([older, newer, archived], {
      query: '',
      status: 'all',
      freshness: 'all',
      assignment: 'all',
      source: 'all',
      timeRange: 'all',
      sort: 'updated_desc',
      includeArchived: false,
    });
    expect(defaultList.map((entry) => entry.id)).toEqual(['s_new', 's_old']);

    const search = filterAndSortBestPayComparisons([older, newer, archived], {
      query: 'ang-2026-0009',
      status: 'all',
      freshness: 'all',
      assignment: 'all',
      source: 'all',
      timeRange: 'all',
      sort: 'updated_desc',
      includeArchived: false,
    });
    expect(search).toHaveLength(1);
    expect(search[0]?.id).toBe('s_new');

    const archivedOnly = filterAndSortBestPayComparisons([older, newer, archived], {
      query: '',
      status: 'archived',
      freshness: 'all',
      assignment: 'all',
      source: 'all',
      timeRange: 'all',
      sort: 'updated_desc',
      includeArchived: true,
    });
    expect(archivedOnly.map((entry) => entry.id)).toEqual(['s_arch']);

    const savingsSorted = filterAndSortBestPayComparisons([older, newer], {
      query: '',
      status: 'all',
      freshness: 'all',
      assignment: 'all',
      source: 'all',
      timeRange: 'all',
      sort: 'savings_desc',
      includeArchived: false,
    });
    expect(savingsSorted[0]?.id).toBe('s_new');
  });

  it('kennzeichnet Mehrkosten und unberechnete Sessions korrekt', () => {
    const draft = toBestPayComparisonSummary(createBestPayComparisonSession('user_001'));
    expect(draft.hasResult).toBe(false);
    expect(draft.savingsMonthlyCents).toBeNull();

    const costly = createBestPayComparisonSession('user_001', {
      status: 'calculated',
      selectedCandidateId: 'c1',
      result: {
        recommendationRecordId: 'r',
        recommendationVersion: 1,
        primaryCandidateId: 'c1',
        variants: [
          {
            candidateId: 'c1',
            tariffId: 't',
            tariffName: 'Classic',
            productId: null,
            productName: null,
            termMonths: 36,
            monthlyTotalCostsCents: 300_00,
            annualTotalCostsCents: 3600_00,
            oneTimeCostsCents: 0,
            savingsMonthlyCents: -50_00,
            savingsAnnualCents: -600_00,
            savingsPercent: -20,
            isHigherCost: true,
            commissionTotalCents: null,
            score: 70,
            rank: 1,
            primaryReasons: [],
          },
        ],
        currentMonthlyCostsCents: 250_00,
        currentAnnualCostsCents: 3000_00,
        inputFingerprint: 'f',
        calculatedAt: '2026-07-01T00:00:00.000Z',
        stale: false,
        staleReasons: [],
      },
    });
    expect(toBestPayComparisonSummary(costly).isHigherCost).toBe(true);
  });

  it('dupliziert, archiviert, stellt wieder her und löscht Entwürfe', () => {
    const service = createService();
    const original = service.createSession(context);
    service.updateManualInput(
      original.id,
      { monthlyCardVolumeCents: 5_000_000, monthlyTotalCostsCents: 200_00, terminalCount: 2 },
      context,
    );
    saveBestPayComparisonSession({
      ...service.getSession(original.id, context)!,
      offerId: null,
      status: 'ready_for_calculation',
    });

    const duplicated = service.duplicateComparison(original.id, context);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) {
      return;
    }
    expect(duplicated.session.id).not.toBe(original.id);
    expect(duplicated.session.title).toContain('Kopie');
    expect(duplicated.session.offerId).toBeNull();
    expect(duplicated.session.offerCreationToken).toBeNull();
    expect(duplicated.session.result).toBeNull();
    expect(duplicated.session.duplicateOfSessionId).toBe(original.id);

    const again = service.duplicateComparison(original.id, context);
    // second call allowed sequentially; in-flight only blocks concurrent
    expect(again.ok).toBe(true);

    const archived = service.archiveComparison(original.id, context);
    expect(archived.ok).toBe(true);
    if (!archived.ok) {
      return;
    }
    expect(archived.session.archivedAt).toBeTruthy();
    const list = service.listComparisons(context);
    expect(list?.some((entry) => entry.id === original.id)).toBe(false);

    const restored = service.restoreComparison(original.id, context);
    expect(restored.ok).toBe(true);
    expect(restored.ok && restored.session.archivedAt).toBeNull();

    const deletable = service.createSession(context);
    const deleted = service.deleteDraftComparison(deletable.id, context);
    expect(deleted.ok).toBe(true);
    expect(service.getSession(deletable.id, context)).toBeNull();
  });

  it('schützt angebotsverknüpfte Sessions vor Löschen', async () => {
    const service = createService();
    const session = service.createSession(context);
    service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
      },
      context,
    );
    const calculated = await service.calculate(session.id, context);
    expect(calculated.ok).toBe(true);
    await service.assignLead(session.id, 'lead_001', context);
    const offer = await service.createOfferFromComparison(session.id, context);
    expect(offer.ok).toBe(true);

    const deleted = service.deleteDraftComparison(session.id, context);
    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error).toBe('not_deletable');
    }
  });

  it('nimmt Session mit gleicher ID wieder auf', () => {
    const service = createService();
    const created = service.createSession(context);
    const resumed = service.resumeComparison(created.id, context);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }
    expect(resumed.session.id).toBe(created.id);
    expect(resumed.session.lastOpenedAt).toBeTruthy();
    expect(resolveBestPayComparisonTitle(resumed.session)).toBeTruthy();
  });
});
