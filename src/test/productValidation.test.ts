import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_PRODUCT_INPUT } from '../domain/product/productDefaults';
import { validateCreateProductInput } from '../services/productValidation';
import { createValidProductInput } from './helpers/productTestHelpers';

describe('Product validation', () => {
  it('requires mandatory fields', () => {
    const errors = validateCreateProductInput(DEFAULT_CREATE_PRODUCT_INPUT);

    expect(errors.name).toBeTruthy();
    expect(errors.internalProductCode).toBeTruthy();
  });

  it('requires non-negative primary price for monthly products', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({ priceType: 'monthly', priceCents: -1 }),
    );

    expect(errors.priceCents).toContain('negativ');
  });

  it('rejects price on on_request products', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({ priceType: 'on_request', priceCents: 1000 }),
    );

    expect(errors.priceCents).toContain('Auf Anfrage');
  });

  it('requires zero price for included products', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({ priceType: 'included', priceCents: 500 }),
    );

    expect(errors.priceCents).toContain('Inklusive');
  });

  it('accepts included products with zero price', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({ priceType: 'included', priceCents: 0 }),
    );

    expect(errors.priceCents).toBeUndefined();
  });

  it('requires complete secondary price when partially filled', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({
        secondaryPriceType: 'one_time',
        secondaryPriceCents: 24995,
        secondaryPriceLabel: null,
      }),
    );

    expect(errors.secondaryPriceLabel).toContain('zweite Preis');
  });

  it('validates secondary price amount for its type', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({
        secondaryPriceType: 'one_time',
        secondaryPriceCents: -100,
        secondaryPriceLabel: 'Option',
      }),
    );

    expect(errors.secondaryPriceCents).toContain('negativ');
  });

  it('accepts complete secondary price', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({
        secondaryPriceType: 'one_time',
        secondaryPriceCents: 24995,
        secondaryPriceLabel: 'Swissbit TSE Stick',
      }),
    );

    expect(errors.secondaryPriceLabel).toBeUndefined();
    expect(errors.secondaryPriceCents).toBeUndefined();
  });

  it('rejects invalid date range', () => {
    const errors = validateCreateProductInput(
      createValidProductInput({
        validFrom: '2026-12-01',
        validUntil: '2026-01-01',
      }),
    );

    expect(errors.validUntil).toBe(
      'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.',
    );
  });

  it('accepts valid product input', () => {
    const errors = validateCreateProductInput(createValidProductInput());
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
