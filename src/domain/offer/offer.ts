import type { ProductCategory } from '../product/product';
import type { TerminalType } from '../tariff/tariff';
import type { OfferRecommendationLink } from '../recommendation/recommendationRecord';
import type { OfferCommercialSnapshot } from './offerCommercialSnapshot';
import type { OfferWorkflowStatus } from './offerWorkflow';
import type { OfferPhaseFilter } from '../../features/offer/offerWorkflowDisplay';

export type OfferStatus = 'draft' | 'completed' | 'cancelled';

export type OfferItemType = 'product' | 'manual';

export type OfferItemPriceType = 'monthly' | 'one_time' | 'included' | 'on_request';

export type OfferStatusFilter = 'all' | OfferStatus;

export type OfferOwnerFilter = 'all' | 'mine';

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Entwurf',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export const OFFER_ITEM_PRICE_TYPE_LABELS: Record<OfferItemPriceType, string> = {
  monthly: 'Monatlich',
  one_time: 'Einmalig',
  included: 'Inklusive',
  on_request: 'Auf Anfrage',
};

export interface OfferTariffSnapshot {
  tariffId: string;
  internalTariffCode: string;

  name: string;
  providerName: string;
  description: string;

  terminalType: TerminalType;

  monthlyAccountBaseFeeCents: number;
  monthlyTerminalRentalCents: number;
  monthlyServiceFeePerTerminalCents: number;

  setupFeeCents: number;

  transactionFeeTenthsOfCent: number;
  girocardClearingFeeTenthsOfCent: number;
  girocardClearingIncluded: boolean;

  girocardRateTenthsOfBasisPoint: number;
  debitCardRateTenthsOfBasisPoint: number;
  creditCardRateTenthsOfBasisPoint: number;

  contractDurationMonths: number | null;
  noticePeriodMonths: number | null;
  minimumTurnoverCents: number | null;

  sourceReference: string;
  notes: string;
}

export interface OfferProductSnapshot {
  productId: string;
  internalProductCode: string;

  name: string;
  providerName: string;
  category: ProductCategory;

  description: string;
  manufacturer: string | null;
  modelName: string | null;

  priceType: OfferItemPriceType;
  unitPriceCents: number | null;
  unitLabel: string | null;

  sourceReference: string;
}

export interface OfferItem {
  id: string;
  type: OfferItemType;

  productSnapshot: OfferProductSnapshot | null;

  name: string;
  description: string;

  quantity: number;

  priceType: OfferItemPriceType;
  unitPriceCents: number | null;
  unitLabel: string | null;

  originalUnitPriceCents: number | null;
  priceOverridden: boolean;
  priceOverrideReason: string;

  sortOrder: number;

  createdAt: string;
  updatedAt: string;
}

export interface OfferCustomerSnapshot {
  leadId: string;

  companyName: string;
  contactFirstName: string;
  contactLastName: string;

  street: string;
  postalCode: string;
  city: string;

  email: string;
  phone: string;

  taxNumber: string;
  vatId: string;
}

export interface Offer {
  id: string;
  offerNumber: string;

  status: OfferStatus;
  workflowStatus: OfferWorkflowStatus;
  currentVersionNumber: number;
  currentVersionId: string | null;
  sourceComparisonSessionId: string | null;
  sourceScenarioId: string | null;

  leadId: string;
  customerSnapshot: OfferCustomerSnapshot;

  tariffSnapshot: OfferTariffSnapshot | null;
  commercialSnapshot: OfferCommercialSnapshot | null;

  items: OfferItem[];

  title: string;
  introductionText: string;
  internalNotes: string;
  customerNotes: string;

  validUntil: string | null;

  createdByUserId: string;
  createdByDisplayName: string;

  completedAt: string | null;
  completedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string;

  recommendationLink: OfferRecommendationLink;

  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferItemInput {
  type: OfferItemType;

  productId: string | null;

  name: string;
  description: string;

  quantity: number;

  priceType: OfferItemPriceType;
  unitPriceCents: number | null;
  unitLabel: string | null;

  priceOverrideReason: string;
}

export interface CreateOfferInput {
  leadId: string;

  tariffId: string | null;

  title: string;
  introductionText: string;
  internalNotes: string;
  customerNotes: string;

  validUntil: string | null;

  items: CreateOfferItemInput[];
}

export type UpdateOfferInput = CreateOfferInput;

export type OfferFormMode = 'create' | 'edit';

export interface OfferFilters {
  search: string;
  phase: OfferPhaseFilter;
  owner: OfferOwnerFilter;
  /** @deprecated Nur noch für Abwärtskompatibilität in Tests – UI nutzt phase. */
  status?: OfferStatusFilter;
  /** @deprecated Nur noch für Abwärtskompatibilität in Tests – UI nutzt phase. */
  workflowStatus?: import('./offerWorkflow').OfferWorkflowStatusFilter;
}

export interface OfferTotals {
  monthlyItemsTotalCents: number;
  oneTimeItemsTotalCents: number;

  tariffMonthlyFixedTotalCents: number;
  tariffSetupTotalCents: number;

  monthlyTotalCents: number;
  oneTimeTotalCents: number;

  hasOnRequestItems: boolean;
  onRequestItemCount: number;
}
