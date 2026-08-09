import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { readBestPayComparisonSessions } from '../services/bestPayComparisonStorageMigration';
import { ADVICE_NEW_PATH } from '../utils/routes';
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

describe('Beratungswizard Kundenschritt', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('zeigt keine technischen Zuordnungs-Buttons', async () => {
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    expect(screen.queryByRole('button', { name: 'Kunde zuordnen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Als Lead anlegen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entwurf speichern' })).not.toBeInTheDocument();
  });

  it('persistiert Kundenzuordnung bei Auswahl und erzeugt keine Duplikate', async () => {
    const user = userEvent.setup();
    const before = readBestPayComparisonSessions().length;
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Kunde suchen' }));
    await user.click(await screen.findByRole('button', { name: /Café Sonnenschein/i }));
    await waitFor(() => {
      expect(readBestPayComparisonSessions().length).toBe(before + 1);
    });
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => {
      expect(readBestPayComparisonSessions().length).toBe(before + 1);
    });
  });

  it('legt neuen Kunden beim Weiter-Klick automatisch an', async () => {
    const user = userEvent.setup();
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Neuen Kunden anlegen' }));
    await user.type(screen.getByLabelText('Firma'), 'Wizard Test GmbH');
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ausgangslage' })).toBeInTheDocument();
    });
    expect(screen.getByText('Automatisch gespeichert')).toBeInTheDocument();
  });
});
