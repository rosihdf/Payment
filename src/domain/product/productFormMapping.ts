import type { CreateProductInput, Product } from './product';

export function productToFormInput(product: Product): CreateProductInput {
  return {
    name: product.name,
    providerName: product.providerName,
    internalProductCode: product.internalProductCode,
    category: product.category,
    status: product.status,
    description: product.description,
    manufacturer: product.manufacturer,
    modelName: product.modelName,
    supportedTerminalTypes: [...product.supportedTerminalTypes],
    priceType: product.priceType,
    priceCents: product.priceCents,
    secondaryPriceType: product.secondaryPriceType,
    secondaryPriceCents: product.secondaryPriceCents,
    secondaryPriceLabel: product.secondaryPriceLabel,
    unitLabel: product.unitLabel,
    includedFeatures: [...product.includedFeatures],
    technicalFeatures: [...product.technicalFeatures],
    sourceReference: product.sourceReference,
    notes: product.notes,
    validFrom: product.validFrom,
    validUntil: product.validUntil,
  };
}

export function isSameProductInput(left: CreateProductInput, right: CreateProductInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
