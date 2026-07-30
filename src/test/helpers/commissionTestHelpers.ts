/** Explizit als Test-/Demo-Konfiguration gekennzeichnet – nicht für produktive Seeds. */
import type { SalesRepresentativeCommissionAssignment } from '../../domain/commission/commissionAssignment';
import type { CommissionPlan, CommissionPlanVersion } from '../../domain/commission/commissionPlan';
import type { CommissionRule } from '../../domain/commission/commissionRule';
import { resetCommissionCatalogForTests } from '../../services/commissionCatalogMigration';
import { resetCommissionCalculationStorageForTests } from '../../services/commissionCalculationStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { FIELD_SERVICE_USER_ID } from './offerTestHelpers';

export const DEMO_COMMISSION_PLAN_CLASSIC_ID = 'commission_plan_demo_classic';
export const DEMO_COMMISSION_PLAN_VARIABLE_ID = 'commission_plan_demo_variable';
export const DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID = 'commission_plan_version_demo_classic_v1';
export const DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID = 'commission_plan_version_demo_variable_v1';
export const DEMO_COMMISSION_ASSIGNMENT_ID = 'commission_assignment_demo_001';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function baseRule(overrides: Partial<CommissionRule>): CommissionRule {
  return {
    id: 'commission_rule_demo',
    commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID,
    name: 'Demo-Regel',
    status: 'active',
    commissionType: 'base_once',
    calculationBasis: 'fixed_amount',
    contractTypeCode: null,
    productId: null,
    tariffId: null,
    contractTermId: null,
    accessoryOnly: false,
    minTermMonthsExclusive: null,
    maxTermMonthsExclusive: null,
    exactTermMonths: null,
    priority: 10,
    combinable: true,
    fixedAmountCents: null,
    percentTenthsOfBasisPoint: null,
    thresholdTenthsOfCent: null,
    currency: 'EUR',
    validFrom: '2026-01-01',
    validUntil: null,
    internalDescription: 'Demo-Regel',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function createDemoClassicRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_demo_classic_terminal_acq_gt36',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch Terminal+ACQ >36 Monate',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 30000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_classic_terminal_lt36',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch Terminal <36 Monate',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 20000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_classic_acq',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch ACQ',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 15000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_classic_accessory',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Zubehör 20 Prozent',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      accessoryOnly: true,
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
  ];
}

export function createDemoVariableRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_demo_variable_terminal_acq_gt36',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel Terminal+ACQ >36 Monate',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 15000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_variable_terminal_lt36',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel Terminal <36 Monate',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_variable_acq',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel ACQ',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_demo_variable_transaction',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Transaktionsbeteiligung 30 Prozent gesamte Gebühr',
      commissionType: 'transaction_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 39,
      combinable: true,
      internalDescription: 'Demo: 30 Prozent der gesamten Transaktionsgebühr (0,039 EUR Schwelle)',
    }),
    baseRule({
      id: 'commission_rule_demo_variable_clearing',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Clearingbeteiligung 30 Prozent oberhalb Schwelle',
      commissionType: 'clearing_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 14,
      combinable: true,
      internalDescription: 'Demo: 30 Prozent oberhalb 0,014 EUR Schwelle',
    }),
    baseRule({
      id: 'commission_rule_demo_variable_accessory',
      commissionPlanVersionId: DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Zubehör 20 Prozent',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      accessoryOnly: true,
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
  ];
}

export function seedDemoCommissionCatalog(planKind: 'classic' | 'variable' = 'classic'): void {
  resetCommissionCatalogForTests();
  resetCommissionCalculationStorageForTests();

  const isClassic = planKind === 'classic';
  const plan: CommissionPlan = {
    id: isClassic ? DEMO_COMMISSION_PLAN_CLASSIC_ID : DEMO_COMMISSION_PLAN_VARIABLE_ID,
    code: isClassic ? 'DEMO-BESTPAY-CLASSIC' : 'DEMO-BESTPAY-VARIABLE',
    name: isClassic ? 'Demo Klassisches Modell' : 'Demo Variables Modell',
    description: 'Explizit gekennzeichnete Demo-Konfiguration für Tests',
    planKind,
    status: 'active',
    internalNote: 'Nur für Tests',
    createdByUserId: 'admin_demo',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  const version: CommissionPlanVersion = {
    id: isClassic
      ? DEMO_COMMISSION_PLAN_VERSION_CLASSIC_ID
      : DEMO_COMMISSION_PLAN_VERSION_VARIABLE_ID,
    commissionPlanId: plan.id,
    versionNumber: 1,
    status: 'published',
    validFrom: '2026-01-01',
    validUntil: null,
    predecessorVersionId: null,
    createdByUserId: 'admin_demo',
    publishedByUserId: 'admin_demo',
    publishedAt: TIMESTAMP,
    archivedAt: null,
    changeNote: 'Demo-Version',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };

  const assignment: SalesRepresentativeCommissionAssignment = {
    id: DEMO_COMMISSION_ASSIGNMENT_ID,
    salesRepresentativeId: FIELD_SERVICE_USER_ID,
    commissionPlanVersionId: version.id,
    validFrom: '2026-01-01',
    validUntil: null,
    isPrimary: true,
    status: 'active',
    reason: 'Demo-Zuordnung',
    createdByUserId: 'admin_demo',
    approvedByUserId: 'admin_demo',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };

  writeStorageItem(STORAGE_KEYS.commissionPlans, [plan]);
  writeStorageItem(STORAGE_KEYS.commissionPlanVersions, [version]);
  writeStorageItem(
    STORAGE_KEYS.commissionRules,
    isClassic ? createDemoClassicRules() : createDemoVariableRules(),
  );
  writeStorageItem(STORAGE_KEYS.commissionAssignments, [assignment]);
  writeStorageItem(STORAGE_KEYS.commissionCatalogVersion, 1);
  writeStorageItem(STORAGE_KEYS.commissionCalculations, []);
  writeStorageItem(STORAGE_KEYS.commissionCases, []);
  writeStorageItem(STORAGE_KEYS.commissionEvents, []);
  writeStorageItem(STORAGE_KEYS.commissionCalculationStorageVersion, 1);
}
