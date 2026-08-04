import { describe, expect, it, vi } from 'vitest';
import { SupabaseSalesTaskRepository } from '../repositories/supabase/SupabaseSalesTaskRepository';
import * as supabaseTable from '../repositories/supabase/supabaseTable';

describe('SupabaseSalesTaskRepository', () => {
  it('gibt bestehende Task bei gleichem source_key zurück', async () => {
    const existingRow = {
      id: 'sales_task_existing',
      created_by_user_id: 'user-1',
      assignee_user_id: 'user-1',
      lead_id: null,
      offer_id: null,
      contract_id: null,
      activation_id: null,
      source_key: 'auto:continue_calculation:session_1',
      created_at: '2026-08-04T19:00:00.000Z',
      updated_at: '2026-08-04T19:00:00.000Z',
      data: {
        id: 'sales_task_existing',
        schemaVersion: 1,
        title: 'Berechnung fortsetzen',
        description: '',
        type: 'continue_calculation',
        status: 'open',
        priority: 'high',
        dueAt: '2026-08-04T19:00:00.000Z',
        dueTimeLocal: null,
        assigneeUserId: 'user-1',
        createdByUserId: 'user-1',
        completedAt: null,
        completedByUserId: null,
        completionNote: '',
        leadId: null,
        comparisonSessionId: 'session_1',
        offerId: null,
        contractId: null,
        contractVersionId: null,
        activationId: null,
        taskId: null,
        contactId: null,
        wizardEnabled: true,
        origin: 'automatic',
        sourceKey: 'auto:continue_calculation:session_1',
        createdAt: '2026-08-04T19:00:00.000Z',
        updatedAt: '2026-08-04T19:00:00.000Z',
      },
    };

    vi.spyOn(supabaseTable, 'sbSelectWhere').mockResolvedValue([existingRow]);
    const insertSpy = vi.spyOn(supabaseTable, 'sbInsert');

    const repo = new SupabaseSalesTaskRepository();
    const task = await repo.create({
      id: 'sales_task_new',
      schemaVersion: 1,
      title: 'Berechnung fortsetzen',
      description: '',
      type: 'continue_calculation',
      status: 'open',
      priority: 'high',
      dueAt: '2026-08-04T19:00:00.000Z',
      dueTimeLocal: null,
      assigneeUserId: 'user-1',
      createdByUserId: 'user-1',
      completedAt: null,
      completedByUserId: null,
      completionNote: '',
      leadId: null,
      comparisonSessionId: 'session_1',
      offerId: null,
      contractId: null,
      contractVersionId: null,
      activationId: null,
      contactId: null,
      wizardEnabled: true,
      origin: 'automatic',
      sourceKey: 'auto:continue_calculation:session_1',
      createdAt: '2026-08-04T19:00:00.000Z',
      updatedAt: '2026-08-04T19:00:00.000Z',
    });

    expect(task.id).toBe('sales_task_existing');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('fängt Duplicate-Key-Fehler ab und lädt bestehende Task', async () => {
    const existingRow = {
      id: 'sales_task_existing',
      created_by_user_id: 'user-1',
      assignee_user_id: 'user-1',
      lead_id: null,
      offer_id: null,
      contract_id: null,
      activation_id: null,
      source_key: 'auto:continue_calculation:session_2',
      created_at: '2026-08-04T19:00:00.000Z',
      updated_at: '2026-08-04T19:00:00.000Z',
      data: {
        id: 'sales_task_existing',
        schemaVersion: 1,
        title: 'Berechnung fortsetzen',
        description: '',
        type: 'continue_calculation',
        status: 'open',
        priority: 'high',
        dueAt: null,
        dueTimeLocal: null,
        assigneeUserId: 'user-1',
        createdByUserId: 'user-1',
        completedAt: null,
        completedByUserId: null,
        completionNote: '',
        leadId: null,
        comparisonSessionId: 'session_2',
        offerId: null,
        contractId: null,
        contractVersionId: null,
        activationId: null,
        taskId: null,
        contactId: null,
        wizardEnabled: true,
        origin: 'automatic',
        sourceKey: 'auto:continue_calculation:session_2',
        createdAt: '2026-08-04T19:00:00.000Z',
        updatedAt: '2026-08-04T19:00:00.000Z',
      },
    };

    vi.spyOn(supabaseTable, 'sbSelectWhere')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existingRow]);
    vi.spyOn(supabaseTable, 'sbInsert').mockRejectedValue(
      new Error('sales_tasks anlegen fehlgeschlagen: duplicate key value violates unique constraint "sales_tasks_source_key_uidx"'),
    );

    const repo = new SupabaseSalesTaskRepository();
    const task = await repo.create({
      id: 'sales_task_new',
      schemaVersion: 1,
      title: 'Berechnung fortsetzen',
      description: '',
      type: 'continue_calculation',
      status: 'open',
      priority: 'high',
      dueAt: null,
      dueTimeLocal: null,
      assigneeUserId: 'user-1',
      createdByUserId: 'user-1',
      completedAt: null,
      completedByUserId: null,
      completionNote: '',
      leadId: null,
      comparisonSessionId: 'session_2',
      offerId: null,
      contractId: null,
      contractVersionId: null,
      activationId: null,
      contactId: null,
      wizardEnabled: true,
      origin: 'automatic',
      sourceKey: 'auto:continue_calculation:session_2',
      createdAt: '2026-08-04T19:00:00.000Z',
      updatedAt: '2026-08-04T19:00:00.000Z',
    });

    expect(task.id).toBe('sales_task_existing');
  });
});
