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

describe('Phase 1A Block 3 – Kunden-Detailseite Komfort UI (v2)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt Stammdaten-Kernfakten und eine führende Beratung-Aktion', async () => {
    renderAt('/leads/lead_001');
    expect(await screen.findByRole('heading', { name: 'Stammdaten' })).toBeInTheDocument();
    expect(screen.getByText('Kontakt')).toBeInTheDocument();
    expect(screen.getByText('Firma')).toBeInTheDocument();
    expect(screen.getByText('Betreuer')).toBeInTheDocument();
    expect(screen.queryByText('Offene Aufgaben')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beratung starten' })).toBeInTheDocument();
  });

  it('zeigt keine Timeline-, Aufgaben- oder Dokument-Module', async () => {
    renderAt('/leads/lead_001');
    await screen.findByRole('heading', { name: 'Stammdaten' });
    expect(screen.queryByRole('heading', { name: 'Timeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dokumente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kontakte' })).not.toBeInTheDocument();
  });
});
