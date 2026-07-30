import { beforeEach, describe, expect, it } from 'vitest';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { ProductService } from '../services/productService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import {
  createUniqueProductInput,
  createValidProductInput,
} from './helpers/productTestHelpers';

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    productService = new ProductService(new LocalProductRepository());
  });

  it('allows admin to create product', async () => {
    const input = createUniqueProductInput('ADMIN-CREATE');
    const result = await productService.createProduct(input, { role: 'admin' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.internalProductCode).toBe('BP-TEST-ADMIN-CREATE');
    }
  });

  it('forbids field service from creating product', async () => {
    const result = await productService.createProduct(createUniqueProductInput('FS-CREATE'), {
      role: 'field_service',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('allows admin to update product', async () => {
    const products = await productService.getProducts();
    const target = products[0]!;

    const result = await productService.updateProduct(
      target.id,
      {
        ...createValidProductInput({ internalProductCode: target.internalProductCode }),
        name: 'Neuer Produktname',
      },
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.name).toBe('Neuer Produktname');
    }
  });

  it('forbids field service from updating product', async () => {
    const products = await productService.getProducts();
    const target = products[0]!;

    const result = await productService.updateProduct(
      target.id,
      createValidProductInput({ internalProductCode: target.internalProductCode }),
      { role: 'field_service' },
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('prevents duplicate internal product codes', async () => {
    const products = await productService.getProducts();
    const existingCode = products[0]!.internalProductCode;

    const result = await productService.createProduct(
      createValidProductInput({ internalProductCode: existingCode }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok && 'errors' in result) {
      expect(result.errors.internalProductCode).toBe(
        'Dieser interne Produktcode wird bereits verwendet.',
      );
    }
  });

  it('compares internal product codes case-insensitively', async () => {
    const products = await productService.getProducts();
    const existingCode = products[0]!.internalProductCode;

    const result = await productService.createProduct(
      createValidProductInput({ internalProductCode: existingCode.toLowerCase() }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(false);
  });

  it('allows keeping own internal product code on update', async () => {
    const products = await productService.getProducts();
    const target = products[0]!;

    const result = await productService.updateProduct(
      target.id,
      createValidProductInput({
        internalProductCode: target.internalProductCode,
        name: 'Aktualisiert',
      }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
  });

  it('sets timestamps on create', async () => {
    const result = await productService.createProduct(createUniqueProductInput('TS-CREATE'), {
      role: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.createdAt).toBeTruthy();
      expect(result.product.updatedAt).toBeTruthy();
      expect(result.product.createdAt).toBe(result.product.updatedAt);
    }
  });

  it('preserves createdAt on update', async () => {
    const products = await productService.getProducts();
    const target = products[0]!;

    const result = await productService.updateProduct(
      target.id,
      createValidProductInput({
        internalProductCode: target.internalProductCode,
        name: 'Update TS',
      }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.createdAt).toBe(target.createdAt);
      expect(result.product.updatedAt).not.toBe(target.updatedAt);
    }
  });

  it('deactivates product via setProductStatus', async () => {
    const products = await productService.getProducts();
    const activeProduct = products.find((product) => product.status === 'active')!;

    const result = await productService.setProductStatus(activeProduct.id, 'inactive', {
      role: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.status).toBe('inactive');
    }
  });

  it('filters products by search, status, category and terminal type', async () => {
    const products = await productService.getProducts();

    const bySearch = productService.filterProducts(products, {
      search: 'BP-A920-SIM',
      status: 'all',
      category: 'all',
      terminalType: 'all',
    });
    expect(bySearch.some((product) => product.internalProductCode === 'BP-A920-SIM')).toBe(true);
    expect(bySearch.some((product) => product.internalProductCode === 'BP-CASH-T2')).toBe(false);

    const byCategory = productService.filterProducts(products, {
      search: '',
      status: 'all',
      category: 'accessory',
      terminalType: 'all',
    });
    expect(byCategory.every((product) => product.category === 'accessory')).toBe(true);

    const byTerminal = productService.filterProducts(products, {
      search: '',
      status: 'all',
      category: 'all',
      terminalType: 'mobile',
    });
    expect(
      byTerminal.every((product) => product.supportedTerminalTypes.includes('mobile')),
    ).toBe(true);
  });

  it('returns only active products from getActiveProducts', async () => {
    const products = await productService.getProducts();
    const target = products.find((product) => product.status === 'active')!;

    await productService.setProductStatus(target.id, 'inactive', { role: 'admin' });

    const activeProducts = await productService.getActiveProducts();
    expect(activeProducts.some((product) => product.id === target.id)).toBe(false);
    expect(activeProducts.every((product) => product.status === 'active')).toBe(true);
  });
});
