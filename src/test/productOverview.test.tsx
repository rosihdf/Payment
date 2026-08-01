import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { adminCatalogPath } from '../utils/routes';

function renderAtRoute(initialRoute: string, currentUserId = 'user_004') {
  clearDemoDataForTests();
  resetDemoDataForTests();
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

describe('Product overview UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('leitet /products in den Admin-Katalog um', async () => {
    const router = renderAtRoute('/products', 'user_004');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/catalog');
      expect(router.state.location.search).toBe('?tab=products');
    });
  });

  it('shows active catalog products for admin', async () => {
    renderAtRoute(adminCatalogPath('products'));

    expect(await screen.findByRole('heading', { name: 'Produkte & Konditionen' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Premium Line Kassensystem')).toBeInTheDocument();
    expect(screen.getByText('A920 SIM-Karte')).toBeInTheDocument();
  });
});
