import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories, createTestWorkspace } from './helpers/createTestRepositories';
import { openFormSelect } from './helpers/selectFormOption';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import { SalesWorkspaceService } from '../services/salesWorkspaceService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAt(route: string, userId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, userId);
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Aufräumblock 6 – Arbeitsplatz UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('zeigt genau vier Bereiche und Schnellaktionen ohne freie Aufgabenanlage', async () => {
    renderAt('/sales');
    expect(await screen.findByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heute' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blockiert' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nächste Kundenfälle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neue Beratung' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kunden suchen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kennzahlen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Erwartete Abschlüsse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nicht zugeordnet')).not.toBeInTheDocument();
  });

  it('öffnet Kundenakte von den Karten und zeigt Empty States', async () => {
    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Arbeitsplatz' });
    const detailLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks[0]?.getAttribute('href')).toMatch(/^\/leads\//);
    expect(screen.getByRole('heading', { name: 'Blockiert' })).toBeInTheDocument();
    expect(
      screen.getAllByText(/Keine Einträge|Nichts überfällig|Heute nichts geplant|Keine blockierten Fälle/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it('Außendienst sieht nur eigene Fälle, Admin kann Team sehen', async () => {
    const workspace = createTestWorkspace();

    const field = await workspace.getWorkspaceView(
      { userId: 'user_001', role: 'field_service', displayName: 'Laura' },
      { scope: 'team' },
    );
    expect(field.scope).toBe('mine');
    expect(field.canUseTeamScope).toBe(false);

    const admin = await workspace.getWorkspaceView(
      { userId: 'user_004', role: 'admin', displayName: 'Michael' },
      { scope: 'team' },
    );
    expect(admin.scope).toBe('team');
    expect(admin.canUseTeamScope).toBe(true);

    renderAt('/sales', 'user_004');
    const user = userEvent.setup();
    expect(await screen.findByLabelText('Ansicht')).toBeInTheDocument();
    await openFormSelect(user, 'Ansicht');
    expect(screen.getByRole('option', { name: 'Team' })).toBeInTheDocument();
  });

  it('Rendern erzeugt keine zusätzlichen Aufgaben oder Aktivitäten jenseits der Sync-Baseline', async () => {
    const repos = createTestRepositories();
    const taskRepo = repos.salesTaskRepository;
    const activityRepo = repos.salesActivityRepository;
    const beforeTasks = (await taskRepo.getAll()).length;
    const beforeActivities = (await activityRepo.getAll()).length;

    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Nächste Kundenfälle' });

    // getWorkspaceView syncs automatic tasks once – weitere Reloads der UI-Sektionen dürfen nicht
    // zusätzliche freie Aufgaben/Aktivitäten anlegen. Nach dem ersten Load erneut zählen und
    // Day-Section-Ableitung isoliert prüfen.
    const afterFirstLoadTasks = (await taskRepo.getAll()).length;
    const afterFirstLoadActivities = (await activityRepo.getAll()).length;
    expect(afterFirstLoadActivities).toBe(beforeActivities);

    const taskService = new SalesTaskService(taskRepo);
    const activityService = new SalesActivityService(activityRepo);
    taskService.setActivityService(activityService);
    const workspace = new SalesWorkspaceService(
      repos.leadRepository,
      repos.offerRepository,
      taskRepo,
      activityRepo,
      taskService,
      activityService,
      repos.bestPayComparisonRepository,
      repos.commissionCalculationRepository,
      repos.pricingEvaluationRepository,
      repos.contractRepository,
      repos.activationCaseRepository,
      repos.activationBlockerRepository,
      repos.offerCustomerQuestionRepository,
      repos.offerChangeRequestRepository,
    );
    const view = await workspace.getWorkspaceView(
      { userId: 'user_001', role: 'field_service', displayName: 'Laura' },
      { scope: 'mine' },
    );
    expect(view.dayWork.nextCases.every((entry) => entry.nextActionLabel)).toBe(true);
    const afterSecond = (await taskRepo.getAll()).length;
    // Idempotente Autosync: keine weiteren Tasks über den ersten Sync hinaus
    expect(afterSecond).toBe(afterFirstLoadTasks);
    expect(afterFirstLoadTasks).toBeGreaterThanOrEqual(beforeTasks);
    expect((await activityRepo.getAll()).length).toBe(afterFirstLoadActivities);
  });
});
