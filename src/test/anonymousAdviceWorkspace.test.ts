import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { createTestRepositories } from './helpers/createTestRepositories';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';
import { buildSalesDayWorkspaceSections } from '../services/salesDayWorkspace';
import { ANONYMOUS_ADVICE_DISPLAY_NAME } from '../domain/lead/getLeadDisplayName';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('Anonymous advice workspace drafts', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog({ withWeightSet: true });
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('does not create continue_calculation tasks during workspace sync', async () => {
    const repos = createTestRepositories();
    const services = createServices(repos);
    const session = await services.salesWizardService.startWizard(context);
    await services.salesWizardService.goNext(session.id, context);
    await services.salesWizardService.updateCostCaptureMode(session.id, 'no_current_costs', context);

    const tasksBefore = await repos.salesTaskRepository.getAll();
    await services.salesWorkspaceService.syncAutomaticTasks(context);
    const tasksAfter = await repos.salesTaskRepository.getAll();

    expect(tasksAfter.length).toBe(tasksBefore.length);
    expect(
      tasksAfter.some((task) => task.type === 'continue_calculation' && task.status === 'open'),
    ).toBe(false);
  });

  it('shows anonymous advice as draft without due date or overdue bucket', async () => {
    const repos = createTestRepositories();
    const services = createServices(repos);
    const session = await services.salesWizardService.startWizard(context);
    const view = await services.salesWorkspaceService.getWorkspaceView(context);

    expect(view.dayWork.adviceDrafts.some((entry) => entry.id === `advice:${session.id}`)).toBe(
      true,
    );
    const draft = view.dayWork.adviceDrafts.find((entry) => entry.id === `advice:${session.id}`);
    expect(draft?.companyName).toBe(ANONYMOUS_ADVICE_DISPLAY_NAME);
    expect(draft?.dueAt).toBeNull();
    expect(draft?.nextActionLabel).toBe('Fortsetzen');
    expect(view.dayWork.overdue.some((entry) => entry.companyName === 'Ohne Kunde')).toBe(false);
    expect(
      view.dayWork.overdue.some((entry) => entry.taskTitle === 'Berechnung fortsetzen'),
    ).toBe(false);
  });

  it('does not duplicate advice drafts in next cases', async () => {
    const repos = createTestRepositories();
    const services = createServices(repos);
    const session = await services.salesWizardService.startWizard(context);
    await services.salesWizardService.goNext(session.id, context);

    const view = await services.salesWorkspaceService.getWorkspaceView(context);

    expect(view.dayWork.adviceDrafts.length).toBeGreaterThan(0);
    expect(
      view.dayWork.nextCases.some((entry) => entry.actionHref?.includes(session.id) ?? false),
    ).toBe(false);
  });

  it('excludes legacy continue_calculation tasks from overdue sections', () => {
    const sections = buildSalesDayWorkspaceSections({
      cards: [],
      adviceDraftCards: [],
      tasks: [
        {
          id: 'sales_task_legacy',
          schemaVersion: 1,
          title: 'Berechnung fortsetzen',
          description: '',
          type: 'continue_calculation',
          status: 'open',
          priority: 'high',
          dueAt: '2026-08-04T21:59:59.999Z',
          dueTimeLocal: null,
          assigneeUserId: 'user_001',
          createdByUserId: 'user_001',
          completedAt: null,
          completedByUserId: null,
          completionNote: '',
          leadId: null,
          comparisonSessionId: 'session_x',
          offerId: null,
          contractId: null,
          contractVersionId: null,
          activationId: null,
          contactId: null,
          wizardEnabled: true,
          origin: 'automatic',
          sourceKey: 'auto:continue_calculation:session_x',
          createdAt: '2026-08-04T19:00:00.000Z',
          updatedAt: '2026-08-04T19:00:00.000Z',
        },
      ],
      now: new Date('2026-08-05T12:00:00.000Z'),
    });

    expect(sections.overdue).toHaveLength(0);
    expect(sections.today).toHaveLength(0);
  });
});
