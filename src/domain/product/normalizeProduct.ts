import { generateId, nowIso } from '../../utils/id';
import type { TerminalType } from '../tariff/tariff';
import type {
  Product,
  ProductCategory,
  ProductPriceType,
  ProductStatus,
} from './product';

const VALID_CATEGORIES = new Set<ProductCategory>([
  'payment_terminal',
  'cash_register',
  'cash_register_module',
  'accessory',
  'service',
]);

const VALID_PRICE_TYPES = new Set<ProductPriceType>([
  'monthly',
  'one_time',
  'included',
  'on_request',
]);

const VALID_STATUSES = new Set<ProductStatus>(['active', 'inactive']);

const VALID_TERMINAL_TYPES = new Set<TerminalType>([
  'stationary',
  'mobile',
  'softpos',
  'ecommerce',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown): string | null {
  const raw = asString(value);
  return raw || null;
}

function asNullableNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function normalizeCategory(value: unknown): ProductCategory {
  const raw = asString(value) as ProductCategory;
  return VALID_CATEGORIES.has(raw) ? raw : 'cash_register';
}

function normalizePriceType(value: unknown): ProductPriceType {
  const raw = asString(value) as ProductPriceType;
  return VALID_PRICE_TYPES.has(raw) ? raw : 'monthly';
}

function normalizeNullablePriceType(value: unknown): ProductPriceType | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const raw = asString(value) as ProductPriceType;
  return VALID_PRICE_TYPES.has(raw) ? raw : null;
}

function normalizeStatus(value: unknown): ProductStatus {
  const raw = asString(value) as ProductStatus;
  return VALID_STATUSES.has(raw) ? raw : 'active';
}

function normalizeTerminalTypes(value: unknown): TerminalType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TerminalType =>
    VALID_TERMINAL_TYPES.has(item as TerminalType),
  );
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const trimmed = asString(item);
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value);
  return raw || null;
}

function normalizePriceCentsForType(
  priceType: ProductPriceType,
  priceCents: number | null,
): number | null {
  if (priceType === 'on_request') {
    return null;
  }

  if (priceType === 'included') {
    return priceCents ?? 0;
  }

  return priceCents ?? 0;
}

export function normalizeProduct(raw: unknown): Product {
  const data = asRecord(raw);
  const id = asString(data.id) || generateId('product');
  const timestamp = nowIso();
  const priceType = normalizePriceType(data.priceType);
  const secondaryPriceType = normalizeNullablePriceType(data.secondaryPriceType);

  return {
    id,
    name: asString(data.name),
    providerName: asString(data.providerName) || 'BestPay',
    internalProductCode: asString(data.internalProductCode),
    category: normalizeCategory(data.category),
    status: normalizeStatus(data.status),
    description: asString(data.description),
    manufacturer: asNullableString(data.manufacturer),
    modelName: asNullableString(data.modelName),
    supportedTerminalTypes: normalizeTerminalTypes(data.supportedTerminalTypes),
    priceType,
    priceCents: normalizePriceCentsForType(
      priceType,
      data.priceCents === null || data.priceCents === undefined || data.priceCents === ''
        ? null
        : asNullableNonNegativeInteger(data.priceCents),
    ),
    secondaryPriceType,
    secondaryPriceCents:
      secondaryPriceType === null
        ? null
        : normalizePriceCentsForType(
            secondaryPriceType,
            data.secondaryPriceCents === null ||
              data.secondaryPriceCents === undefined ||
              data.secondaryPriceCents === ''
              ? null
              : asNullableNonNegativeInteger(data.secondaryPriceCents),
          ),
    secondaryPriceLabel: asNullableString(data.secondaryPriceLabel),
    unitLabel: asNullableString(data.unitLabel),
    includedFeatures: normalizeStringList(data.includedFeatures),
    technicalFeatures: normalizeStringList(data.technicalFeatures),
    sourceReference: asString(data.sourceReference),
    notes: asString(data.notes),
    validFrom: normalizeDate(data.validFrom),
    validUntil: normalizeDate(data.validUntil),
    createdAt: asString(data.createdAt) || timestamp,
    updatedAt: asString(data.updatedAt) || timestamp,
  };
}

export function normalizeProducts(rawProducts: unknown[]): Product[] {
  return rawProducts.map((product) => normalizeProduct(product));
}

export function normalizeFeatureList(features: string[]): string[] {
  return normalizeStringList(features);
}
