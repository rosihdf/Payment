import type { Lead } from '../domain/lead/lead';
import { getLeadDisplayName } from '../domain/lead/getLeadDisplayName';
import type { Product } from '../domain/product/product';
import type { Tariff } from '../domain/tariff/tariff';
import type { User } from '../domain/user/user';
import type {
  CreateOfferInput,
  CreateOfferItemInput,
  Offer,
  OfferFilters,
  OfferItem,
  OfferItemPriceType,
} from '../domain/offer/offer';
import { EMPTY_OFFER_RECOMMENDATION_LINK } from '../domain/recommendation/recommendationRecord';
import { generateNextOfferNumber } from '../domain/offer/offerNumber';
import {
  isPriceOverridden,
  resolveOriginalUnitPriceCents,
} from '../domain/offer/offerCalculations';
import {
  createCustomerSnapshotFromLead,
  createEmptyCustomerSnapshot,
  createProductSnapshotFromProduct,
  createTariffSnapshotFromTariff,
  copyCustomerSnapshot,
  copyProductSnapshot,
  copyTariffSnapshot,
} from '../domain/offer/offerSnapshots';
import { generateId, nowIso } from '../utils/id';
import { formatContactName } from '../utils/format';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import { OfferNotFoundError } from '../repositories/errors/OfferNotFoundError';
import type { OfferWorkflowService } from './offerWorkflowService';
import type { SalesActivityService } from './salesActivityService';
import { canTransitionWorkflowStatus, isEditableWorkflowStatus, syncLegacyOfferStatus } from '../domain/offer/offerWorkflow';
import {
  hasOfferValidationErrors,
  sanitizeOfferInput,
  validateCancellationReason,
  validateCreateOfferInput,
  type CreateOfferErrors,
} from './offerValidation';

export type OfferResult =
  | { ok: true; offer: Offer }
  | { ok: false; errors: CreateOfferErrors }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'invalid_status' };

export type OfferActionResult =
  | { ok: true; offer: Offer }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'invalid_status' }
  | { ok: false; errors: { reason?: string } };

export interface OfferUserContext {
  userId: string;
  role: User['role'];
  displayName: string;
}

function sortOffers(offers: Offer[]): Offer[] {
  return offers.slice().sort((left, right) => {
    const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }

    return right.offerNumber.localeCompare(left.offerNumber, 'de');
  });
}

function canUserAccessLead(lead: Lead, context: OfferUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }

  return lead.assignedSalesUserId === context.userId || lead.createdByUserId === context.userId;
}

function canUserAccessOffer(offer: Offer, context: OfferUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }

  return offer.createdByUserId === context.userId;
}

function resolveCatalogPrice(
  product: Product,
  priceType: OfferItemPriceType,
  useSecondary = false,
): number | null {
  if (priceType === 'included') {
    return 0;
  }

  if (priceType === 'on_request') {
    return null;
  }

  if (useSecondary) {
    return product.secondaryPriceCents;
  }

  return product.priceCents;
}

function buildOfferItemFromInput(
  itemInput: CreateOfferItemInput,
  product: Product | null,
  existingItem: OfferItem | null,
  sortOrder: number,
  timestamp: string,
): OfferItem {
  const priceType = itemInput.priceType;
  const unitPriceCents =
    priceType === 'included' ? 0 : priceType === 'on_request' ? null : itemInput.unitPriceCents;

  if (itemInput.type === 'manual' || !product) {
    return {
      id: existingItem?.id ?? generateId('offer_item'),
      type: 'manual',
      productSnapshot: null,
      name: itemInput.name.trim(),
      description: itemInput.description.trim(),
      quantity: itemInput.quantity,
      priceType,
      unitPriceCents,
      unitLabel: itemInput.unitLabel?.trim() || null,
      originalUnitPriceCents: null,
      priceOverridden: false,
      priceOverrideReason: itemInput.priceOverrideReason.trim(),
      sortOrder,
      createdAt: existingItem?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  const catalogPrice = resolveCatalogPrice(product, priceType);
  const originalUnitPriceCents =
    existingItem?.originalUnitPriceCents ??
    resolveOriginalUnitPriceCents(priceType, catalogPrice);
  const productSnapshot =
    existingItem?.productSnapshot &&
    existingItem.productSnapshot.productId === product.id &&
    existingItem.type === 'product'
      ? copyProductSnapshot(existingItem.productSnapshot)
      : createProductSnapshotFromProduct(product, priceType, catalogPrice);

  return {
    id: existingItem?.id ?? generateId('offer_item'),
    type: 'product',
    productSnapshot,
    name: itemInput.name.trim() || product.name,
    description: itemInput.description.trim() || product.description,
    quantity: itemInput.quantity,
    priceType,
    unitPriceCents,
    unitLabel: itemInput.unitLabel?.trim() || product.unitLabel,
    originalUnitPriceCents,
    priceOverridden: isPriceOverridden(priceType, unitPriceCents, originalUnitPriceCents),
    priceOverrideReason: itemInput.priceOverrideReason.trim(),
    sortOrder,
    createdAt: existingItem?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export class OfferService {
  private readonly offerRepository: OfferRepository;
  private readonly leadRepository: LeadRepository;
  private readonly tariffRepository: TariffRepository;
  private readonly productRepository: ProductRepository;
  private workflowService: OfferWorkflowService | null = null;
  private activityService: SalesActivityService | null = null;

  constructor(
    offerRepository: OfferRepository,
    leadRepository: LeadRepository,
    tariffRepository: TariffRepository,
    productRepository: ProductRepository,
  ) {
    this.offerRepository = offerRepository;
    this.leadRepository = leadRepository;
    this.tariffRepository = tariffRepository;
    this.productRepository = productRepository;
  }

  setWorkflowService(workflowService: OfferWorkflowService): void {
    this.workflowService = workflowService;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  canUserAccessOffer(offer: Offer, context: OfferUserContext): boolean {
    return canUserAccessOffer(offer, context);
  }

  canUserEditOffer(offer: Offer, context: OfferUserContext): boolean {
    return isEditableWorkflowStatus(offer.workflowStatus) && canUserAccessOffer(offer, context);
  }

  async getOffers(context: OfferUserContext): Promise<Offer[]> {
    const offers = await this.offerRepository.getAll();
    const visible = offers.filter((offer) => canUserAccessOffer(offer, context));
    return sortOffers(visible);
  }

  async getOfferById(id: string, context: OfferUserContext): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(id);
    if (!offer || !canUserAccessOffer(offer, context)) {
      return null;
    }

    return offer;
  }

  async getOffersForLead(leadId: string, context: OfferUserContext): Promise<Offer[]> {
    const lead = await this.leadRepository.getById(leadId);
    if (!lead || !canUserAccessLead(lead, context)) {
      return [];
    }

    const offers = await this.getOffers(context);
    return offers.filter((offer) => offer.leadId === leadId);
  }

  filterOffers(offers: Offer[], filters: OfferFilters, context: OfferUserContext): Offer[] {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return offers.filter((offer) => {
      if (filters.status !== 'all' && offer.status !== filters.status) {
        return false;
      }
      if (filters.workflowStatus && filters.workflowStatus !== 'all' && offer.workflowStatus !== filters.workflowStatus) {
        return false;
      }

      if (context.role === 'admin' && filters.owner === 'mine' && offer.createdByUserId !== context.userId) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const productNames = offer.items.map((item) => item.name).join(' ');
      const haystack = [
        offer.offerNumber,
        offer.title,
        getLeadDisplayName(offer.customerSnapshot),
        formatContactName(
          offer.customerSnapshot.contactFirstName,
          offer.customerSnapshot.contactLastName,
        ),
        offer.customerSnapshot.city,
        offer.tariffSnapshot?.name ?? '',
        productNames,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }

  private async resolveLead(leadId: string, context: OfferUserContext): Promise<Lead | null> {
    const lead = await this.leadRepository.getById(leadId);
    if (!lead || !canUserAccessLead(lead, context)) {
      return null;
    }

    return lead;
  }

  private async resolveTariffSnapshot(
    tariffId: string | null,
    existingSnapshot: Offer['tariffSnapshot'],
  ): Promise<Offer['tariffSnapshot']> {
    if (!tariffId) {
      return null;
    }

    if (existingSnapshot?.tariffId === tariffId) {
      return copyTariffSnapshot(existingSnapshot);
    }

    const tariff = await this.tariffRepository.getById(tariffId);
    if (!tariff || tariff.status !== 'active') {
      return null;
    }

    return createTariffSnapshotFromTariff(tariff);
  }

  private async buildOriginalPricesMap(
    items: CreateOfferItemInput[],
  ): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();

    for (const item of items) {
      if (item.type !== 'product' || !item.productId) {
        continue;
      }

      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        continue;
      }

      map.set(item.productId, resolveCatalogPrice(product, item.priceType));
    }

    return map;
  }

  private async buildItemsFromInput(
    input: CreateOfferInput,
    existingOffer: Offer | null,
  ): Promise<{ items: OfferItem[]; errors: CreateOfferErrors }> {
    const errors: CreateOfferErrors = {};
    const itemErrors: Record<number, Partial<Record<keyof CreateOfferItemInput, string>>> = {};
    const timestamp = nowIso();
    const items: OfferItem[] = [];
    const usedProductIds = new Set<string>();

    for (let index = 0; index < input.items.length; index += 1) {
      const itemInput = input.items[index]!;

      if (itemInput.type === 'product') {
        if (!itemInput.productId) {
          itemErrors[index] = { productId: 'Produktposition benötigt eine Produkt-ID.' };
          continue;
        }

        if (usedProductIds.has(itemInput.productId)) {
          itemErrors[index] = { productId: 'Dieses Produkt ist bereits im Angebot enthalten.' };
          continue;
        }

        usedProductIds.add(itemInput.productId);

        const product = await this.productRepository.getById(itemInput.productId);
        if (!product) {
          itemErrors[index] = { productId: 'Produkt wurde nicht gefunden.' };
          continue;
        }

        if (product.status !== 'active' && !existingOffer?.items.some(
          (item) => item.productSnapshot?.productId === product.id,
        )) {
          itemErrors[index] = { productId: 'Nur aktive Produkte können neu hinzugefügt werden.' };
          continue;
        }

        const existingItem =
          existingOffer?.items.find(
            (item) => item.type === 'product' && item.productSnapshot?.productId === product.id,
          ) ?? null;

        items.push(
          buildOfferItemFromInput(itemInput, product, existingItem, index, timestamp),
        );
      } else {
        items.push(buildOfferItemFromInput(itemInput, null, null, index, timestamp));
      }
    }

    if (Object.keys(itemErrors).length > 0) {
      errors.itemErrors = itemErrors;
    }

    return { items, errors };
  }

  async createOffer(
    input: CreateOfferInput,
    context: OfferUserContext,
    options?: { allowMissingLead?: boolean },
  ): Promise<OfferResult> {
    const sanitized = sanitizeOfferInput(input);
    const allowMissingLead = options?.allowMissingLead === true && !sanitized.leadId.trim();
    const lead = allowMissingLead ? null : await this.resolveLead(sanitized.leadId, context);

    if (!allowMissingLead && !lead) {
      return { ok: false, error: 'forbidden' };
    }

    const originalPrices = await this.buildOriginalPricesMap(sanitized.items);
    const validationErrors = validateCreateOfferInput(sanitized, {
      createdAt: nowIso(),
      originalPricesByProductId: originalPrices,
      allowMissingLead,
    });

    if (hasOfferValidationErrors(validationErrors)) {
      return { ok: false, errors: validationErrors };
    }

    const { items, errors: itemBuildErrors } = await this.buildItemsFromInput(sanitized, null);
    if (hasOfferValidationErrors(itemBuildErrors)) {
      return { ok: false, errors: { ...validationErrors, ...itemBuildErrors } };
    }

    let tariffSnapshot: Offer['tariffSnapshot'] = null;
    if (sanitized.tariffId) {
      const tariff = await this.tariffRepository.getById(sanitized.tariffId);
      if (!tariff || tariff.status !== 'active') {
        return {
          ok: false,
          errors: { tariffId: 'Bitte wählen Sie einen aktiven Payment-Tarif.' },
        };
      }

      tariffSnapshot = createTariffSnapshotFromTariff(tariff);
    }

    const timestamp = nowIso();
    const existingOffers = await this.offerRepository.getAll();

    const offer: Offer = {
      id: generateId('offer'),
      offerNumber: generateNextOfferNumber(existingOffers, timestamp),
      status: 'draft',
      workflowStatus: 'draft',
      currentVersionNumber: 0,
      currentVersionId: null,
      sourceComparisonSessionId: null,
      sourceScenarioId: null,
      leadId: lead?.id ?? '',
      customerSnapshot: lead ? createCustomerSnapshotFromLead(lead) : createEmptyCustomerSnapshot(),
      tariffSnapshot,
      items,
      title: sanitized.title.trim(),
      introductionText: sanitized.introductionText.trim(),
      internalNotes: sanitized.internalNotes.trim(),
      customerNotes: sanitized.customerNotes.trim(),
      validUntil: sanitized.validUntil,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      completedAt: null,
      completedByUserId: null,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: '',
      recommendationLink: { ...EMPTY_OFFER_RECOMMENDATION_LINK },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const created = await this.offerRepository.create(offer);
      const withVersion = this.workflowService
        ? await this.workflowService.ensureInitialVersion(created)
        : created;
      await this.activityService?.recordSystemActivity(
        {
          type: 'offer_created',
          title: `Angebot erstellt: ${withVersion.offerNumber}`,
          description: withVersion.title,
          leadId: withVersion.leadId,
          offerId: withVersion.id,
          sourceKey: `offer_created:${withVersion.id}`,
        },
        context,
      );
      return { ok: true, offer: withVersion };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async updateOffer(id: string, input: CreateOfferInput, context: OfferUserContext): Promise<OfferResult> {
    const existing = await this.offerRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (!canUserAccessOffer(existing, context)) {
      return { ok: false, error: 'forbidden' };
    }

    if (!isEditableWorkflowStatus(existing.workflowStatus)) {
      return { ok: false, error: 'invalid_status' };
    }

    const sanitized = sanitizeOfferInput(input);
    const lead = await this.resolveLead(sanitized.leadId, context);
    if (!lead) {
      return { ok: false, error: 'forbidden' };
    }

    const originalPrices = await this.buildOriginalPricesMap(sanitized.items);
    const validationErrors = validateCreateOfferInput(sanitized, {
      existingOffer: existing,
      createdAt: existing.createdAt,
      originalPricesByProductId: originalPrices,
    });

    if (hasOfferValidationErrors(validationErrors)) {
      return { ok: false, errors: validationErrors };
    }

    const { items, errors: itemBuildErrors } = await this.buildItemsFromInput(sanitized, existing);
    if (hasOfferValidationErrors(itemBuildErrors)) {
      return { ok: false, errors: { ...validationErrors, ...itemBuildErrors } };
    }

    let tariffSnapshot = await this.resolveTariffSnapshot(sanitized.tariffId, existing.tariffSnapshot);
    if (sanitized.tariffId && !tariffSnapshot) {
      return {
        ok: false,
        errors: { tariffId: 'Bitte wählen Sie einen aktiven Payment-Tarif.' },
      };
    }

    const customerSnapshot =
      lead.id === existing.leadId
        ? copyCustomerSnapshot(existing.customerSnapshot)
        : createCustomerSnapshotFromLead(lead);

    const updated: Offer = {
      ...existing,
      leadId: lead.id,
      customerSnapshot,
      tariffSnapshot,
      items,
      title: sanitized.title.trim(),
      introductionText: sanitized.introductionText.trim(),
      internalNotes: sanitized.internalNotes.trim(),
      customerNotes: sanitized.customerNotes.trim(),
      validUntil: sanitized.validUntil,
      updatedAt: nowIso(),
    };

    try {
      const saved = await this.offerRepository.update(updated);
      await this.activityService?.recordSystemActivity(
        {
          type: 'offer_updated',
          title: `Angebot geändert: ${saved.offerNumber}`,
          description: saved.title,
          leadId: saved.leadId,
          offerId: saved.id,
          sourceKey: `offer_updated:${saved.id}:${saved.updatedAt}`,
        },
        context,
      );
      return { ok: true, offer: saved };
    } catch (error) {
      if (error instanceof OfferNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }

  async completeOffer(id: string, context: OfferUserContext): Promise<OfferActionResult> {
    const existing = await this.offerRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (!canUserAccessOffer(existing, context)) {
      return { ok: false, error: 'forbidden' };
    }

    if (existing.status !== 'draft') {
      return { ok: false, error: 'invalid_status' };
    }

    if (
      this.workflowService &&
      canTransitionWorkflowStatus(existing.workflowStatus, 'accept')
    ) {
      const result = await this.workflowService.acceptOffer(id, context, {
        acceptedByName: context.displayName,
        acceptanceType: 'personal_confirmation',
        otherText: null,
        note: 'Abschluss über Legacy-API',
      });
      if (result.ok) return result;
      return { ok: false, error: result.error === 'validation' ? 'invalid_status' : result.error };
    }

    const input = {
      leadId: existing.leadId,
      tariffId: existing.tariffSnapshot?.tariffId ?? null,
      title: existing.title,
      introductionText: existing.introductionText,
      internalNotes: existing.internalNotes,
      customerNotes: existing.customerNotes,
      validUntil: existing.validUntil,
      items: existing.items.map((item) => ({
        type: item.type,
        productId: item.productSnapshot?.productId ?? null,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        priceType: item.priceType,
        unitPriceCents: item.unitPriceCents,
        unitLabel: item.unitLabel,
        priceOverrideReason: item.priceOverrideReason,
      })),
    };

    const originalPrices = await this.buildOriginalPricesMap(input.items);
    const validationErrors = validateCreateOfferInput(input, {
      existingOffer: existing,
      createdAt: existing.createdAt,
      originalPricesByProductId: originalPrices,
    });

    if (hasOfferValidationErrors(validationErrors)) {
      return { ok: false, error: 'invalid_status' };
    }

    const timestamp = nowIso();
    const completed: Offer = {
      ...existing,
      workflowStatus: 'accepted',
      status: syncLegacyOfferStatus('accepted'),
      completedAt: timestamp,
      completedByUserId: context.userId,
      updatedAt: timestamp,
    };

    try {
      const saved = await this.offerRepository.update(completed);
      return { ok: true, offer: saved };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async cancelOffer(id: string, reason: string, context: OfferUserContext): Promise<OfferActionResult> {
    const existing = await this.offerRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (!canUserAccessOffer(existing, context)) {
      return { ok: false, error: 'forbidden' };
    }

    if (existing.status === 'cancelled') {
      return { ok: false, error: 'invalid_status' };
    }

    const reasonError = validateCancellationReason(reason);
    if (reasonError) {
      return { ok: false, errors: { reason: reasonError } };
    }
    if (this.workflowService) {
      const result = await this.workflowService.cancelWorkflow(id, context);
      if (result.ok && reason.trim()) {
        return { ok: true, offer: await this.offerRepository.update({ ...result.offer, cancellationReason: reason.trim() }) };
      }
      if (result.ok) return result;
      return { ok: false, error: result.error === 'validation' ? 'invalid_status' : result.error };
    }

    const timestamp = nowIso();
    const cancelled: Offer = {
      ...existing,
      workflowStatus: 'cancelled',
      status: syncLegacyOfferStatus('cancelled'),
      cancelledAt: timestamp,
      cancelledByUserId: context.userId,
      cancellationReason: reason.trim(),
      updatedAt: timestamp,
    };

    try {
      const saved = await this.offerRepository.update(cancelled);
      return { ok: true, offer: saved };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async duplicateOfferAsDraft(id: string, context: OfferUserContext): Promise<OfferActionResult> {
    const existing = await this.offerRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (!canUserAccessOffer(existing, context)) {
      return { ok: false, error: 'forbidden' };
    }

    if (existing.status === 'draft') {
      return { ok: false, error: 'invalid_status' };
    }

    const timestamp = nowIso();
    const allOffers = await this.offerRepository.getAll();
    const duplicatedItems = existing.items.map((item, index) => ({
      ...item,
      id: generateId('offer_item'),
      productSnapshot: item.productSnapshot ? copyProductSnapshot(item.productSnapshot) : null,
      sortOrder: index,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const duplicate: Offer = {
      ...existing,
      id: generateId('offer'),
      offerNumber: generateNextOfferNumber(allOffers, timestamp),
      status: 'draft',
      workflowStatus: 'draft',
      currentVersionNumber: 0,
      currentVersionId: null,
      sourceComparisonSessionId: null,
      sourceScenarioId: null,
      items: duplicatedItems,
      customerSnapshot: copyCustomerSnapshot(existing.customerSnapshot),
      tariffSnapshot: existing.tariffSnapshot ? copyTariffSnapshot(existing.tariffSnapshot) : null,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      completedAt: null,
      completedByUserId: null,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: '',
      recommendationLink: { ...EMPTY_OFFER_RECOMMENDATION_LINK },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const saved = await this.offerRepository.create(duplicate);
      return { ok: true, offer: this.workflowService ? await this.workflowService.ensureInitialVersion(saved) : saved };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async getAccessibleLeads(context: OfferUserContext): Promise<Lead[]> {
    const leads = await this.leadRepository.getAll();

    if (context.role === 'admin') {
      return leads;
    }

    return leads.filter(
      (lead) => lead.assignedSalesUserId === context.userId || lead.createdByUserId === context.userId,
    );
  }

  async getActiveTariffsForSelection(): Promise<Tariff[]> {
    const tariffs = await this.tariffRepository.getAll();
    return tariffs.filter((tariff) => tariff.status === 'active');
  }

  async getActiveProductsForSelection(): Promise<Product[]> {
    const products = await this.productRepository.getAll();
    return products
      .filter((product) => product.status === 'active')
      .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }

  hasLeadDataChanged(offer: Offer, lead: Lead | null): boolean {
    if (!lead) {
      return false;
    }

    const snapshot = offer.customerSnapshot;
    return (
      snapshot.companyName !== lead.companyName ||
      snapshot.contactFirstName !== lead.contactFirstName ||
      snapshot.contactLastName !== lead.contactLastName ||
      snapshot.street !== lead.street ||
      snapshot.postalCode !== lead.postalCode ||
      snapshot.city !== lead.city ||
      snapshot.email !== lead.email ||
      snapshot.phone !== lead.phone
    );
  }
}
