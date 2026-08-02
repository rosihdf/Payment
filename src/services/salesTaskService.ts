import type {
  CreateSalesTaskInput,
  SalesTask,
  SalesTaskPriority,
  SalesTaskStatus,
  SalesTaskType,
  UpdateSalesTaskInput,
} from '../domain/salesWorkspace/salesTask';
import { SALES_TASK_SCHEMA_VERSION } from '../domain/salesWorkspace/salesTask';
import type { User } from '../domain/user/user';
import type { SalesTaskRepository } from '../repositories/interfaces/SalesTaskRepository';
import { generateId, nowIso } from '../utils/id';
import type { SalesActivityService } from './salesActivityService';

export interface SalesTaskUserContext {
  userId: string;
  role: User['role'];
  displayName?: string;
}

export type SalesTaskError =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'already_done'
  | 'conflict';

export interface SalesTaskFilters {
  status?: SalesTaskStatus | 'all';
  type?: SalesTaskType | 'all';
  priority?: SalesTaskPriority | 'all';
  assigneeUserId?: string | 'all' | 'mine';
  leadId?: string | null;
  offerId?: string | null;
  contractId?: string | null;
  activationId?: string | null;
  comparisonSessionId?: string | null;
  dueBucket?: 'overdue' | 'today' | 'upcoming' | 'undated' | 'all';
  query?: string;
}

function startOfDayIso(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDayIso(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

function dueBucketOf(task: SalesTask, now = new Date()): SalesTaskFilters['dueBucket'] {
  if (!task.dueAt) {
    return 'undated';
  }
  const due = new Date(task.dueAt).getTime();
  const start = new Date(startOfDayIso(now)).getTime();
  const end = new Date(endOfDayIso(now)).getTime();
  if (due < start) {
    return 'overdue';
  }
  if (due <= end) {
    return 'today';
  }
  return 'upcoming';
}

export class SalesTaskService {
  private readonly taskRepository: SalesTaskRepository;
  private activityService: SalesActivityService | null;

  constructor(taskRepository: SalesTaskRepository, activityService?: SalesActivityService) {
    this.taskRepository = taskRepository;
    this.activityService = activityService ?? null;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  canViewTask(task: SalesTask, context: SalesTaskUserContext): boolean {
    if (context.role === 'admin') {
      return true;
    }
    return task.assigneeUserId === context.userId || task.createdByUserId === context.userId;
  }

  canAssignTasks(context: SalesTaskUserContext): boolean {
    return context.role === 'admin';
  }

  canCancelOrDelete(task: SalesTask, context: SalesTaskUserContext): boolean {
    if (context.role === 'admin') {
      return true;
    }
    return task.createdByUserId === context.userId || task.assigneeUserId === context.userId;
  }

  async listVisible(context: SalesTaskUserContext): Promise<SalesTask[]> {
    const all = await this.taskRepository.getAll();
    return all.filter((task) => this.canViewTask(task, context));
  }

  async getById(
    id: string,
    context: SalesTaskUserContext,
  ): Promise<SalesTask | null> {
    const task = await this.taskRepository.getById(id);
    if (!task || !this.canViewTask(task, context)) {
      return null;
    }
    return task;
  }

  filterTasks(tasks: SalesTask[], filters: SalesTaskFilters, context: SalesTaskUserContext): SalesTask[] {
    const query = filters.query?.trim().toLowerCase() ?? '';
    return tasks
      .filter((task) => this.canViewTask(task, context))
      .filter((task) => {
        if (filters.status && filters.status !== 'all' && task.status !== filters.status) {
          return false;
        }
        if (filters.type && filters.type !== 'all' && task.type !== filters.type) {
          return false;
        }
        if (filters.priority && filters.priority !== 'all' && task.priority !== filters.priority) {
          return false;
        }
        if (filters.assigneeUserId === 'mine' && task.assigneeUserId !== context.userId) {
          return false;
        }
        if (
          filters.assigneeUserId &&
          filters.assigneeUserId !== 'all' &&
          filters.assigneeUserId !== 'mine' &&
          task.assigneeUserId !== filters.assigneeUserId
        ) {
          return false;
        }
        if (filters.leadId !== undefined && task.leadId !== filters.leadId) {
          return false;
        }
        if (filters.offerId !== undefined && task.offerId !== filters.offerId) {
          return false;
        }
        if (filters.contractId !== undefined && task.contractId !== filters.contractId) {
          return false;
        }
        if (filters.activationId !== undefined && task.activationId !== filters.activationId) {
          return false;
        }
        if (
          filters.comparisonSessionId !== undefined &&
          task.comparisonSessionId !== filters.comparisonSessionId
        ) {
          return false;
        }
        if (filters.dueBucket && filters.dueBucket !== 'all') {
          const open = task.status === 'open' || task.status === 'in_progress';
          if (!open) {
            return false;
          }
          if (dueBucketOf(task) !== filters.dueBucket) {
            return false;
          }
        }
        if (query) {
          const haystack = `${task.title} ${task.description}`.toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => {
        const leftDue = left.dueAt ?? '9999';
        const rightDue = right.dueAt ?? '9999';
        if (leftDue !== rightDue) {
          return leftDue.localeCompare(rightDue);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }

  isOverdue(task: SalesTask, now = new Date()): boolean {
    if (!(task.status === 'open' || task.status === 'in_progress') || !task.dueAt) {
      return false;
    }
    return new Date(task.dueAt).getTime() < new Date(startOfDayIso(now)).getTime();
  }

  async createTask(
    input: CreateSalesTaskInput,
    context: SalesTaskUserContext,
  ): Promise<{ ok: true; task: SalesTask } | { ok: false; error: SalesTaskError; message?: string }> {
    const title = input.title.trim();
    if (!title) {
      return { ok: false, error: 'validation', message: 'Titel ist erforderlich.' };
    }

    if (input.sourceKey) {
      const existing = (await this.taskRepository.getAll()).find(
        (task) =>
          task.sourceKey === input.sourceKey &&
          (task.status === 'open' || task.status === 'in_progress'),
      );
      if (existing) {
        return { ok: true, task: existing };
      }
    }

    const assigneeUserId =
      input.assigneeUserId &&
      (this.canAssignTasks(context) || input.assigneeUserId === context.userId)
        ? input.assigneeUserId
        : context.userId;

    const timestamp = nowIso();
    const task: SalesTask = {
      id: generateId('sales_task'),
      schemaVersion: SALES_TASK_SCHEMA_VERSION,
      title,
      description: input.description?.trim() ?? '',
      type: input.type,
      status: 'open',
      priority: input.priority ?? 'normal',
      dueAt: input.dueAt ?? null,
      dueTimeLocal: input.dueTimeLocal ?? null,
      assigneeUserId,
      createdByUserId: context.userId,
      completedAt: null,
      completedByUserId: null,
      completionNote: '',
      leadId: input.leadId ?? null,
      comparisonSessionId: input.comparisonSessionId ?? null,
      offerId: input.offerId ?? null,
      contractId: input.contractId ?? null,
      contractVersionId: input.contractVersionId ?? null,
      activationId: input.activationId ?? null,
      contactId: input.contactId ?? null,
      wizardEnabled: Boolean(input.wizardEnabled),
      origin: input.origin ?? 'manual',
      sourceKey: input.sourceKey ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const created = await this.taskRepository.create(task);
    if (this.activityService) {
      await this.activityService.recordSystemActivity(
        {
          type: 'task_created',
          title: `Aufgabe angelegt: ${created.title}`,
          description: created.description,
          leadId: created.leadId,
          comparisonSessionId: created.comparisonSessionId,
          offerId: created.offerId,
          taskId: created.id,
          sourceKey: `task_created:${created.id}`,
        },
        context,
      );
    }
    return { ok: true, task: created };
  }

  async ensureAutomaticTask(
    input: CreateSalesTaskInput & { sourceKey: string },
    context: SalesTaskUserContext,
  ): Promise<SalesTask> {
    const result = await this.createTask(
      {
        ...input,
        origin: 'automatic',
        sourceKey: input.sourceKey,
      },
      context,
    );
    if (!result.ok) {
      throw new Error(result.message ?? 'automatic task failed');
    }
    return result.task;
  }

  async ensureOrUpdateAutomaticTask(
    input: CreateSalesTaskInput & { sourceKey: string },
    context: SalesTaskUserContext,
  ): Promise<SalesTask> {
    const existing = (await this.taskRepository.getAll()).find(
      (task) =>
        task.sourceKey === input.sourceKey &&
        (task.status === 'open' || task.status === 'in_progress'),
    );
    if (existing) {
      const result = await this.updateTask(
        existing.id,
        {
          title: input.title,
          dueAt: input.dueAt ?? null,
          priority: input.priority,
          description: input.description,
        },
        context,
      );
      if (!result.ok) {
        throw new Error(result.message ?? 'automatic task update failed');
      }
      return result.task;
    }
    return this.ensureAutomaticTask(input, context);
  }

  async updateTask(
    id: string,
    patch: UpdateSalesTaskInput,
    context: SalesTaskUserContext,
  ): Promise<{ ok: true; task: SalesTask } | { ok: false; error: SalesTaskError; message?: string }> {
    const task = await this.taskRepository.getById(id);
    if (!task) {
      return { ok: false, error: 'not_found' };
    }
    if (!this.canViewTask(task, context)) {
      return { ok: false, error: 'forbidden' };
    }
    if (patch.assigneeUserId && patch.assigneeUserId !== task.assigneeUserId) {
      if (!this.canAssignTasks(context) && patch.assigneeUserId !== context.userId) {
        return { ok: false, error: 'forbidden', message: 'Zuweisung nicht erlaubt.' };
      }
    }

    const updated: SalesTask = {
      ...task,
      title: patch.title?.trim() ?? task.title,
      description: patch.description !== undefined ? patch.description.trim() : task.description,
      type: patch.type ?? task.type,
      status: patch.status ?? task.status,
      priority: patch.priority ?? task.priority,
      dueAt: patch.dueAt !== undefined ? patch.dueAt : task.dueAt,
      dueTimeLocal: patch.dueTimeLocal !== undefined ? patch.dueTimeLocal : task.dueTimeLocal,
      assigneeUserId: patch.assigneeUserId ?? task.assigneeUserId,
      leadId: patch.leadId !== undefined ? patch.leadId : task.leadId,
      comparisonSessionId:
        patch.comparisonSessionId !== undefined
          ? patch.comparisonSessionId
          : task.comparisonSessionId,
      offerId: patch.offerId !== undefined ? patch.offerId : task.offerId,
      contractId: patch.contractId !== undefined ? patch.contractId : task.contractId,
      contractVersionId:
        patch.contractVersionId !== undefined ? patch.contractVersionId : task.contractVersionId,
      activationId: patch.activationId !== undefined ? patch.activationId : task.activationId,
      contactId: patch.contactId !== undefined ? patch.contactId : task.contactId,
      completionNote:
        patch.completionNote !== undefined ? patch.completionNote.trim() : task.completionNote,
      updatedAt: nowIso(),
    };

    return { ok: true, task: await this.taskRepository.update(updated) };
  }

  async completeTask(
    id: string,
    context: SalesTaskUserContext,
    completionNote = '',
  ): Promise<{ ok: true; task: SalesTask } | { ok: false; error: SalesTaskError; message?: string }> {
    const task = await this.taskRepository.getById(id);
    if (!task) {
      return { ok: false, error: 'not_found' };
    }
    if (!this.canViewTask(task, context)) {
      return { ok: false, error: 'forbidden' };
    }
    if (task.status === 'done') {
      return { ok: true, task };
    }
    if (task.status === 'cancelled') {
      return { ok: false, error: 'conflict', message: 'Abgebrochene Aufgabe kann nicht erledigt werden.' };
    }

    const timestamp = nowIso();
    const updated: SalesTask = {
      ...task,
      status: 'done',
      completedAt: timestamp,
      completedByUserId: context.userId,
      completionNote: completionNote.trim(),
      updatedAt: timestamp,
    };
    const saved = await this.taskRepository.update(updated);

    if (this.activityService) {
      await this.activityService.recordSystemActivity(
        {
          type: 'task_completed',
          title: `Aufgabe erledigt: ${saved.title}`,
          description: saved.completionNote,
          leadId: saved.leadId,
          comparisonSessionId: saved.comparisonSessionId,
          offerId: saved.offerId,
          taskId: saved.id,
          contactId: saved.contactId,
          sourceKey: `task_completed:${saved.id}`,
        },
        context,
      );
    }

    return { ok: true, task: saved };
  }

  async cancelTask(
    id: string,
    context: SalesTaskUserContext,
  ): Promise<{ ok: true; task: SalesTask } | { ok: false; error: SalesTaskError; message?: string }> {
    const task = await this.taskRepository.getById(id);
    if (!task) {
      return { ok: false, error: 'not_found' };
    }
    if (!this.canCancelOrDelete(task, context)) {
      return { ok: false, error: 'forbidden' };
    }
    if (task.status === 'done') {
      return { ok: false, error: 'already_done' };
    }
    const updated: SalesTask = {
      ...task,
      status: 'cancelled',
      updatedAt: nowIso(),
    };
    return { ok: true, task: await this.taskRepository.update(updated) };
  }
}

export { dueBucketOf, startOfDayIso, endOfDayIso };
