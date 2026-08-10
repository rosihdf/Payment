import { beforeEach, describe, expect, it } from 'vitest';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import type { Offer } from '../domain/offer/offer';
import type { OfferVersion } from '../domain/offer/offerVersion';
import type { OfferWorkflowEvent } from '../domain/offer/offerWorkflowEvents';
import { deriveSalesPipelinePhase } from '../domain/salesWorkspace/salesPipeline';
import type { SalesDocument } from '../domain/salesDocument/salesDocument';
import type { OfferListQuery } from '../domain/offer/offerListItem';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalPricingEvaluationRepository } from '../repositories/local/LocalPricingEvaluationRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { clearDemoDataForTests, getDemoLeads, resetDemoDataForTests } from '../services/demoDataService';
import { OfferService } from '../services/offerService';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import { SalesWorkspaceService } from '../services/salesWorkspaceService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { generateId } from '../utils/id';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  createTestOffer,
  FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';

class CountingOfferRepository extends LocalOfferRepository {
  getAllCalls = 0;
  listItemsCalls = 0;
  getByLeadIdCalls = 0;

  override async getAll() {
    this.getAllCalls += 1;
    return super.getAll();
  }

  override async listItems(query?: OfferListQuery) {
    this.listItemsCalls += 1;
    return super.listItems(query);
  }

  override async getByLeadId(leadId: string) {
    this.getByLeadIdCalls += 1;
    return super.getByLeadId(leadId);
  }
}

class CountingLeadRepository extends LocalLeadRepository {
  getAllCalls = 0;
  getByIdCalls = 0;

  override async getAll() {
    this.getAllCalls += 1;
    return super.getAll();
  }

  override async getById(id: string) {
    this.getByIdCalls += 1;
    return super.getById(id);
  }
}

class CountingPricingEvaluationRepository extends LocalPricingEvaluationRepository {
  getAllCalls = 0;
  getByOfferIdCalls = 0;

  override async getAll() {
    this.getAllCalls += 1;
    return super.getAll();
  }

  override async getByOfferId(offerId: string) {
    this.getByOfferIdCalls += 1;
    return super.getByOfferId(offerId);
  }
}

function seedDraftPricingEvaluations(offers: Offer[]): void {
  const records = offers
    .filter((offer) => offer.workflowStatus === 'draft')
    .slice(0, 50)
    .map((offer, index) => ({
      id: `perf_pricing_${index}`,
      offerId: offer.id,
      status: 'submitted',
      inputFingerprint: `fp_${offer.id}`,
      result: {
        evaluationId: `eval_${offer.id}`,
        evaluatedAt: '2026-01-15T10:00:00.000Z',
        engineVersion: 'test',
        inputFingerprint: `fp_${offer.id}`,
        approval: {
          adminReviewRequired: true,
          approvalBlocked: false,
        },
        stale: false,
      },
      createdByUserId: offer.createdByUserId,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    }));
  writeStorageItem(STORAGE_KEYS.pricingEvaluations, records);
}

const OFFER_COUNT = 500;
const VERSIONS_PER_OFFER = 4;
const WORKFLOW_STATUSES: Offer['workflowStatus'][] = [
  'draft', 'approval_required', 'sent', 'accepted', 'activation_pending', 'activated',
];

function seedPerformanceDataset(): { offers: Offer[]; versions: OfferVersion[]; events: OfferWorkflowEvent[]; documents: SalesDocument[] } {
  const leads = getDemoLeads();
  const offers: Offer[] = [];
  const versions: OfferVersion[] = [];
  const events: OfferWorkflowEvent[] = [];
  const documents: SalesDocument[] = [];
  const timestamp = '2026-01-15T10:00:00.000Z';

  for (let index = 0; index < OFFER_COUNT; index += 1) {
    const lead = leads[index % leads.length]!;
    const workflowStatus = WORKFLOW_STATUSES[index % WORKFLOW_STATUSES.length]!;
    const offer = createTestOffer({
      id: `perf_offer_${index}`,
      offerNumber: `BP-ANG-2026-${String(index + 1).padStart(4, '0')}`,
      leadId: lead.id,
      createdByUserId: index % 2 === 0 ? 'user_001' : 'user_002',
      workflowStatus,
      status: ['accepted', 'activation_pending', 'activated'].includes(workflowStatus) ? 'completed' : 'draft',
      currentVersionNumber: VERSIONS_PER_OFFER,
      currentVersionId: `perf_version_${index}_${VERSIONS_PER_OFFER}`,
    });

    offers.push(offer);

    for (let versionNumber = 1; versionNumber <= VERSIONS_PER_OFFER; versionNumber += 1) {
      const versionId = `perf_version_${index}_${versionNumber}`;
      versions.push({
        id: versionId,
        offerId: offer.id,
        versionNumber,
        workflowStatus,
        snapshot: buildOfferVersionSnapshot(offer, undefined, versionNumber),
        createdAt: timestamp,
        createdByUserId: offer.createdByUserId,
        createdByDisplayName: offer.createdByDisplayName,
        approvedAt: versionNumber === VERSIONS_PER_OFFER ? timestamp : null,
        approvedByUserId: versionNumber === VERSIONS_PER_OFFER ? 'user_002' : null,
        sentAt: null,
        acceptedAt: null,
        declinedAt: null,
        activatedAt: null,
        supersededAt: versionNumber < VERSIONS_PER_OFFER ? timestamp : null,
      });
    }

    events.push({
      id: generateId('offer_approval'),
      schemaVersion: 1,
      type: 'approval',
      status: 'approved',
      offerId: offer.id,
      offerVersionId: offer.currentVersionId,
      createdAt: timestamp,
      createdByUserId: 'user_002',
      createdByDisplayName: 'Thomas',
      note: '',
      requestedByUserId: offer.createdByUserId,
      approvedByUserId: 'user_002',
    });
    events.push({
      id: generateId('offer_dispatch'),
      schemaVersion: 1,
      type: 'dispatch',
      offerId: offer.id,
      offerVersionId: offer.currentVersionId,
      createdAt: timestamp,
      createdByUserId: offer.createdByUserId,
      createdByDisplayName: offer.createdByDisplayName,
      note: '',
      channel: 'email',
      recipient: 'kunde@example.test',
      sentAt: timestamp,
    });
    events.push({
      id: generateId('offer_acceptance'),
      schemaVersion: 1,
      type: 'acceptance',
      offerId: offer.id,
      offerVersionId: offer.currentVersionId,
      createdAt: timestamp,
      createdByUserId: offer.createdByUserId,
      createdByDisplayName: offer.createdByDisplayName,
      note: '',
      acceptedAt: timestamp,
      acceptedByName: 'Kunde',
      acceptanceType: 'email_confirmation',
      otherText: null,
    });
    events.push({
      id: generateId('offer_activation'),
      schemaVersion: 1,
      type: 'activation',
      status: 'prepared',
      offerId: offer.id,
      offerVersionId: offer.currentVersionId,
      createdAt: timestamp,
      createdByUserId: offer.createdByUserId,
      createdByDisplayName: offer.createdByDisplayName,
      note: '',
      checklist: { offerVersionId: offer.currentVersionId ?? '', checks: { contract: true } },
      activatedAt: null,
      externalReference: null,
      deviations: [],
      activatedHardware: [],
    });

    for (let docIndex = 0; docIndex < 4; docIndex += 1) {
      documents.push({
        id: generateId('sales_document'),
        schemaVersion: 1,
        offerId: offer.id,
        offerVersionId: offer.currentVersionId,
        contractId: null,
        contractVersionId: null,
        terminationId: null,
        activationId: null,
        type: 'offer_pdf',
        fileName: `angebot-${index}-${docIndex}.pdf`,
        mimeType: 'application/pdf',
        externalReference: `https://example.invalid/${offer.id}/${docIndex}`,
        checksum: null,
        createdAt: timestamp,
        createdByUserId: offer.createdByUserId,
        createdByDisplayName: offer.createdByDisplayName,
      });
    }
  }

  return { offers, versions, events, documents };
}

function writePerformanceDataset(): void {
  const { offers, versions, events, documents } = seedPerformanceDataset();
  writeStorageItem(STORAGE_KEYS.offers, offers);
  writeStorageItem(STORAGE_KEYS.offerVersions, versions);
  writeStorageItem(STORAGE_KEYS.offerApprovals, events.filter((event) => event.type === 'approval'));
  writeStorageItem(STORAGE_KEYS.offerDispatches, events.filter((event) => event.type === 'dispatch'));
  writeStorageItem(STORAGE_KEYS.offerAcceptances, events.filter((event) => event.type === 'acceptance'));
  writeStorageItem(STORAGE_KEYS.offerActivations, events.filter((event) => event.type === 'activation'));
  writeStorageItem(STORAGE_KEYS.offerDeclines, []);
  writeStorageItem(STORAGE_KEYS.salesDocuments, documents);
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, 3);
  writeStorageItem(STORAGE_KEYS.offerWorkflowStorageVersion, 1);
}

describe('B03 Angebotsworkflow Performance', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
    writePerformanceDataset();
  });

  it(
    'filtert Angebote, leitet Pipeline-Phasen ab und berechnet Dashboard-Kennzahlen',
    async () => {
      const offerRepository = new LocalOfferRepository();
      const offerService = new OfferService(
        offerRepository,
        new LocalLeadRepository(),
        new LocalTariffRepository(),
        new LocalProductRepository(),
      );
      const taskService = new SalesTaskService(new LocalSalesTaskRepository());
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      taskService.setActivityService(activityService);
      const repos = createTestRepositories();
      const workspace = new SalesWorkspaceService(
        repos.leadRepository,
        offerRepository,
        repos.salesTaskRepository,
        repos.salesActivityRepository,
        taskService,
        activityService,
        repos.bestPayComparisonRepository,
        repos.commissionCalculationRepository,
        repos.pricingEvaluationRepository,
        repos.contractRepository,
        repos.activationCaseRepository,
        repos.activationBlockerRepository,
        repos.offerCustomerQuestionRepository,
        repos.offerChangeRequestRepository,
      );

      const allOffers = await offerRepository.getAll();
      expect(allOffers.length).toBeGreaterThanOrEqual(OFFER_COUNT);

      const filtered = offerService.filterOffers(
        allOffers,
        { search: 'BP-ANG', phase: 'all', owner: 'all', status: 'all', workflowStatus: 'all' },
        FIELD_SERVICE_CONTEXT,
      );
      expect(filtered.length).toBeGreaterThan(0);

      const leads = getDemoLeads();
      const phases = new Set<string>();
      for (const lead of leads) {
        const leadOffers = allOffers.filter((offer) => offer.leadId === lead.id);
        if (!leadOffers.length) {
          continue;
        }
        phases.add(
          deriveSalesPipelinePhase({
            lead,
            sessions: [],
            offers: leadOffers,
            tasks: [],
            activities: [],
            commissionCaseStatus: null,
            approvalRequired: leadOffers.some((offer) =>
              ['approval_required', 'in_approval'].includes(offer.workflowStatus),
            ),
            approvalBlocked: false,
          }),
        );
      }
      expect(phases.size).toBeGreaterThan(0);

      const view = await workspace.getWorkspaceView(FIELD_SERVICE_CONTEXT, { scope: 'mine' });
      expect(view.metrics.openLeads).toBeGreaterThanOrEqual(0);
      expect(view.metrics.offersInApproval).toBeGreaterThanOrEqual(0);
      expect(Object.keys(view.pipeline).length).toBeGreaterThan(0);

      const versions = JSON.parse(localStorage.getItem(STORAGE_KEYS.offerVersions) ?? '[]') as unknown[];
      const storedEvents = [
        STORAGE_KEYS.offerApprovals,
        STORAGE_KEYS.offerDispatches,
        STORAGE_KEYS.offerAcceptances,
        STORAGE_KEYS.offerActivations,
      ].flatMap((key) => JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]);
      const storedDocuments = JSON.parse(localStorage.getItem(STORAGE_KEYS.salesDocuments) ?? '[]') as unknown[];

      expect(versions.length).toBeGreaterThanOrEqual(OFFER_COUNT * VERSIONS_PER_OFFER);
      expect(storedEvents.length).toBeGreaterThanOrEqual(2000);
      expect(storedDocuments.length).toBeGreaterThanOrEqual(2000);
    },
    60_000,
  );

  it('P1: Angebotsliste nutzt listItems statt getAll und ohne N× Lead-Lookups', async () => {
    const offerRepository = new CountingOfferRepository();
    const leadRepository = new CountingLeadRepository();
    const offerService = new OfferService(
      offerRepository,
      leadRepository,
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );

    const items = await offerService.getOfferListItems(FIELD_SERVICE_CONTEXT);
    expect(items.length).toBeGreaterThan(0);
    expect(offerRepository.listItemsCalls).toBe(1);
    expect(offerRepository.getAllCalls).toBe(0);
    expect(leadRepository.getAllCalls).toBe(1);
    expect(leadRepository.getByIdCalls).toBe(0);
  });

  it('P2: getOffersForLead lädt nur Angebote des Leads', async () => {
    const offerRepository = new CountingOfferRepository();
    const leadRepository = new CountingLeadRepository();
    const offerService = new OfferService(
      offerRepository,
      leadRepository,
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );
    const leadId = getDemoLeads()[0]!.id;

    const offers = await offerService.getOffersForLead(leadId, FIELD_SERVICE_CONTEXT);
    expect(offers.length).toBeGreaterThan(0);
    expect(offerRepository.getByLeadIdCalls).toBe(1);
    expect(offerRepository.getAllCalls).toBe(0);
    expect(leadRepository.getByIdCalls).toBe(1);
  });

  it('P3: Workspace prüft Draft-Freigaben per Batch statt N× getByOfferId', async () => {
    const { offers } = seedPerformanceDataset();
    seedDraftPricingEvaluations(offers);
    const offerRepository = new LocalOfferRepository();
    const pricingEvaluationRepository = new CountingPricingEvaluationRepository();
    const taskService = new SalesTaskService(new LocalSalesTaskRepository());
    const activityService = new SalesActivityService(new LocalSalesActivityRepository());
    taskService.setActivityService(activityService);
    const repos = createTestRepositories();
    const workspace = new SalesWorkspaceService(
      repos.leadRepository,
      offerRepository,
      repos.salesTaskRepository,
      repos.salesActivityRepository,
      taskService,
      activityService,
      repos.bestPayComparisonRepository,
      repos.commissionCalculationRepository,
      pricingEvaluationRepository,
      repos.contractRepository,
      repos.activationCaseRepository,
      repos.activationBlockerRepository,
      repos.offerCustomerQuestionRepository,
      repos.offerChangeRequestRepository,
    );

    await workspace.getWorkspaceView(FIELD_SERVICE_CONTEXT, { scope: 'mine' });

    expect(pricingEvaluationRepository.getAllCalls).toBe(1);
    expect(pricingEvaluationRepository.getByOfferIdCalls).toBe(0);
  });
});
