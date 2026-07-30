import { buildCommissionCalculationInput } from '../domain/commission/buildCommissionInputFromOffer';
import type { CommissionCalculationRecord } from '../domain/commission/commissionCalculation';
import type { CommissionReductionDecision } from '../domain/commission/commissionReduction';
import {
  maxAllowedReductionAmountCents,
  remainingCommissionAfterReduction,
} from '../domain/commission/commissionReduction';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import {
  createCommissionCalculationFingerprint,
  hasCommissionRelevantInputChanged,
} from '../domain/commissionEngine/commissionCalculationFingerprint';
import type { Offer } from '../domain/offer/offer';
import type { User } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import type { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import type { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import type { OfferUserContext } from './offerService';
import {
  toAdminCommissionCalculationView,
  toSalesCommissionCalculationView,
  type AdminCommissionCalculationView,
  type SalesCommissionCalculationView,
} from './commissionCalculationViews';

export interface CommissionCalculationUserContext {
  userId: string;
  role: User['role'];
}

function canAccessOffer(offer: Offer, context: CommissionCalculationUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }
  return offer.createdByUserId === context.userId;
}

function getActivePreviewRecord(records: CommissionCalculationRecord[]): CommissionCalculationRecord | null {
  return (
    records
      .filter((record) => record.status === 'preview')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

export class CommissionCalculationService {
  private readonly commissionCatalogRepository: LocalCommissionCatalogRepository;
  private readonly commissionCalculationRepository: LocalCommissionCalculationRepository;
  private readonly offerRepository: OfferRepository;
  private readonly pricingEvaluationRepository: PricingEvaluationRepository;

  constructor(
    commissionCatalogRepository: LocalCommissionCatalogRepository,
    commissionCalculationRepository: LocalCommissionCalculationRepository,
    offerRepository: OfferRepository,
    pricingEvaluationRepository: PricingEvaluationRepository,
  ) {
    this.commissionCatalogRepository = commissionCatalogRepository;
    this.commissionCalculationRepository = commissionCalculationRepository;
    this.offerRepository = offerRepository;
    this.pricingEvaluationRepository = pricingEvaluationRepository;
  }

  private async getAccessibleOffer(
    offerId: string,
    context: CommissionCalculationUserContext,
  ): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer || !canAccessOffer(offer, context)) {
      return null;
    }
    return offer;
  }

  async calculatePreviewForOffer(
    offerId: string,
    context: CommissionCalculationUserContext,
    contractTypeCode: string | null = null,
  ): Promise<
    | { ok: true; record: CommissionCalculationRecord }
    | { ok: false; error: 'not_found' | 'forbidden' | 'frozen' | 'pricing_missing' | 'pricing_stale' }
  > {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    if (offer.status !== 'draft') {
      return { ok: false, error: 'frozen' };
    }

    const pricingRecords = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const activePricing = pricingRecords
      .filter((record) => record.status === 'draft')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!activePricing) {
      return { ok: false, error: 'pricing_missing' };
    }

    if (activePricing.result.stale) {
      return { ok: false, error: 'pricing_stale' };
    }

    const catalog = await this.commissionCatalogRepository.getCatalog();
    const input = buildCommissionCalculationInput(
      offer,
      activePricing.id,
      activePricing.result,
      contractTypeCode,
    );

    const existingRecords = await this.commissionCalculationRepository.getCalculationsByOfferId(offerId);
    const existingReduction =
      getActivePreviewRecord(existingRecords)?.result.reductionDecision ?? null;

    const result = evaluateCommission(
      input,
      {
        commissionPlans: catalog.commissionPlans,
        commissionPlanVersions: catalog.commissionPlanVersions,
        commissionRules: catalog.commissionRules,
        assignments: catalog.assignments,
      },
      existingReduction?.status === 'approved' ? existingReduction : null,
    );

    const fingerprint = createCommissionCalculationFingerprint(input, result.reductionDecision);
    const timestamp = nowIso();
    const activePreview = getActivePreviewRecord(existingRecords);

    if (activePreview && activePreview.inputFingerprint === fingerprint) {
      const updated: CommissionCalculationRecord = {
        ...activePreview,
        result,
        updatedAt: timestamp,
      };
      return { ok: true, record: await this.commissionCalculationRepository.updateCalculation(updated) };
    }

    if (activePreview) {
      await this.commissionCalculationRepository.updateCalculation({
        ...activePreview,
        status: 'superseded',
        updatedAt: timestamp,
      });
    }

    const record: CommissionCalculationRecord = {
      id: generateId('commission_calc_record'),
      offerId,
      status: 'preview',
      inputFingerprint: fingerprint,
      result,
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await this.commissionCalculationRepository.createCalculation(record);
    await this.commissionCalculationRepository.createEvent({
      id: generateId('commission_event'),
      commissionCaseId: null,
      commissionCalculationId: saved.id,
      eventType: 'preview_created',
      previousStatus: null,
      newStatus: 'preview',
      amountCents: result.finalExpectedCommissionAmountCents,
      currency: result.currency,
      reason: 'Provisionsvorschau erstellt',
      triggeredByUserId: context.userId,
      occurredAt: timestamp,
      metadata: {},
    });

    return { ok: true, record: saved };
  }

  async getActivePreviewForOffer(
    offerId: string,
    context: CommissionCalculationUserContext,
  ): Promise<CommissionCalculationRecord | null> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const records = await this.commissionCalculationRepository.getCalculationsByOfferId(offerId);
    const activePreview = getActivePreviewRecord(records);
    if (!activePreview) {
      return null;
    }

    const pricingRecords = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const activePricing = pricingRecords
      .filter((record) => record.status === 'draft')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!activePricing) {
      return { ...activePreview, result: { ...activePreview.result, stale: true } };
    }

    const input = buildCommissionCalculationInput(
      offer,
      activePricing.id,
      activePricing.result,
      activePreview.result.snapshot.contractTypeCode,
    );
    const fingerprint = createCommissionCalculationFingerprint(
      input,
      activePreview.result.reductionDecision,
    );
    const stale = hasCommissionRelevantInputChanged(activePreview.inputFingerprint, fingerprint);

    if (stale !== activePreview.result.stale) {
      const updated: CommissionCalculationRecord = {
        ...activePreview,
        result: { ...activePreview.result, stale },
        updatedAt: nowIso(),
      };
      return this.commissionCalculationRepository.updateCalculation(updated);
    }

    return activePreview;
  }

  async getSalesViewForOffer(
    offerId: string,
    context: CommissionCalculationUserContext,
  ): Promise<SalesCommissionCalculationView | null> {
    const record = await this.getActivePreviewForOffer(offerId, context);
    if (!record) {
      return null;
    }
    return toSalesCommissionCalculationView(record.result);
  }

  async getAdminViewForOffer(
    offerId: string,
    context: OfferUserContext,
  ): Promise<AdminCommissionCalculationView | null> {
    if (context.role !== 'admin') {
      return null;
    }
    const record = await this.getActivePreviewForOffer(offerId, context);
    if (!record) {
      return null;
    }
    return toAdminCommissionCalculationView(record.result);
  }

  async saveReductionDecision(
    offerId: string,
    context: OfferUserContext,
    reductionAmountCents: number,
    reason: string,
  ): Promise<
    | { ok: true; record: CommissionCalculationRecord }
    | { ok: false; error: 'not_found' | 'forbidden' | 'invalid' | 'exceeds_limit' | 'reason_required' }
  > {
    if (context.role !== 'admin') {
      return { ok: false, error: 'forbidden' };
    }

    if (!reason.trim()) {
      return { ok: false, error: 'reason_required' };
    }

    const record = await this.getActivePreviewForOffer(offerId, context);
    if (!record) {
      return { ok: false, error: 'not_found' };
    }

    const original = record.result.originalCommissionAmountCents;
    const maxReduction = maxAllowedReductionAmountCents(original);

    if (reductionAmountCents < 0 || reductionAmountCents > maxReduction) {
      return { ok: false, error: 'exceeds_limit' };
    }

    const decision: CommissionReductionDecision = {
      id: record.result.reductionDecision?.id ?? generateId('commission_reduction'),
      proposedReductionAmountCents: reductionAmountCents,
      proposedReductionPercentTenths:
        original > 0 ? Math.round((reductionAmountCents * 10000) / original) : 0,
      originalCommissionAmountCents: original,
      remainingCommissionAmountCents: remainingCommissionAfterReduction(original, reductionAmountCents),
      maxAllowedReductionAmountCents: maxReduction,
      status: reductionAmountCents === 0 ? 'rejected' : 'approved',
      adminUserId: context.userId,
      reason: reason.trim(),
      decidedAt: nowIso(),
      pricingDeviationContext: record.result.reductionDecision?.pricingDeviationContext ?? {},
    };

    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    const pricingRecords = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const activePricing = pricingRecords
      .filter((entry) => entry.status === 'draft')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (!activePricing) {
      return { ok: false, error: 'invalid' };
    }

    const catalog = await this.commissionCatalogRepository.getCatalog();
    const input = buildCommissionCalculationInput(
      offer,
      activePricing.id,
      activePricing.result,
      record.result.snapshot.contractTypeCode,
    );

    const result = evaluateCommission(
      input,
      {
        commissionPlans: catalog.commissionPlans,
        commissionPlanVersions: catalog.commissionPlanVersions,
        commissionRules: catalog.commissionRules,
        assignments: catalog.assignments,
      },
      decision,
    );

    const timestamp = nowIso();
    const updated: CommissionCalculationRecord = {
      ...record,
      inputFingerprint: createCommissionCalculationFingerprint(input, decision),
      result,
      updatedAt: timestamp,
    };

    const saved = await this.commissionCalculationRepository.updateCalculation(updated);
    await this.commissionCalculationRepository.createEvent({
      id: generateId('commission_event'),
      commissionCaseId: null,
      commissionCalculationId: saved.id,
      eventType: decision.status === 'approved' ? 'reduction_approved' : 'reduction_rejected',
      previousStatus: 'proposed',
      newStatus: decision.status,
      amountCents: reductionAmountCents,
      currency: result.currency,
      reason: reason.trim(),
      triggeredByUserId: context.userId,
      occurredAt: timestamp,
      metadata: {},
    });

    return { ok: true, record: saved };
  }

  async freezeCalculation(
    offerId: string,
    context: OfferUserContext,
  ): Promise<
    | { ok: true; record: CommissionCalculationRecord }
    | { ok: false; error: 'not_found' | 'forbidden' | 'blocked' | 'stale' }
  > {
    if (context.role !== 'admin') {
      return { ok: false, error: 'forbidden' };
    }

    const record = await this.getActivePreviewForOffer(offerId, context);
    if (!record) {
      return { ok: false, error: 'not_found' };
    }

    if (record.result.stale) {
      return { ok: false, error: 'stale' };
    }

    if (record.result.calculationBlocked || !record.result.canFreeze) {
      return { ok: false, error: 'blocked' };
    }

    const timestamp = nowIso();
    const frozenRecord: CommissionCalculationRecord = {
      ...record,
      status: 'frozen',
      result: {
        ...record.result,
        status: 'frozen',
        snapshot: { ...record.result.snapshot },
      },
      updatedAt: timestamp,
    };

    const saved = await this.commissionCalculationRepository.updateCalculation(frozenRecord);
    await this.commissionCalculationRepository.createCase({
      id: generateId('commission_case'),
      commissionCalculationId: saved.id,
      offerId,
      salesRepresentativeId: saved.result.salesRepresentativeId,
      status: 'expected',
      expectedAmountCents: saved.result.finalExpectedCommissionAmountCents,
      approvedAmountCents: saved.result.finalExpectedCommissionAmountCents,
      settledAmountCents: 0,
      paidAmountCents: 0,
      clawedBackAmountCents: 0,
      currency: saved.result.currency,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.commissionCalculationRepository.createEvent({
      id: generateId('commission_event'),
      commissionCaseId: null,
      commissionCalculationId: saved.id,
      eventType: 'calculation_frozen',
      previousStatus: 'preview',
      newStatus: 'frozen',
      amountCents: saved.result.finalExpectedCommissionAmountCents,
      currency: saved.result.currency,
      reason: 'Provisionsberechnung eingefroren',
      triggeredByUserId: context.userId,
      occurredAt: timestamp,
      metadata: {},
    });

    return { ok: true, record: saved };
  }
}
