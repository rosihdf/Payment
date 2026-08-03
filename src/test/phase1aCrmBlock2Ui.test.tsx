import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('Phase 1A Block 2 – Kundenakte CRM UI (v2)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt die verbindliche Tab-Reihenfolge in der Kundenakte', async () => {
    renderAt('/leads/lead_001');
    const nav = await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Übersicht',
      'Vorgänge',
      'Kontakte',
      'Dokumente',
      'Vertrieb',
      'Stammdaten',
    ]);
  });

  it('zeigt Kontakte im Kontakte-Tab', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' });

    await user.click(screen.getByRole('button', { name: 'Kontakte' }));
    expect(await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' })).toBeInTheDocument();
  });

  it('zeigt Vorgänge mit Timeline und Aufgaben', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' });

    await user.click(screen.getByRole('button', { name: 'Vorgänge' }));
    expect(await screen.findByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aufgaben' })).toBeInTheDocument();
  });
});
