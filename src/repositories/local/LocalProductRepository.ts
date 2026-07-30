import type { Product } from '../../domain/product/product';
import { normalizeProduct, normalizeProducts } from '../../domain/product/normalizeProduct';
import { migrateProductCatalogIfNeeded } from '../../services/productCatalogMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { ProductNotFoundError } from '../errors/ProductNotFoundError';
import type { ProductRepository } from '../interfaces/ProductRepository';

export class LocalProductRepository implements ProductRepository {
  async getAll(): Promise<Product[]> {
    migrateProductCatalogIfNeeded();
    const rawProducts = readStorageItem<unknown[]>(STORAGE_KEYS.products) ?? [];
    return normalizeProducts(rawProducts);
  }

  async getById(id: string): Promise<Product | null> {
    const products = await this.getAll();
    return products.find((product) => product.id === id) ?? null;
  }

  async create(product: Product): Promise<Product> {
    const products = await this.getAll();
    const normalizedProduct = normalizeProduct(product);

    if (products.some((item) => item.id === normalizedProduct.id)) {
      throw new Error(`Product with id ${normalizedProduct.id} already exists`);
    }

    writeStorageItem(STORAGE_KEYS.products, [...products, normalizedProduct]);
    return { ...normalizedProduct };
  }

  async update(product: Product): Promise<Product> {
    const products = await this.getAll();
    const index = products.findIndex((item) => item.id === product.id);

    if (index === -1) {
      throw new ProductNotFoundError(product.id);
    }

    const normalizedProduct = normalizeProduct(product);
    const updatedProducts = [...products];
    updatedProducts[index] = normalizedProduct;
    writeStorageItem(STORAGE_KEYS.products, updatedProducts);
    return { ...normalizedProduct };
  }
}
