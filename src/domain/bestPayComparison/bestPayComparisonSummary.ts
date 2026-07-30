import type {
  BestPayComparisonSession,
  BestPayComparisonSource,
  BestPayComparisonStatus,
} from './bestPayComparisonSession';

export type BestPayComparisonListStatusFilter =
  | 'all'
  | 'draft'
  | 'review_required'
  | 'calculated'
  | 'offer_created'
  | 'archived';

export type BestPayComparisonFreshnessFilter = 'all' | 'current' | 'stale';

export type BestPayComparisonAssignmentFilter =
  | 'all'
  | 'with_lead'
  | 'without_lead'
  | 'with_offer'
  | 'without_offer';

export type BestPayComparisonSourceFilter = 'all' | BestPayComparisonSource;

export type BestPayComparisonTimeRangeFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days';

export type BestPayComparisonSort =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'title_asc'
  | 'savings_desc'
  | 'extra_cost_desc';

export type BestPayComparisonDisplayStatus =
  | 'draft'
  | 'billing_import'
  | 'review_required'
  | 'ready_for_calculation'
  | 'calculated'
  | 'recommendation_selected'
  | 'assigned'
  | 'offer_created'
  | 'archived'
  | 'discarded';

export type BestPayComparisonPrimaryAction =
  | 'continue_editing'
  | 'review_data'
  | 'open_result'
  | 'open_offer'
  | 'recalculate'
  | 'restore'
  | 'none';

export interface BestPayComparisonListFilters {
  query: string;
  status: BestPayComparisonListStatusFilter;
  freshness: BestPayComparisonFreshnessFilter;
  assignment: BestPayComparisonAssignmentFilter;
  source: BestPayComparisonSourceFilter;
  timeRange: BestPayComparisonTimeRangeFilter;
  sort: BestPayComparisonSort;
  includeArchived: boolean;
}

export interface BestPayComparisonSummary {
  id: string;
  title: string;
  merchantLabel: string | null;
  leadId: string | null;
  leadLabel: string | null;
  status: BestPayComparisonStatus;
  displayStatus: BestPayComparisonDisplayStatus;
  isStale: boolean;
  staleReasons: string[];
  source: BestPayComparisonSource | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
  selectedVariantName: string | null;
  currentMonthlyCostsCents: number | null;
  bestPayMonthlyCostsCents: number | null;
  savingsMonthlyCents: number | null;
  isHigherCost: boolean;
  hasResult: boolean;
  offerId: string | null;
  offerNumber: string | null;
  offerTitle: string | null;
  primaryAction: BestPayComparisonPrimaryAction;
  canDelete: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDuplicate: boolean;
}

export const DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS: BestPayComparisonListFilters = {
  query: '',
  status: 'all',
  freshness: 'all',
  assignment: 'all',
  source: 'all',
  timeRange: 'all',
  sort: 'updated_desc',
  includeArchived: false,
};

export function formatBestPayComparisonFallbackTitle(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'BestPay-Berechnung';
  }
  const formatted = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return `BestPay-Berechnung vom ${formatted}`;
}

export function resolveBestPayComparisonTitle(session: BestPayComparisonSession): string {
  if (session.title?.trim()) {
    return session.title.trim();
  }
  if (session.customerLabel?.trim()) {
    return session.customerLabel.trim();
  }
  if (session.leadDisplayName?.trim()) {
    return session.leadDisplayName.trim();
  }
  return formatBestPayComparisonFallbackTitle(session.createdAt);
}

export function buildBestPayComparisonSearchText(session: BestPayComparisonSession): string {
  const selected =
    session.result?.variants.find((variant) => variant.candidateId === session.selectedCandidateId) ??
    session.result?.variants[0] ??
    null;
  return [
    resolveBestPayComparisonTitle(session),
    session.customerLabel,
    session.leadDisplayName,
    session.leadId,
    session.offerId,
    session.offerNumber,
    session.offerTitle,
    selected?.tariffName,
    selected?.productName,
    session.id,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLocaleLowerCase('de-DE');
}

export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\s+/g, ' ');
}

function isDraftLike(status: BestPayComparisonStatus): boolean {
  return (
    status === 'draft' ||
    status === 'billing_import' ||
    status === 'ready_for_calculation'
  );
}

export function resolveDisplayStatus(session: BestPayComparisonSession): BestPayComparisonDisplayStatus {
  if (session.archivedAt) {
    return 'archived';
  }
  if (session.status === 'discarded') {
    return 'discarded';
  }
  return session.status;
}

export function resolvePrimaryAction(session: BestPayComparisonSession): BestPayComparisonPrimaryAction {
  if (session.archivedAt) {
    return 'restore';
  }
  if (session.result?.stale) {
    return 'recalculate';
  }
  if (session.status === 'offer_created' && session.offerId) {
    return 'open_offer';
  }
  if (session.status === 'review_required' || session.status === 'billing_import') {
    return 'review_data';
  }
  if (
    session.status === 'calculated' ||
    session.status === 'recommendation_selected' ||
    session.status === 'assigned' ||
    session.status === 'offer_created'
  ) {
    return 'open_result';
  }
  if (isDraftLike(session.status) || session.status === 'ready_for_calculation') {
    return 'continue_editing';
  }
  return 'none';
}

export function canDeleteBestPayComparisonDraft(session: BestPayComparisonSession): boolean {
  if (session.offerId || session.archivedAt || session.status === 'offer_created') {
    return false;
  }
  if (session.result && !session.result.stale && session.status !== 'draft') {
    return false;
  }
  if (session.completedAt) {
    return false;
  }
  return (
    isDraftLike(session.status) ||
    session.status === 'review_required' ||
    session.status === 'discarded'
  );
}

export function toBestPayComparisonSummary(session: BestPayComparisonSession): BestPayComparisonSummary {
  const selected =
    session.result?.variants.find((variant) => variant.candidateId === session.selectedCandidateId) ??
    session.result?.variants[0] ??
    null;
  const hasResult = Boolean(session.result && selected);
  const savingsMonthlyCents = selected?.savingsMonthlyCents ?? null;

  return {
    id: session.id,
    title: resolveBestPayComparisonTitle(session),
    merchantLabel: session.customerLabel,
    leadId: session.leadId,
    leadLabel: session.leadDisplayName ?? session.customerLabel,
    status: session.status,
    displayStatus: resolveDisplayStatus(session),
    isStale: Boolean(session.result?.stale),
    staleReasons: session.result?.staleReasons ?? [],
    source: session.source,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastOpenedAt: session.lastOpenedAt,
    archivedAt: session.archivedAt,
    selectedVariantName: selected?.tariffName ?? null,
    currentMonthlyCostsCents: session.result?.currentMonthlyCostsCents ?? null,
    bestPayMonthlyCostsCents: selected?.monthlyTotalCostsCents ?? null,
    savingsMonthlyCents,
    isHigherCost: selected?.isHigherCost ?? false,
    hasResult,
    offerId: session.offerId,
    offerNumber: session.offerNumber,
    offerTitle: session.offerTitle,
    primaryAction: resolvePrimaryAction(session),
    canDelete: canDeleteBestPayComparisonDraft(session),
    canArchive: !session.archivedAt && session.status !== 'discarded',
    canRestore: Boolean(session.archivedAt),
    canDuplicate: session.status !== 'discarded',
  };
}

function matchesTimeRange(updatedAt: string, timeRange: BestPayComparisonTimeRangeFilter, now: Date): boolean {
  if (timeRange === 'all') {
    return true;
  }
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) {
    return false;
  }
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (timeRange === 'today') {
    return updated >= startOfToday;
  }
  const days = timeRange === 'last_7_days' ? 7 : 30;
  const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return updated >= threshold;
}

function matchesStatusFilter(
  session: BestPayComparisonSession,
  status: BestPayComparisonListStatusFilter,
): boolean {
  if (status === 'all') {
    return true;
  }
  if (status === 'archived') {
    return Boolean(session.archivedAt);
  }
  if (session.archivedAt) {
    return false;
  }
  if (status === 'draft') {
    return isDraftLike(session.status);
  }
  if (status === 'review_required') {
    return session.status === 'review_required' || session.status === 'billing_import';
  }
  if (status === 'calculated') {
    return (
      session.status === 'calculated' ||
      session.status === 'recommendation_selected' ||
      session.status === 'assigned'
    );
  }
  if (status === 'offer_created') {
    return session.status === 'offer_created';
  }
  return true;
}

export function filterAndSortBestPayComparisons(
  sessions: BestPayComparisonSession[],
  filters: BestPayComparisonListFilters,
  now: Date = new Date(),
): BestPayComparisonSummary[] {
  const normalizedQuery = normalizeSearchQuery(filters.query);

  const filtered = sessions.filter((session) => {
    if (session.status === 'discarded' && filters.status !== 'all') {
      return false;
    }
    if (session.status === 'discarded') {
      return false;
    }
    if (!filters.includeArchived && filters.status !== 'archived' && session.archivedAt) {
      return false;
    }
    if (!matchesStatusFilter(session, filters.status)) {
      return false;
    }
    if (filters.freshness === 'stale' && !session.result?.stale) {
      return false;
    }
    if (filters.freshness === 'current' && session.result?.stale) {
      return false;
    }
    if (filters.assignment === 'with_lead' && !session.leadId) {
      return false;
    }
    if (filters.assignment === 'without_lead' && session.leadId) {
      return false;
    }
    if (filters.assignment === 'with_offer' && !session.offerId) {
      return false;
    }
    if (filters.assignment === 'without_offer' && session.offerId) {
      return false;
    }
    if (filters.source !== 'all' && session.source !== filters.source) {
      return false;
    }
    if (!matchesTimeRange(session.updatedAt, filters.timeRange, now)) {
      return false;
    }
    if (normalizedQuery && !buildBestPayComparisonSearchText(session).includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  const summaries = filtered.map(toBestPayComparisonSummary);

  summaries.sort((left, right) => {
    let primary = 0;
    switch (filters.sort) {
      case 'updated_asc':
        primary = left.updatedAt.localeCompare(right.updatedAt);
        break;
      case 'created_desc':
        primary = right.createdAt.localeCompare(left.createdAt);
        break;
      case 'title_asc':
        primary = left.title.localeCompare(right.title, 'de');
        break;
      case 'savings_desc': {
        const leftValue = left.hasResult && !left.isHigherCost ? (left.savingsMonthlyCents ?? -Infinity) : -Infinity;
        const rightValue =
          right.hasResult && !right.isHigherCost ? (right.savingsMonthlyCents ?? -Infinity) : -Infinity;
        primary = rightValue - leftValue;
        break;
      }
      case 'extra_cost_desc': {
        const leftValue =
          left.hasResult && left.isHigherCost ? Math.abs(left.savingsMonthlyCents ?? 0) : -Infinity;
        const rightValue =
          right.hasResult && right.isHigherCost ? Math.abs(right.savingsMonthlyCents ?? 0) : -Infinity;
        primary = rightValue - leftValue;
        break;
      }
      case 'updated_desc':
      default:
        primary = right.updatedAt.localeCompare(left.updatedAt);
        break;
    }
    if (primary !== 0) {
      return primary;
    }
    return left.id.localeCompare(right.id);
  });

  return summaries;
}

export function resolveResumeStep(
  session: BestPayComparisonSession,
): 'source' | 'review' | 'need' | 'result' {
  if (session.result) {
    return 'result';
  }
  if (session.status === 'review_required' || session.status === 'billing_import') {
    return 'review';
  }
  if (
    session.status === 'ready_for_calculation' ||
    session.source === 'manual' ||
    session.source === 'mixed'
  ) {
    return 'need';
  }
  if (session.billingImportSessionId) {
    return 'review';
  }
  return 'source';
}
