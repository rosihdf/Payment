import type { CustomerPrimaryAction } from '../domain/salesWorkspace/customerRecordView';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { dueBucketOf } from './salesTaskService';

export interface SalesDayWorkEntry {
  id: string;
  leadId: string | null;
  companyName: string;
  taskTitle: string | null;
  dueAt: string | null;
  standLabel: string;
  nextActionLabel: string;
  customerHref: string | null;
  warning: string | null;
}

export interface SalesDayWorkspaceSections {
  overdue: SalesDayWorkEntry[];
  today: SalesDayWorkEntry[];
  blocked: SalesDayWorkEntry[];
  nextCases: SalesDayWorkEntry[];
}

/** Minimale Kartenfakten für die Tagesableitung (kein Service-Import). */
export interface SalesDayCaseCard {
  id: string;
  leadId: string | null;
  companyName: string;
  standLabel: string;
  phaseLabel: string;
  nextTaskTitle: string | null;
  nextTaskDueAt: string | null;
  nextActionLabel: string;
  warning: string | null;
  isOverdue: boolean;
  lastActivityAt: string | null;
  primaryKind: CustomerPrimaryAction['kind'];
  isHardBlocked: boolean;
}

function isOpenTask(task: SalesTask): boolean {
  return task.status === 'open' || task.status === 'in_progress';
}

function customerHref(leadId: string | null): string | null {
  return leadId ? `/leads/${leadId}` : null;
}

function sortKey(entry: {
  isHardBlocked?: boolean;
  isOverdue?: boolean;
  isToday?: boolean;
  dueAt: string | null;
  lastActivityAt?: string | null;
}): string {
  const rank = entry.isHardBlocked
    ? '0'
    : entry.isOverdue
      ? '1'
      : entry.isToday
        ? '2'
        : entry.dueAt
          ? '3'
          : '4';
  const due = entry.dueAt ?? '9999';
  const activity = entry.lastActivityAt ?? '';
  return `${rank}|${due}|${activity}`;
}

function entryFromCard(
  card: SalesDayCaseCard,
  overrides: Partial<SalesDayWorkEntry> = {},
): SalesDayWorkEntry {
  return {
    id: card.id,
    leadId: card.leadId,
    companyName: card.companyName,
    taskTitle: overrides.taskTitle ?? card.nextTaskTitle,
    dueAt: overrides.dueAt ?? card.nextTaskDueAt,
    standLabel: card.standLabel || card.phaseLabel,
    nextActionLabel: card.nextActionLabel,
    customerHref: customerHref(card.leadId),
    warning: card.warning,
    ...overrides,
  };
}

function entryFromTask(
  task: SalesTask,
  card: SalesDayCaseCard | undefined,
): SalesDayWorkEntry {
  return {
    id: `task:${task.id}`,
    leadId: task.leadId,
    companyName: card?.companyName ?? 'Ohne Kunde',
    taskTitle: task.title,
    dueAt: task.dueAt,
    standLabel: card?.standLabel || card?.phaseLabel || '–',
    nextActionLabel: card?.nextActionLabel ?? task.title,
    customerHref: customerHref(task.leadId),
    warning: dueBucketOf(task) === 'overdue' ? 'Überfällig' : card?.warning ?? null,
  };
}

/**
 * Baut die vier Tagesbereiche des Arbeitsplatzes – rein abgeleitet, ohne Side Effects.
 */
export function buildSalesDayWorkspaceSections(input: {
  cards: SalesDayCaseCard[];
  tasks: SalesTask[];
  now?: Date;
}): SalesDayWorkspaceSections {
  const now = input.now ?? new Date();
  const cardsByLead = new Map(
    input.cards.filter((card) => card.leadId).map((card) => [card.leadId as string, card]),
  );
  const openTasks = input.tasks.filter(isOpenTask);

  const blockedCards = input.cards
    .filter((card) => card.isHardBlocked)
    .sort((left, right) =>
      sortKey({
        isHardBlocked: true,
        dueAt: left.nextTaskDueAt,
        lastActivityAt: left.lastActivityAt,
      }).localeCompare(
        sortKey({
          isHardBlocked: true,
          dueAt: right.nextTaskDueAt,
          lastActivityAt: right.lastActivityAt,
        }),
      ),
    );

  const blockedLeadIds = new Set(
    blockedCards.map((card) => card.leadId).filter((id): id is string => Boolean(id)),
  );

  const overdueTasks = openTasks
    .filter((task) => dueBucketOf(task, now) === 'overdue')
    .filter((task) => !task.leadId || !blockedLeadIds.has(task.leadId))
    .sort((left, right) => (left.dueAt ?? '').localeCompare(right.dueAt ?? ''));

  const overdueLeadIds = new Set(
    overdueTasks.map((task) => task.leadId).filter((id): id is string => Boolean(id)),
  );

  const todayTasks = openTasks
    .filter((task) => dueBucketOf(task, now) === 'today')
    .filter(
      (task) =>
        !task.leadId || (!blockedLeadIds.has(task.leadId) && !overdueLeadIds.has(task.leadId)),
    )
    .sort((left, right) => (left.dueAt ?? '').localeCompare(right.dueAt ?? ''));

  const todayTaskLeadIds = new Set(
    todayTasks.map((task) => task.leadId).filter((id): id is string => Boolean(id)),
  );

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const todayCaseCards = input.cards
    .filter((card) => {
      if (!card.leadId) return false;
      if (blockedLeadIds.has(card.leadId) || overdueLeadIds.has(card.leadId)) return false;
      if (todayTaskLeadIds.has(card.leadId)) return false;
      if (card.primaryKind === 'offer_approval') return true;
      if (card.primaryKind === 'today_follow_up') return true;
      if (!card.nextTaskDueAt) return false;
      const due = new Date(card.nextTaskDueAt).getTime();
      return due >= dayStart.getTime() && due <= dayEnd.getTime();
    })
    .sort((left, right) =>
      sortKey({
        isToday: true,
        dueAt: left.nextTaskDueAt,
        lastActivityAt: left.lastActivityAt,
      }).localeCompare(
        sortKey({
          isToday: true,
          dueAt: right.nextTaskDueAt,
          lastActivityAt: right.lastActivityAt,
        }),
      ),
    );

  const claimedLeadIds = new Set([
    ...blockedLeadIds,
    ...overdueLeadIds,
    ...todayTaskLeadIds,
    ...todayCaseCards.map((card) => card.leadId).filter((id): id is string => Boolean(id)),
  ]);

  const nextCases = input.cards
    .filter((card) => {
      if (!card.leadId || claimedLeadIds.has(card.leadId)) return false;
      if (card.primaryKind === 'none') return false;
      return true;
    })
    .sort((left, right) =>
      sortKey({
        isHardBlocked: left.isHardBlocked,
        isOverdue: left.primaryKind === 'overdue_follow_up' || left.isOverdue,
        isToday: left.primaryKind === 'today_follow_up',
        dueAt: left.nextTaskDueAt,
        lastActivityAt: left.lastActivityAt,
      }).localeCompare(
        sortKey({
          isHardBlocked: right.isHardBlocked,
          isOverdue: right.primaryKind === 'overdue_follow_up' || right.isOverdue,
          isToday: right.primaryKind === 'today_follow_up',
          dueAt: right.nextTaskDueAt,
          lastActivityAt: right.lastActivityAt,
        }),
      ),
    )
    .slice(0, 30);

  return {
    overdue: overdueTasks.map((task) =>
      entryFromTask(task, task.leadId ? cardsByLead.get(task.leadId) : undefined),
    ),
    today: [
      ...todayTasks.map((task) =>
        entryFromTask(task, task.leadId ? cardsByLead.get(task.leadId) : undefined),
      ),
      ...todayCaseCards.map((card) => entryFromCard(card)),
    ],
    blocked: blockedCards.map((card) =>
      entryFromCard(card, {
        warning: card.warning ?? 'Blockiert',
      }),
    ),
    nextCases: nextCases.map((card) => entryFromCard(card)),
  };
}
