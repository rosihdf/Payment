import type {
  CreateSalesActivityInput,
  SalesActivity,
  SalesActivityType,
  TimelineFilters,
} from '../domain/salesWorkspace/salesActivity';
import {
  MANUAL_SALES_ACTIVITY_TYPES,
  SALES_ACTIVITY_SCHEMA_VERSION,
} from '../domain/salesWorkspace/salesActivity';
import { activityMatchesTimelineGroup } from '../domain/salesWorkspace/timeline';
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
    if (!(MANUAL_SALES_ACTIVITY_TYPES as readonly string[]).includes(type)) {
      return {
        ok: false,
        error: 'validation',
        message: 'Nur Notiz, Telefonat, E-Mail, Termin oder Besuch können manuell angelegt werden.',
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
      contactId: input.contactId ?? null,
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
      contactId: input.contactId ?? null,
      isSystem: true,
      editable: false,
      sourceKey: input.sourceKey ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.activityRepository.create(activity);
  }

  async updateManualActivity(
    id: string,
    patch: { title?: string; description?: string; occurredAt?: string; contactId?: string | null },
    context: SalesActivityUserContext,
  ): Promise<
    { ok: true; activity: SalesActivity } | { ok: false; error: SalesActivityError; message?: string }
  > {
    const existing = await this.activityRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }
    if (existing.isSystem || !existing.editable) {
      return { ok: false, error: 'immutable' };
    }
    if (context.role !== 'admin' && existing.createdByUserId !== context.userId) {
      return { ok: false, error: 'forbidden' };
    }
    const title = patch.title !== undefined ? patch.title.trim() : existing.title;
    if (!title) {
      return { ok: false, error: 'validation', message: 'Titel ist erforderlich.' };
    }
    const updated: SalesActivity = {
      ...existing,
      title,
      description:
        patch.description !== undefined ? patch.description.trim() : existing.description,
      occurredAt: patch.occurredAt ?? existing.occurredAt,
      contactId: patch.contactId !== undefined ? patch.contactId : existing.contactId,
      updatedAt: nowIso(),
    };
    return { ok: true, activity: await this.activityRepository.update(updated) };
  }

  /**
   * Timeline-Datenmodell für die Kundenakte (keine UI).
   * Liefert Aktivitäten eines Leads chronologisch inkl. Gruppenfilter.
   */
  async getTimelineForLead(
    leadId: string,
    context: SalesActivityUserContext,
    filters: TimelineFilters = {},
  ): Promise<SalesActivity[]> {
    const all = await this.activityRepository.getAll();
    const query = filters.query?.trim().toLowerCase() ?? '';
    const offset = Math.max(0, filters.offset ?? 0);
    const limit = Math.max(1, filters.limit ?? 50);

    const filtered = all
      .filter((activity) => activity.leadId === leadId)
      .filter((activity) => {
        // Admin sieht alles; Außendienst sieht Lead-Timeline vollständig (Akte),
        // solange die Akte selbst freigegeben ist – Sichtprüfung erfolgt im Aufrufer.
        if (context.role !== 'admin' && context.role !== 'field_service') {
          return this.canViewActivity(activity, context);
        }
        return true;
      })
      .filter((activity) => activityMatchesTimelineGroup(activity, filters.group))
      .filter((activity) => {
        if (filters.type && filters.type !== 'all' && activity.type !== filters.type) {
          return false;
        }
        if (filters.contactId !== undefined && activity.contactId !== filters.contactId) {
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

    return filtered.slice(offset, offset + limit);
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
