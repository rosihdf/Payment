import type { CustomerPrimaryAction } from '../domain/salesWorkspace/customerRecordView';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { ANONYMOUS_ADVICE_DISPLAY_NAME } from '../domain/lead/getLeadDisplayName';
import { dueBucketOf } from './salesTaskService';

export interface SalesDayWorkEntry {
  id: string;
  leadId: string | null;
  companyName: string;
  taskTitle: string | null;
  dueAt: string | null;
  standLabel: string;
  nextActionLabel: string;
  /** Primäre nächste Aktion (Beratung/Angebot/Vertrag…); Fallback Kundenakte. */
  actionHref: string | null;
  customerHref: string | null;
  warning: string | null;
  /** Letzter Bearbeitungszeitpunkt (Beratungsentwürfe). */
  lastActivityAt?: string | null;
}

export interface SalesDayWorkspaceSections {
  adviceDrafts: SalesDayWorkEntry[];
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
  nextActionHref?: string | null;
  warning: string | null;
  isOverdue: boolean;
  lastActivityAt: string | null;
  primaryKind: CustomerPrimaryAction['kind'];
  isHardBlocked: boolean;
  sessionId?: string | null;
  staleCalculation?: boolean;
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
    actionHref: card.nextActionHref ?? customerHref(card.leadId),
    customerHref: customerHref(card.leadId),
    warning: card.warning,
    ...overrides,
  };
}

function isWizardContinuationTask(task: SalesTask): boolean {
  return task.type === 'continue_calculation' || task.origin === 'automatic' && Boolean(task.comparisonSessionId);
}

function entryFromAdviceDraft(card: SalesDayCaseCard): SalesDayWorkEntry {
  return {
    id: `advice:${card.sessionId ?? card.id}`,
    leadId: card.leadId,
    companyName: card.companyName,
    taskTitle: null,
    dueAt: null,
    standLabel: card.standLabel || 'Beratung',
    nextActionLabel: 'Fortsetzen',
    actionHref: card.nextActionHref ?? null,
    customerHref: customerHref(card.leadId),
    warning: card.staleCalculation ? 'Berechnung veraltet' : card.warning,
    lastActivityAt: card.lastActivityAt,
  };
}

function entryFromTask(
  task: SalesTask,
  card: SalesDayCaseCard | undefined,
): SalesDayWorkEntry {
  return {
    id: `task:${task.id}`,
    leadId: task.leadId,
    companyName: card?.companyName ?? ANONYMOUS_ADVICE_DISPLAY_NAME,
    taskTitle: task.title,
    dueAt: task.dueAt,
    standLabel: card?.standLabel || card?.phaseLabel || '–',
    nextActionLabel: card?.nextActionLabel ?? task.title,
    actionHref: card?.nextActionHref ?? customerHref(task.leadId),
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
  adviceDraftCards?: SalesDayCaseCard[];
  now?: Date;
}): SalesDayWorkspaceSections {
  const now = input.now ?? new Date();
  const adviceDraftSessionIds = new Set(
    (input.adviceDraftCards ?? [])
      .map((card) => card.sessionId)
      .filter((id): id is string => Boolean(id)),
  );
  const cardsByLead = new Map(
    input.cards.filter((card) => card.leadId).map((card) => [card.leadId as string, card]),
  );
  const cardsBySession = new Map(
    input.cards
      .filter((card) => card.sessionId)
      .map((card) => [card.sessionId as string, card]),
  );
  const actionableTasks = input.tasks.filter(
    (task) => isOpenTask(task) && !isWizardContinuationTask(task),
  );

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

  const overdueTasks = actionableTasks
    .filter((task) => dueBucketOf(task, now) === 'overdue')
    .filter((task) => !task.leadId || !blockedLeadIds.has(task.leadId))
    .sort((left, right) => (left.dueAt ?? '').localeCompare(right.dueAt ?? ''));

  const overdueLeadIds = new Set(
    overdueTasks.map((task) => task.leadId).filter((id): id is string => Boolean(id)),
  );

  const todayTasks = actionableTasks
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
      if (card.sessionId && adviceDraftSessionIds.has(card.sessionId)) return false;
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

  const adviceDrafts = (input.adviceDraftCards ?? [])
    .slice()
    .sort((left, right) =>
      (right.lastActivityAt ?? '').localeCompare(left.lastActivityAt ?? ''),
    )
    .map((card) => entryFromAdviceDraft(card));

  return {
    adviceDrafts,
    overdue: overdueTasks.map((task) =>
      entryFromTask(
        task,
        task.leadId
          ? cardsByLead.get(task.leadId)
          : task.comparisonSessionId
            ? cardsBySession.get(task.comparisonSessionId)
            : undefined,
      ),
    ),
    today: [
      ...todayTasks.map((task) =>
        entryFromTask(
          task,
          task.leadId
            ? cardsByLead.get(task.leadId)
            : task.comparisonSessionId
              ? cardsBySession.get(task.comparisonSessionId)
              : undefined,
        ),
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
