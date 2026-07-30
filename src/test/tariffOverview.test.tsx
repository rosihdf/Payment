import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

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

describe('Tariff overview UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('shows A920 tariffs for admin', async () => {
    renderAtRoute('/admin/tariffs');

    expect(await screen.findByRole('heading', { name: 'Tarifverwaltung' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
    expect(screen.getByText('BestPay Mobile A920 Flat')).toBeInTheDocument();
    expect(screen.queryByText('BestPay Start')).not.toBeInTheDocument();
  });

  it('shows create action for admin', async () => {
    renderAtRoute('/admin/tariffs');

    expect(await screen.findByRole('link', { name: 'Tarif anlegen' })).toHaveAttribute(
      'href',
      '/admin/tariffs/new',
    );
  });

  it('shows access denied for field service', async () => {
    renderAtRoute('/admin/tariffs', 'user_001');

    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('filters by name search', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs');

    await user.type(await screen.findByLabelText('Suche'), 'Flat');

    await waitFor(() => {
      expect(screen.getByText('BestPay Mobile A920 Flat')).toBeInTheDocument();
      expect(screen.queryByText('BestPay Mobile A920 Classic')).not.toBeInTheDocument();
    });
  });

  it('filters by product code search', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs');

    await user.type(await screen.findByLabelText('Suche'), 'BP-A920-CLASSIC');

    await waitFor(() => {
      expect(screen.getByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
      expect(screen.queryByText('BestPay Mobile A920 Flat')).not.toBeInTheDocument();
    });
  });

  it('shows Classic values correctly', async () => {
    renderAtRoute('/admin/tariffs');

    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
    expect(screen.getByText('0,249 %')).toBeInTheDocument();
    expect(screen.getAllByText('17,90 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Keine Angabe').length).toBeGreaterThan(0);
  });

  it('shows Flat clearing as inklusive', async () => {
    renderAtRoute('/admin/tariffs');

    expect(await screen.findByText('BestPay Mobile A920 Flat')).toBeInTheDocument();
    expect(screen.getAllByText('inklusive').length).toBeGreaterThan(0);
  });

  it('filters by terminal type mobile', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs');

    await user.click(await screen.findByRole('button', { name: 'Mobil' }));

    await waitFor(() => {
      expect(screen.getByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
      expect(screen.getByText('BestPay Mobile A920 Flat')).toBeInTheDocument();
    });
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs');

    await user.type(await screen.findByLabelText('Suche'), 'NichtVorhanden123');

    expect(await screen.findByText('Keine Tarife gefunden')).toBeInTheDocument();
  });
});
