import { describe, expect, it } from 'vitest';
import {
  createTestPriceRule,
  TEST_PRICE_BOOK_VERSION_ID,
  TEST_TARIFF_ID,
} from './helpers/pricingTestHelpers';
import { computeRuleSpecificity, selectPriceRules } from '../domain/pricingEngine/ruleMatching';
import { createTestPricingInput } from './helpers/pricingTestHelpers';

describe('price rule matching', () => {
  it('selects exact tariff rule over general rule', () => {
    const general = createTestPriceRule({ id: 'general', priority: 10 });
    const specific = createTestPriceRule({
      id: 'specific',
      tariffId: TEST_TARIFF_ID,
      priority: 20,
      listPriceCents: 12000,
    });

    const result = selectPriceRules(
      [general, specific],
      TEST_PRICE_BOOK_VERSION_ID,
      createTestPricingInput(),
    );

    expect(result.selectedRules).toHaveLength(1);
    expect(result.selectedRules[0]?.id).toBe('specific');
  });

  it('returns conflict for equal specific contradictory rules', () => {
    const left = createTestPriceRule({
      id: 'left',
      tariffId: TEST_TARIFF_ID,
      priority: 50,
      listPriceCents: 10000,
    });
    const right = createTestPriceRule({
      id: 'right',
      tariffId: TEST_TARIFF_ID,
      priority: 50,
      listPriceCents: 11000,
    });

    const result = selectPriceRules(
      [left, right],
      TEST_PRICE_BOOK_VERSION_ID,
      createTestPricingInput(),
    );

    expect(result.selectedRules).toHaveLength(0);
    expect(result.conflicting).toBe(true);
  });

  it('ignores inactive rules', () => {
    const inactive = createTestPriceRule({ status: 'inactive' });
    const result = selectPriceRules(
      [inactive],
      TEST_PRICE_BOOK_VERSION_ID,
      createTestPricingInput(),
    );
    expect(result.selectedRules).toHaveLength(0);
  });

  it('computes negative specificity for mismatched product', () => {
    const rule = createTestPriceRule({ productId: 'other-product' });
    expect(computeRuleSpecificity(rule, createTestPricingInput({ productId: 'x' }))).toBe(-1);
  });
});
