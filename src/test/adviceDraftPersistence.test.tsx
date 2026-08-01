import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { createServices } from '../services';
import { createTestRepositories } from './helpers/createTestRepositories';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import {
  getActiveBestPayComparisonSessionId,
  readBestPayComparisonSessions,
} from '../services/bestPayComparisonStorageMigration';
import { ADVICE_NEW_PATH, ADVICE_PATH } from '../utils/routes';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { selectFormOptionByValue } from './helpers/selectFormOption';

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

function wizardSessionCount(): number {
  return readBestPayComparisonSessions().filter(
    (session) => session.entryMode === 'wizard' || session.wizard.enabled,
  ).length;
}

describe('Beratungsentwurf Persistenz', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('erzeugt beim Klick auf Beratung starten keine persistierte Session', async () => {
    const before = wizardSessionCount();
    renderAt(ADVICE_PATH);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'Beratung starten' }));
    expect(await screen.findByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
    expect(screen.getByText('Noch nicht gespeichert')).toBeInTheDocument();
    expect(wizardSessionCount()).toBe(before);
    expect(getActiveBestPayComparisonSessionId()).toBeNull();
  });

  it('erzeugt beim Öffnen und sofortigen Verlassen keine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    const router = renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('link', { name: 'Zum Arbeitsplatz' }));
    expect(router.state.location.pathname).toBe('/sales');
    expect(wizardSessionCount()).toBe(before);
  });

  it('erzeugt beim Schrittwechsel ohne Eingabe keine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: /Ausgangslage/i }));
    expect(await screen.findByRole('heading', { name: 'Ausgangslage' })).toBeInTheDocument();
    expect(wizardSessionCount()).toBe(before);
  });

  it('erzeugt bei erster Kundenauswahl genau eine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    const router = renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Bestehender Kunde' }));
    await selectFormOptionByValue(user, 'Kunde auswählen', 'lead_001');
    await user.click(screen.getByRole('button', { name: 'Kunde zuordnen' }));
    await waitFor(() => {
      expect(wizardSessionCount()).toBe(before + 1);
    });
    expect(screen.getByText('Autosave aktiv')).toBeInTheDocument();
    expect(router.state.location.search).toMatch(/session=/);
    // zweites Speichern / Reload-Pfad erzeugt keine zweite Session
    await user.click(screen.getByRole('button', { name: /Bedarf/i }));
    expect(wizardSessionCount()).toBe(before + 1);
  });

  it('erzeugt bei erster manueller Kosteneingabe genau eine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: /Ausgangslage/i }));
    await user.click(screen.getByRole('button', { name: 'Manuelle Ist-Kosten' }));
    await waitFor(() => {
      expect(wizardSessionCount()).toBe(before + 1);
    });
    expect(screen.getByText('Autosave aktiv')).toBeInTheDocument();
  });

  it('löscht leeren Entwurf über ConfirmDialog', async () => {
    const user = userEvent.setup();
    const router = renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    await screen.findByText('Autosave aktiv');
    const emptyId = new URLSearchParams(router.state.location.search).get('session');
    expect(emptyId).toBeTruthy();

    await user.click(screen.getAllByRole('link', { name: 'Beratung' })[0]!);
    expect(router.state.location.pathname).toBe(ADVICE_PATH);
    expect(await screen.findByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect(screen.getByText(/Leerer Entwurf/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(/Leeren Entwurf löschen/i);
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    });
    const discarded = readBestPayComparisonSessions().find((session) => session.id === emptyId);
    expect(discarded?.status).toBe('discarded');
  });

  it('verweigert Löschen nicht leerer Entwürfe im Service', async () => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    const services = createServices(createTestRepositories());
    const wizard = services.salesWizardService;
    const bestPay = services.bestPayComparisonService;
    const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
    const filled = await wizard.startWizard(context);
    await wizard.updateProspectDraft(filled.id, { companyName: 'Geschützt GmbH' }, context);
    expect(await wizard.discardEmptyWizard(filled.id, context)).toEqual({ ok: false, error: 'not_empty' });
    expect((await bestPay.getSession(filled.id, context))?.status).not.toBe('discarded');
  });
});
