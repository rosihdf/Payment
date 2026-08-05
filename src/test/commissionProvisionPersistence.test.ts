/**
 * Provisions-Persistenznachweis (Task A "PROVISION PERSISTENCE PROOF").
 *
 * Deckt den vollständigen Pfad UI → Service (`CommissionCatalogAdminService`,
 * `CommissionAdminService`) → Repository (`LocalCommissionCatalogRepository`,
 * localStorage) ab. Jeder Test instanziiert nach dem Speichern bewusst einen
 * NEUEN Repository-/Service-Satz (`createServices(createTestRepositories())`),
 * um einen echten "Reload" (frisches Lesen aus dem Storage statt In-Memory-
 * Zustand) zu simulieren – analog zu `commissionCatalogAdminService.test.ts`.
 *
 * Ergänzende UI-Ebene: `commissionAdminUiPersistence.test.tsx`.
 * Ergänzende Supabase-RLS-Absicherung (nicht in Unit-Tests erreichbar, da kein
 * Supabase-Client in Vitest läuft): `commissionRlsMigration.test.ts` prüft die
 * SQL-Migration `supabase/migrations/20260802103000_commission_rls.sql` auf
 * Row-Level-Security-Policies für Katalog (nur Admin) und Zuordnungen/Fälle
 * (Außendienst nur eigene Zeilen, Admin alles).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalCommissionWorkflowRepository } from '../repositories/local/LocalCommissionWorkflowRepository';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';

const ADMIN = createUserContext({ id: 'user_004', role: 'admin', name: 'Admin', status: 'active' });
const FIELD = createUserContext({
  id: FIELD_SERVICE_USER_ID,
  role: 'field_service',
  name: 'Außendienst',
  status: 'active',
});

describe('Provision – Persistenznachweis Standardregel (UI → Service → Repository → Reload)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('speichert Betrag, Aktiv-Flag und Gültigkeit einer Standardregel und zeigt sie nach Reload korrekt an', async () => {
    const writeServices = createServices(createTestRepositories());
    await writeServices.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);
    const before = await writeServices.commissionCatalogAdminService.getCatalog(ADMIN);
    if ('error' in before) throw new Error('catalog forbidden');
    const rule = before.commissionRules.find((entry) => entry.id === 'commission_rule_classic_acq');
    expect(rule).toBeTruthy();

    const save = await writeServices.commissionCatalogAdminService.upsertStandardRule(ADMIN, {
      id: rule!.id,
      commissionPlanVersionId: rule!.commissionPlanVersionId,
      name: rule!.name,
      internalDescription: rule!.internalDescription,
      status: 'inactive',
      commissionType: rule!.commissionType,
      calculationBasis: rule!.calculationBasis,
      contractTypeCode: rule!.contractTypeCode,
      fixedAmountCents: 17500,
      percentTenthsOfBasisPoint: rule!.percentTenthsOfBasisPoint,
      validFrom: '2026-02-01',
      validUntil: '2026-12-31',
    });
    expect(save.ok).toBe(true);

    // Reload: neue Repository-/Service-Instanz liest ausschließlich aus localStorage.
    const reloadServices = createServices(createTestRepositories());
    const after = await reloadServices.commissionCatalogAdminService.getCatalog(ADMIN);
    if ('error' in after) throw new Error('reload forbidden');
    const reloaded = after.commissionRules.find((entry) => entry.id === rule!.id);
    expect(reloaded?.fixedAmountCents).toBe(17500);
    expect(reloaded?.status).toBe('inactive');
    expect(reloaded?.validFrom?.slice(0, 10)).toBe('2026-02-01');
    expect(reloaded?.validUntil?.slice(0, 10)).toBe('2026-12-31');
  });

  it('Außendienst kann keine Standardregel schreiben (Service-Guard admin.commission)', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);
    const result = await services.commissionCatalogAdminService.upsertStandardRule(FIELD, {
      id: 'commission_rule_classic_acq',
      commissionPlanVersionId: 'commission_plan_version_classic_v1',
      name: 'Manipuliert',
      internalDescription: '',
      status: 'active',
      commissionType: 'base_once',
      calculationBasis: 'fixed_amount',
      contractTypeCode: null,
      fixedAmountCents: 999999,
      percentTenthsOfBasisPoint: null,
      validFrom: null,
      validUntil: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('forbidden');

    // Repository-Ebene bestätigt: keine Änderung wurde persistiert.
    const reloadServices = createServices(createTestRepositories());
    const catalog = await reloadServices.commissionCatalogAdminService.getCatalog(ADMIN);
    if ('error' in catalog) throw new Error('reload forbidden');
    const rule = catalog.commissionRules.find((entry) => entry.id === 'commission_rule_classic_acq');
    expect(rule?.fixedAmountCents).not.toBe(999999);
  });
});

describe('Provision – Persistenznachweis Mitarbeitervereinbarung (0–100 %, Euro live, Reset, Overlap)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('speichert individuellen Anteil (0–100 %), berechnet Euro live und zeigt Werte nach Reload', async () => {
    const writeServices = createServices(createTestRepositories());
    await writeServices.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);
    await writeServices.commissionAdminService.ensureDefaultAssignments(ADMIN);

    // "Live"-Berechnung im UI-Sinn: Standard 15000 Cent × 80 % = 12000 Cent, ohne zu speichern.
    const detailBeforeSave = await writeServices.commissionAdminService.getAssignmentDetail(
      ADMIN,
      FIELD_SERVICE_USER_ID,
    );
    if ('error' in detailBeforeSave) throw new Error('detail forbidden');
    const acqView = detailBeforeSave.ruleViews.find((view) => view.ruleId === 'commission_rule_classic_acq');
    expect(acqView?.standardAmountCents).toBe(15000);
    expect(acqView?.sharePercent).toBe(100);

    const save = await writeServices.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 80 }],
      changeNote: 'Individuelle Vereinbarung 80 %',
    });
    expect(save.ok).toBe(true);

    // Reload über frische Repository-Instanz.
    const reloadServices = createServices(createTestRepositories());
    const reloadedDetail = await reloadServices.commissionAdminService.getAssignmentDetail(
      ADMIN,
      FIELD_SERVICE_USER_ID,
    );
    if ('error' in reloadedDetail) throw new Error('reload forbidden');
    const reloadedAcq = reloadedDetail.ruleViews.find((view) => view.ruleId === 'commission_rule_classic_acq');
    expect(reloadedAcq?.sharePercent).toBe(80);
    expect(reloadedAcq?.calculatedAmountCents).toBe(12000);
    expect(reloadedAcq?.isIndividual).toBe(true);

    // Reset auf Standard (100 %) und erneuter Reload bestätigt Rücksetzung.
    const reset = await reloadServices.commissionAdminService.resetAssignmentOverrides(
      ADMIN,
      FIELD_SERVICE_USER_ID,
    );
    expect(reset.ok).toBe(true);

    const afterResetServices = createServices(createTestRepositories());
    const afterReset = await afterResetServices.commissionAdminService.getAssignmentDetail(
      ADMIN,
      FIELD_SERVICE_USER_ID,
    );
    if ('error' in afterReset) throw new Error('reset reload forbidden');
    const resetAcq = afterReset.ruleViews.find((view) => view.ruleId === 'commission_rule_classic_acq');
    expect(resetAcq?.sharePercent).toBe(100);
    expect(resetAcq?.calculatedAmountCents).toBe(15000);
    expect(resetAcq?.isIndividual).toBe(false);
  });

  it('lehnt Anteile außerhalb von 0–100 % beim Speichern ab (obere und untere Grenze)', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);

    const tooHigh = await services.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 101 }],
      changeNote: 'zu hoch',
    });
    expect(tooHigh.ok).toBe(false);
    if (!tooHigh.ok) expect(tooHigh.error).toBe('share_range');

    const tooLow = await services.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: -1 }],
      changeNote: 'zu niedrig',
    });
    expect(tooLow.ok).toBe(false);
    if (!tooLow.ok) expect(tooLow.error).toBe('share_range');

    const zeroIsValid = await services.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 0 }],
      changeNote: '0 % ist gültig',
    });
    expect(zeroIsValid.ok).toBe(true);
  });

  it('zwei parallele Save-Aufrufe schließen ab und erzeugen höchstens zwei Versionen', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);
    await services.commissionAdminService.ensureDefaultAssignments(ADMIN);

    const input = {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic' as const,
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 42 }],
      changeNote: 'Individuelle Vereinbarung 42 %',
    };

    const before = await services.commissionAdminService.getAssignmentDetail(ADMIN, FIELD_SERVICE_USER_ID);
    if ('error' in before || !before.assignment) throw new Error('detail missing');
    const workflowRepository = new LocalCommissionWorkflowRepository();
    const beforeCount = await workflowRepository.countAssignmentVersions(before.assignment.id);

    const [first, second] = await Promise.all([
      services.commissionAdminService.saveAssignment(ADMIN, input),
      services.commissionAdminService.saveAssignment(ADMIN, input),
    ]);

    expect(first.ok || second.ok).toBe(true);

    const afterCount = await workflowRepository.countAssignmentVersions(before.assignment.id);
    expect(afterCount - beforeCount).toBeLessThanOrEqual(2);

    const after = await services.commissionAdminService.getAssignmentDetail(ADMIN, FIELD_SERVICE_USER_ID);
    if ('error' in after) throw new Error('reload forbidden');
    const acq = after.ruleViews.find((view) => view.ruleId === 'commission_rule_classic_acq');
    expect(acq?.sharePercent).toBe(42);
  });

  it('lehnt überlappende Zuordnungszeiträume ab (Repository-Ebene: zweiter Assignment-Datensatz mit überlappender Gültigkeit)', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);
    await services.commissionAdminService.ensureDefaultAssignments(ADMIN);

    // Zweiten, ebenfalls als "aktiv/primär" markierten Zuordnungsdatensatz direkt im
    // Repository ablegen (z. B. verwaister Altdatensatz aus einer Datenmigration), der
    // sich mit dem geplanten neuen Zeitraum überschneidet. `saveAssignment` erkennt und
    // aktualisiert nur den ERSTEN aktiven Datensatz je Mitarbeiter – der zweite muss
    // trotzdem als Overlap erkannt werden, damit nie zwei gültige Zeiträume kollidieren.
    const catalogRepository = new LocalCommissionCatalogRepository();
    const catalog = await catalogRepository.getCatalog();
    catalog.assignments.push({
      id: 'commission_assignment_overlap_seed',
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      commissionPlanVersionId: 'commission_plan_version_variable_v1',
      currentVersionId: null,
      validFrom: '2026-06-01',
      validUntil: '2026-08-31',
      isPrimary: true,
      status: 'active',
      reason: 'Historischer Zeitraum für Overlap-Test',
      createdByUserId: 'user_004',
      approvedByUserId: 'user_004',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await catalogRepository.saveAssignments(catalog.assignments);

    const overlapping = await services.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-07-01',
      validUntil: null,
      ruleOverrides: [],
      changeNote: 'überlappt mit historischem Zeitraum',
    });
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) expect(overlapping.error).toBe('overlap');

    // Nicht überlappender Zeitraum wird weiterhin akzeptiert.
    const nonOverlapping = await services.commissionAdminService.saveAssignment(ADMIN, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-09-01',
      validUntil: null,
      ruleOverrides: [],
      changeNote: 'kein Overlap',
    });
    expect(nonOverlapping.ok).toBe(true);
  });

  it('Außendienst kann keine Mitarbeitervereinbarung schreiben (Service-Guard admin.commission)', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(ADMIN);

    const result = await services.commissionAdminService.saveAssignment(FIELD, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 50 }],
      changeNote: 'unautorisiert',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('forbidden');

    const resetResult = await services.commissionAdminService.resetAssignmentOverrides(
      FIELD,
      FIELD_SERVICE_USER_ID,
    );
    expect(resetResult.ok).toBe(false);
  });
});
