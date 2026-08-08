import type { Lead } from './lead';
import type { BestPayComparisonSession } from '../bestPayComparison/bestPayComparisonSession';
import { formatContactName } from '../../utils/format';

export const UNNAMED_LEAD_DISPLAY_NAME = 'Unbenannter Kunde';
export const ANONYMOUS_ADVICE_DISPLAY_NAME = 'Beratung ohne Kundenzuordnung';

export type LeadDisplayNameInput = Pick<
  Lead,
  'companyName' | 'contactFirstName' | 'contactLastName' | 'city'
> & {
  customerNumber?: string | null;
};

export function isInternalLeadIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^lead_[0-9a-f-]{36}$/i.test(trimmed)) {
    return true;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }
  if (/^lead_\d+$/i.test(trimmed)) {
    return true;
  }
  if (/^user_[0-9a-f-]{36}$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function cleanDisplayPart(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || isInternalLeadIdentifier(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isPlaceholderLeadDisplayName(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed === UNNAMED_LEAD_DISPLAY_NAME || trimmed === ANONYMOUS_ADVICE_DISPLAY_NAME;
}

/** Bevorzugt echte Kundenbezeichnungen gegenüber Platzhalter-Strings beim Session-Merge. */
export function preferNonPlaceholderCustomerLabel(
  ...labels: Array<string | null | undefined>
): string | null {
  let placeholder: string | null = null;
  for (const label of labels) {
    const cleaned = cleanDisplayPart(label);
    if (!cleaned) {
      continue;
    }
    if (isPlaceholderLeadDisplayName(cleaned)) {
      placeholder = placeholder ?? cleaned;
      continue;
    }
    return cleaned;
  }
  return placeholder;
}

/**
 * Kanonischer fachlicher Anzeigename für Kunden/Leads.
 * Priorität: Firma → Ansprechpartner → Ort → Kundennummer → „Unbenannter Kunde“.
 * Interne IDs werden nie zurückgegeben.
 */
export function getLeadDisplayName(lead: LeadDisplayNameInput): string {
  const company = cleanDisplayPart(lead.companyName);
  if (company) {
    return company;
  }

  const contact = cleanDisplayPart(
    formatContactName(lead.contactFirstName, lead.contactLastName),
  );
  if (contact) {
    return contact;
  }

  const city = cleanDisplayPart(lead.city);
  if (city) {
    return city;
  }

  const customerNumber = cleanDisplayPart(lead.customerNumber);
  if (customerNumber) {
    return customerNumber;
  }

  return UNNAMED_LEAD_DISPLAY_NAME;
}

export function resolveStoredLeadLabel(
  ...labels: Array<string | null | undefined>
): string {
  for (const label of labels) {
    const cleaned = cleanDisplayPart(label);
    if (cleaned) {
      return cleaned;
    }
  }
  return UNNAMED_LEAD_DISPLAY_NAME;
}

export function enrichLeadWithDisplayName(lead: Lead): Lead {
  return {
    ...lead,
    displayName: getLeadDisplayName(lead),
  };
}

export function getSessionCustomerDisplayName(
  session: Pick<
    BestPayComparisonSession,
    'customerLabel' | 'leadDisplayName' | 'title' | 'wizard' | 'leadId'
  >,
): string {
  const resolved = resolveStoredLeadLabel(
    session.customerLabel,
    session.leadDisplayName,
    getLeadDisplayName({
      companyName: session.wizard.prospectDraft.companyName,
      contactFirstName: session.wizard.prospectDraft.contactFirstName,
      contactLastName: session.wizard.prospectDraft.contactLastName,
      city: '',
    }),
    session.title,
  );
  if (
    !session.leadId &&
    resolved === UNNAMED_LEAD_DISPLAY_NAME &&
    !session.wizard.prospectDraft.companyName.trim() &&
    !session.wizard.prospectDraft.contactFirstName.trim() &&
    !session.wizard.prospectDraft.contactLastName.trim()
  ) {
    return ANONYMOUS_ADVICE_DISPLAY_NAME;
  }
  return resolved;
}
