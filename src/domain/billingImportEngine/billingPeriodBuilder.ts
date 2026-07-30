import { BILLING_FIELD_CODES } from '../billingImport/billingFieldCodes';
import type { BillingPeriodRecord } from '../billingImport/billingPeriodRecord';
import type { ExtractedBillingField } from '../billingImport/extractedBillingField';
import { generateId } from '../../utils/id';
import { getConfirmedFieldValue } from './billingFieldRecognition';
import { parsePeriodFromText } from './billingPeriodParser';

function numberValue(value: number | string | null): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildBillingPeriodRecordFromFields(
  sessionId: string,
  documentId: string,
  fields: ExtractedBillingField[],
): BillingPeriodRecord | null {
  const periodFrom = getConfirmedFieldValue(fields, BILLING_FIELD_CODES.PERIOD_FROM);
  const periodTo = getConfirmedFieldValue(fields, BILLING_FIELD_CODES.PERIOD_TO);

  let from = typeof periodFrom === 'string' ? periodFrom : null;
  let to = typeof periodTo === 'string' ? periodTo : null;

  if (!from || !to) {
    const periodField = fields.find((field) => field.fieldCode === BILLING_FIELD_CODES.PERIOD_FROM);
    const parsed = periodField ? parsePeriodFromText(periodField.originalText) : null;
    if (parsed) {
      from = parsed.periodFrom;
      to = parsed.periodTo;
    }
  }

  if (!from || !to) {
    return null;
  }

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const calendarDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const isFullMonth =
    start.getUTCDate() === 1 &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();

  const currencyValue = getConfirmedFieldValue(fields, BILLING_FIELD_CODES.CURRENCY);
  const currency = typeof currencyValue === 'string' ? currencyValue : 'EUR';

  const fixed =
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.MONTHLY_BASE_FEE)) ?? 0;
  const terminal =
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.TERMINAL_RENTAL)) ?? 0;
  const transactionCosts =
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL)) ?? null;
  const clearing =
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.CLEARING_FEE)) ?? null;
  const oneTime =
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.ONE_TIME_FEE)) ??
    numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.CREDIT_NOTE));
  const total = numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.TOTAL_AMOUNT));

  const recurringParts = [fixed, terminal, transactionCosts ?? 0, clearing ?? 0].filter(
    (value) => value !== null,
  ) as number[];

  return {
    id: generateId('billing_period'),
    sessionId,
    sourceDocumentIds: [documentId],
    periodFrom: from,
    periodTo: to,
    calendarDays,
    isFullMonth,
    isPartialPeriod: !isFullMonth,
    monthEquivalent: calendarDays / 30,
    currency,
    netGrossBasis: 'unknown',
    cardVolumeCents: numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.CARD_VOLUME)),
    transactionCount: numberValue(
      getConfirmedFieldValue(fields, BILLING_FIELD_CODES.TRANSACTION_COUNT),
    ),
    averageTicketCents: null,
    fixedCostsCents: fixed > 0 ? fixed : null,
    terminalCostsCents: terminal > 0 ? terminal : null,
    transactionCostsCents: transactionCosts,
    volumeBasedCostsCents: null,
    clearingCostsCents: clearing,
    serviceCostsCents: null,
    otherRecurringCostsCents: null,
    oneTimeCostsCents: oneTime,
    creditAmountCents: oneTime !== null && oneTime < 0 ? oneTime : null,
    taxAmountCents: null,
    totalAmountCents: total ?? (recurringParts.length > 0 ? recurringParts.reduce((sum, v) => sum + v, 0) : null),
    terminalCount: numberValue(getConfirmedFieldValue(fields, BILLING_FIELD_CODES.TERMINAL_COUNT)),
    cardMix: {
      girocardPercent: null,
      creditPercent: null,
      debitPercent: null,
    },
    completenessScore: 50,
    qualityStatus: 'limited',
    outlierStatus: 'none',
    outlierDecision: 'pending',
    confirmationStatus: 'draft',
    findings: [],
  };
}

export function finalizePeriodMetrics(period: BillingPeriodRecord): BillingPeriodRecord {
  if (
    period.averageTicketCents === null &&
    period.cardVolumeCents !== null &&
    period.transactionCount !== null &&
    period.transactionCount > 0
  ) {
    period.averageTicketCents = Math.round(period.cardVolumeCents / period.transactionCount);
  }

  let score = 0;
  if (period.cardVolumeCents !== null) score += 20;
  if (period.transactionCount !== null) score += 20;
  if (period.fixedCostsCents !== null) score += 15;
  if (period.totalAmountCents !== null) score += 15;
  if (period.isFullMonth) score += 20;
  if (period.currency) score += 10;
  period.completenessScore = score;

  if (score >= 80 && period.isFullMonth) {
    period.qualityStatus = 'good';
  } else if (score >= 60) {
    period.qualityStatus = 'limited';
  } else {
    period.qualityStatus = 'poor';
  }

  return period;
}
