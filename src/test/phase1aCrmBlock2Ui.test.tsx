import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAt(route: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Phase 1A Block 2 – Kunden-Detailseite (v2)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt Stammdaten und Angebote ohne Modul-Tabs', async () => {
    renderAt('/leads/lead_001');
    expect(await screen.findByRole('heading', { name: 'Stammdaten' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bestehende Angebote' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Kundenakte Bereiche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vorgänge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kontakte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dokumente' })).not.toBeInTheDocument();
  });

  it('zeigt Beratung starten als Hauptaktion', async () => {
    renderAt('/leads/lead_001');
    expect(await screen.findByRole('link', { name: 'Beratung starten' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bearbeiten' })).toBeInTheDocument();
  });
});
