import type { Product } from '../../domain/product/product';
import { normalizeProduct, normalizeProducts } from '../../domain/product/normalizeProduct';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { ProductNotFoundError } from '../errors/ProductNotFoundError';
import type { ProductRepository } from '../interfaces/ProductRepository';

interface ProductRow {
  id: string;
  name: string;
  internal_product_code: string;
  category: string;
  status: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

function productToRow(product: Product): ProductRow {
  const normalized = normalizeProduct(product);
  return {
    id: normalized.id,
    name: normalized.name,
    internal_product_code: normalized.internalProductCode,
    category: normalized.category,
    status: normalized.status,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToProduct(row: ProductRow): Product {
  return normalizeProduct(row.data ?? {
    id: row.id,
    name: row.name,
    internalProductCode: row.internal_product_code,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SupabaseProductRepository implements ProductRepository {
  async getAll(): Promise<Product[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('products').select('*').order('name');
    if (error) {
      throw new Error(`Produkte laden fehlgeschlagen: ${error.message}`);
    }
    return normalizeProducts((data as ProductRow[]).map((row) => rowToProduct(row)));
  }

  async getById(id: string): Promise<Product | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Produkt laden fehlgeschlagen: ${error.message}`);
    }
    return data ? rowToProduct(data as ProductRow) : null;
  }

  async create(product: Product): Promise<Product> {
    const client = getSupabaseClient();
    const row = productToRow(product);
    const { data, error } = await client.from('products').insert(row).select('*').single();
    if (error) {
      throw new Error(`Produkt anlegen fehlgeschlagen: ${error.message}`);
    }
    return rowToProduct(data as ProductRow);
  }

  async update(product: Product): Promise<Product> {
    const existing = await this.getById(product.id);
    if (!existing) {
      throw new ProductNotFoundError(product.id);
    }

    const client = getSupabaseClient();
    const row = productToRow(product);
    const { data, error } = await client
      .from('products')
      .update(row)
      .eq('id', product.id)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Produkt aktualisieren fehlgeschlagen: ${error.message}`);
    }
    return rowToProduct(data as ProductRow);
  }
}
