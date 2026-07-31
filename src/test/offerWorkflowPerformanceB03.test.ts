import { beforeEach, describe, expect, it } from 'vitest';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import type { Offer } from '../domain/offer/offer';
import type { OfferVersion } from '../domain/offer/offerVersion';
import type { OfferWorkflowEvent } from '../domain/offer/offerWorkflowEvents';
import { deriveSalesPipelinePhase } from '../domain/salesWorkspace/salesPipeline';
import type { SalesDocument } from '../domain/salesDocument/salesDocument';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
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
import { generateId } from '../utils/id';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  createTestOffer,
  FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';

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
      const workspace = new SalesWorkspaceService(
        new LocalLeadRepository(),
        offerRepository,
        new LocalSalesTaskRepository(),
        new LocalSalesActivityRepository(),
        taskService,
        activityService,
      );

      const allOffers = await offerRepository.getAll();
      expect(allOffers.length).toBeGreaterThanOrEqual(OFFER_COUNT);

      const filtered = offerService.filterOffers(
        allOffers,
        { search: 'BP-ANG', status: 'all', workflowStatus: 'all', owner: 'all' },
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
});
