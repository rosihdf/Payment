import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';

function renderApp(initialRoute = '/', currentUserId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
    initialIndex: 0,
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

describe('Routing', () => {
  it('leitet / auf den Arbeitsplatz um', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Arbeitsplatz' })).toBeInTheDocument();
  });

  it('renders the customers page on /leads', async () => {
    renderApp('/leads');
    expect(await screen.findByRole('heading', { name: 'Kunden' })).toBeInTheDocument();
  });

  it('renders the new customer page with functional form on /leads/new', async () => {
    renderApp('/leads/new');
    expect(await screen.findByRole('heading', { name: 'Neuen Kunden aufnehmen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Firmenname')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Kunde speichern' })).toBeEnabled();
  });

  it('renders lead detail on /leads/:id', async () => {
    renderApp('/leads/lead_001');
    expect(await screen.findByRole('heading', { name: 'Café Sonnenschein GmbH' })).toBeInTheDocument();
  });

  it('renders the edit lead page on /leads/:id/edit', async () => {
    renderApp('/leads/lead_001/edit');
    expect(await screen.findByRole('heading', { name: 'Kunde bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Änderungen speichern' })).toBeEnabled();
  });

  it('leitet /advice/quick auf den Beratungshub um', async () => {
    const router = renderApp('/advice/quick');
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/advice');
  });

  it('redirects /calculator to the advice hub', async () => {
    const router = renderApp('/calculator');
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/advice');
  });

  it('redirects /admin/tariffs to the catalog tariffs tab for admin', async () => {
    const router = renderApp('/admin/tariffs', 'user_004');
    expect(await screen.findByRole('heading', { name: 'Produkte & Konditionen' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/catalog');
    expect(router.state.location.search).toBe('?tab=tariffs');
  });

  it('shows access denied for non-admin on /admin/tariffs', async () => {
    renderApp('/admin/tariffs', 'user_001');
    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zum Arbeitsplatz' })).toBeInTheDocument();
  });

  it('renders the profile page on /profile', async () => {
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: 'Profil' })).toBeInTheDocument();
  });

  it('shows admin section on profile for admin users', async () => {
    renderApp('/profile', 'user_004');
    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Produkte & Konditionen/i })).toHaveAttribute(
      'href',
      '/admin/catalog',
    );
  });
});
