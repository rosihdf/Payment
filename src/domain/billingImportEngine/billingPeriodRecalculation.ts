import type { BillingCostLineItem } from '../billingImport/billingCostLineItem';
import { BILLING_FIELD_CODES } from '../billingImport/billingFieldCodes';
import type { BillingPeriodRecord } from '../billingImport/billingPeriodRecord';
import type { ExtractedBillingField } from '../billingImport/extractedBillingField';
import {
  buildBillingPeriodRecordFromFields,
  finalizePeriodMetrics,
} from './billingPeriodBuilder';

function applyLineItemsToPeriod(
  period: BillingPeriodRecord,
  lineItems: BillingCostLineItem[],
): BillingPeriodRecord {
  const included = lineItems.filter((item) => item.included);
  let fixed = period.fixedCostsCents ?? 0;
  let terminal = period.terminalCostsCents ?? 0;
  let transaction = period.transactionCostsCents ?? 0;
  let clearing = period.clearingCostsCents ?? 0;
  let service = period.serviceCostsCents ?? 0;
  let otherRecurring = period.otherRecurringCostsCents ?? 0;
  let oneTime = period.oneTimeCostsCents ?? 0;
  let credit = period.creditAmountCents ?? 0;

  for (const item of included) {
    const amount = item.amountCents;
    switch (item.category) {
      case 'monthly_base_fee':
      case 'communication_fee':
        fixed += amount;
        break;
      case 'terminal_rental':
        terminal += amount;
        break;
      case 'transaction_fee':
        transaction += amount;
        break;
      case 'percentage_fee':
        otherRecurring += amount;
        break;
      case 'clearing_fee':
        clearing += amount;
        break;
      case 'service_fee':
        service += amount;
        break;
      case 'credit':
        credit += amount;
        break;
      case 'tax':
        break;
      case 'setup_fee':
      case 'terminal_purchase':
      case 'shipping_fee':
      case 'repair_fee':
      case 'other_one_time':
        oneTime += amount;
        break;
      default:
        if (item.costType === 'one_time') {
          oneTime += amount;
        } else {
          otherRecurring += amount;
        }
    }
  }

  const recurringParts = [fixed, terminal, transaction, clearing, service, otherRecurring].filter(
    (value) => value !== 0,
  );
  const totalFromParts = recurringParts.reduce((sum, value) => sum + value, 0) + oneTime + credit;

  return finalizePeriodMetrics({
    ...period,
    fixedCostsCents: fixed !== 0 ? fixed : period.fixedCostsCents,
    terminalCostsCents: terminal !== 0 ? terminal : period.terminalCostsCents,
    transactionCostsCents: transaction !== 0 ? transaction : period.transactionCostsCents,
    clearingCostsCents: clearing !== 0 ? clearing : period.clearingCostsCents,
    serviceCostsCents: service !== 0 ? service : period.serviceCostsCents,
    otherRecurringCostsCents: otherRecurring !== 0 ? otherRecurring : period.otherRecurringCostsCents,
    oneTimeCostsCents: oneTime !== 0 ? oneTime : period.oneTimeCostsCents,
    creditAmountCents: credit !== 0 ? credit : period.creditAmountCents,
    totalAmountCents: period.totalAmountCents ?? (totalFromParts !== 0 ? totalFromParts : null),
  });
}

export function rebuildSessionPeriods(input: {
  sessionId: string;
  documents: Array<{ id: string }>;
  fields: ExtractedBillingField[];
  lineItems: BillingCostLineItem[];
}): BillingPeriodRecord[] {
  const periods: BillingPeriodRecord[] = [];

  for (const document of input.documents) {
    const documentFields = input.fields.filter((field) => field.documentId === document.id);
    const basePeriod = buildBillingPeriodRecordFromFields(input.sessionId, document.id, documentFields);
    if (!basePeriod) {
      continue;
    }
    const periodLineItems = input.lineItems.filter(
      (item) => item.documentId === document.id || item.periodId === basePeriod.id,
    );
    periods.push(applyLineItemsToPeriod(basePeriod, periodLineItems));
  }

  const manualLineItems = input.lineItems.filter((item) => !item.documentId && item.periodId);
  const manualPeriodIds = new Set(manualLineItems.map((item) => item.periodId).filter(Boolean));
  for (const periodId of manualPeriodIds) {
    if (periods.some((period) => period.id === periodId)) {
      continue;
    }
    const items = manualLineItems.filter((item) => item.periodId === periodId);
    const first = items[0];
    if (!first) {
      continue;
    }
    periods.push(
      applyLineItemsToPeriod(
        finalizePeriodMetrics({
          id: periodId!,
          sessionId: input.sessionId,
          sourceDocumentIds: [],
          periodFrom: '1970-01-01',
          periodTo: '1970-01-01',
          calendarDays: 1,
          isFullMonth: false,
          isPartialPeriod: true,
          monthEquivalent: 1 / 30,
          currency: first.currency,
          netGrossBasis: 'unknown',
          cardVolumeCents: null,
          transactionCount: null,
          averageTicketCents: null,
          fixedCostsCents: null,
          terminalCostsCents: null,
          transactionCostsCents: null,
          volumeBasedCostsCents: null,
          clearingCostsCents: null,
          serviceCostsCents: null,
          otherRecurringCostsCents: null,
          oneTimeCostsCents: null,
          creditAmountCents: null,
          taxAmountCents: null,
          totalAmountCents: null,
          terminalCount: null,
          cardMix: { girocardPercent: null, creditPercent: null, debitPercent: null },
          completenessScore: 20,
          qualityStatus: 'limited',
          outlierStatus: 'none',
          outlierDecision: 'pending',
          confirmationStatus: 'draft',
          findings: [],
        }),
        items,
      ),
    );
  }

  return periods;
}

export function parseFieldInputValue(
  fieldCode: string,
  rawInput: string,
): { ok: true; value: string | number } | { ok: false; message: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, message: 'Wert darf nicht leer sein.' };
  }

  const moneyFields = new Set([
    BILLING_FIELD_CODES.CARD_VOLUME,
    BILLING_FIELD_CODES.MONTHLY_BASE_FEE,
    BILLING_FIELD_CODES.TERMINAL_RENTAL,
    BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL,
    BILLING_FIELD_CODES.CLEARING_FEE,
    BILLING_FIELD_CODES.TOTAL_AMOUNT,
    BILLING_FIELD_CODES.ONE_TIME_FEE,
    BILLING_FIELD_CODES.CREDIT_NOTE,
  ]);

  if (moneyFields.has(fieldCode as typeof BILLING_FIELD_CODES.CARD_VOLUME)) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return { ok: false, message: 'Ungültiger Geldbetrag.' };
    }
    return { ok: true, value: Math.round(parsed * 100) };
  }

  if (
    fieldCode === BILLING_FIELD_CODES.TRANSACTION_COUNT ||
    fieldCode === BILLING_FIELD_CODES.TERMINAL_COUNT
  ) {
    const parsed = Number.parseInt(trimmed.replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed)) {
      return { ok: false, message: 'Ungültige Ganzzahl.' };
    }
    return { ok: true, value: parsed };
  }

  if (fieldCode === BILLING_FIELD_CODES.VOLUME_BASED_FEE_PERCENT) {
    const normalized = trimmed.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return { ok: false, message: 'Ungültiger Prozentwert.' };
    }
    return { ok: true, value: Math.round(parsed * 1000) };
  }

  if (fieldCode === BILLING_FIELD_CODES.PERIOD_FROM || fieldCode === BILLING_FIELD_CODES.PERIOD_TO) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
      return { ok: false, message: 'Ungültiges Datum.' };
    }
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('.');
      return {
        ok: true,
        value: `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`,
      };
    }
    return { ok: true, value: trimmed };
  }

  return { ok: true, value: trimmed };
}
