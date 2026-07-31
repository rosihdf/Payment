import { isWithinDays, parseIsoDateOnly, toIsoDateOnly } from '../contract/contractDates';
import type { ActivationCase, ActivationListItem, ActivationMetrics, ActivationPriority } from './activationCase';
import { ACTIVATION_PRIORITY_LABELS } from './activationCase';
import type { ActivationStatus } from './activationStatus';
import { ACTIVATION_STATUS_LABELS, ACTIVATION_STATUSES } from './activationStatus';

/** Work-state filters for the activation overview (independent of exact status enum where useful). */
export type ActivationWorkStateFilter =
  | 'all'
  | 'blocked'
  | 'documents_open'
  | 'application_open'
  | 'hardware_open'
  | 'setup_open'
  | 'test_open'
  | 'go_live_ready'
  | 'completion_open'
  | 'completed'
  | 'without_next_task';

export type ActivationGoLiveWindowFilter = 'all' | '7' | '14' | '30' | 'overdue' | 'none';

export type ActivationOwnerFilter = 'all' | 'mine' | 'unassigned' | string;

export type ActivationSortBy =
  | 'nextDueAt'
  | 'desiredGoLive'
  | 'priority'
  | 'updatedAt'
  | 'company'
  | 'activationNumber';

export type ActivationSortDirection = 'asc' | 'desc';

export interface ActivationOverviewFilters {
  query?: string;
  status?: ActivationStatus | 'all' | 'open_group' | 'blocked_group';
  ownerUserId?: ActivationOwnerFilter;
  priority?: ActivationPriority | 'all';
  goLiveWindow?: ActivationGoLiveWindowFilter;
  workState?: ActivationWorkStateFilter;
  sortBy?: ActivationSortBy;
  sortDirection?: ActivationSortDirection;
  /** UTC date-only ISO (YYYY-MM-DD) used for window calculations. Defaults to today UTC. */
  todayIso?: string;
  /** Current user for `mine` owner filter. */
  currentUserId?: string;
}

export interface ActivationSearchContext {
  contractNumber: string;
  customerCompanyName: string;
  contactName: string;
  offerNumber: string;
  externalReferenceText: string;
  serialNumbers: string[];
  hardwareModels: string[];
  hasOpenTask: boolean;
}

export type ActivationOverviewItem = ActivationListItem & ActivationSearchContext;

export const ACTIVATION_WORK_STATE_LABELS: Record<Exclude<ActivationWorkStateFilter, 'all'>, string> = {
  blocked: 'Blockiert',
  documents_open: 'Unterlagen offen',
  application_open: 'Antrag offen',
  hardware_open: 'Hardware offen',
  setup_open: 'Einrichtung offen',
  test_open: 'Test offen',
  go_live_ready: 'Go-live bereit',
  completion_open: 'Abschluss offen',
  completed: 'Abgeschlossen',
  without_next_task: 'Ohne nächste Aufgabe',
};

export const ACTIVATION_GO_LIVE_WINDOW_LABELS: Record<Exclude<ActivationGoLiveWindowFilter, 'all'>, string> = {
  '7': 'Go-live in 7 Tagen',
  '14': 'Go-live in 14 Tagen',
  '30': 'Go-live in 30 Tagen',
  overdue: 'Go-live überfällig',
  none: 'Ohne geplantes Go-live',
};

export const ACTIVATION_SORT_LABELS: Record<ActivationSortBy, string> = {
  nextDueAt: 'Nächste Fälligkeit',
  desiredGoLive: 'Gewünschter Go-live',
  priority: 'Priorität',
  updatedAt: 'Zuletzt geändert',
  company: 'Firma',
  activationNumber: 'Aktivierungsnummer',
};

const PRIORITY_RANK: Record<ActivationPriority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
};

const TERMINAL_STATUSES: ActivationStatus[] = ['completed', 'archived', 'cancelled'];

export function normalizeActivationSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchesActivationSearch(
  item: Pick<
    ActivationOverviewItem,
    | 'activationNumber'
    | 'contractNumber'
    | 'customerCompanyName'
    | 'contactName'
    | 'offerNumber'
    | 'externalReferenceText'
    | 'serialNumbers'
    | 'hardwareModels'
  >,
  query: string | null | undefined,
): boolean {
  const normalizedQuery = normalizeActivationSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    item.activationNumber,
    item.contractNumber,
    item.customerCompanyName,
    item.contactName,
    item.offerNumber,
    item.externalReferenceText,
    ...item.serialNumbers,
    ...item.hardwareModels,
  ]
    .map((part) => normalizeActivationSearchText(part))
    .join(' ');

  return haystack.includes(normalizedQuery);
}

export function matchesActivationStatus(
  status: ActivationStatus,
  filter: ActivationOverviewFilters['status'],
): boolean {
  if (!filter || filter === 'all') {
    return true;
  }
  if (filter === 'open_group') {
    return !TERMINAL_STATUSES.includes(status) && status !== 'live';
  }
  if (filter === 'blocked_group') {
    return status === 'blocked';
  }
  return status === filter;
}

export function matchesActivationOwner(
  item: Pick<ActivationCase, 'ownerUserId'>,
  filter: ActivationOwnerFilter | undefined,
  currentUserId?: string,
): boolean {
  if (!filter || filter === 'all') {
    return true;
  }
  const owner = item.ownerUserId?.trim() ?? '';
  if (filter === 'unassigned') {
    return owner.length === 0;
  }
  if (filter === 'mine') {
    return Boolean(currentUserId) && owner === currentUserId;
  }
  return owner === filter;
}

export function matchesActivationGoLiveWindow(
  desiredGoLive: string | null,
  filter: ActivationGoLiveWindowFilter | undefined,
  todayIso?: string,
): boolean {
  if (!filter || filter === 'all') {
    return true;
  }
  const today = todayIso ?? toIsoDateOnly(new Date());
  if (filter === 'none') {
    return !desiredGoLive;
  }
  if (!desiredGoLive) {
    return false;
  }
  if (filter === 'overdue') {
    const target = parseIsoDateOnly(desiredGoLive);
    const todayDate = parseIsoDateOnly(today);
    if (!target || !todayDate) {
      return false;
    }
    return target.getTime() < todayDate.getTime();
  }
  const days = Number(filter);
  return isWithinDays(desiredGoLive, days, today);
}

export function matchesActivationWorkState(
  item: Pick<ActivationCase, 'status'> & { hasOpenTask: boolean },
  filter: ActivationWorkStateFilter | undefined,
): boolean {
  if (!filter || filter === 'all') {
    return true;
  }
  switch (filter) {
    case 'blocked':
      return item.status === 'blocked';
    case 'documents_open':
      return item.status === 'documents_pending';
    case 'application_open':
      return item.status === 'application_pending' || item.status === 'provider_review';
    case 'hardware_open':
      return item.status === 'hardware_pending';
    case 'setup_open':
      return item.status === 'setup_pending';
    case 'test_open':
      return item.status === 'testing';
    case 'go_live_ready':
      return item.status === 'go_live_ready';
    case 'completion_open':
      return item.status === 'live';
    case 'completed':
      return item.status === 'completed';
    case 'without_next_task':
      return !item.hasOpenTask && !TERMINAL_STATUSES.includes(item.status);
    default:
      return true;
  }
}

export function filterActivationCases<T extends ActivationOverviewItem>(
  items: T[],
  filters: ActivationOverviewFilters = {},
): T[] {
  return items.filter((item) => {
    if (!matchesActivationSearch(item, filters.query)) return false;
    if (!matchesActivationStatus(item.status, filters.status)) return false;
    if (!matchesActivationOwner(item, filters.ownerUserId, filters.currentUserId)) return false;
    if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) return false;
    if (!matchesActivationGoLiveWindow(item.desiredGoLive, filters.goLiveWindow, filters.todayIso)) return false;
    if (!matchesActivationWorkState(item, filters.workState)) return false;
    return true;
  });
}

function compareNullableIso(
  left: string | null,
  right: string | null,
  direction: ActivationSortDirection,
  emptyLast: boolean,
): number {
  const leftEmpty = !left;
  const rightEmpty = !right;
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return emptyLast ? 1 : -1;
  if (rightEmpty) return emptyLast ? -1 : 1;
  const cmp = left!.localeCompare(right!);
  return direction === 'asc' ? cmp : -cmp;
}

function defaultSortDirection(sortBy: ActivationSortBy): ActivationSortDirection {
  if (sortBy === 'updatedAt' || sortBy === 'priority') {
    return 'desc';
  }
  return 'asc';
}

export function sortActivationCases<T extends ActivationOverviewItem>(
  items: T[],
  sortBy: ActivationSortBy = 'nextDueAt',
  sortDirection?: ActivationSortDirection,
): T[] {
  const direction = sortDirection ?? defaultSortDirection(sortBy);
  const sorted = [...items];
  sorted.sort((a, b) => {
    let primary = 0;
    switch (sortBy) {
      case 'desiredGoLive':
        primary = compareNullableIso(a.desiredGoLive, b.desiredGoLive, direction, true);
        break;
      case 'priority': {
        const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        primary = direction === 'asc' ? rankDiff : -rankDiff;
        break;
      }
      case 'updatedAt': {
        const cmp = a.updatedAt.localeCompare(b.updatedAt);
        primary = direction === 'asc' ? cmp : -cmp;
        break;
      }
      case 'company': {
        const cmp = a.customerCompanyName.localeCompare(b.customerCompanyName, 'de');
        primary = direction === 'asc' ? cmp : -cmp;
        break;
      }
      case 'activationNumber': {
        const cmp = a.activationNumber.localeCompare(b.activationNumber);
        primary = direction === 'asc' ? cmp : -cmp;
        break;
      }
      case 'nextDueAt':
      default:
        primary = compareNullableIso(a.nextDueAt, b.nextDueAt, direction, true);
        break;
    }
    if (primary !== 0) return primary;
    const byNumber = a.activationNumber.localeCompare(b.activationNumber);
    if (byNumber !== 0) return byNumber;
    return a.id.localeCompare(b.id);
  });
  return sorted;
}

export function getActivationOverviewMetrics(
  items: Array<
    Pick<ActivationOverviewItem, 'status' | 'desiredGoLive' | 'hasOpenTask' | 'progressPercent'>
  >,
  todayIso?: string,
): ActivationMetrics {
  const today = todayIso ?? toIsoDateOnly(new Date());
  const openStatuses = items.filter(
    (item) => !TERMINAL_STATUSES.includes(item.status) && item.status !== 'live',
  );

  return {
    openCount: openStatuses.length,
    blockedCount: items.filter((item) => item.status === 'blocked').length,
    goLiveIn7Days: items.filter((item) => matchesActivationGoLiveWindow(item.desiredGoLive, '7', today)).length,
    documentsOpenCount: items.filter((item) => item.status === 'documents_pending').length,
    providerReviewCount: items.filter((item) => item.status === 'provider_review').length,
    hardwareOpenCount: items.filter((item) => item.status === 'hardware_pending').length,
    setupOpenCount: items.filter((item) => item.status === 'setup_pending').length,
    testOpenCount: items.filter((item) => item.status === 'testing').length,
    goLiveReadyCount: items.filter((item) => item.status === 'go_live_ready').length,
    completionOpenCount: items.filter((item) => item.status === 'live').length,
    withoutNextTaskCount: items.filter(
      (item) => !item.hasOpenTask && !TERMINAL_STATUSES.includes(item.status),
    ).length,
    liveCount: items.filter((item) => item.status === 'live').length,
    completedCount: items.filter((item) => item.status === 'completed').length,
    overdueCount: items.filter((item) => matchesActivationGoLiveWindow(item.desiredGoLive, 'overdue', today)).length,
    averageProgressPercent: items.length
      ? Math.round(items.reduce((sum, item) => sum + item.progressPercent, 0) / items.length)
      : 0,
  };
}

export function listActivationStatusFilterOptions(): Array<{ value: ActivationStatus | 'all'; label: string }> {
  return [
    { value: 'all', label: 'Alle Status' },
    ...ACTIVATION_STATUSES.map((status) => ({
      value: status,
      label: ACTIVATION_STATUS_LABELS[status],
    })),
  ];
}

export function listActivationPriorityFilterOptions(): Array<{
  value: ActivationPriority | 'all';
  label: string;
}> {
  return [
    { value: 'all', label: 'Alle Prioritäten' },
    ...(Object.entries(ACTIVATION_PRIORITY_LABELS) as Array<[ActivationPriority, string]>).map(
      ([value, label]) => ({ value, label }),
    ),
  ];
}
