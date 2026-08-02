import { beforeEach, describe, expect, it } from 'vitest';
import { applyRuleOverrides } from '../domain/commissionEngine/applyRuleOverrides';
import {
  buildDefaultOverridesForRules,
  hasIndividualAgreement,
} from '../domain/commission/commissionAssignmentHelpers';
import {
  calculateAmountFromShare,
  COMMISSION_SHARE_DEFAULT,
  isValidCommissionSharePercent,
} from '../domain/commission/commissionShare';
import { migrateLegacyOverrideToShare } from '../services/commissionShareMigration';
import { createClassicCommissionRules } from '../services/commissionCatalogSeed';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createServices } from '../services';
import { seedDemoCommissionCatalog } from './helpers/commissionTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';

describe('Provision 2.0 – Unternehmensmodell / %-Anteil', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedDemoCommissionCatalog('classic');
  });

  it('berechnet Eurobetrag aus Standard × Prozent', () => {
    expect(calculateAmountFromShare(30000, 100)).toBe(30000);
    expect(calculateAmountFromShare(30000, 80)).toBe(24000);
    expect(calculateAmountFromShare(30000, 50)).toBe(15000);
    expect(isValidCommissionSharePercent(101)).toBe(false);
    expect(isValidCommissionSharePercent(-1)).toBe(false);
    expect(isValidCommissionSharePercent(100.5)).toBe(false);
  });

  it('Default-Overrides sind 100 % ohne Euro-Snapshot', () => {
    const rules = createClassicCommissionRules();
    const defaults = buildDefaultOverridesForRules(rules);
    expect(defaults.every((entry) => entry.sharePercent === COMMISSION_SHARE_DEFAULT)).toBe(true);
    expect(defaults.every((entry) => entry.fixedAmountCents == null)).toBe(true);
    expect(hasIndividualAgreement(defaults)).toBe(false);
  });

  it('skaliert Standardbetrag bei individuellem Anteil', () => {
    const rules = createClassicCommissionRules();
    const overridden = applyRuleOverrides(rules, [
      { ruleId: rules[0]!.id, sharePercent: 80 },
    ]);
    expect(overridden[0]?.fixedAmountCents).toBe(24000);
  });

  it('Standardänderung wirkt bei 100 %, Individuell behält Prozent', () => {
    const rules = createClassicCommissionRules();
    const withShare = applyRuleOverrides(rules, [
      { ruleId: rules[0]!.id, sharePercent: 80 },
    ]);
    expect(withShare[0]?.fixedAmountCents).toBe(24000);

    const raisedStandard = rules.map((rule) =>
      rule.id === rules[0]!.id ? { ...rule, fixedAmountCents: 40000 } : rule,
    );
    const afterRaise = applyRuleOverrides(raisedStandard, [
      { ruleId: rules[0]!.id, sharePercent: 80 },
    ]);
    expect(afterRaise[0]?.fixedAmountCents).toBe(32000);

    const defaultShare = applyRuleOverrides(raisedStandard, [
      { ruleId: rules[0]!.id, sharePercent: 100 },
    ]);
    expect(defaultShare[0]?.fixedAmountCents).toBe(40000);
  });

  it('migriert Euro-Snapshot gleich Standard zu 100 %', () => {
    const rules = createClassicCommissionRules();
    const migrated = migrateLegacyOverrideToShare(
      { ruleId: rules[0]!.id, fixedAmountCents: rules[0]!.fixedAmountCents },
      rules[0],
    );
    expect(migrated.sharePercent).toBe(100);
    expect(migrated.fixedAmountCents).toBeNull();
  });

  it('Prozent führt – Euro-Override wird entfernt und aus Standard × % abgeleitet', () => {
    const rules = createClassicCommissionRules();
    const normalized = migrateLegacyOverrideToShare(
      { ruleId: rules[0]!.id, sharePercent: 80, fixedAmountCents: 99999 },
      rules[0],
    );
    expect(normalized.sharePercent).toBe(80);
    expect(normalized.fixedAmountCents).toBeNull();
    const applied = applyRuleOverrides(rules, [normalized]);
    expect(applied[0]?.fixedAmountCents).toBe(24000);
  });

  it('wandelt Euro-Ausnahme in ganzzahligen Anteil um, wenn möglich', () => {
    const rules = createClassicCommissionRules();
    const migrated = migrateLegacyOverrideToShare(
      { ruleId: rules[0]!.id, fixedAmountCents: 15000 },
      rules[0],
    );
    expect(migrated.sharePercent).toBe(50);
    expect(migrated.fixedAmountCents).toBeNull();
  });

  it('lehnt Anteil über 100 % beim Speichern ab', async () => {
    const services = createServices(createTestRepositories());
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Admin',
      status: 'active',
    });
    await services.commissionCatalogAdminService.seedDefaultCatalog(admin);

    const result = await services.commissionAdminService.saveAssignment(admin, {
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      model: 'classic',
      validFrom: '2026-01-01',
      validUntil: null,
      ruleOverrides: [{ ruleId: 'commission_rule_classic_acq', sharePercent: 120 }],
      changeNote: 'ungültig',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('share_range');
    }
  });

  it('stellt Default-Zuordnungen mit 100 % sicher', async () => {
    const services = createServices(createTestRepositories());
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Admin',
      status: 'active',
    });
    await services.commissionCatalogAdminService.seedDefaultCatalog(admin);
    const ensured = await services.commissionAdminService.ensureDefaultAssignments(admin);
    expect(ensured.ok).toBe(true);

    const detail = await services.commissionAdminService.getAssignmentDetail(
      admin,
      FIELD_SERVICE_USER_ID,
    );
    expect('error' in detail).toBe(false);
    if (!('error' in detail)) {
      expect(detail.model).toBe('classic');
      expect(detail.ruleViews.every((view) => view.sharePercent === 100)).toBe(true);
      expect(detail.ruleViews.every((view) => !view.isIndividual)).toBe(true);
    }
  });
});
