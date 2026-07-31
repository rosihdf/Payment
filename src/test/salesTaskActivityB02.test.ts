import { beforeEach, describe, expect, it } from 'vitest';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import {
  CURRENT_SALES_ACTIVITY_STORAGE_VERSION,
  CURRENT_SALES_TASK_STORAGE_VERSION,
  migrateSalesActivityStorageIfNeeded,
  migrateSalesTaskStorageIfNeeded,
} from '../services/salesWorkspaceStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const other = { userId: 'user_002', role: 'field_service' as const, displayName: 'Thomas' };

function createServices() {
  const taskService = new SalesTaskService(new LocalSalesTaskRepository());
  const activityService = new SalesActivityService(new LocalSalesActivityRepository());
  taskService.setActivityService(activityService);
  return { taskService, activityService };
}

describe('B02 SalesTask and SalesActivity', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('legt Aufgabe an, erledigt sie idempotent und erzeugt genau eine Abschlussaktivität', async () => {
    const { taskService, activityService } = createServices();
    const created = await taskService.createTask(
      {
        title: 'Rückruf',
        type: 'callback',
        dueAt: new Date().toISOString(),
        leadId: 'lead_001',
      },
      context,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await taskService.completeTask(created.task.id, context, 'Erledigt');
    const second = await taskService.completeTask(created.task.id, context, 'Nochmal');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.task.completedAt).toBe(second.task.completedAt);

    const activities = await activityService.listVisible(context);
    expect(activities.filter((entry) => entry.type === 'task_completed')).toHaveLength(1);
    expect(activities.some((entry) => entry.type === 'task_created')).toBe(true);
  });

  it('erzeugt automatische Aufgaben idempotent über sourceKey', async () => {
    const { taskService } = createServices();
    const first = await taskService.ensureAutomaticTask(
      {
        title: 'Berechnung fortsetzen',
        type: 'continue_calculation',
        sourceKey: 'auto:continue_calculation:session_1',
        comparisonSessionId: 'session_1',
      },
      context,
    );
    const second = await taskService.ensureAutomaticTask(
      {
        title: 'Berechnung fortsetzen',
        type: 'continue_calculation',
        sourceKey: 'auto:continue_calculation:session_1',
        comparisonSessionId: 'session_1',
      },
      context,
    );
    expect(first.id).toBe(second.id);
    const all = await taskService.listVisible(context);
    expect(all.filter((task) => task.sourceKey === 'auto:continue_calculation:session_1')).toHaveLength(
      1,
    );
  });

  it('filtert Aufgaben nach Fälligkeit und schützt fremde Aufgaben', async () => {
    const { taskService } = createServices();
    await taskService.createTask(
      {
        title: 'Heute',
        type: 'general',
        dueAt: new Date().toISOString(),
      },
      context,
    );
    await taskService.createTask(
      {
        title: 'Fremd',
        type: 'general',
        dueAt: new Date().toISOString(),
      },
      other,
    );

    const visible = await taskService.listVisible(context);
    expect(visible.every((task) => task.assigneeUserId === context.userId)).toBe(true);
    const filtered = taskService.filterTasks(
      visible,
      { dueBucket: 'today', status: 'open' },
      context,
    );
    expect(filtered.some((task) => task.title === 'Heute')).toBe(true);
  });

  it('legt manuelle Notiz an und blockiert Löschen von Systemaktivitäten', async () => {
    const { activityService } = createServices();
    const note = await activityService.createManualActivity(
      { type: 'note', title: 'Interne Notiz', description: 'Nur intern', leadId: 'lead_001' },
      context,
    );
    expect(note.ok).toBe(true);

    const system = await activityService.recordSystemActivity(
      {
        type: 'offer_created',
        title: 'Angebot erstellt',
        offerId: 'offer_1',
        sourceKey: 'offer_created:offer_1',
      },
      context,
    );
    const deleted = await activityService.deleteActivity(system.id, context);
    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error).toBe('immutable');
    }
  });

  it('migriert beschädigte Task-/Activity-Stores fehlertolerant', () => {
    writeStorageItem(STORAGE_KEYS.salesTasks, [{ broken: true }, { id: 't1', title: 'Ok', assigneeUserId: 'u', createdByUserId: 'u', type: 'general', status: 'open' }]);
    writeStorageItem(STORAGE_KEYS.salesTaskStorageVersion, 0);
    migrateSalesTaskStorageIfNeeded();
    expect(readStorageItem(STORAGE_KEYS.salesTaskStorageVersion)).toBe(
      CURRENT_SALES_TASK_STORAGE_VERSION,
    );
    const tasks = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? [];
    expect(tasks).toHaveLength(1);

    writeStorageItem(STORAGE_KEYS.salesActivities, [
      { broken: true },
      {
        id: 'a1',
        title: 'Ok',
        type: 'note',
        createdByUserId: 'u',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    writeStorageItem(STORAGE_KEYS.salesActivityStorageVersion, 0);
    migrateSalesActivityStorageIfNeeded();
    expect(readStorageItem(STORAGE_KEYS.salesActivityStorageVersion)).toBe(
      CURRENT_SALES_ACTIVITY_STORAGE_VERSION,
    );
    const activities = readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? [];
    expect(activities).toHaveLength(1);
  });
});
