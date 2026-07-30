import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import type { Product } from '../domain/product/product';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { DEFAULT_CREATE_PRODUCT_INPUT } from '../domain/product/productDefaults';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import * as storageModule from '../utils/storage';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function getStoredProducts(): Product[] {
  const raw = localStorage.getItem(STORAGE_KEYS.products);
  return raw ? normalizeProducts(JSON.parse(raw) as unknown[]) : [];
}

function renderAtRoute(initialRoute: string, resetData = true, currentUserId = 'user_004') {
  if (resetData) {
    clearDemoDataForTests();
    resetDemoDataForTests();
  }
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

async function fillRequiredProductFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Produktname'), 'Neues Demo Produkt');
  await user.type(screen.getByLabelText('Interner Produktcode'), 'BP-NEW-001');
}

describe('Product form UI', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('validates required fields on create', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await user.click(await screen.findByRole('button', { name: 'Produkt speichern' }));

    expect(await screen.findByText('Bitte geben Sie einen Produktnamen ein.')).toBeInTheDocument();
    expect(
      screen.getByText('Bitte geben Sie einen internen Produktcode ein.'),
    ).toBeInTheDocument();
  });

  it('prefills existing product on edit', async () => {
    renderAtRoute('/admin/products/product_bestpay_premium_line_register/edit');

    expect(await screen.findByLabelText('Produktname')).toHaveValue(
      'BestPay Premium Line Kassensystem',
    );
    expect(screen.getByLabelText('Interner Produktcode')).toHaveValue('BP-CASH-PREMIUM-LINE');
    expect(screen.getByRole('button', { name: 'Stationär' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('creates product and navigates to overview', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await fillRequiredProductFields(user);
    await user.click(screen.getByRole('button', { name: 'Produkt speichern' }));

    await waitFor(() => {
      expect(getStoredProducts().some((product) => product.name === 'Neues Demo Produkt')).toBe(
        true,
      );
    });

    renderAtRoute('/admin/products', false);
    expect(await screen.findByText('Neues Demo Produkt')).toBeInTheDocument();
  });

  it('prevents duplicate internal product code', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await user.type(await screen.findByLabelText('Produktname'), 'Duplikat Produkt');
    await user.type(screen.getByLabelText('Interner Produktcode'), 'bp-cash-premium-line');
    await user.click(screen.getByRole('button', { name: 'Produkt speichern' }));

    expect(
      await screen.findByText('Dieser interne Produktcode wird bereits verwendet.'),
    ).toBeInTheDocument();
  });

  it('updates product and navigates to overview', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/product_bestpay_premium_line_register/edit');

    const nameField = await screen.findByLabelText('Produktname');
    await user.clear(nameField);
    await user.type(nameField, 'BestPay Premium Line Plus');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(
        getStoredProducts().some((product) => product.name === 'BestPay Premium Line Plus'),
      ).toBe(true);
    });

    renderAtRoute('/admin/products', false);
    expect(await screen.findByText('BestPay Premium Line Plus')).toBeInTheDocument();
  });

  it('shows cancel dialog when form is dirty', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await user.type(await screen.findByLabelText('Produktname'), 'Abbruch Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });

  it('navigates back on cancel without changes', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));

    expect(navigateMock).toHaveBeenCalledWith('/admin/products', { replace: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps form data on storage error', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await fillRequiredProductFields(user);

    const originalWrite = storageModule.writeStorageItem.bind(storageModule);
    const writeSpy = vi.spyOn(storageModule, 'writeStorageItem').mockImplementation((key, value) => {
      if (key === STORAGE_KEYS.products) {
        throw new Error('quota exceeded');
      }

      return originalWrite(key, value);
    });

    try {
      await user.click(screen.getByRole('button', { name: 'Produkt speichern' }));

      expect(await screen.findByLabelText('Produktname')).toHaveValue('Neues Demo Produkt');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Produkt speichern' })).toBeEnabled();
      });
      expect(navigateMock).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('prevents double submit while saving', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/new');

    await fillRequiredProductFields(user);
    const submitButton = screen.getByRole('button', { name: 'Produkt speichern' });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });
});

describe('Product form mapping', () => {
  it('detects unchanged default input', async () => {
    renderAtRoute('/admin/products/new');
    expect(await screen.findByLabelText('Anbieter')).toHaveValue(
      DEFAULT_CREATE_PRODUCT_INPUT.providerName,
    );
    expect(screen.getByLabelText('Produktname')).toHaveValue('');
  });
});
