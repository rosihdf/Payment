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

  return render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );
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

  it('renders the calculator page with comparison layout on /calculator', async () => {
    renderApp('/calculator');
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bisheriger Vertrag' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Angebot von BestPay' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vergleichsergebnis' })).toBeInTheDocument();
  });

  it('renders admin tariffs for admin role on /admin/tariffs', async () => {
    renderApp('/admin/tariffs', 'user_004');
    expect(await screen.findByRole('heading', { name: 'Tarifverwaltung' })).toBeInTheDocument();
    expect(await screen.findByText('BestPay Mobile A920 Classic')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /Tarifverwaltung/i })).toHaveAttribute(
      'href',
      '/admin/tariffs',
    );
  });
});
