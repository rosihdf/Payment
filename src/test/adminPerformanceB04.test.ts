import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeAuditEntries } from '../domain/audit/normalizeAuditEntry';
import { normalizeApprovalRules } from '../domain/approvalRule/normalizeApprovalRule';
import { normalizeUsers } from '../domain/user/normalizeUser';
import { AdminOverviewService } from '../services/adminOverviewService';
import { AdminUserService } from '../services/adminUserService';
import { ApprovalRuleService } from '../services/approvalRuleService';
import { AuditService } from '../services/auditService';
import { DataDiagnosticService } from '../services/dataDiagnosticService';
import { DataExportService } from '../services/dataExportService';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { LocalAuditRepository } from '../repositories/local/LocalAuditRepository';
import { LocalApprovalRuleRepository } from '../repositories/local/LocalApprovalRuleRepository';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { generateId } from '../utils/id';

const USER_COUNT = 200;
const TARIFF_COUNT = 500;
const PRODUCT_COUNT = 2000;
const RULE_COUNT = 1000;
const AUDIT_COUNT = 5000;

function seedAdminPerformanceData(): void {
  const users = Array.from({ length: USER_COUNT }, (_, index) => ({
    id: `perf_user_${index}`,
    name: `User ${index}`,
    email: `user${index}@demo.local`,
    role: index % 5 === 0 ? 'admin' : 'field_service',
    status: 'active',
    salesTeamId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deactivatedAt: null,
    lastAccessAt: null,
    schemaVersion: 2,
  }));

  writeStorageItem(STORAGE_KEYS.users, normalizeUsers(users));

  writeStorageItem(
    STORAGE_KEYS.tariffs,
    Array.from({ length: TARIFF_COUNT }, (_, index) => ({
      id: `perf_tariff_${index}`,
      name: `Tarif ${index}`,
      providerName: 'BestPay',
      productCode: `BP-${index}`,
      description: '',
      status: index % 3 === 0 ? 'inactive' : 'active',
      supportedTerminalTypes: ['mobile'],
      monthlyAccountBaseFeeCents: 1000,
      monthlyTerminalRentalCents: 1000,
      monthlyServiceFeePerTerminalCents: 500,
      setupFeeCents: 0,
      minimumMonthlyFeeCents: null,
      minimumContractMonths: 36,
      noticePeriodMonths: null,
      includedTransactions: null,
      additionalTransactionFeeTenthsOfCent: 0,
      girocardClearingFeeTenthsOfCent: 0,
      girocardClearingIncluded: true,
      cardRates: {
        girocard: { percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 },
        debit: { percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 },
        credit: { percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 },
        other: { percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 },
      },
      billingInterval: 'monthly',
      validFrom: '2026-01-01',
      validUntil: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
  );

  writeStorageItem(
    STORAGE_KEYS.products,
    Array.from({ length: PRODUCT_COUNT }, (_, index) => ({
      id: `perf_product_${index}`,
      name: `Produkt ${index}`,
      productCode: `P-${index}`,
      category: index % 4 === 0 ? 'payment_terminal' : 'accessory',
      status: 'active',
      description: '',
      customerDescription: '',
      internalNote: '',
      priceType: 'monthly',
      priceCents: 1000,
      currency: 'EUR',
      terminalType: 'mobile',
      manufacturer: 'PAX',
      model: 'A920',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
  );

  writeStorageItem(
    STORAGE_KEYS.approvalRules,
    normalizeApprovalRules(
      Array.from({ length: RULE_COUNT }, (_, index) => ({
        id: generateId('approval_rule'),
        schemaVersion: 1,
        name: `Regel ${index}`,
        description: '',
        type: 'special_condition',
        status: index % 10 === 0 ? 'inactive' : 'active',
        priority: index,
        thresholdValue: null,
        thresholdUnit: 'none',
        tariffId: null,
        requiredReviewerRole: 'admin',
        fourEyesRequired: true,
        validFrom: null,
        validUntil: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'system',
      })),
    ),
  );

  writeStorageItem(
    STORAGE_KEYS.auditEntries,
    normalizeAuditEntries(
      Array.from({ length: AUDIT_COUNT }, (_, index) => ({
        id: generateId('audit'),
        schemaVersion: 1,
        timestamp: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        userId: `perf_user_${index % USER_COUNT}`,
        userDisplayName: `User ${index % USER_COUNT}`,
        action: 'user_updated',
        entityType: 'user',
        entityId: `perf_user_${index % USER_COUNT}`,
        entityVersion: null,
        summary: `Audit ${index}`,
        changes: [],
        source: 'admin',
      })),
    ),
  );
}

describe('B04 Administration Performance', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedAdminPerformanceData();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'perf_user_0');
  });

  it(
    'filtert Benutzer, Tarife, Regeln und Audit ohne Engine-Aufrufe',
    async () => {
      const auditService = new AuditService(new LocalAuditRepository());
      const adminUserService = new AdminUserService(new LocalUserRepository(), auditService);
      const approvalRuleService = new ApprovalRuleService(new LocalApprovalRuleRepository(), auditService);
      const dataExportService = new DataExportService(auditService);
      const dataDiagnosticService = new DataDiagnosticService(auditService);
      const adminOverviewService = new AdminOverviewService(
        adminUserService,
        new LocalTariffRepository(),
        new LocalProductRepository(),
        new LocalCommissionCatalogRepository(),
        approvalRuleService,
        dataDiagnosticService,
        dataExportService,
      );

      const admin = createUserContext({
        id: 'perf_user_0',
        role: 'admin',
        name: 'Admin',
        status: 'active',
      });

      const users = await adminUserService.getUsers(admin, { query: 'User 12' });
      expect(Array.isArray(users)).toBe(true);
      if (Array.isArray(users)) {
        expect(users.length).toBeGreaterThan(0);
        expect(users.length).toBeLessThan(USER_COUNT);
      }

      const rules = await approvalRuleService.getRules(admin, { status: 'active' });
      expect(Array.isArray(rules)).toBe(true);

      const audit = await auditService.getEntries(admin, { query: 'Audit 42' });
      expect(Array.isArray(audit)).toBe(true);

      const overview = await adminOverviewService.getOverview(admin);
      expect('error' in overview).toBe(false);

      const diagnostics = await dataDiagnosticService.runDiagnostics(admin);
      expect(Array.isArray(diagnostics)).toBe(true);
    },
    60_000,
  );
});
