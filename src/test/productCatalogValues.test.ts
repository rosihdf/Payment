import { describe, expect, it } from 'vitest';
import { getDemoProducts } from '../services/demoDataService';

describe('BestPay product catalog values', () => {
  const products = getDemoProducts();

  function expectProduct(
    internalProductCode: string,
    expected: {
      priceType: 'monthly' | 'one_time' | 'included' | 'on_request';
      priceCents: number | null;
      secondaryPriceType?: 'monthly' | 'one_time' | 'included' | 'on_request' | null;
      secondaryPriceCents?: number | null;
    },
  ) {
    const product = products.find((item) => item.internalProductCode === internalProductCode);
    expect(product).toBeDefined();
    expect(product?.priceType).toBe(expected.priceType);
    expect(product?.priceCents).toBe(expected.priceCents);

    if ('secondaryPriceType' in expected) {
      expect(product?.secondaryPriceType).toBe(expected.secondaryPriceType ?? null);
    }

    if ('secondaryPriceCents' in expected) {
      expect(product?.secondaryPriceCents).toBe(expected.secondaryPriceCents ?? null);
    }
  }

  it('contains nineteen catalog products', () => {
    expect(products).toHaveLength(19);
  });

  it('stores Premium Line prices from spec', () => {
    expectProduct('BP-CASH-PREMIUM-LINE', {
      priceType: 'monthly',
      priceCents: 11995,
      secondaryPriceType: 'one_time',
      secondaryPriceCents: 24995,
    });
    expectProduct('BP-SERVICE-PREMIUM-SETUP', {
      priceType: 'one_time',
      priceCents: 39995,
    });
  });

  it('stores Speedypay module prices from spec', () => {
    expectProduct('BP-MODULE-PRINTER', { priceType: 'monthly', priceCents: 1295 });
    expectProduct('BP-MODULE-SIGNATURE-SERVER', { priceType: 'monthly', priceCents: 995 });
    expectProduct('BP-MODULE-TSE-SD', { priceType: 'monthly', priceCents: 995 });
    expectProduct('BP-MODULE-TSE-USB', { priceType: 'monthly', priceCents: 995 });
    expectProduct('BP-MODULE-CASH-DRAWER-S', { priceType: 'monthly', priceCents: 595 });
    expectProduct('BP-MODULE-CASH-DRAWER-L', { priceType: 'monthly', priceCents: 795 });
  });

  it('stores CCV cash register prices from spec', () => {
    expectProduct('BP-CASH-CCV-A960', { priceType: 'monthly', priceCents: 6995 });
    expectProduct('BP-CASH-CCV-A920', { priceType: 'monthly', priceCents: 6495 });
    expectProduct('BP-CASH-CCV-A77', { priceType: 'monthly', priceCents: 6495 });
  });

  it('stores A920 accessory prices from spec', () => {
    expectProduct('BP-A920-DISPLAY-LOGO', { priceType: 'one_time', priceCents: 14995 });
    expectProduct('BP-A920-RECEIPT-ROLLS-50', { priceType: 'one_time', priceCents: 4950 });
    expectProduct('BP-A920-SIM', { priceType: 'monthly', priceCents: 495 });
    expectProduct('BP-A920-CASE', { priceType: 'one_time', priceCents: 3995 });
    expectProduct('BP-A920-HOLDER', { priceType: 'one_time', priceCents: 8995 });
  });

  it('marks blanko offer cash registers as on_request without stored price', () => {
    expectProduct('BP-CASH-T2', { priceType: 'on_request', priceCents: null });
    expectProduct('BP-CASH-V3', { priceType: 'on_request', priceCents: null });
    expectProduct('BP-CASH-A920-REGISTER', { priceType: 'on_request', priceCents: null });
  });
});
