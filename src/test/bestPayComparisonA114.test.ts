import { beforeEach, describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { buildCustomerNeedForComparison } from '../domain/bestPayComparison/buildCustomerNeedForComparison';
import { DEFAULT_BESTPAY_MANUAL_INPUT } from '../domain/bestPayComparison/bestPayComparisonSession';
import {
  resolveCurrentMonthlyCosts,
  summarizePrimaryCandidate,
} from '../domain/bestPayComparison/comparisonSummary';
import { migrateBestPayComparisonStorageIfNeeded } from '../services/bestPayComparisonStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import type { BestPaySolutionCandidate } from '../domain/recommendation/bestPaySolutionCandidate';
import { createEmptyCostProjection } from '../domain/recommendation/customerCostProjection';

describe('A11.4 BestPayComparison Domain', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('erzeugt versionierte Sessions', () => {
    const session = createBestPayComparisonSession('user_1');
    expect(session.schemaVersion).toBe(2);
    expect(session.status).toBe('draft');
    expect(session.offerId).toBeNull();
  });

  it('baut CustomerNeed aus manueller Eingabe', () => {
    const need = buildCustomerNeedForComparison({
      manualInput: {
        ...DEFAULT_BESTPAY_MANUAL_INPUT,
        monthlyCardVolumeCents: 100_000_00,
        monthlyTransactions: 1000,
        monthlyTotalCostsCents: 250_00,
        terminalCount: 2,
        paymentUsage: {
          stationary: true,
          mobile: false,
          ecommerce: false,
          softPos: false,
        },
      },
      baseline: null,
      salesRepresentativeId: 'user_1',
      leadId: null,
    });
    expect(need.monthlyCardVolumeCents).toBe(100_000_00);
    expect(need.terminalCount).toBe(2);
    expect(need.offerId).toBeNull();
  });

  it('kennzeichnet Mehrkosten klar', () => {
    const candidate: BestPaySolutionCandidate = {
      candidateId: 'cand_1',
      candidateCode: 'C1',
      contractTypeId: null,
      tariffId: 'tariff_1',
      tariffName: 'BestPay Classic',
      tariffProductCode: 'BP',
      terminalType: 'mobile',
      hardwareProductIds: [],
      hardwareProductNames: [],
      accessoryItems: [],
      contractTermId: null,
      contractTermMonths: 36,
      isStandardTerm: true,
      quantity: 1,
      priceBookVersionId: null,
      pricingEvaluation: null,
      commissionPreview: null,
      costProjection: {
        ...createEmptyCostProjection('EUR', 36, 'contract_term'),
        averageMonthlyCostsCents: 300_00,
        oneTimeCostsCents: 0,
      },
      fulfilledRequirements: [],
      unfulfilledRequirements: [],
      hints: [],
      warnings: [],
      exclusionReasons: [],
      status: 'eligible',
      rank: 1,
    };
    const summary = summarizePrimaryCandidate(candidate, 80, 200_00, []);
    expect(summary.isHigherCost).toBe(true);
    expect(summary.savingsMonthlyCents).toBe(-100_00);
  });

  it('persistiert Sessions versioniert', () => {
    migrateBestPayComparisonStorageIfNeeded();
    migrateBestPayComparisonStorageIfNeeded();
    expect(readStorageItem(STORAGE_KEYS.bestPayComparisonSessions)).toEqual({
      activeSessionId: null,
      sessions: [],
    });
    expect(readStorageItem(STORAGE_KEYS.bestPayComparisonStorageVersion)).toBe(2);
    writeStorageItem(STORAGE_KEYS.bestPayComparisonStorageVersion, 1);
    writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, [
      createBestPayComparisonSession('user_1'),
    ]);
    migrateBestPayComparisonStorageIfNeeded();
    const store = readStorageItem<{ sessions: unknown[] }>(STORAGE_KEYS.bestPayComparisonSessions);
    expect(store?.sessions).toHaveLength(1);
  });

  it('nutzt bestätigte Baseline für Ist-Kosten', () => {
    const monthly = resolveCurrentMonthlyCosts(
      {
        status: 'confirmed',
        avgMonthlyTotalCostsCents: 275_00,
      } as never,
      100_00,
    );
    expect(monthly).toBe(275_00);
  });
});
