import type {
  CreateSalesActivityInput,
  SalesActivity,
  SalesActivityType,
} from '../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_SCHEMA_VERSION } from '../domain/salesWorkspace/salesActivity';
import type { User } from '../domain/user/user';
import type { SalesActivityRepository } from '../repositories/interfaces/SalesActivityRepository';
import { generateId, nowIso } from '../utils/id';

export interface SalesActivityUserContext {
  userId: string;
  role: User['role'];
  displayName?: string;
}

export type SalesActivityError = 'not_found' | 'forbidden' | 'validation' | 'immutable';

export interface SalesActivityFilters {
  type?: SalesActivityType | 'all';
  createdByUserId?: string | 'all' | 'mine';
  leadId?: string | null;
  offerId?: string | null;
  contractId?: string | null;
  activationId?: string | null;
  comparisonSessionId?: string | null;
  from?: string | null;
  to?: string | null;
  query?: string;
}

export class SalesActivityService {
  private readonly activityRepository: SalesActivityRepository;

  constructor(activityRepository: SalesActivityRepository) {
    this.activityRepository = activityRepository;
  }

  canViewActivity(activity: SalesActivity, context: SalesActivityUserContext): boolean {
    if (context.role === 'admin') {
      return true;
    }
    return activity.createdByUserId === context.userId;
  }

  async listVisible(context: SalesActivityUserContext): Promise<SalesActivity[]> {
    const all = await this.activityRepository.getAll();
    return all.filter((activity) => this.canViewActivity(activity, context));
  }

  filterActivities(
    activities: SalesActivity[],
    filters: SalesActivityFilters,
    context: SalesActivityUserContext,
  ): SalesActivity[] {
    const query = filters.query?.trim().toLowerCase() ?? '';
    return activities
      .filter((activity) => this.canViewActivity(activity, context))
      .filter((activity) => {
        if (filters.type && filters.type !== 'all' && activity.type !== filters.type) {
          return false;
        }
        if (filters.createdByUserId === 'mine' && activity.createdByUserId !== context.userId) {
          return false;
        }
        if (
          filters.createdByUserId &&
          filters.createdByUserId !== 'all' &&
          filters.createdByUserId !== 'mine' &&
          activity.createdByUserId !== filters.createdByUserId
        ) {
          return false;
        }
        if (filters.leadId !== undefined && activity.leadId !== filters.leadId) {
          return false;
        }
        if (filters.offerId !== undefined && activity.offerId !== filters.offerId) {
          return false;
        }
        if (filters.contractId !== undefined && activity.contractId !== filters.contractId) {
          return false;
        }
        if (filters.activationId !== undefined && activity.activationId !== filters.activationId) {
          return false;
        }
        if (
          filters.comparisonSessionId !== undefined &&
          activity.comparisonSessionId !== filters.comparisonSessionId
        ) {
          return false;
        }
        if (filters.from && activity.occurredAt < filters.from) {
          return false;
        }
        if (filters.to && activity.occurredAt > filters.to) {
          return false;
        }
        if (query) {
          const haystack = `${activity.title} ${activity.description}`.toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  async createManualActivity(
    input: CreateSalesActivityInput,
    context: SalesActivityUserContext,
  ): Promise<
    { ok: true; activity: SalesActivity } | { ok: false; error: SalesActivityError; message?: string }
  > {
    const title = input.title.trim();
    if (!title) {
      return { ok: false, error: 'validation', message: 'Titel ist erforderlich.' };
    }
    const type = input.type;
    if (!['note', 'call', 'email', 'meeting'].includes(type)) {
      return {
        ok: false,
        error: 'validation',
        message: 'Nur Notiz, Telefonat, E-Mail oder Termin können manuell angelegt werden.',
      };
    }

    const timestamp = nowIso();
    const activity: SalesActivity = {
      id: generateId('sales_activity'),
      schemaVersion: SALES_ACTIVITY_SCHEMA_VERSION,
      type,
      title,
      description: input.description?.trim() ?? '',
      occurredAt: input.occurredAt ?? timestamp,
      createdByUserId: context.userId,
      leadId: input.leadId ?? null,
      comparisonSessionId: input.comparisonSessionId ?? null,
      offerId: input.offerId ?? null,
      contractId: input.contractId ?? null,
      contractVersionId: input.contractVersionId ?? null,
      activationId: input.activationId ?? null,
      taskId: input.taskId ?? null,
      isSystem: false,
      editable: true,
      sourceKey: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return { ok: true, activity: await this.activityRepository.create(activity) };
  }

  async recordSystemActivity(
    input: CreateSalesActivityInput & { type: SalesActivityType; title: string },
    context: SalesActivityUserContext,
  ): Promise<SalesActivity> {
    if (input.sourceKey) {
      const existing = (await this.activityRepository.getAll()).find(
        (activity) => activity.sourceKey === input.sourceKey,
      );
      if (existing) {
        return existing;
      }
    }

    const timestamp = nowIso();
    const activity: SalesActivity = {
      id: generateId('sales_activity'),
      schemaVersion: SALES_ACTIVITY_SCHEMA_VERSION,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      occurredAt: input.occurredAt ?? timestamp,
      createdByUserId: context.userId,
      leadId: input.leadId ?? null,
      comparisonSessionId: input.comparisonSessionId ?? null,
      offerId: input.offerId ?? null,
      contractId: input.contractId ?? null,
      contractVersionId: input.contractVersionId ?? null,
      activationId: input.activationId ?? null,
      taskId: input.taskId ?? null,
      isSystem: true,
      editable: false,
      sourceKey: input.sourceKey ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.activityRepository.create(activity);
  }

  async deleteActivity(
    id: string,
    context: SalesActivityUserContext,
  ): Promise<{ ok: true } | { ok: false; error: SalesActivityError }> {
    const activity = await this.activityRepository.getById(id);
    if (!activity) {
      return { ok: false, error: 'not_found' };
    }
    if (activity.isSystem || !activity.editable) {
      return { ok: false, error: 'immutable' };
    }
    if (!this.canViewActivity(activity, context) && context.role !== 'admin') {
      return { ok: false, error: 'forbidden' };
    }
    await this.activityRepository.delete(id);
    return { ok: true };
  }
}
