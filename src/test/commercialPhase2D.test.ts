import { describe, expect, it } from 'vitest';
import {
  classifyCommissionContractTerm,
  resolveCommissionContractConfiguration,
} from '../domain/commission/commissionContractConfiguration';
import {
  getOpenCommissionSourceConflicts,
  getResolvedCommissionSourceDecisions,
} from '../domain/commercial/commissionSourceConflict';
import {
  createClassicCommissionRules,
  createVariableFixedCommissionRules,
  createVariableModel1CommissionRules,
  createVariableModel2CommissionRules,
} from '../services/commissionCatalogSeed';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import type { PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';
import {
  createDemoClassicRules,
  createDemoVariableRules,
  seedDemoCommissionCatalog,
} from './helpers/commissionTestHelpers';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import {
  createTestContractTerm,
  createTestPriceBookVersion,
  createTestPriceRule,
  createTestPricingInput,
  seedTestPricingCatalog,
} from './helpers/pricingTestHelpers';

function buildPricingResult(overrides: Partial<PricingEvaluationResult> = {}): PricingEvaluationResult {
  seedTestPricingCatalog();
  const result = evaluatePricing(createTestPricingInput(), {
    priceBookVersions: [createTestPriceBookVersion()],
    priceRules: [createTestPriceRule()],
    contractTerms: [createTestContractTerm({ months: 36 })],
  });
  return { ...result, stale: false, ...overrides };
}

function buildInput(
  termMonths: number,
  contractConfiguration: CommissionCalculationInput['contractConfiguration'],
): CommissionCalculationInput {
  return {
    evaluationDate: '2026-06-15',
    offerId: 'offer_test',
    offerVersionKey: 'v1',
    salesRepresentativeId: FIELD_SERVICE_USER_ID,
    pricingEvaluationRecordId: 'pricing_eval',
    pricingEvaluationResult: buildPricingResult({ termMonths }),
    contractConfiguration,
    contractTypeCode: null,
    accessoryItems: [],
  };
}

function loadCatalog(planKind: 'classic' | 'variable' = 'classic') {
  seedDemoCommissionCatalog(planKind);
  return {
    commissionPlans: readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? [],
    commissionPlanVersions:
      readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? [],
    commissionRules:
      planKind === 'classic' ? createDemoClassicRules() : createDemoVariableRules(),
    assignments:
      readStorageItem<SalesRepresentativeCommissionAssignment[]>(STORAGE_KEYS.commissionAssignments) ??
      [],
    ruleOverrides: [],
  };
}

describe('Phase 2D – PPT Provisionslogik final', () => {
  describe('Laufzeitklassifikation', () => {
    it('35 → short_term', () => {
      expect(classifyCommissionContractTerm(35)).toBe('short_term');
    });
    it('36 → long_term', () => {
      expect(classifyCommissionContractTerm(36)).toBe('long_term');
    });
    it('48 → long_term', () => {
      expect(classifyCommissionContractTerm(48)).toBe('long_term');
    });
  });

  describe('Quellenpriorität', () => {
    it('keine offenen Source-Conflicts mehr', () => {
      expect(getOpenCommissionSourceConflicts()).toHaveLength(0);
      expect(getResolvedCommissionSourceDecisions()).toHaveLength(2);
    });
  });

  describe('Klassisch', () => {
    it('K1: Terminal+ACQ 36M → 300 €', () => {
      const result = evaluateCommission(
        buildInput(36, 'terminal_acq_long_term'),
        loadCatalog('classic'),
      );
      expect(result.baseCommissionAmountCents).toBe(30000);
    });

    it('K2: Terminal+ACQ 48M → 300 €', () => {
      const result = evaluateCommission(
        buildInput(48, 'terminal_acq_long_term'),
        loadCatalog('classic'),
      );
      expect(result.baseCommissionAmountCents).toBe(30000);
    });

    it('K3: Terminalvertrag 24M → 200 €', () => {
      const result = evaluateCommission(
        buildInput(24, 'terminal_short_term'),
        loadCatalog('classic'),
      );
      expect(result.baseCommissionAmountCents).toBe(20000);
    });

    it('K4: ACQ-only → 150 €', () => {
      const result = evaluateCommission(
        buildInput(24, 'acq_only'),
        loadCatalog('classic'),
      );
      expect(result.baseCommissionAmountCents).toBe(15000);
    });

    it('K5: keine Addition Terminal + ACQ (≠ 350 €)', () => {
      const result = evaluateCommission(
        buildInput(24, 'terminal_short_term'),
        loadCatalog('classic'),
      );
      expect(result.baseCommissionAmountCents).not.toBe(35000);
    });
  });

  describe('Variabel Fix', () => {
    it('V1: Terminal+ACQ 36M → 150 €', () => {
      const result = evaluateCommission(
        buildInput(36, 'terminal_acq_long_term'),
        loadCatalog('variable'),
      );
      expect(result.baseCommissionAmountCents).toBe(15000);
    });

    it('V2: Terminal+ACQ 48M → 150 €', () => {
      const result = evaluateCommission(
        buildInput(48, 'terminal_acq_long_term'),
        loadCatalog('variable'),
      );
      expect(result.baseCommissionAmountCents).toBe(15000);
    });

    it('V3: Terminal <36 → 100 €', () => {
      const result = evaluateCommission(
        buildInput(24, 'terminal_short_term'),
        loadCatalog('variable'),
      );
      expect(result.baseCommissionAmountCents).toBe(10000);
    });

    it('V4: ACQ-only → 100 €', () => {
      const result = evaluateCommission(
        buildInput(24, 'acq_only'),
        loadCatalog('variable'),
      );
      expect(result.baseCommissionAmountCents).toBe(10000);
    });
  });

  describe('Legacy-Auflösung', () => {
    it('terminal_plus_acq + 36M → terminal_acq_long_term', () => {
      expect(
        resolveCommissionContractConfiguration({
          contractTypeCode: 'terminal_plus_acq',
          termMonths: 36,
        }),
      ).toBe('terminal_acq_long_term');
    });
    it('terminal_only + 24M → terminal_short_term', () => {
      expect(
        resolveCommissionContractConfiguration({
          contractTypeCode: 'terminal_only',
          termMonths: 24,
        }),
      ).toBe('terminal_short_term');
    });
  });

  describe('Laufende Beteiligungen & Zubehör (Seed)', () => {
    it('Modell 1 Schwellen vollständig', () => {
      const rules = createVariableModel1CommissionRules();
      expect(rules.find((r) => r.id === 'commission_rule_model1_transaction')?.thresholdTenthsOfCent).toBe(
        39,
      );
      expect(rules.find((r) => r.id === 'commission_rule_model1_clearing')?.thresholdTenthsOfCent).toBe(
        14,
      );
      expect(rules.find((r) => r.id === 'commission_rule_model1_terminal')?.thresholdTenthsOfCent).toBe(
        1200,
      );
    });

    it('Modell 2 Regeln vollständig', () => {
      const rules = createVariableModel2CommissionRules();
      expect(rules.find((r) => r.id === 'commission_rule_model2_girocard')).toBeTruthy();
      expect(rules.find((r) => r.id === 'commission_rule_model2_transaction_fixed')).toBeTruthy();
    });

    it('Zubehör 20 % separat kombinierbar', () => {
      const input = buildInput(48, 'terminal_acq_long_term');
      input.accessoryItems = [{ productId: 'acc', quantity: 1, salePriceCents: 10000 }];
      const result = evaluateCommission(input, loadCatalog('classic'));
      expect(result.baseCommissionAmountCents).toBe(30000);
      expect(result.accessoryCommissionAmountCents).toBe(2000);
    });

    it('Classic-Seed nutzt contractConfiguration ohne Term-Filter', () => {
      const rules = createClassicCommissionRules();
      for (const rule of rules) {
        if (rule.contractConfiguration) {
          expect(rule.minTermMonthsExclusive).toBeNull();
          expect(rule.maxTermMonthsExclusive).toBeNull();
        }
      }
    });

    it('Variable-Fix-Seed getrennt von Modell 2', () => {
      const fixIds = createVariableFixedCommissionRules().map((r) => r.id);
      const m2Ids = createVariableModel2CommissionRules().map((r) => r.id);
      expect(fixIds.some((id) => m2Ids.includes(id))).toBe(false);
    });
  });
});
