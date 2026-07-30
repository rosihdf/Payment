export interface ParsedBillingPeriod {
  periodFrom: string;
  periodTo: string;
  calendarDays: number;
  isFullMonth: boolean;
  isPartialPeriod: boolean;
  monthEquivalent: number;
  isMultiMonth: boolean;
  rawText: string;
}

const MONTH_NAMES: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  mar: 3,
  maerz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
  dec: 12,
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function isFullCalendarMonth(from: string, to: string): boolean {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  return (
    start.getUTCDate() === 1 &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  );
}

function parseGermanDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const year = Number.parseInt(match[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return toIsoDate(year, month, day);
}

function parseMonthYear(value: string): { from: string; to: string } | null {
  const match = value.trim().match(/^([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const month = MONTH_NAMES[match[1].toLowerCase()];
  const year = Number.parseInt(match[2], 10);
  if (!month || !Number.isFinite(year)) {
    return null;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: toIsoDate(year, month, 1),
    to: toIsoDate(year, month, lastDay),
  };
}

export function parsePeriodFromText(text: string): ParsedBillingPeriod | null {
  const normalized = text.replace(/\s+/g, ' ').trim();

  const rangeMatch = normalized.match(
    /(\d{1,2}\.\d{1,2}\.\d{4})\s*(?:-|–|bis)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
  );
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const periodFrom = parseGermanDate(rangeMatch[1]);
    const periodTo = parseGermanDate(rangeMatch[2]);
    if (periodFrom && periodTo) {
      const calendarDays = daysBetween(periodFrom, periodTo);
      const isFullMonth = isFullCalendarMonth(periodFrom, periodTo);
      return {
        periodFrom,
        periodTo,
        calendarDays,
        isFullMonth,
        isPartialPeriod: !isFullMonth,
        monthEquivalent: calendarDays / 30,
        isMultiMonth: calendarDays > 31,
        rawText: normalized,
      };
    }
  }

  const monthMatch = normalized.match(
    /(?:Leistungszeitraum|Abrechnungszeitraum|Zeitraum)[:\s]+([A-Za-zÄÖÜäöü]+\s+\d{4})/i,
  );
  if (monthMatch?.[1]) {
    const parsed = parseMonthYear(monthMatch[1]);
    if (parsed) {
      const calendarDays = daysBetween(parsed.from, parsed.to);
      return {
        periodFrom: parsed.from,
        periodTo: parsed.to,
        calendarDays,
        isFullMonth: true,
        isPartialPeriod: false,
        monthEquivalent: 1,
        isMultiMonth: false,
        rawText: normalized,
      };
    }
  }

  return null;
}

export function normalizePeriodToMonthlyAmount(
  amountCents: number,
  period: Pick<ParsedBillingPeriod, 'calendarDays' | 'isFullMonth' | 'monthEquivalent'>,
): number {
  if (period.isFullMonth && period.calendarDays >= 28 && period.calendarDays <= 31) {
    return amountCents;
  }
  if (period.calendarDays <= 0) {
    return amountCents;
  }
  return Math.round((amountCents * 30) / period.calendarDays);
}
