import type { Lead } from '../../domain/lead/lead';
import {
  COUNSELING_PRINCIPLE_KEYS,
  emptyCounselingPrincipleFlags,
} from '../../domain/offer/counselingConfirmation';
import type {
  CreateOfferInput,
  CreateOfferItemInput,
  Offer,
  OfferItem,
} from '../../domain/offer/offer';
import { DEFAULT_CREATE_OFFER_INPUT } from '../../domain/offer/offerDefaults';
import { formatOfferNumber } from '../../domain/offer/offerNumber';
import {
  createCustomerSnapshotFromLead,
  createProductSnapshotFromProduct,
  createTariffSnapshotFromTariff,
} from '../../domain/offer/offerSnapshots';
import type { Product } from '../../domain/product/product';
import type { Tariff } from '../../domain/tariff/tariff';
import {
  clearDemoDataForTests,
  getDemoLeads,
  getDemoProducts,
  getDemoTariffs,
  resetDemoDataForTests,
} from '../../services/demoDataService';
import { syncLegacyOfferStatus } from '../../domain/offer/offerWorkflow';
import { createServices } from '../../services';
import type { OfferService, OfferUserContext } from '../../services/offerService';
import type { OfferWorkflowService } from '../../services/offerWorkflowService';
import { createTestRepositories } from './createTestRepositories';
import { EMPTY_OFFER_RECOMMENDATION_LINK } from '../../domain/recommendation/recommendationRecord';
import { generateId, nowIso } from '../../utils/id';
import { STORAGE_KEYS, writeStorageItem } from '../../utils/storage';

let testOfferSequence = 0;

function nextTestOfferNumber(): string {
  testOfferSequence += 1;
  return formatOfferNumber(2026, testOfferSequence);
}

export function resetOfferTestSequence(): void {
  testOfferSequence = 0;
}

export const ADMIN_USER_ID = 'user_004';
export const FIELD_SERVICE_USER_ID = 'user_001';

export const ADMIN_CONTEXT: OfferUserContext = {
  userId: ADMIN_USER_ID,
  role: 'admin',
  displayName: 'Michael Weber',
};

export const FIELD_SERVICE_CONTEXT: OfferUserContext = {
  userId: FIELD_SERVICE_USER_ID,
  role: 'field_service',
  displayName: 'Laura Berger',
};

export const OTHER_FIELD_SERVICE_CONTEXT: OfferUserContext = {
  userId: 'user_002',
  role: 'field_service',
  displayName: 'Thomas Klein',
};

export const DEMO_LEAD_ID = 'lead_001';
export const DEMO_TARIFF_ID = 'tariff_bestpay_a920_classic';
export const DEMO_PRODUCT_MONTHLY_ID = 'product_bestpay_premium_line_register';
export const DEMO_PRODUCT_ONE_TIME_ID = 'product_bestpay_premium_line_setup';
export const DEMO_PRODUCT_ON_REQUEST_ID = 'product_speedypay_t2';

export function getDemoLead(id = DEMO_LEAD_ID): Lead {
  const lead = getDemoLeads().find((entry) => entry.id === id);
  if (!lead) {
    throw new Error(`Demo lead ${id} not found`);
  }

  return lead;
}

export function getDemoTariff(id = DEMO_TARIFF_ID): Tariff {
  const tariff = getDemoTariffs().find((entry) => entry.id === id);
  if (!tariff) {
    throw new Error(`Demo tariff ${id} not found`);
  }

  return tariff;
}

export function getDemoProduct(id = DEMO_PRODUCT_MONTHLY_ID): Product {
  const product = getDemoProducts().find((entry) => entry.id === id);
  if (!product) {
    throw new Error(`Demo product ${id} not found`);
  }

  return product;
}

export function createValidOfferItemInput(
  overrides: Partial<CreateOfferItemInput> = {},
): CreateOfferItemInput {
  return {
    type: 'manual',
    productId: null,
    name: 'Testposition',
    description: 'Testbeschreibung',
    quantity: 1,
    priceType: 'monthly',
    unitPriceCents: 1995,
    unitLabel: 'je Gerät',
    priceOverrideReason: '',
    ...overrides,
  };
}

export function createProductOfferItemInput(
  product: Product,
  overrides: Partial<CreateOfferItemInput> = {},
): CreateOfferItemInput {
  return createValidOfferItemInput({
    type: 'product',
    productId: product.id,
    name: product.name,
    description: product.description,
    priceType: product.priceType,
    unitPriceCents:
      product.priceType === 'included'
        ? 0
        : product.priceType === 'on_request'
          ? null
          : product.priceCents,
    unitLabel: product.unitLabel,
    ...overrides,
  });
}

export function createValidOfferInput(overrides: Partial<CreateOfferInput> = {}): CreateOfferInput {
  const product = getDemoProduct();

  return {
    ...DEFAULT_CREATE_OFFER_INPUT,
    leadId: DEMO_LEAD_ID,
    tariffId: DEMO_TARIFF_ID,
    title: 'Test Angebot',
    items: [createProductOfferItemInput(product)],
    ...overrides,
  };
}

export function createTariffOnlyOfferInput(
  overrides: Partial<CreateOfferInput> = {},
): CreateOfferInput {
  return createValidOfferInput({
    items: [],
    ...overrides,
  });
}

export function createTestOfferItem(overrides: Partial<OfferItem> = {}): OfferItem {
  const timestamp = nowIso();
  const product = getDemoProduct();

  return {
    id: generateId('offer_item'),
    type: 'product',
    productSnapshot: createProductSnapshotFromProduct(product, product.priceType, product.priceCents),
    name: product.name,
    description: product.description,
    quantity: 1,
    priceType: product.priceType,
    unitPriceCents: product.priceCents,
    unitLabel: product.unitLabel,
    originalUnitPriceCents: product.priceCents,
    priceOverridden: false,
    priceOverrideReason: '',
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createTestOffer(overrides: Partial<Offer> = {}): Offer {
  const timestamp = nowIso();
  const lead = getDemoLead();
  const tariff = getDemoTariff();

  return {
    id: generateId('offer'),
    offerNumber: nextTestOfferNumber(),
    status: 'draft',
    workflowStatus: 'draft',
    currentVersionNumber: 0,
    currentVersionId: null,
    sourceComparisonSessionId: null,
    sourceScenarioId: null,
    leadId: lead.id,
    customerSnapshot: createCustomerSnapshotFromLead(lead),
    tariffSnapshot: createTariffSnapshotFromTariff(tariff),
    commercialSnapshot: null,
    items: [createTestOfferItem()],
    title: 'Test Angebot',
    introductionText: '',
    internalNotes: '',
    customerNotes: '',
    validUntil: null,
    createdByUserId: FIELD_SERVICE_USER_ID,
    createdByDisplayName: FIELD_SERVICE_CONTEXT.displayName,
    completedAt: null,
    completedByUserId: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: '',
    recommendationLink: { ...EMPTY_OFFER_RECOMMENDATION_LINK },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  } as Offer;
}

export async function createOfferViaService(
  offerService: OfferService,
  input: CreateOfferInput = createValidOfferInput(),
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<Offer> {
  const result = await offerService.createOffer(input, context);
  if (!result.ok) {
    throw new Error(`Failed to create offer: ${JSON.stringify(result)}`);
  }

  return result.offer;
}

export async function seedCompletedOffer(
  _offerService?: OfferService,
  input: CreateOfferInput = createValidOfferInput(),
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<Offer> {
  const repos = createTestRepositories();
  const services = createServices(repos);
  const draft = await createOfferViaService(services.offerService, input, context);
  await services.offerWorkflowService.ensureInitialVersion(draft);

  const sentOffer = await repos.offerRepository.update({
    ...draft,
    workflowStatus: 'sent',
    status: syncLegacyOfferStatus('sent'),
    updatedAt: nowIso(),
  });

  const result = await services.offerService.completeOffer(sentOffer.id, context);
  if (!result.ok) {
    throw new Error(`Failed to complete offer: ${JSON.stringify(result)}`);
  }

  return result.offer;
}

export async function seedOfferInStorage(
  repository: import('../../repositories/local/LocalOfferRepository').LocalOfferRepository,
  overrides: Partial<Offer> = {},
): Promise<Offer> {
  return repository.create(createTestOffer(overrides));
}

export function setupOfferTestStorage(currentUserId = FIELD_SERVICE_USER_ID): void {
  clearDemoDataForTests();
  resetDemoDataForTests();
  resetOfferTestSequence();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);
}

export function allCounselingPrinciplesConfirmed() {
  return Object.fromEntries(COUNSELING_PRINCIPLE_KEYS.map((key) => [key, true])) as ReturnType<
    typeof emptyCounselingPrincipleFlags
  >;
}

export async function confirmCounselingAndDocumentSent(
  service: OfferWorkflowService,
  offerId: string,
  context: OfferUserContext,
  offerDocumentService: import('../../services/offerDocumentService').OfferDocumentService,
  recipient = 'kunde@example.test',
) {
  const version = await service.getCurrentVersion(offerId);
  if (!version) {
    throw new Error(`Keine Angebotsversion für ${offerId}`);
  }
  await service.confirmCounselingPrinciples(
    offerId,
    version.id,
    context,
    allCounselingPrinciplesConfirmed(),
  );
  const documentResult = await offerDocumentService.createFinalDocument(offerId, context);
  if (!documentResult.ok) {
    throw new Error('Finales Dokument konnte nicht erzeugt werden.');
  }
  return service.documentSent(offerId, context, recipient, 'email', {
    providedAt: new Date().toISOString(),
    followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    comparesOffers: false,
    openQuestions: '',
    customerContactsSelf: false,
    noFollowUpDesired: false,
  });
}
