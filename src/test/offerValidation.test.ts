import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_OFFER_INPUT } from '../domain/offer/offerDefaults';
import {
  hasOfferValidationErrors,
  sanitizeOfferInput,
  validateCancellationReason,
  validateCreateOfferInput,
  validateOfferNumber,
} from '../services/offerValidation';
import {
  createProductOfferItemInput,
  createValidOfferInput,
  createValidOfferItemInput,
  getDemoProduct,
} from './helpers/offerTestHelpers';

describe('Offer validation', () => {
  it('requires mandatory fields', () => {
    const errors = validateCreateOfferInput({
      ...DEFAULT_CREATE_OFFER_INPUT,
      title: '',
    });

    expect(errors.leadId).toBeTruthy();
    expect(errors.title).toBeTruthy();
    expect(errors.items).toBeTruthy();
  });

  it('accepts tariff-only offers without items', () => {
    const errors = validateCreateOfferInput(
      createValidOfferInput({
        items: [],
      }),
    );

    expect(errors.leadId).toBeUndefined();
    expect(errors.title).toBeUndefined();
    expect(errors.items).toBeUndefined();
  });

  it('requires price override reason when unit price differs', () => {
    const product = getDemoProduct();
    const errors = validateCreateOfferInput(
      createValidOfferInput({
        items: [
          createProductOfferItemInput(product, {
            unitPriceCents: (product.priceCents ?? 0) - 100,
          }),
        ],
      }),
      {
        createdAt: '2026-07-30T00:00:00.000Z',
        originalPricesByProductId: new Map([[product.id, product.priceCents]]),
      },
    );

    expect(errors.itemErrors?.[0]?.priceOverrideReason).toContain('Begründung');
  });

  it('accepts price override with reason', () => {
    const product = getDemoProduct();
    const errors = validateCreateOfferInput(
      createValidOfferInput({
        items: [
          createProductOfferItemInput(product, {
            unitPriceCents: (product.priceCents ?? 0) - 100,
            priceOverrideReason: 'Sonderkondition für Bestandskunde',
          }),
        ],
      }),
      {
        createdAt: '2026-07-30T00:00:00.000Z',
        originalPricesByProductId: new Map([[product.id, product.priceCents]]),
      },
    );

    expect(errors.itemErrors?.[0]?.priceOverrideReason).toBeUndefined();
  });

  it('rejects duplicate products in one offer', () => {
    const product = getDemoProduct();
    const errors = validateCreateOfferInput(
      createValidOfferInput({
        items: [
          createProductOfferItemInput(product),
          createProductOfferItemInput(product),
        ],
      }),
      {
        createdAt: '2026-07-30T00:00:00.000Z',
        originalPricesByProductId: new Map([[product.id, product.priceCents]]),
      },
    );

    expect(errors.itemErrors?.[1]?.productId).toBe(
      'Dieses Produkt ist bereits im Angebot enthalten.',
    );
  });

  it('sanitizes on_request items to null price', () => {
    const sanitized = sanitizeOfferInput(
      createValidOfferInput({
        items: [
          createValidOfferItemInput({
            priceType: 'on_request',
            unitPriceCents: 1000,
          }),
        ],
      }),
    );

    expect(sanitized.items[0]?.unitPriceCents).toBeNull();
  });

  it('sanitizes included items to zero price', () => {
    const sanitized = sanitizeOfferInput(
      createValidOfferInput({
        items: [
          createValidOfferItemInput({
            priceType: 'included',
            unitPriceCents: 500,
          }),
        ],
      }),
    );

    expect(sanitized.items[0]?.unitPriceCents).toBe(0);
  });

  it('validates validUntil against createdAt', () => {
    const errors = validateCreateOfferInput(
      createValidOfferInput({
        validUntil: '2026-01-01',
      }),
      { createdAt: '2026-07-30T00:00:00.000Z' },
    );

    expect(errors.validUntil).toBe(
      'Das Gültigkeitsdatum darf nicht vor dem Erstellungsdatum liegen.',
    );
  });

  it('sanitizes included and on_request prices', () => {
    const sanitized = sanitizeOfferInput(
      createValidOfferInput({
        items: [
          createValidOfferItemInput({ priceType: 'included', unitPriceCents: 999 }),
          createValidOfferItemInput({ priceType: 'on_request', unitPriceCents: 999 }),
        ],
      }),
    );

    expect(sanitized.items[0]?.unitPriceCents).toBe(0);
    expect(sanitized.items[1]?.unitPriceCents).toBeNull();
  });

  it('validates offer number format', () => {
    expect(validateOfferNumber('')).toContain('fehlt');
    expect(validateOfferNumber('INVALID')).toContain('Format');
    expect(validateOfferNumber('BP-ANG-2026-0001')).toBeUndefined();
  });

  it('requires cancellation reason', () => {
    expect(validateCancellationReason('')).toContain('Stornierungsgrund');
    expect(validateCancellationReason('Kunde hat abgesagt')).toBeUndefined();
  });

  it('detects validation errors helper', () => {
    expect(hasOfferValidationErrors({})).toBe(false);
    expect(hasOfferValidationErrors({ title: 'Fehler' })).toBe(true);
    expect(hasOfferValidationErrors({ itemErrors: { 0: { name: 'Fehler' } } })).toBe(true);
  });
});
