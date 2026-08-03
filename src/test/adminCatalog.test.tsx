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

describe('Admin catalog unification', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('shows exactly one catalog entry in admin navigation', async () => {
    renderAtRoute('/admin');

    expect(await screen.findByRole('link', { name: 'Produkte & Konditionen' })).toHaveAttribute(
      'href',
      '/admin/catalog',
    );
    expect(screen.queryByRole('link', { name: 'Tarife & Preise' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Produkte & Hardware' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tarifverwaltung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Produktverwaltung' })).not.toBeInTheDocument();
  });

  it('renders catalog with tariffs, products and price rules tabs', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/catalog');

    expect(
      await screen.findByRole('navigation', { name: 'Produkte & Konditionen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Produkte/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tarife' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produkte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preisregeln' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Produkte' }));
    expect(await screen.findByRole('link', { name: 'Produkt anlegen' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Preisregeln' }));
    expect(await screen.findByText('Pflegezustand')).toBeInTheDocument();
    expect(screen.getByText('Keine Preisregeln vorhanden')).toBeInTheDocument();
  });

  it('uses existing product edit route from catalog', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/catalog?tab=products');

    const editLinks = await screen.findAllByRole('link', { name: 'Bearbeiten' });
    const editLink = editLinks[0];
    if (!editLink) {
      throw new Error('Erwarteter Produkt-Bearbeiten-Link fehlt');
    }
    expect(editLink).toHaveAttribute('href', expect.stringMatching(/^\/admin\/products\/manage\/.+\/edit$/));

    await user.click(editLink);
    expect(await screen.findByRole('heading', { name: 'Produkt bearbeiten' })).toBeInTheDocument();
    expect(screen.getByLabelText('Produktname')).toBeInTheDocument();
  });

  it('uses existing tariff edit route from catalog', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/catalog?tab=tariffs');

    const editLinks = await screen.findAllByRole('link', { name: 'Bearbeiten' });
    const editLink = editLinks[0];
    if (!editLink) {
      throw new Error('Erwarteter Tarif-Bearbeiten-Link fehlt');
    }
    expect(editLink).toHaveAttribute('href', expect.stringMatching(/^\/admin\/tariffs\/.+\/edit$/));

    await user.click(editLink);
    expect(await screen.findByLabelText('Tarifname')).toBeInTheDocument();
  });

  it('redirects /admin/pricing to rules tab and preserves query', async () => {
    const router = renderAtRoute('/admin/pricing?source=legacy');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/catalog');
      expect(router.state.location.search).toBe('?source=legacy&tab=rules');
    });
    expect(await screen.findByText('Pflegezustand')).toBeInTheDocument();
  });

  it('redirects /admin/tariffs to tariffs tab and preserves query', async () => {
    const router = renderAtRoute('/admin/tariffs?filter=active');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/catalog');
      expect(router.state.location.search).toBe('?filter=active&tab=tariffs');
    });
    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
  });

  it('redirects /admin/products to products tab and preserves query', async () => {
    const router = renderAtRoute('/admin/products?view=all');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/catalog');
      expect(router.state.location.search).toBe('?view=all&tab=products');
    });
  });

  it('redirects /admin/products/manage to products tab and preserves query', async () => {
    const router = renderAtRoute('/admin/products/manage?q=terminal');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/catalog');
      expect(router.state.location.search).toBe('?q=terminal&tab=products');
    });
  });

  it('does not create redirect loops on catalog', async () => {
    const router = renderAtRoute('/admin/catalog?tab=products');
    expect(
      await screen.findByRole('navigation', { name: 'Produkte & Konditionen' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/catalog');
    expect(router.state.location.search).toBe('?tab=products');
  });

  it('denies field service access to catalog', async () => {
    renderAtRoute('/admin/catalog', 'user_001');
    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('denies field service on legacy product manage redirect', async () => {
    renderAtRoute('/admin/products/manage', 'user_001');
    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });
});
