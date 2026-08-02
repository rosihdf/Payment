import type { Contact } from '../../domain/contact/contact';
import type { CustomerDocumentRef } from '../../services/customerDocumentAggregationService';
import type { SalesActivity, SalesActivityType } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import { formatContactName } from '../../utils/format';

export type CrmTimelineFilter = 'all' | 'communication' | 'sales';

export type TimelineRecencyGroup = 'today' | 'yesterday' | 'this_week' | 'older';

export const TIMELINE_RECENCY_LABELS: Record<TimelineRecencyGroup, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  this_week: 'Diese Woche',
  older: 'Älter',
};

export type DocumentGroupKey = 'offers' | 'contracts' | 'activations' | 'other';

export const DOCUMENT_GROUP_LABELS: Record<DocumentGroupKey, string> = {
  offers: 'Angebote',
  contracts: 'Verträge / BestPay-Abschluss',
  activations: 'Aktivierung',
  other: 'Sonstige Dokumente',
};

const COMMUNICATION_TYPES = new Set<SalesActivityType>(['call', 'email', 'meeting', 'visit']);

/** Kundenkontakt für Last-Contact-Ableitung (Notizen zählen nicht). */
const CUSTOMER_CONTACT_TYPES = new Set<SalesActivityType>(['call', 'email', 'visit']);

export type CustomerContactKind = 'call' | 'email' | 'visit';

export const CUSTOMER_CONTACT_KIND_LABELS: Record<CustomerContactKind, string> = {
  call: 'Telefonat',
  email: 'E-Mail',
  visit: 'Besuch',
};

export function matchesCrmTimelineFilter(
  activity: SalesActivity,
  filter: CrmTimelineFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'communication') {
    return COMMUNICATION_TYPES.has(activity.type);
  }
  return !COMMUNICATION_TYPES.has(activity.type) && activity.type !== 'note';
}

export function timelineIconForActivity(type: SalesActivityType): string {
  switch (type) {
    case 'call':
      return '📞';
    case 'email':
      return '✉️';
    case 'visit':
    case 'meeting':
      return '👤';
    case 'note':
      return '📝';
    case 'offer_created':
    case 'offer_updated':
    case 'offer_sent':
    case 'offer_accepted':
      return '📄';
    case 'approval_requested':
    case 'approval_completed':
    case 'approval_rejected':
      return '✅';
    case 'contract_created':
    case 'contract_version_created':
    case 'contract_version_activated':
    case 'contract_tariff_changed':
    case 'contract_term_changed':
    case 'contract_hardware_changed':
    case 'contract_termination_recorded':
    case 'contract_termination_confirmed':
    case 'contract_termination_withdrawn':
    case 'contract_renewal_created':
    case 'contract_suspended':
    case 'contract_reactivated':
    case 'contract_ended':
    case 'contract_document_created':
    case 'bestpay_handoff':
      return '📑';
    case 'activation':
    case 'activation_started':
    case 'activation_status_changed':
    case 'activation_checklist_updated':
    case 'activation_document_requested':
    case 'activation_document_reviewed':
    case 'activation_application_created':
    case 'activation_application_submitted':
    case 'activation_application_inquiry':
    case 'activation_application_approved':
    case 'activation_application_rejected':
    case 'activation_hardware_updated':
    case 'activation_hardware_deviation':
    case 'activation_setup_updated':
    case 'activation_test_recorded':
    case 'activation_blocker_created':
    case 'activation_blocker_resolved':
    case 'activation_go_live_confirmed':
    case 'activation_go_live_revoked':
    case 'activation_completed':
    case 'activation_cancelled':
    case 'activation_handover_ready':
    case 'activation_handover_confirmed':
      return '⚙️';
    case 'commission':
    case 'commission_approved':
    case 'commission_paid':
      return '💰';
    default:
      return '🤖';
  }
}

export function lastContactAtForContact(
  contactId: string,
  activities: SalesActivity[],
): string | null {
  return lastCustomerContactForContact(contactId, activities)?.occurredAt ?? null;
}

export function lastCustomerContactForContact(
  contactId: string,
  activities: SalesActivity[],
): { occurredAt: string; kind: CustomerContactKind } | null {
  const forContact = activities.filter(
    (activity) => activity.contactId === contactId && CUSTOMER_CONTACT_TYPES.has(activity.type),
  );
  const latest = forContact.sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  )[0];
  if (!latest) {
    return null;
  }
  const kind: CustomerContactKind =
    latest.type === 'email' ? 'email' : latest.type === 'visit' ? 'visit' : 'call';
  return { occurredAt: latest.occurredAt, kind };
}

export function formatLastCustomerContact(
  contact: { occurredAt: string; kind: CustomerContactKind } | null,
  formatDateTime: (iso: string) => string,
): string {
  if (!contact) {
    return 'Noch kein Kontakt';
  }
  return `${formatDateTime(contact.occurredAt)} · ${CUSTOMER_CONTACT_KIND_LABELS[contact.kind]}`;
}

export function contactTouchpoints(
  contactId: string,
  activities: SalesActivity[],
): {
  lastCall: string | null;
  lastVisit: string | null;
  lastEmail: string | null;
  lastNote: string | null;
  lastAny: string | null;
} {
  const forContact = activities.filter((activity) => activity.contactId === contactId);
  const latestOf = (types: SalesActivityType[]) => {
    const match = forContact
      .filter((activity) => types.includes(activity.type))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
    return match?.occurredAt ?? null;
  };
  const lastCall = latestOf(['call']);
  const lastVisit = latestOf(['visit', 'meeting']);
  const lastEmail = latestOf(['email']);
  const lastNote = latestOf(['note']);
  const lastAny = [lastCall, lastVisit, lastEmail]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  return { lastCall, lastVisit, lastEmail, lastNote, lastAny };
}

export function resolveTimelineRecencyGroup(
  occurredAt: string,
  now = new Date(),
): TimelineRecencyGroup {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return 'older';
  }
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  const weekday = startWeek.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  startWeek.setDate(startWeek.getDate() - daysFromMonday);

  if (date >= startToday) {
    return 'today';
  }
  if (date >= startYesterday) {
    return 'yesterday';
  }
  if (date >= startWeek) {
    return 'this_week';
  }
  return 'older';
}

export function groupTimelineByRecency(
  activities: SalesActivity[],
  now = new Date(),
): Array<{ group: TimelineRecencyGroup; label: string; items: SalesActivity[] }> {
  const buckets: Record<TimelineRecencyGroup, SalesActivity[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };
  for (const activity of activities) {
    buckets[resolveTimelineRecencyGroup(activity.occurredAt, now)].push(activity);
  }
  return (['today', 'yesterday', 'this_week', 'older'] as const)
    .filter((group) => buckets[group].length > 0)
    .map((group) => ({
      group,
      label: TIMELINE_RECENCY_LABELS[group],
      items: buckets[group],
    }));
}

export function matchesTimelineSearch(
  activity: SalesActivity,
  query: string,
  contacts: Contact[],
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const contact = contacts.find((entry) => entry.id === activity.contactId);
  const contactName = contact
    ? formatContactName(contact.firstName, contact.lastName).toLowerCase()
    : '';
  const haystack = [
    activity.title,
    activity.description,
    SALES_ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type,
    contactName,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(normalized);
}

export function resolveDocumentGroup(document: CustomerDocumentRef): DocumentGroupKey {
  if (document.offerId && !document.contractId && !document.activationId) {
    return 'offers';
  }
  if (document.contractId && !document.activationId) {
    return 'contracts';
  }
  if (document.activationId) {
    return 'activations';
  }
  if (document.source === 'offer_document') {
    return 'offers';
  }
  return 'other';
}

export function groupDocumentsByType(
  documents: CustomerDocumentRef[],
): Array<{ key: DocumentGroupKey; label: string; items: CustomerDocumentRef[] }> {
  const buckets: Record<DocumentGroupKey, CustomerDocumentRef[]> = {
    offers: [],
    contracts: [],
    activations: [],
    other: [],
  };
  for (const document of documents) {
    buckets[resolveDocumentGroup(document)].push(document);
  }
  return (['offers', 'contracts', 'activations', 'other'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: DOCUMENT_GROUP_LABELS[key],
      items: buckets[key],
    }));
}

export function latestCommunicationAt(activities: SalesActivity[]): string | null {
  const match = activities
    .filter((activity) => CUSTOMER_CONTACT_TYPES.has(activity.type))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  return match?.occurredAt ?? null;
}

export function latestCustomerContact(
  activities: SalesActivity[],
): { occurredAt: string; kind: CustomerContactKind } | null {
  const match = activities
    .filter((activity) => CUSTOMER_CONTACT_TYPES.has(activity.type))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (!match) {
    return null;
  }
  const kind: CustomerContactKind =
    match.type === 'email' ? 'email' : match.type === 'visit' ? 'visit' : 'call';
  return { occurredAt: match.occurredAt, kind };
}

export function filterTimelineEntries(
  activities: SalesActivity[],
  filter: CrmTimelineFilter,
  query: string,
  contacts: Contact[],
): SalesActivity[] {
  return activities.filter(
    (activity) =>
      matchesCrmTimelineFilter(activity, filter) &&
      matchesTimelineSearch(activity, query, contacts),
  );
}

export function countOpenTasksByDueState(
  tasks: Array<{ status: string; dueAt: string | null }>,
  isOverdue: (dueAt: string | null) => boolean,
): { open: number; overdue: number; otherOpen: number } {
  const open = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
  const overdue = open.filter((task) => task.dueAt && isOverdue(task.dueAt));
  return {
    open: open.length,
    overdue: overdue.length,
    otherOpen: open.length - overdue.length,
  };
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateInputToIsoEndOfDay(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(`${value.trim()}T17:00:00.000`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
