import type { CreateOfferInput, Offer } from '../../domain/offer/offer';
import { createOfferDocumentSnapshot } from '../../domain/offerDocument/createOfferDocumentSnapshot';
import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import { formatOfferDocumentNumber } from '../../domain/offerDocument/offerDocumentNumber';
import { LocalLeadRepository } from '../../repositories/local/LocalLeadRepository';
import { LocalOfferDocumentRepository } from '../../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../../repositories/local/LocalProductRepository';
import { LocalTariffRepository } from '../../repositories/local/LocalTariffRepository';
import { OfferDocumentService } from '../../services/offerDocumentService';
import { OfferService } from '../../services/offerService';
import { generateId, nowIso } from '../../utils/id';
import { STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import {
  clearDemoDataForTests,
  resetDemoDataForTests,
} from '../../services/demoDataService';
import {
  ADMIN_CONTEXT,
  createOfferViaService,
  createProductOfferItemInput,
  createValidOfferInput,
  createValidOfferItemInput,
  DEMO_LEAD_ID,
  DEMO_PRODUCT_MONTHLY_ID,
  DEMO_PRODUCT_ONE_TIME_ID,
  FIELD_SERVICE_CONTEXT,
  getDemoProduct,
  OTHER_FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
  seedCompletedOffer,
} from './offerTestHelpers';
import type { OfferUserContext } from '../../services/offerService';

export const PREMIUM_LINE_MONTHLY_CENTS = 11995;
export const PREMIUM_LINE_TSE_CENTS = 24995;
export const PREMIUM_LINE_SETUP_CENTS = 39995;
export const PREMIUM_LINE_ONE_TIME_TOTAL_CENTS =
  PREMIUM_LINE_TSE_CENTS + PREMIUM_LINE_SETUP_CENTS;

function ensureOfferDocumentDemoData(currentUserId = FIELD_SERVICE_CONTEXT.userId): void {
  if (localStorage.getItem(STORAGE_KEYS.seeded) !== 'true') {
    setupOfferDocumentTestStorage(currentUserId);
  }
}

export function resolveLeadIdForContext(context: OfferUserContext): string {
  return context.userId === OTHER_FIELD_SERVICE_CONTEXT.userId ? 'lead_002' : DEMO_LEAD_ID;
}

export function setupOfferDocumentTestStorage(currentUserId = FIELD_SERVICE_CONTEXT.userId): void {
  clearDemoDataForTests();
  resetDemoDataForTests();
  resetOfferTestSequence();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);
}

export function createPremiumLineOfferInput(
  overrides: Partial<CreateOfferInput> = {},
): CreateOfferInput {
  const monthlyProduct = getDemoProduct(DEMO_PRODUCT_MONTHLY_ID);
  const setupProduct = getDemoProduct(DEMO_PRODUCT_ONE_TIME_ID);

  return createValidOfferInput({
    tariffId: null,
    title: 'Premium Line Angebot',
    items: [
      createProductOfferItemInput(monthlyProduct),
      createValidOfferItemInput({
        type: 'manual',
        productId: null,
        name: 'Swissbit TSE Stick',
        description: 'Finanzamtkonforme TSE für Premium Line',
        quantity: 1,
        priceType: 'one_time',
        unitPriceCents: PREMIUM_LINE_TSE_CENTS,
        unitLabel: 'je Stick',
        priceOverrideReason: '',
      }),
      createProductOfferItemInput(setupProduct),
    ],
    ...overrides,
  });
}

export function createOfferServicesForTests(): {
  offerService: OfferService;
  offerDocumentService: OfferDocumentService;
  offerRepository: LocalOfferRepository;
  offerDocumentRepository: LocalOfferDocumentRepository;
} {
  const offerRepository = new LocalOfferRepository();
  const offerService = new OfferService(
    offerRepository,
    new LocalLeadRepository(),
    new LocalTariffRepository(),
    new LocalProductRepository(),
  );
  const offerDocumentRepository = new LocalOfferDocumentRepository();
  const offerDocumentService = new OfferDocumentService(
    offerDocumentRepository,
    offerRepository,
    (offer, context) => offerService.canUserAccessOffer(offer, context),
  );

  return {
    offerService,
    offerDocumentService,
    offerRepository,
    offerDocumentRepository,
  };
}

export async function seedPremiumLineCompletedOffer(
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<Offer> {
  ensureOfferDocumentDemoData(context.userId);
  const { offerService } = createOfferServicesForTests();
  return seedCompletedOffer(
    offerService,
    createPremiumLineOfferInput({ leadId: resolveLeadIdForContext(context) }),
    context,
  );
}

export async function createTestOfferDocument(
  offer: Offer,
  overrides: Partial<OfferDocument> = {},
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<OfferDocument> {
  const timestamp = nowIso();
  const version = overrides.version ?? 1;
  const documentId = overrides.id ?? generateId('offer_doc');
  const snapshot = await createOfferDocumentSnapshot({
    documentId,
    documentVersion: version,
    offer,
    generatedAt: timestamp,
    generatedByUserId: context.userId,
    generatedByDisplayName: context.displayName,
  });

  return {
    id: documentId,
    offerId: offer.id,
    offerNumber: offer.offerNumber,
    documentNumber: formatOfferDocumentNumber(offer.offerNumber, version),
    version,
    status: 'generated',
    snapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export async function seedOfferDocumentInStorage(
  repository: LocalOfferDocumentRepository,
  offer: Offer,
  overrides: Partial<OfferDocument> = {},
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<OfferDocument> {
  const document = await createTestOfferDocument(offer, overrides, context);
  return repository.create(document);
}

export async function seedPremiumLineDraftOffer(
  context: OfferUserContext = FIELD_SERVICE_CONTEXT,
): Promise<Offer> {
  ensureOfferDocumentDemoData(context.userId);
  const { offerService } = createOfferServicesForTests();
  return createOfferViaService(
    offerService,
    createPremiumLineOfferInput({ leadId: resolveLeadIdForContext(context) }),
    context,
  );
}

export { ADMIN_CONTEXT, FIELD_SERVICE_CONTEXT, OTHER_FIELD_SERVICE_CONTEXT, clearDemoDataForTests, resetDemoDataForTests };
