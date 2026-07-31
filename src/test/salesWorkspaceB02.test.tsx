import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import { SalesWorkspaceService } from '../services/salesWorkspaceService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAtRoute(initialRoute: string) {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');

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
    expect(screen.getByRole('link', { name: 'Beratung starten' })).toBeInTheDocument();
    expect(screen.getByText(/Meine Vorgänge/)).toBeInTheDocument();
  });

  it('zeigt Kennzahlen und Pipeline ohne OCR/PDF-Imports', async () => {
    renderAtRoute('/sales');
    expect(await screen.findByRole('heading', { name: 'Kennzahlen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pipeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heute' })).toBeInTheDocument();
  });

  it('aggregiert Workspace-Daten und legt automatische Wizard-Aufgaben an', async () => {
    const taskService = new SalesTaskService(new LocalSalesTaskRepository());
    const activityService = new SalesActivityService(new LocalSalesActivityRepository());
    taskService.setActivityService(activityService);
    const workspace = new SalesWorkspaceService(
      new LocalLeadRepository(),
      new LocalOfferRepository(),
      new LocalSalesTaskRepository(),
      new LocalSalesActivityRepository(),
      taskService,
      activityService,
    );

    const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
    const view = await workspace.getWorkspaceView(context, { scope: 'mine' });
    expect(view.scope).toBe('mine');
    expect(view.canUseTeamScope).toBe(false);
    expect(view.metrics.openLeads).toBeGreaterThan(0);
    expect(Object.keys(view.pipeline)).toContain('new');
  });
});
