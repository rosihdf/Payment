import { describe, expect, it } from 'vitest';
import {
  normalizeFeatureList,
  normalizeProduct,
  normalizeProducts,
} from '../domain/product/normalizeProduct';
import { getDemoProducts } from '../services/demoDataService';

describe('Product normalization', () => {
  it('loads legacy demo product without crashing', () => {
    const normalized = normalizeProduct({
      id: 'product_legacy',
      name: 'Legacy Produkt',
      active: true,
    });

    expect(normalized.id).toBe('product_legacy');
    expect(normalized.name).toBe('Legacy Produkt');
    expect(normalized.status).toBe('active');
  });

  it('applies defaults for missing fields', () => {
    const normalized = normalizeProduct({ id: 'product_min', name: 'Minimal' });

    expect(normalized.providerName).toBe('BestPay');
    expect(normalized.status).toBe('active');
    expect(normalized.category).toBe('cash_register');
    expect(normalized.supportedTerminalTypes).toEqual([]);
    expect(normalized.priceType).toBe('monthly');
    expect(normalized.priceCents).toBe(0);
    expect(normalized.secondaryPriceType).toBeNull();
    expect(normalized.includedFeatures).toEqual([]);
    expect(normalized.validFrom).toBeNull();
    expect(normalized.validUntil).toBeNull();
  });

  it('preserves existing values', () => {
    const normalized = normalizeProduct({
      id: 'product_full',
      name: 'Vollständig',
      providerName: 'BestPay',
      internalProductCode: 'BP-FULL',
      category: 'accessory',
      status: 'inactive',
      supportedTerminalTypes: ['mobile'],
      priceType: 'one_time',
      priceCents: 4995,
      secondaryPriceType: 'monthly',
      secondaryPriceCents: 995,
      secondaryPriceLabel: 'Zusatzoption',
    });

    expect(normalized.internalProductCode).toBe('BP-FULL');
    expect(normalized.category).toBe('accessory');
    expect(normalized.status).toBe('inactive');
    expect(normalized.supportedTerminalTypes).toEqual(['mobile']);
    expect(normalized.priceCents).toBe(4995);
    expect(normalized.secondaryPriceCents).toBe(995);
  });

  it('deduplicates feature lists case-insensitively', () => {
    const normalized = normalizeProduct({
      id: 'product_features',
      name: 'Features',
      includedFeatures: ['TSE', 'tse', '  TSE  ', 'GoBD', ''],
      technicalFeatures: ['Android', 'android'],
    });

    expect(normalized.includedFeatures).toEqual(['TSE', 'GoBD']);
    expect(normalized.technicalFeatures).toEqual(['Android']);
  });

  it('normalizes feature list helper independently', () => {
    expect(normalizeFeatureList(['A', 'a', 'B', ''])).toEqual(['A', 'B']);
  });

  it('forces primary price to null for on_request', () => {
    const normalized = normalizeProduct({
      id: 'product_on_request',
      name: 'Auf Anfrage',
      priceType: 'on_request',
      priceCents: 9999,
    });

    expect(normalized.priceType).toBe('on_request');
    expect(normalized.priceCents).toBeNull();
  });

  it('defaults included price to zero', () => {
    const normalized = normalizeProduct({
      id: 'product_included',
      name: 'Inklusive',
      priceType: 'included',
      priceCents: null,
    });

    expect(normalized.priceType).toBe('included');
    expect(normalized.priceCents).toBe(0);
  });

  it('defaults monthly and one_time prices to zero when missing', () => {
    const monthly = normalizeProduct({
      id: 'product_monthly',
      name: 'Monatlich',
      priceType: 'monthly',
      priceCents: null,
    });
    const oneTime = normalizeProduct({
      id: 'product_one_time',
      name: 'Einmalig',
      priceType: 'one_time',
      priceCents: null,
    });

    expect(monthly.priceCents).toBe(0);
    expect(oneTime.priceCents).toBe(0);
  });

  it('clears secondary price when secondary type is missing', () => {
    const normalized = normalizeProduct({
      id: 'product_secondary',
      name: 'Sekundär',
      secondaryPriceType: null,
      secondaryPriceCents: 1995,
      secondaryPriceLabel: 'Option',
    });

    expect(normalized.secondaryPriceCents).toBeNull();
  });

  it('normalizes demo catalog with nineteen products', () => {
    const products = getDemoProducts();

    expect(products).toHaveLength(19);
    expect(products.some((product) => product.id === 'product_bestpay_premium_line_register')).toBe(
      true,
    );
    expect(products.some((product) => product.priceType === 'on_request')).toBe(true);
  });

  it('normalizes product arrays', () => {
    const products = normalizeProducts([
      { id: 'product_a', name: 'A' },
      { id: 'product_b', name: 'B' },
    ]);

    expect(products).toHaveLength(2);
    expect(products[0]?.providerName).toBe('BestPay');
    expect(products[1]?.providerName).toBe('BestPay');
  });
});
