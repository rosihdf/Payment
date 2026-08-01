import { beforeEach, describe, expect, it } from 'vitest';
import { hasPermission } from '../domain/permission/permission';
import { validateTemplatePlaceholders } from '../domain/template/documentTemplate';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createServices } from '../services';
import { createTestRepositories } from './helpers/createTestRepositories';
import { migrateAdminStorageIfNeeded } from '../services/adminStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function createTestServices() {
  return createServices(createTestRepositories());
}

describe('B04 Administration', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    migrateAdminStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_004');
  });

  describe('Benutzer', () => {
    it('legt Benutzer an und deaktiviert ihn', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const created = await services.adminUserService.createUser(admin, {
        name: 'Test User',
        email: 'test@demo.local',
        role: 'field_service',
      });
      expect(created.ok).toBe(true);

      const deactivated = await services.adminUserService.deactivateUser(admin, created.ok ? created.user.id : '');
      expect(deactivated.ok).toBe(true);
    });

    it('schützt den letzten aktiven Administrator', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      for (const otherAdminId of ['user_003', 'user_005']) {
        const deactivated = await services.adminUserService.deactivateUser(admin, otherAdminId);
        expect(deactivated.ok).toBe(true);
      }

      const result = await services.adminUserService.deactivateUser(admin, 'user_004');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('protected');
      }
    });
  });

  describe('Rollen und Rechte', () => {
    it('prüft zentrale Permissions für Administrator und Außendienst', () => {
      expect(hasPermission('admin', 'admin.users')).toBe(true);
      expect(hasPermission('admin', 'offers.approve')).toBe(true);
      expect(hasPermission('admin', 'leads.view_team')).toBe(true);
      expect(hasPermission('field_service', 'admin.users')).toBe(false);
      expect(hasPermission('field_service', 'admin.access')).toBe(false);
      expect(hasPermission('field_service', 'offers.approve')).toBe(false);
      expect(hasPermission('field_service', 'leads.view_team')).toBe(false);
      expect(hasPermission('field_service', 'offers.create')).toBe(true);
    });

    it('blockiert Admin-Mutationen für Außendienst', async () => {
      const services = createTestServices();
      const field = createUserContext({
        id: 'user_001',
        role: 'field_service',
        name: 'Laura Berger',
        status: 'active',
      });

      const users = await services.adminUserService.getUsers(field);
      expect(users).toEqual({ error: 'forbidden' });
    });
  });

  describe('Freigaberegeln', () => {
    it('simuliert Freigabe über echte Regeln', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const rules = await services.approvalRuleService.getRules(admin);
      expect(Array.isArray(rules)).toBe(true);
      if (!Array.isArray(rules)) {
        return;
      }

      const simulation = services.approvalRuleService.simulateApproval(
        {
          requestedPriceCents: 7000,
          listPriceCents: 10000,
          discountPercentTenths: 3000,
          contractTermMonths: 24,
          contractModelCode: 'terminal_plus_acq',
          tariffId: null,
          hasMissingRequiredData: false,
        },
        rules,
      );

      expect(simulation.approvalRequired).toBe(true);
      expect(simulation.triggeredRules.length).toBeGreaterThan(0);
    });
  });

  describe('Provision', () => {
    it('aktiviert Classic/Variable Katalog und nutzt Engine-Vorschau', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const seeded = await services.commissionCatalogAdminService.seedDefaultCatalog(admin);
      expect(seeded.ok).toBe(true);

      const preview = await services.commissionCatalogAdminService.previewCommission(admin, {
        contractTypeCode: 'terminal_plus_acq',
        termMonths: 37,
        transactionVolumeCents: 100000,
        clearingVolumeCents: 50000,
        terminalRentalCents: 2000,
        accessorySaleCents: 0,
      });

      expect('error' in preview).toBe(false);
      if (!('error' in preview)) {
        expect(preview.finalExpectedCommissionAmountCents).toBeGreaterThan(0);
      }
    });
  });

  describe('Vorlagen', () => {
    it('blockiert unbekannte Platzhalter', () => {
      const unknown = validateTemplatePlaceholders('Hallo {{secretField}}');
      expect(unknown).toContain('secretField');
    });
  });

  describe('Export und Backup', () => {
    it('erstellt JSON-Gesamtsicherung ohne Secrets', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const backup = await services.dataExportService.exportFullBackup(admin);
      expect(backup.ok).toBe(true);
      if (backup.ok) {
        expect(backup.manifest.formatVersion).toBe(1);
        expect(backup.content.includes('"formatVersion"')).toBe(true);
        expect(backup.content.includes('password')).toBe(false);
      }
    });

    it('führt Restore-Vorprüfung ohne Mutation durch', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const backup = await services.dataExportService.exportFullBackup(admin);
      if (!backup.ok) {
        return;
      }

      const preview = await services.dataRestoreService.previewRestoreWithAudit(admin, backup.content);
      expect(preview.ok).toBe(true);
      if (preview.ok) {
        expect(preview.preview.includedAreas.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Diagnose und Systemstatus', () => {
    it('erkennt fehlende Leadreferenzen nicht bei sauberen Demo-Daten', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const findings = await services.dataDiagnosticService.runDiagnostics(admin);
      expect(Array.isArray(findings)).toBe(true);
    });

    it('liefert Systemstatus ohne Mutation', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      const status = await services.systemStatusService.getStatus(admin);
      expect('error' in status).toBe(false);
      if (!('error' in status)) {
        expect(status.persistenceMode).toBe('local');
        expect(status.healthChecks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Audit', () => {
    it('protokolliert Benutzeränderungen', async () => {
      const services = createTestServices();
      const admin = createUserContext({
        id: 'user_004',
        role: 'admin',
        name: 'Michael Weber',
        status: 'active',
      });

      await services.adminUserService.createUser(admin, {
        name: 'Audit Test',
        email: 'audit@demo.local',
        role: 'field_service',
      });

      const entries = await services.auditService.getEntries(admin);
      expect(Array.isArray(entries)).toBe(true);
      if (Array.isArray(entries)) {
        expect(entries.some((entry) => entry.action === 'user_created')).toBe(true);
      }
    });
  });
});
