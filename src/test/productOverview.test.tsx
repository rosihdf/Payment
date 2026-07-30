import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';

function renderAtRoute(initialRoute: string, currentUserId = 'user_001') {
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

  it('shows active catalog products for field service', async () => {
    renderAtRoute('/products');

    expect(await screen.findByRole('heading', { name: 'Produkte' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Premium Line Kassensystem')).toBeInTheDocument();
    expect(screen.getByText('A920 SIM-Karte')).toBeInTheDocument();
  });

  it('shows Premium Line prices correctly', async () => {
    renderAtRoute('/products');

    expect(await screen.findByText('BestPay Premium Line Kassensystem')).toBeInTheDocument();
    expect(screen.getByText('119,95 € / Monat')).toBeInTheDocument();
    expect(screen.getByText('249,95 € einmalig')).toBeInTheDocument();
  });

  it('shows on_request products without fixed price', async () => {
    renderAtRoute('/products');

    expect(await screen.findByText('Speedypay T2')).toBeInTheDocument();
    expect(screen.getAllByText('Preis auf Anfrage').length).toBeGreaterThan(0);
  });

  it('filters by name search', async () => {
    const user = userEvent.setup();
    renderAtRoute('/products');

    await user.type(await screen.findByLabelText('Suche'), 'Bonrollen');

    await waitFor(() => {
      expect(screen.getByText('A920 Bonrollenpaket')).toBeInTheDocument();
      expect(screen.queryByText('A920 SIM-Karte')).not.toBeInTheDocument();
    });
  });

  it('filters by internal product code search', async () => {
    const user = userEvent.setup();
    renderAtRoute('/products');

    await user.type(await screen.findByLabelText('Suche'), 'BP-A920-CASE');

    await waitFor(() => {
      expect(screen.getByText('A920 Terminalhülle')).toBeInTheDocument();
      expect(screen.queryByText('A920 Terminalhalterung')).not.toBeInTheDocument();
    });
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    renderAtRoute('/products');

    await user.click(await screen.findByRole('button', { name: 'Zubehör' }));

    await waitFor(() => {
      expect(screen.getByText('A920 Terminalhülle')).toBeInTheDocument();
      expect(screen.queryByText('BestPay Premium Line Kassensystem')).not.toBeInTheDocument();
    });
  });

  it('hides inactive products from overview', async () => {
    clearDemoDataForTests();
    resetDemoDataForTests();

    const repository = new LocalProductRepository();
    const products = await repository.getAll();
    const target = products.find((product) => product.name === 'A920 SIM-Karte')!;
    await repository.update({ ...target, status: 'inactive' });

    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');

    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: ['/products'],
    });

    render(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Produkte' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('A920 SIM-Karte')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    renderAtRoute('/products');

    await user.type(await screen.findByLabelText('Suche'), 'NichtVorhanden123');

    expect(await screen.findByText('Keine Produkte gefunden')).toBeInTheDocument();
  });
});
