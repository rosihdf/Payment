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
    displaySharePercent: null,
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
      name: 'Terminal + Acquiring >36 Monate',
      internalDescription: 'CLASSIC – Terminal + Acquiring bei Laufzeit über 36 Monate',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 30000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Nur Terminal',
      internalDescription: 'CLASSIC – ausschließlich Terminal (200 € Standard)',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 20000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Nur Acquiring',
      internalDescription: 'CLASSIC – ausschließlich Acquiring (150 € Standard)',
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
      name: 'Feste Provision Terminal + Acquiring >36 Monate',
      internalDescription: 'VARIABLE – feste Provision 150 €',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 15000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Feste Provision Nur Terminal',
      internalDescription: 'VARIABLE – feste Provision 100 €',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Feste Provision Nur Acquiring',
      internalDescription: 'VARIABLE – feste Provision 100 €',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_transaction',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variable Beteiligung Transaktion 30 %',
      internalDescription: 'VARIABLE – 30 % der gesamten Transaktionsgebühr',
      commissionType: 'transaction_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_clearing',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Variable Beteiligung Clearing 30 %',
      internalDescription: 'VARIABLE – 30 % Clearing oberhalb Schwelle 0,014 €',
      commissionType: 'clearing_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 14,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_terminal_share',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Hardware / Terminalbeteiligung 30 %',
      internalDescription: 'VARIABLE – 30 % Terminal-/Hardwarebeteiligung',
      commissionType: 'terminal_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_accessory',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Zubehör 20 %',
      internalDescription: 'VARIABLE – 20 % vom Zubehör-Verkaufspreis',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      accessoryOnly: true,
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_hardware',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Hardware 20 %',
      internalDescription: 'VARIABLE – 20 % vom Hardware-Verkaufspreis',
      commissionType: 'hardware',
      calculationBasis: 'percentage_of_sale_price',
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_service',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Dienstleistungen 20 %',
      internalDescription: 'VARIABLE – 20 % von Dienstleistungen',
      commissionType: 'recurring',
      calculationBasis: 'percentage_of_sale_price',
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_variable_addon_device',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Zusatzgeräte 20 %',
      commissionType: 'hardware',
      calculationBasis: 'percentage_of_sale_price',
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
      priority: 20,
      internalDescription: 'VARIABLE – 20 % von Zusatzgeräten',
    }),
    baseRule({
      id: 'commission_rule_variable_special_product',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
      name: 'Sonderprodukte 20 %',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
      priority: 25,
      internalDescription: 'VARIABLE – 20 % von Sonderprodukten',
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
    description: 'Festbeträge laut PPT: Terminal+ACQ >36M 300 € / Terminal <36M 200 € / ACQ 150 €',
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
