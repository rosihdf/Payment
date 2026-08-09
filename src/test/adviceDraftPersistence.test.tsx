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
    expect(screen.getByText('Wird beim Fortschritt gespeichert')).toBeInTheDocument();
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

  it('blockiert Vorwärtssprung ohne Weiter und erzeugt keine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    const steps = within(screen.getByRole('navigation', { name: 'Beratungsschritte' }));
    const ausgangslageBtn = steps.getByRole('button', { name: /Ausgangslage/i });
    expect(ausgangslageBtn).toBeDisabled();
    await user.click(ausgangslageBtn);
    expect(screen.getByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
    expect(wizardSessionCount()).toBe(before);
  });

  it('erzeugt bei erster Kundenauswahl genau eine Session', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    const router = renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Kunde suchen' }));
    const leadButton = await screen.findByRole('button', { name: /Café Sonnenschein/i });
    await user.click(leadButton);
    await waitFor(() => {
      expect(wizardSessionCount()).toBe(before + 1);
    });
    expect(screen.getByText('Automatisch gespeichert')).toBeInTheDocument();
    expect(router.state.location.search).toMatch(/session=/);
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await screen.findByRole('heading', { name: 'Ausgangslage' });
    expect(wizardSessionCount()).toBe(before + 1);
    await user.click(screen.getByRole('button', { name: /Ausgangslage/i }));
    expect(wizardSessionCount()).toBe(before + 1);
  });

  it('erzeugt bei erstem Weiter genau eine Session und behält sie bei Kostenauswahl', async () => {
    const user = userEvent.setup();
    const before = wizardSessionCount();
    renderAt(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Ohne Kundenzuordnung beraten' }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await screen.findByRole('heading', { name: 'Ausgangslage' });
    await waitFor(() => {
      expect(wizardSessionCount()).toBe(before + 1);
    });
    await user.click(
      screen.getByRole('button', {
        name: 'Noch keine Payment-Lösung / aktuelle Kosten 0 €',
      }),
    );
    expect(wizardSessionCount()).toBe(before + 1);
    expect(screen.getByText('Automatisch gespeichert')).toBeInTheDocument();
  });

  it('löscht leeren Entwurf über ConfirmDialog', async () => {
    const user = userEvent.setup();
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
    const services = createServices(createTestRepositories());
    const wizard = services.salesWizardService;
    const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
    const emptySession = await wizard.startWizard(context);
    const emptyId = emptySession.id;
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/advice?session=${emptyId}`],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await user.click(screen.getAllByRole('link', { name: 'Beratung' })[0]!);
    expect(router.state.location.pathname).toBe(ADVICE_PATH);
    expect(await screen.findByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect(screen.getByText(/Leerer Entwurf|Beratung ohne Kundenzuordnung/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(/Beratungsentwurf löschen/i);
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
