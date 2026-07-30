import { describe, expect, it } from 'vitest';
import {
  calculateItemLineTotalCents,
  calculateOfferTotals,
  calculateTariffMonthlyFixedTotalCents,
  calculateTariffSetupTotalCents,
  isBillableOfferItem,
  isPriceOverridden,
  resolveOriginalUnitPriceCents,
} from '../domain/offer/offerCalculations';
import { createTariffSnapshotFromTariff } from '../domain/offer/offerSnapshots';
import {
  createTestOffer,
  createTestOfferItem,
  getDemoProduct,
  getDemoTariff,
} from './helpers/offerTestHelpers';

describe('Offer calculations', () => {
  it('calculates monthly line totals with quantity', () => {
    const total = calculateItemLineTotalCents(
      createTestOfferItem({
        priceType: 'monthly',
        unitPriceCents: 11995,
        quantity: 2,
      }),
    );

    expect(total).toBe(23990);
  });

  it('calculates one_time line totals with quantity', () => {
    const total = calculateItemLineTotalCents(
      createTestOfferItem({
        priceType: 'one_time',
        unitPriceCents: 39995,
        quantity: 3,
      }),
    );

    expect(total).toBe(119985);
  });

  it('returns zero for included items regardless of quantity', () => {
    const total = calculateItemLineTotalCents(
      createTestOfferItem({
        priceType: 'included',
        unitPriceCents: 0,
        quantity: 5,
      }),
    );

    expect(total).toBe(0);
  });

  it('returns null for on_request items', () => {
    const total = calculateItemLineTotalCents(
      createTestOfferItem({
        priceType: 'on_request',
        unitPriceCents: null,
        quantity: 2,
      }),
    );

    expect(total).toBeNull();
  });

  it('sums tariff monthly fixed costs only', () => {
    const tariff = createTariffSnapshotFromTariff(getDemoTariff());

    expect(calculateTariffMonthlyFixedTotalCents(tariff)).toBe(1790);
    expect(calculateTariffSetupTotalCents(tariff)).toBe(7995);
  });

  it('excludes variable card rates from offer totals', () => {
    const offer = createTestOffer({
      items: [
        createTestOfferItem({
          priceType: 'monthly',
          unitPriceCents: 11995,
          quantity: 1,
        }),
      ],
      tariffSnapshot: createTariffSnapshotFromTariff(getDemoTariff()),
    });

    const totals = calculateOfferTotals(offer);

    expect(totals.monthlyItemsTotalCents).toBe(11995);
    expect(totals.tariffMonthlyFixedTotalCents).toBe(1790);
    expect(totals.monthlyTotalCents).toBe(13785);
    expect(totals.oneTimeItemsTotalCents).toBe(0);
    expect(totals.tariffSetupTotalCents).toBe(7995);
    expect(totals.oneTimeTotalCents).toBe(7995);
  });

  it('combines monthly and one_time item totals without float errors', () => {
    const offer = createTestOffer({
      tariffSnapshot: null,
      items: [
        createTestOfferItem({
          priceType: 'monthly',
          unitPriceCents: 333,
          quantity: 3,
        }),
        createTestOfferItem({
          priceType: 'one_time',
          unitPriceCents: 777,
          quantity: 2,
          sortOrder: 1,
        }),
      ],
    });

    const totals = calculateOfferTotals(offer);

    expect(totals.monthlyItemsTotalCents).toBe(999);
    expect(totals.oneTimeItemsTotalCents).toBe(1554);
    expect(totals.monthlyTotalCents).toBe(999);
    expect(totals.oneTimeTotalCents).toBe(1554);
  });

  it('tracks on_request items separately from totals', () => {
    const onRequestProduct = getDemoProduct('product_speedypay_t2');
    const offer = createTestOffer({
      tariffSnapshot: null,
      items: [
        createTestOfferItem({
          productSnapshot: null,
          name: onRequestProduct.name,
          priceType: 'on_request',
          unitPriceCents: null,
        }),
        createTestOfferItem({
          priceType: 'monthly',
          unitPriceCents: 1295,
          quantity: 1,
          sortOrder: 1,
        }),
      ],
    });

    const totals = calculateOfferTotals(offer);

    expect(totals.hasOnRequestItems).toBe(true);
    expect(totals.onRequestItemCount).toBe(1);
    expect(totals.monthlyItemsTotalCents).toBe(1295);
    expect(totals.oneTimeItemsTotalCents).toBe(0);
  });

  it('detects price overrides', () => {
    expect(isPriceOverridden('monthly', 1000, 1200)).toBe(true);
    expect(isPriceOverridden('monthly', 1200, 1200)).toBe(false);
    expect(isPriceOverridden('included', 0, 0)).toBe(false);
    expect(isPriceOverridden('on_request', null, null)).toBe(false);
  });

  it('resolves original unit prices by price type', () => {
    expect(resolveOriginalUnitPriceCents('included', 500)).toBe(0);
    expect(resolveOriginalUnitPriceCents('on_request', 500)).toBeNull();
    expect(resolveOriginalUnitPriceCents('monthly', 500)).toBe(500);
  });

  it('identifies billable offer items', () => {
    expect(isBillableOfferItem(createTestOfferItem({ priceType: 'monthly' }))).toBe(true);
    expect(isBillableOfferItem(createTestOfferItem({ priceType: 'one_time' }))).toBe(true);
    expect(isBillableOfferItem(createTestOfferItem({ priceType: 'included' }))).toBe(false);
    expect(isBillableOfferItem(createTestOfferItem({ priceType: 'on_request' }))).toBe(false);
  });
});
