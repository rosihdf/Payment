import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import type { CommissionRule } from '../domain/commission/commissionRule';
import { generateId } from '../utils/id';

export const DEFAULT_COMMISSION_PLAN_CLASSIC_ID = 'commission_plan_classic';
export const DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_1_ID = 'commission_plan_variable_model_1';
export const DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_2_ID = 'commission_plan_variable_model_2';
/** @deprecated Einheitlicher Variable-Plan – durch Modell 1/2 ersetzt. */
export const DEFAULT_COMMISSION_PLAN_VARIABLE_ID = 'commission_plan_variable';
export const DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID = 'commission_plan_version_classic_v1';
export const DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID =
  'commission_plan_version_variable_model_1_v1';
export const DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_2_ID =
  'commission_plan_version_variable_model_2_v1';
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
      internalDescription: 'PPT klassisch – Terminal + Acquiring bei Laufzeit über 36 Monate (300 €)',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 30000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Nur Terminal',
      internalDescription: 'PPT klassisch – ausschließlich Terminal unter 36 Monate (200 €)',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 20000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_classic_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
      name: 'Nur Acquiring',
      internalDescription: 'PPT klassisch – ausschließlich Acquiring (150 €)',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 15000,
      combinable: false,
    }),
  ];
}

/** PPT variable Fixbeträge + Zubehör – getrennt von laufenden Modell-1/2-Regeln. */
export function createVariableFixedCommissionRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_variable_terminal_acq_gt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Feste Provision Terminal + Acquiring >36 Monate',
      internalDescription: 'PPT variabel – feste Provision 150 € (>36 Monate)',
      contractTypeCode: 'terminal_plus_acq',
      minTermMonthsExclusive: 36,
      fixedAmountCents: 15000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_terminal_lt36',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Feste Provision Nur Terminal',
      internalDescription: 'PPT variabel – feste Provision 100 € (<36 Monate)',
      contractTypeCode: 'terminal_only',
      maxTermMonthsExclusive: 36,
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_acq',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Feste Provision Nur Acquiring',
      internalDescription: 'PPT variabel – feste Provision 100 €',
      contractTypeCode: 'acq_only',
      fixedAmountCents: 10000,
      combinable: false,
    }),
    baseRule({
      id: 'commission_rule_variable_accessory',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Zubehör 20 %',
      internalDescription: 'PPT Zubehör – 20 % vom Zubehör-Verkaufspreis',
      commissionType: 'accessory',
      calculationBasis: 'percentage_of_sale_price',
      accessoryOnly: true,
      percentTenthsOfBasisPoint: 2000,
      combinable: true,
    }),
  ];
}

/** PPT Angebot 1 + Vertragsanlage Modell 1. */
export function createVariableModel1CommissionRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_model1_transaction',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Transaktionsbeteiligung 30 % ab 0,039 €',
      internalDescription: 'PPT/Vertrag Modell 1 – 30 % Transaktionsgebühr ab Schwelle 0,039 €',
      commissionType: 'transaction_share',
      calculationBasis: 'percentage_of_full_fee',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 39,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_model1_clearing',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Clearingbeteiligung 30 % ab 0,014 €',
      internalDescription: 'PPT/Vertrag Modell 1 – 30 % Clearing oberhalb 0,014 €',
      commissionType: 'clearing_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 14,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_model1_terminal',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
      name: 'Terminalbeteiligung 30 % ab 12,00 €',
      internalDescription: 'PPT/Vertrag Modell 1 – 30 % Terminal oberhalb 12,00 €',
      commissionType: 'terminal_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 1200,
      combinable: true,
    }),
  ];
}

/** PPT Angebot 2 + Vertragsanlage Modell 2. */
export function createVariableModel2CommissionRules(): CommissionRule[] {
  return [
    baseRule({
      id: 'commission_rule_model2_girocard',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_2_ID,
      name: 'Girokartenbeteiligung 30 % ab 0,30 %',
      internalDescription: 'PPT/Vertrag Modell 2 – 30 % Girokartenentgelt ab 0,30 %',
      commissionType: 'girocard_share',
      calculationBasis: 'percentage_above_threshold',
      percentTenthsOfBasisPoint: 3000,
      thresholdTenthsOfCent: 30,
      combinable: true,
    }),
    baseRule({
      id: 'commission_rule_model2_transaction_fixed',
      commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_2_ID,
      name: 'Transaktionsbeteiligung 0,01 € bei VK 0,04 €',
      internalDescription: 'PPT/Vertrag Modell 2 – 0,01 € je Transaktion bei VK 0,04 €',
      commissionType: 'transaction_share',
      calculationBasis: 'amount_per_transaction',
      fixedAmountCents: 1,
      thresholdTenthsOfCent: 40,
      combinable: true,
    }),
  ];
}

/** @deprecated Nutze createVariableModel1/2CommissionRules. */
export function createVariableCommissionRules(): CommissionRule[] {
  return [
    ...createVariableFixedCommissionRules(),
    ...createVariableModel1CommissionRules(),
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
    description: 'PPT klassisch: Terminal+ACQ >36M 300 € / Terminal <36M 200 € / ACQ 150 €',
    planKind: 'classic',
    status: 'active',
    internalNote: 'Vertragsabschluss-Konflikt PPT vs. Vertragsanlage offen – siehe commissionSourceConflict.ts',
    createdByUserId,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  const variableModel1Plan: CommissionPlan = {
    id: DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_1_ID,
    code: 'VARIABLE-M1',
    name: 'Variable Modell 1',
    description: 'PPT Angebot 1 / Vertragsanlage Modell 1: Tx/Clearing/Terminal-Beteiligungen',
    planKind: 'variable_model_1',
    status: 'active',
    internalNote: 'Nicht mit Modell 2 vermischen',
    createdByUserId,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  const variableModel2Plan: CommissionPlan = {
    id: DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_2_ID,
    code: 'VARIABLE-M2',
    name: 'Variable Modell 2',
    description: 'PPT Angebot 2 / Vertragsanlage Modell 2: Giro + feste Tx-Beteiligung',
    planKind: 'variable_model_2',
    status: 'active',
    internalNote: 'Nicht mit Modell 1 vermischen',
    createdByUserId,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    archivedAt: null,
  };

  return {
    plans: [classicPlan, variableModel1Plan, variableModel2Plan],
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
        id: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_1_ID,
        commissionPlanId: variableModel1Plan.id,
        versionNumber: 1,
        status: 'published',
        validFrom: '2026-01-01',
        validUntil: null,
        predecessorVersionId: null,
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: TIMESTAMP,
        archivedAt: null,
        changeNote: 'Initial Variable Modell 1',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_MODEL_2_ID,
        commissionPlanId: variableModel2Plan.id,
        versionNumber: 1,
        status: 'published',
        validFrom: '2026-01-01',
        validUntil: null,
        predecessorVersionId: null,
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: TIMESTAMP,
        archivedAt: null,
        changeNote: 'Initial Variable Modell 2',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    rules: [
      ...createClassicCommissionRules(),
      ...createVariableFixedCommissionRules(),
      ...createVariableModel1CommissionRules(),
      ...createVariableModel2CommissionRules(),
    ],
  };
}
