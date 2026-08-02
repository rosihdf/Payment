import type { OfferFollowUpPreferences } from '../offer/offerFollowUpPreferences';

export const STANDARD_FOLLOW_UP_OFFSETS_DAYS = [1, 3, 7] as const;

export type StandardFollowUpOffsetDays = (typeof STANDARD_FOLLOW_UP_OFFSETS_DAYS)[number];

export interface FollowUpQuickPick {
  days: StandardFollowUpOffsetDays;
  label: string;
}

export const FOLLOW_UP_QUICK_PICKS: readonly FollowUpQuickPick[] = [
  { days: 1, label: 'Morgen' },
  { days: 3, label: 'In 3 Tagen' },
  { days: 7, label: 'In einer Woche' },
];

export function followUpDateAfterDays(days: number, from = new Date()): string {
  const copy = new Date(from);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

export function followUpDateInputValue(days: number, from = new Date()): string {
  const copy = new Date(from);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

export function followUpTaskSourceKey(offerId: string): string {
  return `auto:follow_up_offer:${offerId}`;
}

/** Legacy keys from earlier builds – werden beim Ersetzen abgeschlossen. */
export function legacyFollowUpTaskSourceKeys(offerId: string): string[] {
  return STANDARD_FOLLOW_UP_OFFSETS_DAYS.map((days) => `auto:follow_up_offer:${days}d:${offerId}`);
}

function endOfDayIso(date: Date): string {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

export function resolveFollowUpDueAt(
  preferences: Pick<OfferFollowUpPreferences, 'followUpDate'>,
  from = new Date(),
): string {
  if (preferences.followUpDate?.trim()) {
    return endOfDayIso(new Date(preferences.followUpDate));
  }
  return endOfDayIso(new Date(from.getTime() + 7 * 86400000));
}

export function resolveFollowUpTaskTitle(
  preferences: Pick<OfferFollowUpPreferences, 'followUpDate'>,
  from = new Date(),
): string {
  if (!preferences.followUpDate?.trim()) {
    return 'Angebot nachfassen (1 Woche)';
  }
  const due = new Date(preferences.followUpDate);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 1) {
    return 'Angebot nachfassen (morgen)';
  }
  if (diffDays <= 3) {
    return 'Angebot nachfassen (3 Tage)';
  }
  if (diffDays <= 7) {
    return 'Angebot nachfassen (1 Woche)';
  }
  return 'Angebot nachfassen';
}

export function shouldScheduleFollowUpTask(
  preferences: Pick<
    OfferFollowUpPreferences,
    'noFollowUpDesired' | 'customerContactsSelf'
  >,
): boolean {
  return !preferences.noFollowUpDesired && !preferences.customerContactsSelf;
}
