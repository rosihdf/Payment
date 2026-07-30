import { buildPricingEvaluationInputFromOffer } from '../domain/pricing/buildPricingInputFromOffer';
import type { PricingEvaluationInput } from '../domain/pricing/pricingEvaluation';
import type { PricingEvaluationRecord } from '../domain/pricing/pricingEvaluationRecord';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import {
  createPricingEvaluationFingerprint,
  hasPricingRelevantInputChanged,
} from '../domain/pricingEngine/pricingEvaluationFingerprint';
import type { Offer } from '../domain/offer/offer';
import type { User } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { PricingCatalogRepository } from '../repositories/interfaces/PricingCatalogRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import type { OfferUserContext } from './offerService';
import {
  hasPricingEvaluationValidationErrors,
  validatePricingEvaluationInput,
  type PricingEvaluationValidationErrors,
} from './pricingEvaluationValidation';
import {
  toAdminPricingEvaluationView,
  toSalesPricingEvaluationView,
  type AdminPricingEvaluationView,
  type SalesPricingEvaluationView,
} from './pricingEvaluationViews';

export type PricingEvaluationServiceResult =
  | { ok: true; record: PricingEvaluationRecord }
  | { ok: false; errors: PricingEvaluationValidationErrors }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'frozen' };

export interface PricingEvaluationUserContext {
  userId: string;
  role: User['role'];
}

function canAccessOffer(offer: Offer, context: PricingEvaluationUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }

  return offer.createdByUserId === context.userId;
}

function getActiveDraftRecord(records: PricingEvaluationRecord[]): PricingEvaluationRecord | null {
  const draftRecords = records
    .filter((record) => record.status === 'draft')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return draftRecords[0] ?? null;
}

function markStaleIfNeeded(
  record: PricingEvaluationRecord,
  currentInput: PricingEvaluationInput,
): PricingEvaluationRecord {
  const stale = hasPricingRelevantInputChanged(record.result.snapshot.input, currentInput);
  if (!stale || record.result.stale) {
    return {
      ...record,
      result: {
        ...record.result,
        stale,
      },
    };
  }

  return {
    ...record,
    result: {
      ...record.result,
      stale: true,
    },
  };
}

export class PricingEvaluationService {
  private readonly pricingCatalogRepository: PricingCatalogRepository;
  private readonly pricingEvaluationRepository: PricingEvaluationRepository;
  private readonly offerRepository: OfferRepository;

  constructor(
    pricingCatalogRepository: PricingCatalogRepository,
    pricingEvaluationRepository: PricingEvaluationRepository,
    offerRepository: OfferRepository,
  ) {
    this.pricingCatalogRepository = pricingCatalogRepository;
    this.pricingEvaluationRepository = pricingEvaluationRepository;
    this.offerRepository = offerRepository;
  }

  private async getAccessibleOffer(
    offerId: string,
    context: PricingEvaluationUserContext,
  ): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer || !canAccessOffer(offer, context)) {
      return null;
    }

    return offer;
  }

  async evaluateInput(
    input: PricingEvaluationInput,
    _context: PricingEvaluationUserContext,
  ): Promise<
    | { ok: true; result: ReturnType<typeof evaluatePricing> }
    | { ok: false; errors: PricingEvaluationValidationErrors }
  > {
    const errors = validatePricingEvaluationInput(input);
    if (hasPricingEvaluationValidationErrors(errors)) {
      return { ok: false, errors };
    }

    const catalog = await this.pricingCatalogRepository.getCatalog();
    const result = evaluatePricing(input, {
      priceBookVersions: catalog.priceBookVersions,
      priceRules: catalog.priceRules,
      contractTerms: catalog.contractTerms,
    });

    return { ok: true, result };
  }

  async evaluateOffer(
    offerId: string,
    context: PricingEvaluationUserContext,
    inputOverrides: Partial<PricingEvaluationInput> = {},
  ): Promise<PricingEvaluationServiceResult> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    if (offer.status !== 'draft') {
      return { ok: false, error: 'frozen' };
    }

    const catalog = await this.pricingCatalogRepository.getCatalog();
    const input = buildPricingEvaluationInputFromOffer(offer, catalog.contractTerms, {
      salesRepresentativeId: context.userId,
      ...inputOverrides,
    });

    const evaluation = await this.evaluateInput(input, context);
    if (!evaluation.ok) {
      return evaluation;
    }

    const timestamp = nowIso();
    const fingerprint = createPricingEvaluationFingerprint(input);
    const existingRecords = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const activeDraft = getActiveDraftRecord(existingRecords);

    if (activeDraft && activeDraft.inputFingerprint === fingerprint) {
      const updatedRecord: PricingEvaluationRecord = {
        ...activeDraft,
        result: evaluation.result,
        updatedAt: timestamp,
      };
      const saved = await this.pricingEvaluationRepository.update(updatedRecord);
      return { ok: true, record: saved };
    }

    if (activeDraft) {
      await this.pricingEvaluationRepository.update({
        ...activeDraft,
        status: 'superseded',
        updatedAt: timestamp,
      });
    }

    const record: PricingEvaluationRecord = {
      id: generateId('pricing_eval_record'),
      offerId,
      status: 'draft',
      inputFingerprint: fingerprint,
      result: evaluation.result,
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await this.pricingEvaluationRepository.create(record);
    return { ok: true, record: saved };
  }

  async getActiveEvaluationForOffer(
    offerId: string,
    context: PricingEvaluationUserContext,
  ): Promise<PricingEvaluationRecord | null> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const catalog = await this.pricingCatalogRepository.getCatalog();
    const currentInput = buildPricingEvaluationInputFromOffer(offer, catalog.contractTerms, {
      salesRepresentativeId: context.userId,
    });

    const records = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const activeDraft = getActiveDraftRecord(records);
    if (!activeDraft) {
      return null;
    }

    const marked = markStaleIfNeeded(activeDraft, currentInput);
    if (marked.result.stale !== activeDraft.result.stale) {
      return this.pricingEvaluationRepository.update({
        ...marked,
        updatedAt: nowIso(),
      });
    }

    return marked;
  }

  async getSalesViewForOffer(
    offerId: string,
    context: PricingEvaluationUserContext,
  ): Promise<SalesPricingEvaluationView | null> {
    const record = await this.getActiveEvaluationForOffer(offerId, context);
    if (!record) {
      return null;
    }

    return toSalesPricingEvaluationView(record.result);
  }

  async getAdminViewForOffer(
    offerId: string,
    context: OfferUserContext,
  ): Promise<AdminPricingEvaluationView | null> {
    if (context.role !== 'admin') {
      return null;
    }

    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return null;
    }

    const record = await this.getActiveEvaluationForOffer(offerId, context);
    if (!record) {
      return null;
    }

    return toAdminPricingEvaluationView(record.result);
  }

  isEvaluationCurrent(record: PricingEvaluationRecord | null): boolean {
    return Boolean(record && !record.result.stale);
  }
}
