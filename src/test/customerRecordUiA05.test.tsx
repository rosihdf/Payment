import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAt(route: string) {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Aufräumblock 5 – Kunden-Detailseite UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('zeigt Kunden-Detail mit genau einer Hauptaktion', async () => {
    renderAt('/leads/lead_001');
    expect(await screen.findByRole('heading', { name: 'Stammdaten' })).toBeInTheDocument();
    expect(screen.queryByText(/Kundenakte/)).not.toBeInTheDocument();
    const primary = screen.getByRole('link', { name: 'Beratung starten' });
    expect(primary).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
  });

  it('Arbeitsplatz bietet Kunden-Suche und Beratungsbereich', async () => {
    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Arbeitsplatz' });
    expect(screen.getByRole('link', { name: 'Kunden suchen' })).toHaveAttribute('href', '/leads');
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zur Kundenakte' })).not.toBeInTheDocument();
  });
});
