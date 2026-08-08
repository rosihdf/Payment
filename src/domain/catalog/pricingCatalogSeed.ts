import { BESTPAY_A920_TARIFFS_RAW } from '../tariff/bestPayTariffs';
import type { ContractTerm } from '../pricing/contractTerm';
import type { PriceBook, PriceBookVersion } from '../pricing/priceBook';
import type { PriceRule } from '../pricing/priceRule';

/**
 * Produktive Ausgangskonfiguration – Preise abgeleitet aus kanonischen Tarifgebühren
 * (monthlyTerminalRentalCents + monthlyServiceFeePerTerminalCents), nicht erfunden.
 */
export const PRODUCTION_PRICE_BOOK_ID = 'price_book_bestpay_v1';
export const PRODUCTION_PRICE_BOOK_VERSION_ID = 'price_book_version_bestpay_v1';
export const PRODUCTION_CONTRACT_TERM_24_ID = 'contract_term_24';
export const PRODUCTION_CONTRACT_TERM_36_ID = 'contract_term_36';
export const PRODUCTION_CONTRACT_TERM_48_ID = 'contract_term_48';
export const PRODUCTION_PRICE_RULE_GENERAL_ID = 'price_rule_bestpay_general';
export const PRODUCTION_PRICE_RULE_TARIFF_CLASSIC_ID = 'price_rule_tariff_bestpay_a920_classic';
export const PRODUCTION_PRICE_RULE_TARIFF_FLAT_ID = 'price_rule_tariff_bestpay_a920_flat';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function monthlyTariffListPriceCents(tariffId: string): number {
  const tariff = BESTPAY_A920_TARIFFS_RAW.find((entry) => entry.id === tariffId);
  if (!tariff) {
    return 0;
  }
  return tariff.monthlyTerminalRentalCents + tariff.monthlyServiceFeePerTerminalCents;
}

function basePriceRule(overrides: Partial<PriceRule>): PriceRule {
  return {
    id: PRODUCTION_PRICE_RULE_GENERAL_ID,
    priceBookVersionId: PRODUCTION_PRICE_BOOK_VERSION_ID,
    name: 'Allgemeine Regel',
    status: 'active',
    contractTypeId: null,
    productId: null,
    tariffId: null,
    contractTermId: null,
    industryId: null,
    priority: 10,
    combinable: false,
    listPriceCents: null,
    targetPriceCents: null,
    minimumPriceCents: null,
    maxDiscountPercentTenths: null,
    unit: 'monthly',
    currency: 'EUR',
    validFrom: '2026-01-01',
    validUntil: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function createProductionPricingCatalog(): {
  priceBooks: PriceBook[];
  priceBookVersions: PriceBookVersion[];
  contractTerms: ContractTerm[];
  priceRules: PriceRule[];
} {
  const classicMonthlyCents = monthlyTariffListPriceCents('tariff_bestpay_a920_classic');
  const flatMonthlyCents = monthlyTariffListPriceCents('tariff_bestpay_a920_flat');

  return {
    priceBooks: [
      {
        id: PRODUCTION_PRICE_BOOK_ID,
        code: 'BESTPAY-A920',
        name: 'BestPay Mobile A920',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    priceBookVersions: [
      {
        id: PRODUCTION_PRICE_BOOK_VERSION_ID,
        priceBookId: PRODUCTION_PRICE_BOOK_ID,
        versionNumber: 1,
        status: 'published',
        validFrom: '2026-01-01',
        validUntil: null,
        publishedAt: TIMESTAMP,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    contractTerms: [
      {
        id: PRODUCTION_CONTRACT_TERM_24_ID,
        contractTypeId: null,
        name: '24 Monate (historisch)',
        months: 24,
        isStandard: false,
        status: 'active',
        validFrom: '2026-01-01',
        validUntil: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: PRODUCTION_CONTRACT_TERM_36_ID,
        contractTypeId: null,
        name: '36 Monate',
        months: 36,
        isStandard: false,
        status: 'active',
        validFrom: '2026-01-01',
        validUntil: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: PRODUCTION_CONTRACT_TERM_48_ID,
        contractTypeId: null,
        name: '48 Monate',
        months: 48,
        isStandard: false,
        status: 'active',
        validFrom: '2026-01-01',
        validUntil: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    priceRules: [
      basePriceRule({
        id: PRODUCTION_PRICE_RULE_GENERAL_ID,
        name: 'Allgemeine Monatsgebühr',
        priority: 5,
        listPriceCents: classicMonthlyCents,
        targetPriceCents: classicMonthlyCents,
        minimumPriceCents: classicMonthlyCents,
      }),
      basePriceRule({
        id: PRODUCTION_PRICE_RULE_TARIFF_CLASSIC_ID,
        name: 'BestPay A920 Classic Monatsgebühr',
        tariffId: 'tariff_bestpay_a920_classic',
        priority: 20,
        listPriceCents: classicMonthlyCents,
        targetPriceCents: classicMonthlyCents,
        minimumPriceCents: classicMonthlyCents,
      }),
      basePriceRule({
        id: PRODUCTION_PRICE_RULE_TARIFF_FLAT_ID,
        name: 'BestPay A920 Flat Monatsgebühr',
        tariffId: 'tariff_bestpay_a920_flat',
        priority: 20,
        listPriceCents: flatMonthlyCents,
        targetPriceCents: flatMonthlyCents,
        minimumPriceCents: flatMonthlyCents,
      }),
    ],
  };
}
