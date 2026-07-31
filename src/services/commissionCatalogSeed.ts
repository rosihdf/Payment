import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import type { CommissionRule } from '../domain/commission/commissionRule';
import { generateId } from '../utils/id';

export const DEFAULT_COMMISSION_PLAN_CLASSIC_ID = 'commission_plan_classic';
export const DEFAULT_COMMISSION_PLAN_VARIABLE_ID = 'commission_plan_variable';
export const DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID = 'commission_plan_version_classic_v1';
export const DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID = 'commission_plan_version_variable_v1';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function baseRule(overrides: Partial<CommissionRule>): CommissionRule {
  return {
    id: generateId('commission_rule'),
    commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
    name: 'Regel',
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
    internalDescription: '',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function createClassicCommissionRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_classic_terminal_acq_gt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch Terminal+ACQ >36 Monate',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 30000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch Terminal <36 Monate',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 20000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Klassisch ACQ',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 15000,
      combinable: false,
    }),
  ];
}

export function createVariableCommissionRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_variable_terminal_acq_gt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel Terminal+ACQ >36 Monate',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 15000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel Terminal <36 Monate',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variabel ACQ',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_transaction',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Transaktionsbeteiligung 30 %',
      commissionType: 'transaction_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_clearing',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Clearingbeteiligung 30 %',
      commissionType: 'clearing_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 14,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_terminal_share',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Terminalbeteiligung 30 %',
      commissionType: 'terminal_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_accessory',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Zubehör 20 %',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      accessoryOnly: true,
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
  ];
}

export function createDefaultCommissionCatalog(createdByUserId: string): {
  plans: CommissionPlan[];
  planVersions: CommissionPlanVersion[];
  rules: CommissionRule[];
} {
  const classicPlan: CommissionPlan = {
    id: DEFAULT_COMMISSION_PLAN_CLASSIC_ID,
    code: 'CLASSIC',
    name: 'Classic',
    description: 'Festbeträge: Terminal+ACQ 300 € / Terminal 200 € / ACQ 150 €',
    planKind: 'classic',
    status: 'active',
    internalNote: '',
    createdByUserId,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  const variablePlan: CommissionPlan = {
    id: DEFAULT_COMMISSION_PLAN_VARIABLE_ID,
    code: 'VARIABLE',
    name: 'Variable',
    description: 'Variable Beteiligung mit Festbeträgen und 30 %-Anteilen',
    planKind: 'variable',
    status: 'active',
    internalNote: '',
    createdByUserId,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  return {
    plans: [classicPlan, variablePlan],
    planVersions: [
      {
        id: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
        commissionPlanId: classicPlan.id,
        versionNumber: 1,
        status: 'published',
        validFrom: '2026-01-01',
        validUntil: null,
        predecessorVersionId: null,
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: TIMESTAMP,
        archivedAt: null,
        changeNote: 'Initial Classic',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
        commissionPlanId: variablePlan.id,
        versionNumber: 1,
        status: 'published',
        validFrom: '2026-01-01',
        validUntil: null,
        predecessorVersionId: null,
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: TIMESTAMP,
        archivedAt: null,
        changeNote: 'Initial Variable',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    rules: [...createClassicCommissionRules(), ...createVariableCommissionRules()],
  };
}
