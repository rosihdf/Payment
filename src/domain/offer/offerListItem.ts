import type { Offer, OfferStatus } from './offer';
import type { OfferWorkflowStatus } from './offerWorkflow';

/** Schlanke Listendarstellung – ohne Items, Commercial Snapshot oder Workflow-Historie. */
export interface OfferListItem {
  id: string;
  offerNumber: string;
  title: string;
  leadId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  city: string;
  tariffName: string | null;
  contractTermMonths: number | null;
  workflowStatus: OfferWorkflowStatus;
  status: OfferStatus;
  createdByUserId: string;
  createdByDisplayName: string;
  createdAt: string;
  updatedAt: string;
  itemNamesSummary: string;
}

export interface OfferListQuery {
  leadId?: string;
  limit?: number;
  offset?: number;
}

export function toOfferListItem(offer: Offer): OfferListItem {
  return {
    id: offer.id,
    offerNumber: offer.offerNumber,
    title: offer.title,
    leadId: offer.leadId,
    companyName: offer.customerSnapshot.companyName,
    contactFirstName: offer.customerSnapshot.contactFirstName,
    contactLastName: offer.customerSnapshot.contactLastName,
    city: offer.customerSnapshot.city,
    tariffName: offer.commercialSnapshot?.identity.tariffName ?? offer.tariffSnapshot?.name ?? null,
    contractTermMonths:
      offer.commercialSnapshot?.identity.contractTermMonths ??
      offer.tariffSnapshot?.contractDurationMonths ??
      null,
    workflowStatus: offer.workflowStatus,
    status: offer.status,
    createdByUserId: offer.createdByUserId,
    createdByDisplayName: offer.createdByDisplayName,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    itemNamesSummary: offer.items.map((item) => item.name).join(' '),
  };
}

export function sortOfferListItems(items: OfferListItem[]): OfferListItem[] {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function offerListItemSearchHaystack(item: OfferListItem): string {
  return [
    item.offerNumber,
    item.title,
    item.companyName,
    [item.contactFirstName, item.contactLastName].filter(Boolean).join(' '),
    item.city,
    item.tariffName ?? '',
    item.itemNamesSummary,
  ]
    .join(' ')
    .toLowerCase();
}
