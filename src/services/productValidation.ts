import type {
  CreateProductInput,
  ProductPriceType,
  ProductStatus,
} from '../domain/product/product';
import { normalizeFeatureList } from '../domain/product/normalizeProduct';

export type CreateProductField = keyof CreateProductInput;

export type CreateProductErrors = Partial<Record<CreateProductField, string>>;

function validateNonNegativeCents(value: number | null, label: string): string | undefined {
  if (value === null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    return `${label} darf nicht negativ sein.`;
  }

  return undefined;
}

function validatePriceForType(
  priceType: ProductPriceType,
  priceCents: number | null,
  label: string,
): string | undefined {
  if (priceType === 'on_request') {
    if (priceCents !== null) {
      return `${label}: Bei „Auf Anfrage“ darf kein Preis gespeichert werden.`;
    }

    return undefined;
  }

  if (priceType === 'included') {
    if (priceCents !== null && priceCents !== 0) {
      return `${label}: Bei „Inklusive“ muss der Preis 0 sein.`;
    }

    return undefined;
  }

  if (priceCents === null || !Number.isInteger(priceCents) || priceCents < 0) {
    return `${label}: Bitte geben Sie einen nicht negativen Preis an.`;
  }

  return undefined;
}

function validateSecondaryPrice(input: CreateProductInput): CreateProductErrors {
  const errors: CreateProductErrors = {};
  const hasSecondaryType = input.secondaryPriceType !== null;
  const hasSecondaryPrice = input.secondaryPriceCents !== null;
  const hasSecondaryLabel = Boolean(input.secondaryPriceLabel?.trim());

  if (!hasSecondaryType && !hasSecondaryPrice && !hasSecondaryLabel) {
    return errors;
  }

  if (!hasSecondaryType || !hasSecondaryPrice || !hasSecondaryLabel) {
    errors.secondaryPriceLabel =
      'Der zweite Preis muss vollständig mit Preisart, Betrag und Bezeichnung angegeben werden.';
    return errors;
  }

  const priceError = validatePriceForType(
    input.secondaryPriceType!,
    input.secondaryPriceCents,
    'Der zweite Preis',
  );

  if (priceError) {
    errors.secondaryPriceCents = priceError;
  }

  return errors;
}

export function validateCreateProductInput(input: CreateProductInput): CreateProductErrors {
  const errors: CreateProductErrors = {};

  if (!input.name.trim()) {
    errors.name = 'Bitte geben Sie einen Produktnamen ein.';
  }

  if (!input.providerName.trim()) {
    errors.providerName = 'Bitte geben Sie einen Anbieter an.';
  }

  if (!input.internalProductCode.trim()) {
    errors.internalProductCode = 'Bitte geben Sie einen internen Produktcode ein.';
  }

  const primaryPriceError = validatePriceForType(
    input.priceType,
    input.priceType === 'included' ? input.priceCents ?? 0 : input.priceCents,
    'Der Hauptpreis',
  );

  if (primaryPriceError) {
    errors.priceCents = primaryPriceError;
  }

  if (input.priceCents !== null) {
    const centError = validateNonNegativeCents(input.priceCents, 'Der Hauptpreis');
    if (centError) {
      errors.priceCents = centError;
    }
  }

  Object.assign(errors, validateSecondaryPrice(input));

  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) {
    errors.validUntil = 'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.';
  }

  return errors;
}

export function normalizeInternalProductCode(code: string): string {
  return code.trim();
}

export function isSameInternalProductCode(left: string, right: string): boolean {
  return (
    normalizeInternalProductCode(left).toLowerCase() ===
    normalizeInternalProductCode(right).toLowerCase()
  );
}

export function sanitizeProductInput(input: CreateProductInput): CreateProductInput {
  const priceCents =
    input.priceType === 'on_request'
      ? null
      : input.priceType === 'included'
        ? 0
        : input.priceCents;

  const hasCompleteSecondary =
    input.secondaryPriceType !== null &&
    input.secondaryPriceCents !== null &&
    Boolean(input.secondaryPriceLabel?.trim());

  return {
    ...input,
    name: input.name.trim(),
    providerName: input.providerName.trim(),
    internalProductCode: normalizeInternalProductCode(input.internalProductCode),
    description: input.description.trim(),
    manufacturer: input.manufacturer?.trim() || null,
    modelName: input.modelName?.trim() || null,
    priceCents,
    secondaryPriceType: hasCompleteSecondary ? input.secondaryPriceType : null,
    secondaryPriceCents: hasCompleteSecondary ? input.secondaryPriceCents : null,
    secondaryPriceLabel: hasCompleteSecondary ? input.secondaryPriceLabel?.trim() ?? null : null,
    unitLabel: input.unitLabel?.trim() || null,
    includedFeatures: normalizeFeatureList(input.includedFeatures),
    technicalFeatures: normalizeFeatureList(input.technicalFeatures),
    sourceReference: input.sourceReference.trim(),
    notes: input.notes.trim(),
  };
}

export function validateProductStatus(status: ProductStatus): boolean {
  return status === 'active' || status === 'inactive';
}
