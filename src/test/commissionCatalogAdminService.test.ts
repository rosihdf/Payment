import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID } from '../services/commissionCatalogSeed';

describe('commissionCatalogAdminService', () => {
  const admin = createUserContext({
    id: 'user_004',
    role: 'admin',
    name: 'Admin',
    status: 'active',
  });

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('speichert Standardregel und lädt sie nach Reload', async () => {
    const services = createServices(createTestRepositories());
    await services.commissionCatalogAdminService.seedDefaultCatalog(admin);
    const catalog = await services.commissionCatalogAdminService.getCatalog(admin);
    if ('error' in catalog) {
      throw new Error('catalog forbidden');
    }
    const rule = catalog.commissionRules[0];
    expect(rule).toBeTruthy();

    const result = await services.commissionCatalogAdminService.upsertStandardRule(admin, {
      id: rule!.id,
      commissionPlanVersionId: rule!.commissionPlanVersionId,
      name: rule!.name,
      internalDescription: rule!.internalDescription,
      status: rule!.status === 'inactive' ? 'inactive' : 'active',
      commissionType: rule!.commissionType,
      calculationBasis: rule!.calculationBasis,
      contractTypeCode: rule!.contractTypeCode,
      fixedAmountCents: 0,
      percentTenthsOfBasisPoint: rule!.percentTenthsOfBasisPoint,
      validFrom: rule!.validFrom,
      validUntil: rule!.validUntil,
    });
    expect(result.ok).toBe(true);

    const reloaded = await services.commissionCatalogAdminService.getCatalog(admin);
    if ('error' in reloaded) {
      throw new Error('reload forbidden');
    }
    const updated = reloaded.commissionRules.find((entry) => entry.id === rule!.id);
    expect(updated?.fixedAmountCents).toBe(0);
  });

  it('lehnt Speichern ohne Berechtigung ab', async () => {
    const services = createServices(createTestRepositories());
    const field = createUserContext({
      id: 'user_001',
      role: 'field_service',
      name: 'Außendienst',
      status: 'active',
    });
    const result = await services.commissionCatalogAdminService.upsertStandardRule(field, {
      id: 'commission_rule_classic_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Test',
      internalDescription: '',
      status: 'active',
      commissionType: 'base_once',
      calculationBasis: 'fixed_amount',
      contractTypeCode: null,
      fixedAmountCents: 100,
      percentTenthsOfBasisPoint: null,
      validFrom: null,
      validUntil: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('forbidden');
    }
  });
});
