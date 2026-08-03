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

describe('Aufräumblock 5 – Kundenakte UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('zeigt Kundenakte mit genau einer Hauptaktion', async () => {
    renderAt('/leads/lead_001');
    expect(
      await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kundenakte/)).toBeInTheDocument();
    const primary = screen.getByRole('link', { name: 'Beratung starten' });
    expect(primary).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
  });

  it('Arbeitsplatz öffnet die Kundenakte', async () => {
    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Arbeitsplatz' });
    expect(screen.getByRole('link', { name: 'Kunden suchen' })).toHaveAttribute('href', '/leads');
    const detailLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks[0]?.getAttribute('href')).toMatch(/^\/leads\//);
  });
});
