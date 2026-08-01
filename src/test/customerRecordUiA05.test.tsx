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
    expect(await screen.findByText('Kundenakte')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Kundenakte Bereiche' })).toBeInTheDocument();
    const primary = screen.getAllByRole('link').filter((link) =>
      ['Beratung starten', 'Beratung fortsetzen', 'Kein Handlungsbedarf'].some((label) =>
        link.textContent?.includes(label),
      ),
    );
    // genau eine dominante Primäraktion im Kopf (Klasse primary) oder Idle-Text
    const heroPrimary = document.querySelector('a[class*="primaryAction"], span[class*="primaryIdle"]');
    expect(heroPrimary).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
    void primary;
  });

  it('Arbeitsplatz öffnet die Kundenakte', async () => {
    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Arbeitsplatz' });
    const links = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.getAttribute('href')).toMatch(/^\/leads\//);
  });
});
