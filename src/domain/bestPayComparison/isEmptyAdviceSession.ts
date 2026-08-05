import {
  ANONYMOUS_ADVICE_DISPLAY_NAME,
  UNNAMED_LEAD_DISPLAY_NAME,
} from '../lead/getLeadDisplayName';
import type { BestPayComparisonSession } from './bestPayComparisonSession';
import { DEFAULT_BESTPAY_MANUAL_INPUT } from './bestPayComparisonSession';
import { formatBestPayComparisonFallbackTitle } from './bestPayComparisonSummary';
import { hasMeaningfulCostCapture, resolveCostCaptureMode } from './costCaptureMode';
import { DEFAULT_SALES_WIZARD_PROSPECT } from './salesWizard';

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function isPlaceholderCustomerLabel(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return (
    !trimmed ||
    trimmed === ANONYMOUS_ADVICE_DISPLAY_NAME ||
    trimmed === UNNAMED_LEAD_DISPLAY_NAME
  );
}

function isTechnicalTitle(session: BestPayComparisonSession): boolean {
  const title = session.title?.trim() ?? '';
  if (!title) {
    return true;
  }
  if (title === ANONYMOUS_ADVICE_DISPLAY_NAME || title === UNNAMED_LEAD_DISPLAY_NAME) {
    return true;
  }
  return title === formatBestPayComparisonFallbackTitle(session.createdAt);
}

function isDefaultPaymentUsage(
  usage: BestPayComparisonSession['manualInput']['paymentUsage'],
): boolean {
  const defaults = DEFAULT_BESTPAY_MANUAL_INPUT.paymentUsage;
  return (
    usage.stationary === defaults.stationary &&
    usage.mobile === defaults.mobile &&
    usage.ecommerce === defaults.ecommerce &&
    usage.softPos === defaults.softPos
  );
}

/**
 * Rein abgeleitet: true, wenn die Beratung keine fachlichen Daten enthält.
 * Technische Defaults, Status und Zeitstempel zählen nicht als Befüllung.
 */
export function isEmptyAdviceSession(session: BestPayComparisonSession): boolean {
  if (session.leadId || session.offerId || session.billingImportSessionId || session.costBaselineId) {
    return false;
  }
  if (session.result || session.selectedCandidateId) {
    return false;
  }
  if (!isPlaceholderCustomerLabel(session.customerLabel)) {
    return false;
  }
  if (!isPlaceholderCustomerLabel(session.leadDisplayName)) {
    return false;
  }
  if (hasText(session.title) && !isTechnicalTitle(session)) {
    return false;
  }
  if (session.source) {
    return false;
  }

  const prospect = session.wizard.prospectDraft;
  if (
    hasText(prospect.companyName) ||
    hasText(prospect.contactFirstName) ||
    hasText(prospect.contactLastName) ||
    hasText(prospect.phone) ||
    hasText(prospect.email) ||
    hasText(prospect.industry) ||
    hasText(prospect.notes)
  ) {
    return false;
  }

  if (hasText(session.wizard.approvalNotes) || hasText(session.wizard.followUpNotes)) {
    return false;
  }
  if (session.wizard.scenarios.length > 0 || session.wizard.selectedScenarioId) {
    return false;
  }
  if (session.wizard.wizardCompletedAt) {
    return false;
  }

  if (hasMeaningfulCostCapture(session)) {
    return false;
  }

  const inferredMode = resolveCostCaptureMode(session);
  if (inferredMode === 'billing_import') {
    return false;
  }

  const input = session.manualInput;
  const defaults = DEFAULT_BESTPAY_MANUAL_INPUT;
  const meaningfulKeys: Array<keyof typeof input> = [
    'monthlyCardVolumeCents',
    'annualCardVolumeCents',
    'monthlyTransactions',
    'averageTransactionValueCents',
    'girocardPercent',
    'debitPercent',
    'creditPercent',
    'otherPercent',
    'monthlyFixedCostsCents',
    'monthlyTerminalCostsCents',
    'monthlyTransactionCostsCents',
    'monthlyClearingCostsCents',
    'monthlyTotalCostsCents',
  ];
  for (const key of meaningfulKeys) {
    if (input[key] !== null && input[key] !== defaults[key]) {
      return false;
    }
  }
  if (input.terminalCount !== defaults.terminalCount) {
    return false;
  }
  if (input.preferredTermMonths !== defaults.preferredTermMonths) {
    return false;
  }
  if (hasText(input.industry)) {
    return false;
  }
  if (!isDefaultPaymentUsage(input.paymentUsage)) {
    return false;
  }

  // Prospect-Defaults gegen Default-Objekt (keine abweichenden Leerzeichen-Felder)
  for (const key of Object.keys(DEFAULT_SALES_WIZARD_PROSPECT) as Array<
    keyof typeof DEFAULT_SALES_WIZARD_PROSPECT
  >) {
    if ((prospect[key] ?? '').trim() !== (DEFAULT_SALES_WIZARD_PROSPECT[key] ?? '').trim()) {
      return false;
    }
  }

  return true;
}

/** Nur eindeutig leere Entwürfe dürfen uneingeschränkt verworfen werden. */
export function canDiscardEmptyAdviceSession(session: BestPayComparisonSession): boolean {
  return isEmptyAdviceSession(session) && session.status !== 'discarded' && !session.archivedAt;
}
