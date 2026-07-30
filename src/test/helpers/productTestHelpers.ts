import type { CreateProductInput, Product } from '../../domain/product/product';
import { nowIso } from '../../utils/id';

export function createValidProductInput(
  overrides: Partial<CreateProductInput> = {},
): CreateProductInput {
  return {
    name: 'Test Produkt',
    providerName: 'BestPay',
    internalProductCode: 'BP-TEST-001',
    category: 'cash_register',
    status: 'active',
    description: 'Testbeschreibung',
    manufacturer: null,
    modelName: null,
    supportedTerminalTypes: ['stationary'],
    priceType: 'monthly',
    priceCents: 1995,
    secondaryPriceType: null,
    secondaryPriceCents: null,
    secondaryPriceLabel: null,
    unitLabel: 'je Gerät',
    includedFeatures: [],
    technicalFeatures: [],
    sourceReference: 'Testquelle',
    notes: 'Interne Notiz',
    validFrom: null,
    validUntil: null,
    ...overrides,
  };
}

export function createTestProduct(overrides: Partial<Product> = {}): Product {
  const timestamp = nowIso();

  return {
    id: 'product_test',
    ...createValidProductInput(),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createUniqueProductInput(suffix: string): CreateProductInput {
  return createValidProductInput({
    name: `Test Produkt ${suffix}`,
    internalProductCode: `BP-TEST-${suffix}`,
  });
}

export function createProductWithId(id: string, input?: Partial<CreateProductInput>): Product {
  const timestamp = nowIso();
  return {
    id,
    ...createValidProductInput(input),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
