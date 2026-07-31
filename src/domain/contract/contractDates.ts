/** Central date helpers for contract terms. Uses UTC date parts to avoid timezone drift. */

export function parseIsoDateOnly(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : utcDate(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }
  return utcDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toIsoDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export function addMonthsUtc(startIso: string, months: number): string | null {
  const start = parseIsoDateOnly(startIso);
  if (!start || !Number.isFinite(months)) {
    return null;
  }
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + Math.trunc(months);
  const day = start.getUTCDate();
  const target = utcDate(year, month, 1);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIsoDateOnly(target);
}

export function addDaysUtc(startIso: string, days: number): string | null {
  const start = parseIsoDateOnly(startIso);
  if (!start || !Number.isFinite(days)) {
    return null;
  }
  const next = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + days);
  return toIsoDateOnly(next);
}

export function daysBetweenUtc(fromIso: string, toIso: string): number | null {
  const from = parseIsoDateOnly(fromIso);
  const to = parseIsoDateOnly(toIso);
  if (!from || !to) {
    return null;
  }
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeContractEndDate(startIso: string, termMonths: number): string | null {
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }
  // Regular end = day before start + termMonths (common DE contract semantics: start 2026-01-01, 12m → 2026-12-31)
  const endExclusive = addMonthsUtc(startIso, termMonths);
  if (!endExclusive) {
    return null;
  }
  return addDaysUtc(endExclusive, -1);
}

export function computeEarliestTerminationDate(
  contractEndIso: string,
  noticePeriodMonths: number,
): string | null {
  if (!Number.isFinite(noticePeriodMonths) || noticePeriodMonths < 0) {
    return null;
  }
  const end = parseIsoDateOnly(contractEndIso);
  if (!end) {
    return null;
  }
  const noticeStart = addMonthsUtc(contractEndIso, -noticePeriodMonths);
  return noticeStart;
}

export function computeNextRenewalDate(contractEndIso: string, renewalMonths: number): string | null {
  if (!Number.isFinite(renewalMonths) || renewalMonths <= 0) {
    return null;
  }
  return addMonthsUtc(addDaysUtc(contractEndIso, 1) ?? contractEndIso, renewalMonths);
}

export function validateContractDateRange(
  startIso: string | null,
  endIso: string | null,
): string | null {
  if (!startIso || !endIso) {
    return null;
  }
  const start = parseIsoDateOnly(startIso);
  const end = parseIsoDateOnly(endIso);
  if (!start || !end) {
    return 'Ungültiges Datumsformat.';
  }
  if (end.getTime() < start.getTime()) {
    return 'Vertragsende liegt vor Vertragsbeginn.';
  }
  return null;
}

export function isWithinDays(targetIso: string | null, days: number, todayIso?: string): boolean {
  if (!targetIso) {
    return false;
  }
  const today = parseIsoDateOnly(todayIso ?? toIsoDateOnly(new Date())) ?? new Date();
  const target = parseIsoDateOnly(targetIso);
  if (!target) {
    return false;
  }
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 && diff <= days;
}

export const CONTRACT_DEADLINE_OFFSETS_DAYS = [180, 120, 90, 30] as const;
