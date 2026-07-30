import { buildCustomerNeedFromOffer, applyCostBaselineToNeed } from '../domain/recommendation/buildCustomerNeedFromLead';
import type { RecommendationRecord, RecommendationSelection } from '../domain/recommendation/recommendationRecord';
import { RECOMMENDATION_FINDING_CODES } from '../domain/recommendation/recommendationFinding';
import type { RecommendationWeightSet } from '../domain/recommendation/recommendationWeightSet';
import {
  runBestPayRecommendationEngine,
  type BestPayRecommendationEngineContext,
} from '../domain/recommendationEngine/bestPayRecommendationEngine';
import {
  createRecommendationInputFingerprint,
  hasRecommendationInputChanged,
} from '../domain/recommendationEngine/recommendationFingerprint';
import type { Offer } from '../domain/offer/offer';
import type { User } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { RecommendationRepository } from '../repositories/interfaces/RecommendationRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import type { PricingCatalogRepository } from '../repositories/interfaces/PricingCatalogRepository';
import type { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import {
  CURRENT_COMMISSION_CATALOG_VERSION,
} from './commissionCatalogMigration';
import { CURRENT_PRICING_CATALOG_VERSION } from './pricingCatalogMigration';
import { CURRENT_PRODUCT_CATALOG_VERSION } from './productCatalogMigration';
import { CURRENT_TARIFF_CATALOG_VERSION } from './tariffCatalogMigration';
import { CURRENT_RECOMMENDATION_CATALOG_VERSION } from './recommendationStorageMigration';
import {
  toAdminRecommendationView,
  toSalesRecommendationView,
  toCostBaselineComparisonView,
  type AdminRecommendationView,
  type SalesRecommendationView,
  type CostBaselineComparisonView,
} from './recommendationViews';
import { compareBaselineWithCandidate } from '../domain/billingImportEngine/costBaselineComparison';
import type { BillingImportService } from './billingImportService';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';

export interface RecommendationUserContext {
  userId: string;
  role: User['role'];
}

export type RecommendationServiceResult =
  | { ok: true; record: RecommendationRecord }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'frozen' | 'stale' }
  | { ok: false; error: 'validation'; message: string };

function canAccessOffer(offer: Offer, context: RecommendationUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }
  return offer.createdByUserId === context.userId;
}

function resolvePublishedWeightSet(
  weightSets: RecommendationWeightSet[],
  evaluationDate: string,
): RecommendationWeightSet | null {
  const date = new Date(`${evaluationDate.slice(0, 10)}T00:00:00.000Z`);

  return (
    weightSets
      .filter((set) => set.status === 'published')
      .filter((set) => {
        if (set.validFrom) {
          const from = new Date(`${set.validFrom.slice(0, 10)}T00:00:00.000Z`);
          if (date < from) {
            return false;
          }
        }
        if (set.validUntil) {
          const until = new Date(`${set.validUntil.slice(0, 10)}T00:00:00.000Z`);
          if (date > until) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null
  );
}

function getLatestRecordForOffer(
  records: RecommendationRecord[],
  offerId: string,
): RecommendationRecord | null {
  return (
    records
      .filter((record) => record.offerId === offerId && record.status !== 'superseded')
      .sort((left, right) => right.version - left.version)[0] ?? null
  );
}

export class RecommendationService {
  private readonly recommendationRepository: RecommendationRepository;
  private readonly offerRepository: OfferRepository;
  private readonly leadRepository: LeadRepository;
  private readonly tariffRepository: TariffRepository;
  private readonly productRepository: ProductRepository;
  private readonly pricingCatalogRepository: PricingCatalogRepository;
  private readonly commissionCatalogRepository: LocalCommissionCatalogRepository;
  private readonly billingImportService: BillingImportService | null;

  constructor(
    recommendationRepository: RecommendationRepository,
    offerRepository: OfferRepository,
    leadRepository: LeadRepository,
    tariffRepository: TariffRepository,
    productRepository: ProductRepository,
    pricingCatalogRepository: PricingCatalogRepository,
    commissionCatalogRepository: LocalCommissionCatalogRepository,
    billingImportService: BillingImportService | null = null,
  ) {
    this.recommendationRepository = recommendationRepository;
    this.offerRepository = offerRepository;
    this.leadRepository = leadRepository;
    this.tariffRepository = tariffRepository;
    this.productRepository = productRepository;
    this.pricingCatalogRepository = pricingCatalogRepository;
    this.commissionCatalogRepository = commissionCatalogRepository;
    this.billingImportService = billingImportService;
  }

  private async getAccessibleOffer(
    offerId: string,
    context: RecommendationUserContext,
  ): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer || !canAccessOffer(offer, context)) {
      return null;
    }
    return offer;
  }

  private resolveCostBaselineForOffer(
    offer: Offer,
    context: RecommendationUserContext,
  ): import('../domain/billingImport/customerCostBaseline').CustomerCostBaseline | null {
    if (!this.billingImportService) {
      return null;
    }
    return this.billingImportService.getActiveBaselineForOffer(offer.id, context);
  }

  private buildNeedWithBaseline(
    offer: Offer,
    lead: import('../domain/lead/lead').Lead | null,
    context: RecommendationUserContext,
  ) {
    let need = buildCustomerNeedFromOffer(offer, lead, offer.createdByUserId);
    const baseline = this.resolveCostBaselineForOffer(offer, context);
    if (baseline && baseline.status === 'confirmed') {
      need = applyCostBaselineToNeed(need, baseline);
    } else if (offer.recommendationLink.costBaselineId) {
      need = {
        ...need,
        costBaselineId: offer.recommendationLink.costBaselineId,
        costBaselineVersion: offer.recommendationLink.costBaselineVersion,
      };
    }
    return need;
  }

  private async buildEngineContext(
    need: ReturnType<typeof buildCustomerNeedFromOffer>,
    weightSet: RecommendationWeightSet | null,
  ): Promise<BestPayRecommendationEngineContext> {
    const [tariffs, products, pricingCatalog, commissionCatalog] = await Promise.all([
      this.tariffRepository.getAll(),
      this.productRepository.getAll(),
      this.pricingCatalogRepository.getCatalog(),
      this.commissionCatalogRepository.getCatalog(),
    ]);

    return {
      catalog: {
        tariffs,
        products,
        contractTerms: pricingCatalog.contractTerms,
      },
      tariffs,
      products,
      pricingCatalog: {
        priceBookVersions: pricingCatalog.priceBookVersions,
        priceRules: pricingCatalog.priceRules,
        contractTerms: pricingCatalog.contractTerms,
      },
      commissionCatalog: {
        commissionPlanVersions: commissionCatalog.commissionPlanVersions,
        commissionPlans: commissionCatalog.commissionPlans,
        commissionRules: commissionCatalog.commissionRules,
        assignments: commissionCatalog.assignments,
      },
      weightSet,
      catalogVersions: {
        tariffCatalogVersion:
          readStorageItem<number>(STORAGE_KEYS.tariffCatalogVersion) ??
          CURRENT_TARIFF_CATALOG_VERSION,
        productCatalogVersion:
          readStorageItem<number>(STORAGE_KEYS.productCatalogVersion) ??
          CURRENT_PRODUCT_CATALOG_VERSION,
        pricingCatalogVersion:
          readStorageItem<number>(STORAGE_KEYS.pricingCatalogVersion) ??
          CURRENT_PRICING_CATALOG_VERSION,
        commissionCatalogVersion:
          readStorageItem<number>(STORAGE_KEYS.commissionCatalogVersion) ??
          CURRENT_COMMISSION_CATALOG_VERSION,
        recommendationCatalogVersion:
          readStorageItem<number>(STORAGE_KEYS.recommendationCatalogVersion) ??
          CURRENT_RECOMMENDATION_CATALOG_VERSION,
      },
      costBaselineId: need.costBaselineId,
      costBaselineVersion: need.costBaselineVersion,
    };
  }

  async calculateForOffer(
    offerId: string,
    context: RecommendationUserContext,
  ): Promise<RecommendationServiceResult> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    if (offer.status !== 'draft') {
      return { ok: false, error: 'frozen' };
    }

    const lead = offer.leadId ? await this.leadRepository.getById(offer.leadId) : null;
    const need = this.buildNeedWithBaseline(offer, lead, context);
    const weightSets = await this.recommendationRepository.getWeightSets();
    const weightSet = resolvePublishedWeightSet(weightSets, need.evaluationDate);
    const engineContext = await this.buildEngineContext(need, weightSet);
    const result = runBestPayRecommendationEngine(need, engineContext);

    const records = await this.recommendationRepository.getRecords();
    const existing = getLatestRecordForOffer(records, offerId);
    const version = existing ? existing.version + 1 : 1;

    if (existing && existing.status !== 'superseded') {
      await this.recommendationRepository.saveRecord({
        ...existing,
        status: 'superseded',
        supersededAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const record: RecommendationRecord = {
      id: generateId('recommendation_record'),
      leadId: need.leadId,
      offerId,
      version,
      status: result.status,
      inputFingerprint: result.inputFingerprint,
      snapshot: result.snapshot,
      primaryCandidateId: result.primaryCandidate?.candidateId ?? null,
      selectedCandidateId: existing?.selectedCandidateId ?? null,
      selection: existing?.selection ?? null,
      createdByUserId: context.userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      frozenAt: null,
      supersededAt: null,
    };

    await this.recommendationRepository.saveRecord(record);
    return { ok: true, record };
  }

  async calculateForStandaloneNeed(
    need: import('../domain/recommendation/customerNeed').CustomerNeed,
    context: RecommendationUserContext,
  ): Promise<
    | {
        ok: true;
        record: RecommendationRecord;
        result: import('../domain/recommendation/recommendationResult').BestPayRecommendationResult;
      }
    | { ok: false; error: 'storage' | 'forbidden' }
  > {
    if (context.role !== 'admin' && context.role !== 'field_service') {
      return { ok: false, error: 'forbidden' };
    }

    const weightSets = await this.recommendationRepository.getWeightSets();
    const weightSet = resolvePublishedWeightSet(weightSets, need.evaluationDate);
    const engineContext = await this.buildEngineContext(need, weightSet);
    const result = runBestPayRecommendationEngine(need, engineContext);

    const records = await this.recommendationRepository.getRecords();
    const related = records
      .filter(
        (entry) =>
          entry.offerId === null &&
          entry.leadId === need.leadId &&
          entry.createdByUserId === context.userId &&
          entry.status !== 'superseded',
      )
      .sort((left, right) => right.version - left.version)[0];

    const version = related ? related.version + 1 : 1;
    if (related) {
      await this.recommendationRepository.saveRecord({
        ...related,
        status: 'superseded',
        supersededAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const record: RecommendationRecord = {
      id: generateId('recommendation_record'),
      leadId: need.leadId,
      offerId: null,
      version,
      status: result.status,
      inputFingerprint: result.inputFingerprint,
      snapshot: result.snapshot,
      primaryCandidateId: result.primaryCandidate?.candidateId ?? null,
      selectedCandidateId: result.primaryCandidate?.candidateId ?? null,
      selection: null,
      createdByUserId: context.userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      frozenAt: null,
      supersededAt: null,
    };

    await this.recommendationRepository.saveRecord(record);
    return { ok: true, record, result };
  }

  private async resolveStaleState(
    record: RecommendationRecord,
    offer: Offer,
    context: RecommendationUserContext,
  ): Promise<boolean> {
    const lead = offer.leadId ? await this.leadRepository.getById(offer.leadId) : null;
    const need = this.buildNeedWithBaseline(offer, lead, context);
    const weightSets = await this.recommendationRepository.getWeightSets();
    const weightSet = resolvePublishedWeightSet(weightSets, need.evaluationDate);

    const fingerprint = createRecommendationInputFingerprint({
      need,
      tariffCatalogVersion:
        readStorageItem<number>(STORAGE_KEYS.tariffCatalogVersion) ??
        CURRENT_TARIFF_CATALOG_VERSION,
      productCatalogVersion:
        readStorageItem<number>(STORAGE_KEYS.productCatalogVersion) ??
        CURRENT_PRODUCT_CATALOG_VERSION,
      pricingCatalogVersion:
        readStorageItem<number>(STORAGE_KEYS.pricingCatalogVersion) ??
        CURRENT_PRICING_CATALOG_VERSION,
      commissionCatalogVersion:
        readStorageItem<number>(STORAGE_KEYS.commissionCatalogVersion) ??
        CURRENT_COMMISSION_CATALOG_VERSION,
      weightSet,
      costBaselineId: need.costBaselineId,
      costBaselineVersion: need.costBaselineVersion,
    });

    return hasRecommendationInputChanged(record.inputFingerprint, fingerprint);
  }

  async getSalesViewForOffer(
    offerId: string,
    context: RecommendationUserContext,
  ): Promise<SalesRecommendationView | null> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const records = await this.recommendationRepository.getRecords();
    const record = getLatestRecordForOffer(records, offerId);
    if (!record) {
      return toSalesRecommendationView({
        recordId: null,
        version: null,
        result: null,
        stale: false,
        selection: {
          selectedCandidateId: offer.recommendationLink.selectedCandidateId,
          selectionType: offer.recommendationLink.selectionType,
          isDeviation: Boolean(offer.recommendationLink.deviationReason),
          deviationReason: offer.recommendationLink.deviationReason,
        },
        canApplySelection: offer.status === 'draft',
      });
    }

    const stale = await this.resolveStaleState(record, offer, context);
    const baseline = this.resolveCostBaselineForOffer(offer, context);
    const result = this.recordToResult(record);
    let costBaselineComparison: CostBaselineComparisonView | null = null;
    if (baseline && result.primaryCandidate) {
      costBaselineComparison = toCostBaselineComparisonView(
        compareBaselineWithCandidate(baseline, result.primaryCandidate),
      );
    }

    return toSalesRecommendationView({
      recordId: record.id,
      version: record.version,
      result,
      stale,
      selection: {
        selectedCandidateId:
          record.selectedCandidateId ?? offer.recommendationLink.selectedCandidateId,
        selectionType: record.selection?.selectionType ?? offer.recommendationLink.selectionType,
        isDeviation: record.selection?.isDeviation ?? Boolean(offer.recommendationLink.deviationReason),
        deviationReason:
          record.selection?.deviationReason ?? offer.recommendationLink.deviationReason,
      },
      canApplySelection: offer.status === 'draft' && !stale && record.status !== 'frozen',
      costBaselineComparison,
    });
  }

  async getAdminViewForOffer(
    offerId: string,
    context: RecommendationUserContext,
  ): Promise<AdminRecommendationView | null> {
    if (context.role !== 'admin') {
      return null;
    }

    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const records = await this.recommendationRepository.getRecords();
    const record = getLatestRecordForOffer(records, offerId);
    if (!record) {
      return toAdminRecommendationView({
        recordId: null,
        version: null,
        result: null,
        stale: false,
      });
    }

    const stale = await this.resolveStaleState(record, offer, context);
    return toAdminRecommendationView({
      recordId: record.id,
      version: record.version,
      result: this.recordToResult(record),
      stale,
    });
  }

  private recordToResult(
    record: RecommendationRecord,
  ): import('../domain/recommendation/recommendationResult').BestPayRecommendationResult {
    const snapshot = record.snapshot;
    const scoredCandidates = snapshot.candidates.map((candidate) => ({
      candidate,
      scoreBreakdown: snapshot.scoreBreakdowns[candidate.candidateId] ?? {
        eligibilityScore: 0,
        needFitScore: 0,
        costScore: 0,
        termScore: 0,
        hardwareScore: 0,
        riskScore: 0,
        completenessScore: 0,
        internalBusinessScore: 0,
        totalScore: 0,
      },
    }));

    const primaryCandidate =
      snapshot.candidates.find(
        (candidate) => candidate.candidateId === snapshot.primaryCandidateId,
      ) ?? null;

    return {
      recommendationId: record.id,
      engineVersion: snapshot.engineVersion,
      createdAt: snapshot.evaluatedAt,
      leadId: record.leadId,
      offerId: record.offerId,
      inputFingerprint: snapshot.inputFingerprint,
      status: record.status,
      normalizedNeed: snapshot.normalizedNeed,
      needCompleteness: {
        isComplete: true,
        missingFields: [],
        warnings: [],
      },
      scoredCandidates,
      blockedCandidates: snapshot.blockedCandidates,
      excludedCandidates: snapshot.excludedCandidates,
      primaryCandidate,
      primaryRank: primaryCandidate?.rank ?? null,
      primaryReasons: snapshot.reasons,
      primaryAdvantages: snapshot.reasons.filter((r) => r.isPositive).map((r) => r.customerFacingText),
      primaryLimitations: snapshot.reasons.filter((r) => !r.isPositive).map((r) => r.customerFacingText),
      requiredReviews: [],
      alternatives: snapshot.alternativeCandidateIds
        .map((candidateId, index) => {
          const candidate = snapshot.candidates.find((entry) => entry.candidateId === candidateId);
          if (!candidate) {
            return null;
          }
          return {
            candidate,
            rank: candidate.rank ?? index + 2,
            mainDifference: 'Alternative BestPay-Konfiguration',
            costDifferenceCents: null,
            termDifferenceMonths: null,
            hardwareDifference: null,
            riskLabel: candidate.pricingEvaluation?.reviewClass ?? 'unbekannt',
            suitabilityHint: 'Alternative',
            reasons: [],
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      findings: snapshot.findings,
      snapshot,
      stale: record.status === 'stale',
    };
  }

  async applyCandidateSelection(
    offerId: string,
    candidateId: string,
    context: RecommendationUserContext,
    options: {
      selectionType: 'primary' | 'alternative';
      deviationReason?: string;
    },
  ): Promise<RecommendationServiceResult> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    if (offer.status !== 'draft') {
      return { ok: false, error: 'frozen' };
    }

    const records = await this.recommendationRepository.getRecords();
    const record = getLatestRecordForOffer(records, offerId);
    if (!record) {
      return { ok: false, error: 'not_found' };
    }

    const stale = await this.resolveStaleState(record, offer, context);
    if (stale || record.status === 'stale') {
      return { ok: false, error: 'stale' };
    }

    const allowedCandidates = [
      ...record.snapshot.candidates,
    ];
    const selected = allowedCandidates.find((candidate) => candidate.candidateId === candidateId);

    if (!selected || selected.status === 'blocked' || selected.status === 'excluded') {
      return {
        ok: false,
        error: 'validation',
        message: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_OVERRIDE_NOT_ALLOWED,
      };
    }

    const isPrimary = record.primaryCandidateId === candidateId;
    const isDeviation = options.selectionType === 'alternative' || !isPrimary;
    const deviationReason = (options.deviationReason ?? '').trim();

    if (isDeviation && !deviationReason) {
      return {
        ok: false,
        error: 'validation',
        message: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_OVERRIDE_REASON_REQUIRED,
      };
    }

    const selection: RecommendationSelection = {
      recommendationRecordId: record.id,
      recommendationVersion: record.version,
      selectedCandidateId: candidateId,
      selectionType: isPrimary && options.selectionType === 'primary' ? 'primary' : 'alternative',
      isDeviation,
      deviationReason,
      selectedByUserId: context.userId,
      selectedAt: nowIso(),
    };

    const updatedRecord: RecommendationRecord = {
      ...record,
      selectedCandidateId: candidateId,
      selection,
      updatedAt: nowIso(),
    };

    await this.recommendationRepository.saveRecord(updatedRecord);

    const updatedOffer: Offer = {
      ...offer,
      recommendationLink: {
        ...offer.recommendationLink,
        recommendationRecordId: record.id,
        recommendationVersion: record.version,
        selectedCandidateId: candidateId,
        selectionType: selection.selectionType,
        deviationReason,
      },
      tariffSnapshot: await this.buildTariffSnapshotFromCandidate(selected),
      updatedAt: nowIso(),
    };

    await this.offerRepository.update(updatedOffer);
    return { ok: true, record: updatedRecord };
  }

  private async buildTariffSnapshotFromCandidate(
    candidate: import('../domain/recommendation/bestPaySolutionCandidate').BestPaySolutionCandidate,
  ): Promise<Offer['tariffSnapshot']> {
    const tariff = await this.tariffRepository.getById(candidate.tariffId);
    if (!tariff) {
      return null;
    }

    const { createTariffSnapshotFromTariff } = await import('../domain/offer/offerSnapshots');
    const snapshot = createTariffSnapshotFromTariff(tariff);
    return {
      ...snapshot,
      contractDurationMonths: candidate.contractTermMonths,
    };
  }

  async getWeightSets(context: RecommendationUserContext): Promise<RecommendationWeightSet[]> {
    if (context.role !== 'admin') {
      return [];
    }
    return this.recommendationRepository.getWeightSets();
  }
}
