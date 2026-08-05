import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestWorkspace } from './helpers/createTestRepositories';
import { ADVICE_NEW_PATH } from '../utils/routes';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAtRoute(initialRoute: string, userId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, userId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

describe('B02 Sales Workspace', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('öffnet /sales über die Hauptnavigation', async () => {
    renderAtRoute('/sales');
    expect(await screen.findByRole('heading', { name: 'Arbeitsplatz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neue Beratung' })).toHaveAttribute('href', ADVICE_NEW_PATH);
    expect(screen.getByRole('link', { name: 'Kunden suchen' })).toHaveAttribute('href', '/leads');
  });

  it('zeigt die Tagesbereiche inklusive Beratungsentwürfe ohne Pipeline und Kennzahlen', async () => {
    renderAtRoute('/sales');
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heute' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Blockiert' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nächste Kundenfälle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kennzahlen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Erwartete Abschlüsse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meine Provision' })).toHaveAttribute('href', '/sales/commission');
  });

  it('aggregiert Workspace-Daten und legt automatische Wizard-Aufgaben an', async () => {
    const workspace = createTestWorkspace();

    const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
    const view = await workspace.getWorkspaceView(context, { scope: 'mine' });
    expect(view.scope).toBe('mine');
    expect(view.canUseTeamScope).toBe(false);
    expect(view.metrics.openLeads).toBeGreaterThan(0);
    expect(Object.keys(view.pipeline)).toContain('new');
    expect(view.dayWork).toBeTruthy();
    expect(view.dayWork.overdue).toBeDefined();
    expect(view.dayWork.today).toBeDefined();
    expect(view.dayWork.blocked).toBeDefined();
    expect(view.dayWork.nextCases).toBeDefined();
  });
});
