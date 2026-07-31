import { generateId, nowIso } from '../../utils/id';
import {
  isPriceOverridden,
  resolveOriginalUnitPriceCents,
} from './offerCalculations';
import type {
  CreateOfferInput,
  Offer,
  OfferCustomerSnapshot,
  OfferItem,
  OfferItemPriceType,
  OfferItemType,
  OfferProductSnapshot,
  OfferStatus,
  OfferTariffSnapshot,
} from './offer';
import { copyCustomerSnapshot, copyProductSnapshot, copyTariffSnapshot } from './offerSnapshots';
import {
  EMPTY_OFFER_RECOMMENDATION_LINK,
  type OfferRecommendationLink,
} from '../recommendation/recommendationRecord';
import {
  mapLegacyOfferStatus,
  syncLegacyOfferStatus,
  type OfferWorkflowStatus,
} from './offerWorkflow';

const OFFER_STATUSES: OfferStatus[] = ['draft', 'completed', 'cancelled'];
const OFFER_ITEM_TYPES: OfferItemType[] = ['product', 'manual'];
const OFFER_ITEM_PRICE_TYPES: OfferItemPriceType[] = [
  'monthly',
  'one_time',
  'included',
  'on_request',
];
const WORKFLOW_STATUSES: OfferWorkflowStatus[] = [
  'draft', 'approval_required', 'in_approval', 'changes_requested', 'approved', 'ready_to_send',
  'sent', 'accepted', 'declined', 'expired', 'activation_pending', 'activated', 'released',
  'accounted', 'paid', 'cancelled',
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asOfferStatus(value: unknown): OfferStatus {
  if (typeof value === 'string' && OFFER_STATUSES.includes(value as OfferStatus)) {
    return value as OfferStatus;
  }

  return 'draft';
}

function asWorkflowStatus(value: unknown, legacy: OfferStatus): OfferWorkflowStatus {
  return typeof value === 'string' && WORKFLOW_STATUSES.includes(value as OfferWorkflowStatus)
    ? value as OfferWorkflowStatus
    : mapLegacyOfferStatus(legacy);
}

function asOfferItemType(value: unknown): OfferItemType {
  if (typeof value === 'string' && OFFER_ITEM_TYPES.includes(value as OfferItemType)) {
    return value as OfferItemType;
  }

  return 'manual';
}

function asOfferItemPriceType(value: unknown): OfferItemPriceType {
  if (
    typeof value === 'string' &&
    OFFER_ITEM_PRICE_TYPES.includes(value as OfferItemPriceType)
  ) {
    return value as OfferItemPriceType;
  }

  return 'monthly';
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function asNullableNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function asQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  const rounded = Math.round(parsed);
  return Math.min(999, Math.max(1, rounded));
}

function normalizePriceForType(
  priceType: OfferItemPriceType,
  priceCents: number | null,
): number | null {
  if (priceType === 'included') {
    return 0;
  }

  if (priceType === 'on_request') {
    return null;
  }

  return priceCents;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = asString(value);
    if (!text || seen.has(text.toLowerCase())) {
      continue;
    }

    seen.add(text.toLowerCase());
    result.push(text);
  }

  return result;
}

function normalizeProductSnapshot(value: unknown): OfferProductSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const priceType = asOfferItemPriceType(raw.priceType);

  return {
    productId: asString(raw.productId),
    internalProductCode: asString(raw.internalProductCode),
    name: asString(raw.name),
    providerName: asString(raw.providerName),
    category:
      typeof raw.category === 'string' &&
      ['payment_terminal', 'cash_register', 'cash_register_module', 'accessory', 'service'].includes(
        raw.category,
      )
        ? (raw.category as OfferProductSnapshot['category'])
        : 'accessory',
    description: asString(raw.description),
    manufacturer: asNullableString(raw.manufacturer),
    modelName: asNullableString(raw.modelName),
    priceType,
    unitPriceCents: normalizePriceForType(priceType, asNullableNonNegativeInteger(raw.unitPriceCents)),
    unitLabel: asNullableString(raw.unitLabel),
    sourceReference: asString(raw.sourceReference),
  };
}

export function normalizeTariffSnapshot(value: unknown): OfferTariffSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const terminalType =
    typeof raw.terminalType === 'string' &&
    ['stationary', 'mobile', 'softpos', 'ecommerce'].includes(raw.terminalType)
      ? (raw.terminalType as OfferTariffSnapshot['terminalType'])
      : 'stationary';

  return {
    tariffId: asString(raw.tariffId),
    internalTariffCode: asString(raw.internalTariffCode),
    name: asString(raw.name),
    providerName: asString(raw.providerName),
    description: asString(raw.description),
    terminalType,
    monthlyAccountBaseFeeCents: asNonNegativeInteger(raw.monthlyAccountBaseFeeCents),
    monthlyTerminalRentalCents: asNonNegativeInteger(raw.monthlyTerminalRentalCents),
    monthlyServiceFeePerTerminalCents: asNonNegativeInteger(raw.monthlyServiceFeePerTerminalCents),
    setupFeeCents: asNonNegativeInteger(raw.setupFeeCents),
    transactionFeeTenthsOfCent: asNonNegativeInteger(raw.transactionFeeTenthsOfCent),
    girocardClearingFeeTenthsOfCent: asNonNegativeInteger(raw.girocardClearingFeeTenthsOfCent),
    girocardClearingIncluded: raw.girocardClearingIncluded === true,
    girocardRateTenthsOfBasisPoint: asNonNegativeInteger(raw.girocardRateTenthsOfBasisPoint),
    debitCardRateTenthsOfBasisPoint: asNonNegativeInteger(raw.debitCardRateTenthsOfBasisPoint),
    creditCardRateTenthsOfBasisPoint: asNonNegativeInteger(raw.creditCardRateTenthsOfBasisPoint),
    contractDurationMonths: asNullableNonNegativeInteger(raw.contractDurationMonths),
    noticePeriodMonths: asNullableNonNegativeInteger(raw.noticePeriodMonths),
    minimumTurnoverCents: asNullableNonNegativeInteger(raw.minimumTurnoverCents),
    sourceReference: asString(raw.sourceReference),
    notes: asString(raw.notes),
  };
}

export function normalizeCustomerSnapshot(value: unknown): OfferCustomerSnapshot {
  if (!value || typeof value !== 'object') {
    return {
      leadId: '',
      companyName: '',
      contactFirstName: '',
      contactLastName: '',
      street: '',
      postalCode: '',
      city: '',
      email: '',
      phone: '',
      taxNumber: '',
      vatId: '',
    };
  }

  const raw = value as Record<string, unknown>;

  return {
    leadId: asString(raw.leadId),
    companyName: asString(raw.companyName),
    contactFirstName: asString(raw.contactFirstName),
    contactLastName: asString(raw.contactLastName),
    street: asString(raw.street),
    postalCode: asString(raw.postalCode),
    city: asString(raw.city),
    email: asString(raw.email),
    phone: asString(raw.phone),
    taxNumber: asString(raw.taxNumber),
    vatId: asString(raw.vatId),
  };
}

export function normalizeOfferItem(value: unknown, fallbackSortOrder: number): OfferItem {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const timestamp = nowIso();
  const priceType = asOfferItemPriceType(raw.priceType);
  const type = asOfferItemType(raw.type);
  const unitPriceCents = normalizePriceForType(priceType, asNullableNonNegativeInteger(raw.unitPriceCents));
  const originalUnitPriceCents =
    type === 'manual'
      ? null
      : normalizePriceForType(
          priceType,
          asNullableNonNegativeInteger(raw.originalUnitPriceCents ?? raw.unitPriceCents),
        );

  const item: OfferItem = {
    id: asString(raw.id) || generateId('offer_item'),
    type,
    productSnapshot: normalizeProductSnapshot(raw.productSnapshot),
    name: asString(raw.name),
    description: asString(raw.description),
    quantity: asQuantity(raw.quantity),
    priceType,
    unitPriceCents,
    unitLabel: asNullableString(raw.unitLabel),
    originalUnitPriceCents,
    priceOverridden:
      typeof raw.priceOverridden === 'boolean'
        ? raw.priceOverridden
        : isPriceOverridden(priceType, unitPriceCents, originalUnitPriceCents),
    priceOverrideReason: asString(raw.priceOverrideReason),
    sortOrder: asNonNegativeInteger(raw.sortOrder, fallbackSortOrder),
    createdAt: asString(raw.createdAt) || timestamp,
    updatedAt: asString(raw.updatedAt) || timestamp,
  };

  return item;
}

function reindexOfferItems(items: OfferItem[]): OfferItem[] {
  const seenIds = new Set<string>();

  return items
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'de'))
    .map((item, index) => {
      let id = item.id;
      if (seenIds.has(id)) {
        id = generateId('offer_item');
      }

      seenIds.add(id);

      return {
        ...item,
        id,
        sortOrder: index,
        productSnapshot: item.productSnapshot ? copyProductSnapshot(item.productSnapshot) : null,
      };
    });
}

function normalizeRecommendationLink(value: unknown): OfferRecommendationLink {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_OFFER_RECOMMENDATION_LINK };
  }

  const raw = value as Record<string, unknown>;
  const selectionType =
    raw.selectionType === 'primary' || raw.selectionType === 'alternative'
      ? raw.selectionType
      : null;

  return {
    recommendationRecordId: asNullableString(raw.recommendationRecordId),
    recommendationVersion:
      typeof raw.recommendationVersion === 'number' ? raw.recommendationVersion : null,
    selectedCandidateId: asNullableString(raw.selectedCandidateId),
    selectionType,
    deviationReason: asString(raw.deviationReason),
    costBaselineId: asNullableString(raw.costBaselineId),
    costBaselineVersion:
      typeof raw.costBaselineVersion === 'number' ? raw.costBaselineVersion : null,
  };
}

export function normalizeOffer(value: unknown): Offer {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const timestamp = nowIso();
  const status = asOfferStatus(raw.status);
  const normalizedWorkflowStatus = asWorkflowStatus(raw.workflowStatus, status);
  // Preserve completed/cancelled legacy records created before B03 even when a
  // test fixture or stale client has carried a default draft workflow value.
  const workflowStatus =
    status !== 'draft' && normalizedWorkflowStatus === 'draft'
      ? mapLegacyOfferStatus(status)
      : normalizedWorkflowStatus;
  const items = reindexOfferItems(
    Array.isArray(raw.items)
      ? raw.items.map((item, index) => normalizeOfferItem(item, index))
      : [],
  );

  const offer: Offer = {
    id: asString(raw.id) || generateId('offer'),
    offerNumber: asString(raw.offerNumber),
    status: syncLegacyOfferStatus(workflowStatus),
    workflowStatus,
    currentVersionNumber: Math.max(0, asNonNegativeInteger(raw.currentVersionNumber)),
    currentVersionId: asNullableString(raw.currentVersionId),
    sourceComparisonSessionId: asNullableString(raw.sourceComparisonSessionId),
    sourceScenarioId: asNullableString(raw.sourceScenarioId),
    leadId: asString(raw.leadId),
    customerSnapshot: copyCustomerSnapshot(normalizeCustomerSnapshot(raw.customerSnapshot)),
    tariffSnapshot: raw.tariffSnapshot ? copyTariffSnapshot(normalizeTariffSnapshot(raw.tariffSnapshot)!) : null,
    items,
    title: asString(raw.title),
    introductionText: asString(raw.introductionText),
    internalNotes: asString(raw.internalNotes),
    customerNotes: asString(raw.customerNotes),
    validUntil: asNullableString(raw.validUntil),
    createdByUserId: asString(raw.createdByUserId),
    createdByDisplayName: asString(raw.createdByDisplayName),
    completedAt: asNullableString(raw.completedAt),
    completedByUserId: asNullableString(raw.completedByUserId),
    cancelledAt: asNullableString(raw.cancelledAt),
    cancelledByUserId: asNullableString(raw.cancelledByUserId),
    cancellationReason: asString(raw.cancellationReason),
    recommendationLink: normalizeRecommendationLink(raw.recommendationLink),
    createdAt: asString(raw.createdAt) || timestamp,
    updatedAt: asString(raw.updatedAt) || timestamp,
  };

  if (status === 'completed' && !offer.completedAt) {
    offer.completedAt = offer.updatedAt;
  }

  return offer;
}

export function normalizeOffers(values: unknown[]): Offer[] {
  return values.map((value) => normalizeOffer(value));
}

export function normalizeCreateOfferInput(value: unknown): CreateOfferInput {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    leadId: asString(raw.leadId),
    tariffId: asNullableString(raw.tariffId),
    title: asString(raw.title),
    introductionText: asString(raw.introductionText),
    internalNotes: asString(raw.internalNotes),
    customerNotes: asString(raw.customerNotes),
    validUntil: asNullableString(raw.validUntil),
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => {
          const itemRaw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const priceType = asOfferItemPriceType(itemRaw.priceType);

          return {
            type: asOfferItemType(itemRaw.type),
            productId: asNullableString(itemRaw.productId),
            name: asString(itemRaw.name),
            description: asString(itemRaw.description),
            quantity: asQuantity(itemRaw.quantity),
            priceType,
            unitPriceCents: normalizePriceForType(
              priceType,
              asNullableNonNegativeInteger(itemRaw.unitPriceCents),
            ),
            unitLabel: asNullableString(itemRaw.unitLabel),
            priceOverrideReason: asString(itemRaw.priceOverrideReason),
          };
        })
      : [],
  };
}

export function resolveItemOriginalPrice(
  priceType: OfferItemPriceType,
  catalogPrice: number | null,
): number | null {
  return resolveOriginalUnitPriceCents(priceType, catalogPrice);
}

export function dedupeFeatureStrings(values: string[]): string[] {
  return normalizeStringList(values);
}
