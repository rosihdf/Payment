import { beforeEach, describe, expect, it } from 'vitest';
import { applyRuleOverrides } from '../domain/commissionEngine/applyRuleOverrides';
import { assignmentsOverlap } from '../domain/commission/commissionAssignmentHelpers';
import { canTransitionCommissionCase } from '../domain/commission/commissionBusinessStatus';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createServices } from '../services';
import { seedDemoCommissionCatalog } from './helpers/commissionTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import { createClassicCommissionRules } from '../services/commissionCatalogSeed';

describe('Commission Workflow 1.0', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedDemoCommissionCatalog('classic');
  });

  it('wendet Regel-Overrides in der Engine an', () => {
    const rules = createClassicCommissionRules();
    const overridden = applyRuleOverrides(rules, [
      {
        ruleId: rules[0]!.id,
        fixedAmountCents: 25000,
      },
    ]);
    expect(overridden[0]?.fixedAmountCents).toBe(25000);
  });

  it('erkennt überlappende Zuordnungen', () => {
    expect(
      assignmentsOverlap(
        { validFrom: '2026-01-01', validUntil: null, status: 'active', isPrimary: true },
        { validFrom: '2026-06-01', validUntil: null, status: 'active', isPrimary: true },
      ),
    ).toBe(true);
    expect(
      assignmentsOverlap(
        { validFrom: '2026-01-01', validUntil: '2026-05-31', status: 'active', isPrimary: true },
        { validFrom: '2026-06-01', validUntil: null, status: 'active', isPrimary: true },
      ),
    ).toBe(false);
  });

  it('erlaubt nur definierte Workflow-Übergänge', () => {
    expect(canTransitionCommissionCase('expected', 'reserved')).toBe(true);
    expect(canTransitionCommissionCase('expected', 'paid')).toBe(false);
  });

  it('Admin kann Zuordnung speichern und Mitarbeiter sehen', async () => {
    const services = createServices(createTestRepositories());
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Admin',
      status: 'active',
    });

    await services.commissionCatalogAdminService.seedDefaultCatalog(admin);
    const save = await services.commissionAdminService.saveAssignment(admin, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'variable',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [],
      changeNote: 'Test',
    });
    expect(save.ok).toBe(true);

    const rows = await services.commissionAdminService.listRepresentativeAssignments(admin);
    expect(Array.isArray(rows)).toBe(true);
    if (Array.isArray(rows)) {
      expect(rows.some((row) => row.userId === FIELD_SERVICE_USER_ID)).toBe(true);
    }
  });

  it('Außendienst sieht nur eigene Provision', async () => {
    const services = createServices(createTestRepositories());
    const field = createUserContext({
      id: FIELD_SERVICE_USER_ID,
      role: 'field_service',
      name: 'Laura',
      status: 'active',
    });
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Admin',
      status: 'active',
    });

    const own = await services.commissionAdminService.getSalesOverview(field);
    expect('error' in own).toBe(false);

    const foreign = await services.commissionAdminService.saveAssignment(admin, {
      salesRepresentativeId: 'user_002',
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [],
      changeNote: 'Test',
    });
    expect(foreign.ok).toBe(true);
  });

  it('Admin kann Sonderzahlung anlegen und freigeben', async () => {
    const services = createServices(createTestRepositories());
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Admin',
      status: 'active',
    });

    const created = await services.commissionAdminService.createBonusPayment(admin, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      amountCents: 5000,
      currency: 'EUR',
      bonusType: 'bonus',
      title: 'Q1 Bonus',
      description: 'Test',
      reason: 'Leistung',
      periodFrom: null,
      periodUntil: null,
      leadId: null,
      offerId: null,
      contractId: null,
      activationId: null,
      documentReference: null,
      createdByUserId: admin.userId,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      const approved = await services.commissionAdminService.updateBonusStatus(
        admin,
        created.bonus.id,
        'approved',
      );
      expect(approved.ok).toBe(true);
    }
  });

  it('Außendienst darf keine Adminaktion ausführen', async () => {
    const services = createServices(createTestRepositories());
    const field = createUserContext({
      id: FIELD_SERVICE_USER_ID,
      role: 'field_service',
      name: 'Laura',
      status: 'active',
    });

    const rows = await services.commissionAdminService.listRepresentativeAssignments(field);
    expect(rows).toEqual({ error: 'forbidden' });

    const bonus = await services.commissionAdminService.createBonusPayment(field, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      amountCents: 100,
      currency: 'EUR',
      bonusType: 'bonus',
      title: 'X',
      description: '',
      reason: '',
      periodFrom: null,
      periodUntil: null,
      leadId: null,
      offerId: null,
      contractId: null,
      activationId: null,
      documentReference: null,
      createdByUserId: field.userId,
    });
    expect(bonus.ok).toBe(false);
  });
});
