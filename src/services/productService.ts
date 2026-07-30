import type {
  CreateProductInput,
  Product,
  ProductCategoryFilter,
  ProductStatus,
  ProductStatusFilter,
  ProductTerminalTypeFilter,
} from '../domain/product/product';
import type { UserRole } from '../domain/user/user';
import { normalizeProduct } from '../domain/product/normalizeProduct';
import { generateId, nowIso } from '../utils/id';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import { ProductNotFoundError } from '../repositories/errors/ProductNotFoundError';
import {
  isSameInternalProductCode,
  sanitizeProductInput,
  validateCreateProductInput,
  type CreateProductErrors,
} from './productValidation';

export type CreateProductResult =
  | { ok: true; product: Product }
  | { ok: false; errors: CreateProductErrors }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export type UpdateProductResult =
  | { ok: true; product: Product }
  | { ok: false; errors: CreateProductErrors }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export type SetProductStatusResult =
  | { ok: true; product: Product }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export interface ProductAdminContext {
  role: UserRole;
}

export interface ProductFilters {
  search: string;
  status: ProductStatusFilter;
  category: ProductCategoryFilter;
  terminalType: ProductTerminalTypeFilter;
}

function mapInputToFields(input: CreateProductInput) {
  const sanitized = sanitizeProductInput(input);

  return {
    name: sanitized.name,
    providerName: sanitized.providerName,
    internalProductCode: sanitized.internalProductCode,
    category: sanitized.category,
    status: sanitized.status,
    description: sanitized.description,
    manufacturer: sanitized.manufacturer,
    modelName: sanitized.modelName,
    supportedTerminalTypes: [...sanitized.supportedTerminalTypes],
    priceType: sanitized.priceType,
    priceCents: sanitized.priceCents,
    secondaryPriceType: sanitized.secondaryPriceType,
    secondaryPriceCents: sanitized.secondaryPriceCents,
    secondaryPriceLabel: sanitized.secondaryPriceLabel,
    unitLabel: sanitized.unitLabel,
    includedFeatures: [...sanitized.includedFeatures],
    technicalFeatures: [...sanitized.technicalFeatures],
    sourceReference: sanitized.sourceReference,
    notes: sanitized.notes,
    validFrom: sanitized.validFrom,
    validUntil: sanitized.validUntil,
  };
}

export class ProductService {
  private readonly productRepository: ProductRepository;

  constructor(productRepository: ProductRepository) {
    this.productRepository = productRepository;
  }

  canManageProducts(context: ProductAdminContext): boolean {
    return context.role === 'admin';
  }

  canViewProducts(_context: ProductAdminContext): boolean {
    return true;
  }

  validateCreateProductInput(input: CreateProductInput): CreateProductErrors {
    return validateCreateProductInput(input);
  }

  async getProducts(): Promise<Product[]> {
    const products = await this.productRepository.getAll();
    return products.sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.productRepository.getById(id);
  }

  async getActiveProducts(): Promise<Product[]> {
    const products = await this.getProducts();
    return products.filter((product) => product.status === 'active');
  }

  async isInternalProductCodeTaken(
    internalProductCode: string,
    excludeProductId?: string,
  ): Promise<boolean> {
    const products = await this.productRepository.getAll();
    return products.some(
      (product) =>
        product.id !== excludeProductId &&
        isSameInternalProductCode(product.internalProductCode, internalProductCode),
    );
  }

  filterProducts(products: Product[], filters: ProductFilters): Product[] {
    const normalizedQuery = filters.search.trim().toLowerCase();

    return products.filter((product) => {
      if (filters.status !== 'all' && product.status !== filters.status) {
        return false;
      }

      if (filters.category !== 'all' && product.category !== filters.category) {
        return false;
      }

      if (
        filters.terminalType !== 'all' &&
        !product.supportedTerminalTypes.includes(filters.terminalType)
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        product.name,
        product.internalProductCode,
        product.providerName,
        product.manufacturer,
        product.modelName,
        product.description,
        product.sourceReference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }

  async createProduct(
    input: CreateProductInput,
    context: ProductAdminContext,
  ): Promise<CreateProductResult> {
    if (!this.canManageProducts(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const sanitized = sanitizeProductInput(input);
    const errors = validateCreateProductInput(sanitized);

    if (await this.isInternalProductCodeTaken(sanitized.internalProductCode)) {
      errors.internalProductCode = 'Dieser interne Produktcode wird bereits verwendet.';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const timestamp = nowIso();
    const product = normalizeProduct({
      id: generateId('product'),
      ...mapInputToFields(sanitized),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      const createdProduct = await this.productRepository.create(product);
      return { ok: true, product: createdProduct };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async updateProduct(
    productId: string,
    input: CreateProductInput,
    context: ProductAdminContext,
  ): Promise<UpdateProductResult> {
    if (!this.canManageProducts(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.productRepository.getById(productId);

    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    const sanitized = sanitizeProductInput(input);
    const errors = validateCreateProductInput(sanitized);

    if (await this.isInternalProductCodeTaken(sanitized.internalProductCode, productId)) {
      errors.internalProductCode = 'Dieser interne Produktcode wird bereits verwendet.';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const updatedProduct = normalizeProduct({
      ...mapInputToFields(sanitized),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    });

    try {
      const product = await this.productRepository.update(updatedProduct);
      return { ok: true, product };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }

  async setProductStatus(
    productId: string,
    status: ProductStatus,
    context: ProductAdminContext,
  ): Promise<SetProductStatusResult> {
    if (!this.canManageProducts(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.productRepository.getById(productId);

    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    try {
      const product = await this.productRepository.update(
        normalizeProduct({
          ...existing,
          status,
          updatedAt: nowIso(),
        }),
      );
      return { ok: true, product };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }
}
