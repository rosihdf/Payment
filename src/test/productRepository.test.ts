import { beforeEach, describe, expect, it } from 'vitest';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { ProductNotFoundError } from '../repositories/errors/ProductNotFoundError';
import {
  clearDemoDataForTests,
  getDemoProducts,
  resetDemoDataForTests,
} from '../services/demoDataService';
import { createTestProduct } from './helpers/productTestHelpers';

describe('LocalProductRepository', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('creates a product', async () => {
    const repository = new LocalProductRepository();
    const initialCount = (await repository.getAll()).length;
    const product = createTestProduct({ id: 'product_new' });

    const created = await repository.create(product);

    expect((await repository.getAll()).length).toBe(initialCount + 1);
    expect(created.id).toBe('product_new');
    expect(await repository.getById('product_new')).toEqual(created);
  });

  it('updates an existing product', async () => {
    const repository = new LocalProductRepository();
    const existing = (await repository.getAll())[0]!;

    const updated = await repository.update({
      ...existing,
      name: 'Aktualisiertes Produkt',
      updatedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(updated.name).toBe('Aktualisiertes Produkt');
    expect((await repository.getById(existing.id))?.name).toBe('Aktualisiertes Produkt');
  });

  it('throws on update with unknown id', async () => {
    const repository = new LocalProductRepository();
    const product = createTestProduct({ id: 'product_missing' });

    await expect(repository.update(product)).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('does not create a new product on update', async () => {
    const repository = new LocalProductRepository();
    const countBefore = (await repository.getAll()).length;
    const product = createTestProduct({ id: 'product_unknown' });

    await expect(repository.update(product)).rejects.toThrow();
    expect((await repository.getAll()).length).toBe(countBefore);
  });

  it('returns null for unknown id', async () => {
    const repository = new LocalProductRepository();

    expect(await repository.getById('product_does_not_exist')).toBeNull();
  });

  it('returns defensive copies from create and update', async () => {
    const repository = new LocalProductRepository();
    const product = createTestProduct({ id: 'product_copy_test', name: 'Original' });

    const created = await repository.create(product);
    created.name = 'Mutiert';

    expect((await repository.getById('product_copy_test'))?.name).toBe('Original');

    const existing = (await repository.getById('product_copy_test'))!;
    const updated = await repository.update({ ...existing, name: 'Geändert' });
    updated.name = 'Erneut mutiert';

    expect((await repository.getById('product_copy_test'))?.name).toBe('Geändert');
  });

  it('keeps deactivated product stored', async () => {
    const repository = new LocalProductRepository();
    const existing = (await repository.getAll())[0]!;

    await repository.update({ ...existing, status: 'inactive' });

    const stored = await repository.getById(existing.id);
    expect(stored?.status).toBe('inactive');
    expect((await repository.getAll()).length).toBe(getDemoProducts().length);
  });
});
