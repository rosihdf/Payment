import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories, createTestWorkspace } from './helpers/createTestRepositories';
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

  it('zeigt Beratung fortsetzen, Heute und Überfällig ohne CRM-Pipeline', async () => {
    renderAt('/sales');
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heute' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neue Beratung' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kunden suchen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Blockiert' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nächste Kundenfälle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aufgabe anlegen' })).not.toBeInTheDocument();
  });

  it('Admin und Außendienst nutzen dieselbe Sichtbarkeitslogik ohne Team-Filter', async () => {
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
    expect(admin.scope).toBe('mine');
    expect(admin.canUseTeamScope).toBe(false);
    expect(admin.dayWork).toBeDefined();
  });

  it('Rendern erzeugt keine zusätzlichen freien Aufgaben über die Sync-Baseline hinaus', async () => {
    const repos = createTestRepositories();
    const taskRepo = repos.salesTaskRepository;
    const activityRepo = repos.salesActivityRepository;
    const beforeActivities = (await activityRepo.getAll()).length;

    renderAt('/sales');
    await screen.findByRole('heading', { name: 'Beratung fortsetzen' });

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
    await workspace.getWorkspaceView(
      { userId: 'user_001', role: 'field_service', displayName: 'Laura' },
      { scope: 'mine' },
    );
    const afterSecond = (await taskRepo.getAll()).length;
    expect(afterSecond).toBe(afterFirstLoadTasks);
    expect((await activityRepo.getAll()).length).toBe(afterFirstLoadActivities);
  });
});
