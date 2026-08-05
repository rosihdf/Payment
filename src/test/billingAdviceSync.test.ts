import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';

const context = {
  userId: 'user_001',
  role: 'field_service' as const,
  displayName: 'Laura Berger',
};

describe('Billing-Import → Beratungssync', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('übernimmt Ist-Kosten und merkt Kartenumsatz nur im Bedarf vor', async () => {
    const services = createServices(createTestRepositories());
    const session = await services.bestPayComparisonService.createSession(context);
    const started = await services.bestPayComparisonService.startBillingImport(session.id, context);
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }

    await services.billingImportService.addManualPeriodToSession(
      started.billingSessionId,
      {
        periodFrom: '2026-01-01',
        periodTo: '2026-01-31',
        currency: 'EUR',
        cardVolumeCents: 12_345_67,
        transactionCount: 420,
        fixedCostsCents: 29_00,
        terminalCostsCents: 19_00,
        transactionCostsCents: 41_50,
        totalAmountCents: 89_50,
      },
      context,
    );

    const baseline = await services.billingImportService.confirmSessionBaseline(
      started.billingSessionId,
      context,
    );
    expect(baseline?.status).toBe('confirmed');
    expect(baseline?.avgMonthlyTotalCostsCents).toBe(89_50);

    const synced = await services.bestPayComparisonService.syncBaselineFromBilling(
      session.id,
      context,
      { replaceExistingManualValues: true },
    );

    expect(synced?.costBaselineId).toBe(baseline?.id);
    expect(synced?.wizard.costCaptureMode).toBe('billing_import');
    expect(synced?.manualInput.monthlyTotalCostsCents).toBe(89_50);
    // Bedarfsvorschlag – nicht als zweites Ausgangslage-Feld modelliert
    expect(synced?.manualInput.monthlyCardVolumeCents).toBe(12_345_67);
    expect(synced?.manualInput.monthlyTransactions).toBe(420);
  });

  it('überschreibt vorhandene manuelle Werte nicht ohne replace-Flag', async () => {
    const services = createServices(createTestRepositories());
    const session = await services.bestPayComparisonService.createSession(context);
    await services.bestPayComparisonService.updateManualInput(
      session.id,
      {
        monthlyTotalCostsCents: 120_00,
        monthlyCardVolumeCents: 5_000_00,
        monthlyTransactions: 100,
      },
      context,
    );

    const started = await services.bestPayComparisonService.startBillingImport(session.id, context);
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }

    await services.billingImportService.addManualPeriodToSession(
      started.billingSessionId,
      {
        periodFrom: '2026-02-01',
        periodTo: '2026-02-28',
        currency: 'EUR',
        cardVolumeCents: 9_999_00,
        transactionCount: 999,
        fixedCostsCents: 10_00,
        terminalCostsCents: 10_00,
        transactionCostsCents: 10_00,
        totalAmountCents: 30_00,
      },
      context,
    );
    await services.billingImportService.confirmSessionBaseline(started.billingSessionId, context);

    const synced = await services.bestPayComparisonService.syncBaselineFromBilling(
      session.id,
      context,
      { replaceExistingManualValues: false },
    );

    expect(synced?.manualInput.monthlyTotalCostsCents).toBe(120_00);
    expect(synced?.manualInput.monthlyCardVolumeCents).toBe(5_000_00);
    expect(synced?.manualInput.monthlyTransactions).toBe(100);
    expect(synced?.costBaselineId).toBeTruthy();
  });
});
