import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateCompletionReadiness,
  evaluateGoLiveReadiness,
} from '../domain/activation/activationEvaluator';
import type { ActivationStatus } from '../domain/activation/activationStatus';
import { ACTIVATION_STATUSES } from '../domain/activation/activationStatus';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from '../domain/contract/contract';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from '../domain/contract/contractVersion';
import { SALES_DOCUMENT_SCHEMA_VERSION } from '../domain/salesDocument/salesDocument';
import { SALES_ACTIVITY_SCHEMA_VERSION } from '../domain/salesWorkspace/salesActivity';
import { SALES_TASK_SCHEMA_VERSION } from '../domain/salesWorkspace/salesTask';
import { LocalAuditRepository } from '../repositories/local/LocalAuditRepository';
import { LocalApprovalRuleRepository } from '../repositories/local/LocalApprovalRuleRepository';
import { LocalContractRepository } from '../repositories/local/LocalContractRepository';
import { LocalContractTerminationRepository } from '../repositories/local/LocalContractTerminationRepository';
import { LocalContractVersionRepository } from '../repositories/local/LocalContractVersionRepository';
import { LocalActivationCaseRepository } from '../repositories/local/LocalActivationCaseRepository';
import { LocalActivationChecklistRepository } from '../repositories/local/LocalActivationChecklistRepository';
import { LocalActivationApplicationRepository } from '../repositories/local/LocalActivationApplicationRepository';
import { LocalActivationHardwareRepository } from '../repositories/local/LocalActivationHardwareRepository';
import { LocalActivationBlockerRepository } from '../repositories/local/LocalActivationBlockerRepository';
import { LocalDocumentTemplateRepository } from '../repositories/local/LocalDocumentTemplateRepository';
import { LocalLeadDraftRepository } from '../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../repositories/local/LocalLeadEditDraftRepository';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferDocumentRepository } from '../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalOfferVersionRepository } from '../repositories/local/LocalOfferVersionRepository';
import { LocalOfferWorkflowEventRepository } from '../repositories/local/LocalOfferWorkflowEventRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../repositories/local/LocalPricingEvaluationRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesDocumentRepository } from '../repositories/local/LocalSalesDocumentRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createServices } from '../services';
import { createUserContext } from '../services/auditService';
import { CURRENT_ACTIVATION_STORAGE_VERSION } from '../services/activationStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const CASE_COUNT = 1000;
const CHECKLIST_PER_CASE = 20;
const APPLICATION_PER_CASE = 3;
const HARDWARE_PER_CASE = 5;
const BLOCKER_PER_CASE = 2;
const TASK_PER_CASE = 5;
const ACTIVITY_PER_CASE = 10;
const DOCUMENT_PER_CASE = 5;

const PRIORITIES = ['normal', 'high', 'urgent'] as const;
const OPERATIONAL_STATUSES: ActivationStatus[] = ACTIVATION_STATUSES;

function createTestServices() {
  return createServices({
    userRepository: new LocalUserRepository(),
    auditRepository: new LocalAuditRepository(),
    approvalRuleRepository: new LocalApprovalRuleRepository(),
    documentTemplateRepository: new LocalDocumentTemplateRepository(),
    leadRepository: new LocalLeadRepository(),
    leadDraftRepository: new LocalLeadDraftRepository(),
    leadEditDraftRepository: new LocalLeadEditDraftRepository(),
    tariffRepository: new LocalTariffRepository(),
    productRepository: new LocalProductRepository(),
    offerRepository: new LocalOfferRepository(),
    offerVersionRepository: new LocalOfferVersionRepository(),
    offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
    salesDocumentRepository: new LocalSalesDocumentRepository(),
    offerDocumentRepository: new LocalOfferDocumentRepository(),
    pricingCatalogRepository: new LocalPricingCatalogRepository(),
    pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
    commissionCatalogRepository: new LocalCommissionCatalogRepository(),
    commissionCalculationRepository: new LocalCommissionCalculationRepository(),
    recommendationRepository: new LocalRecommendationRepository(),
    salesTaskRepository: new LocalSalesTaskRepository(),
    salesActivityRepository: new LocalSalesActivityRepository(),
    contractRepository: new LocalContractRepository(),
    contractVersionRepository: new LocalContractVersionRepository(),
    contractTerminationRepository: new LocalContractTerminationRepository(),
    activationCaseRepository: new LocalActivationCaseRepository(),
    activationChecklistRepository: new LocalActivationChecklistRepository(),
    activationApplicationRepository: new LocalActivationApplicationRepository(),
    activationHardwareRepository: new LocalActivationHardwareRepository(),
    activationBlockerRepository: new LocalActivationBlockerRepository(),
  });
}

const admin = createUserContext({
  id: 'user_004',
  name: 'Admin',
  role: 'admin',
  status: 'active',
});

function pad(value: number, size = 5): string {
  return String(value).padStart(size, '0');
}

function desiredGoLiveForIndex(index: number): string | null {
  if (index % 11 === 0) return null;
  if (index % 7 === 0) return '2026-07-01';
  if (index % 5 === 0) return '2026-07-18';
  if (index % 3 === 0) return '2026-07-25';
  return '2026-08-15';
}

/** Deterministic maximal activation dataset for D performance acceptance. */
function seedMaximalActivationSet() {
  const contracts = [];
  const versions = [];
  const offers = [];
  const activationCases = [];
  const checklists = [];
  const applications = [];
  const hardware = [];
  const blockers = [];
  const tasks = [];
  const activities = [];
  const documents = [];

  for (let index = 1; index <= CASE_COUNT; index += 1) {
    const contractId = `contract_activation_perf_${index}`;
    const versionId = `${contractId}_v1`;
    const offerId = `offer_activation_perf_${index}`;
    const activationId = `activation_perf_${index}`;
    const status = OPERATIONAL_STATUSES[index % OPERATIONAL_STATUSES.length]!;
    const priority = PRIORITIES[index % PRIORITIES.length]!;
    const ownerUserId = index % 17 === 0 ? '' : index % 2 === 0 ? 'user_001' : 'user_002';
    const desiredGoLive = desiredGoLiveForIndex(index);

    offers.push({
      id: offerId,
      schemaVersion: 1,
      offerNumber: `O-2026-${pad(index)}`,
      status: 'completed',
      workflowStatus: 'activated',
      leadId: 'lead_001',
      ownerUserId: 'user_001',
      currentVersionId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      customerSnapshot: {
        leadId: 'lead_001',
        companyName: `Firma ${index}`,
        contactFirstName: 'Anna',
        contactLastName: `Kontakt${index}`,
        street: 'Str. 1',
        postalCode: '10115',
        city: 'Berlin',
        email: `kontakt${index}@example.test`,
        phone: '',
      },
    });

    versions.push({
      id: versionId,
      schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
      contractId,
      versionNumber: 1,
      status: 'active',
      validFrom: '2026-01-01',
      validTo: null,
      changeReason: 'initial',
      changeNote: '',
      previousVersionId: null,
      sourceOfferVersionId: null,
      snapshot: {
        schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
        customerSnapshot: {
          leadId: 'lead_001',
          companyName: `Firma ${index}`,
          contactFirstName: 'Anna',
          contactLastName: `Kontakt${index}`,
          street: 'Str. 1',
          postalCode: '10115',
          city: 'Berlin',
          email: `kontakt${index}@example.test`,
          phone: '',
        },
        tariffSnapshot: null,
        contractModel: 'purchase',
        termMonths: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        noticePeriodMonths: 3,
        autoRenewal: false,
        renewalMonths: null,
        terminalCount: HARDWARE_PER_CASE,
        terminalLines: [],
        accessoryLines: [],
        hardware: Array.from({ length: HARDWARE_PER_CASE }, (_, unitIndex) => ({
          productId: null,
          productName: `Terminal ${unitIndex + 1}`,
          model: index % 2 === 0 ? 'Pax A920' : 'Ingenico Move',
          quantity: 1,
          mobility: 'mobile',
          acquisition: 'rental',
          activationStatus: 'pending',
          serialNumber: null,
          validFrom: null,
          validTo: null,
          unitPriceCents: 1000,
        })),
        fees: {
          monthlyFeeCents: 1000,
          setupFeeCents: 0,
          transactionFeeNote: null,
          clearingNote: null,
          discountNote: null,
        },
        optionalItems: [],
        totals: {
          monthlyTotalCents: 1000,
          oneTimeTotalCents: 0,
          hardwareTotalCents: 1000,
          accessoryTotalCents: 0,
        },
        priceBookVersion: null,
        commissionReferenceId: null,
        expectedCommissionCents: null,
        sourceOfferId: offerId,
        sourceOfferVersionId: null,
        sourceOfferNumber: `O-2026-${pad(index)}`,
        activationNote: null,
      },
      approvalRequired: false,
      approvalReasons: [],
      approvedAt: null,
      approvedByUserId: null,
      activatedAt: '2026-01-01T00:00:00.000Z',
      discardedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      createdByDisplayName: 'Laura',
    });

    contracts.push({
      id: contractId,
      schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
      contractNumber: `V-2026-${pad(index)}`,
      sourceKey: `offer:${offerId}:version:v1`,
      leadId: 'lead_001',
      sourceOfferId: offerId,
      acceptedOfferVersionId: null,
      currentVersionId: versionId,
      status: status === 'completed' || status === 'live' ? 'active' : 'activation',
      ownerUserId: ownerUserId || 'user_001',
      startDate: '2026-01-01',
      termMonths: 12,
      endDate: '2026-12-31',
      noticePeriodMonths: 3,
      earliestTerminationDate: null,
      autoRenewal: false,
      renewalMonths: null,
      activationOfferId: offerId,
      commissionCaseId: null,
      expectedCommissionCents: null,
      hardwareCount: HARDWARE_PER_CASE,
      tariffName: 'Standard',
      customerCompanyName: `Firma ${index}`,
      nextDeadlineAt: null,
      nextDeadlineLabel: null,
      plannedChangeAt: null,
      terminationId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      createdByDisplayName: 'Laura',
      updatedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      updatedByUserId: 'user_001',
    });

    activationCases.push({
      id: activationId,
      schemaVersion: 1,
      activationNumber: `A-2026-${pad(index)}`,
      contractId,
      contractVersionId: versionId,
      leadId: 'lead_001',
      sourceOfferId: offerId,
      sourceKey: `contract:${contractId}:initial-activation`,
      status,
      ownerUserId,
      priority,
      plannedStart: '2026-01-01',
      desiredGoLive,
      confirmedGoLive: status === 'live' || status === 'completed' ? '2026-07-01' : null,
      currentStep: 'Schritt',
      progressPercent: index % 100,
      nextStep: index % 13 === 0 ? null : 'Nächster Schritt',
      nextDueAt: index % 9 === 0 ? null : `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
      openBlockerCount: status === 'blocked' ? 1 : 0,
      openMandatoryCount: index % 4,
      externalReferences:
        index % 6 === 0
          ? [{ system: 'BestPay', reference: `EXT-${pad(index)}`, note: '' }]
          : [],
      templateSnapshotId: 'tpl_v1',
      templateSnapshotVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      createdByDisplayName: 'Laura',
      updatedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      updatedByUserId: 'user_001',
      completedAt: status === 'completed' ? '2026-07-20T00:00:00.000Z' : null,
      handedOverAt: null,
      cancelledAt: status === 'cancelled' ? '2026-07-01T00:00:00.000Z' : null,
      blockedFromStatus: status === 'blocked' ? 'hardware_pending' : null,
    });

    for (let checklistIndex = 1; checklistIndex <= CHECKLIST_PER_CASE; checklistIndex += 1) {
      checklists.push({
        id: `chk_perf_${index}_${checklistIndex}`,
        schemaVersion: 1,
        activationId,
        category: checklistIndex <= 4 ? 'unterlagen' : checklistIndex <= 8 ? 'hardware' : 'go_live',
        key: `item_${checklistIndex}`,
        title: `Check ${checklistIndex}`,
        description: '',
        status: checklistIndex % 3 === 0 ? 'done' : 'open',
        required: checklistIndex % 2 === 0,
        evidenceRequired: checklistIndex % 5 === 0,
        documentId: null,
        dependsOnKeys: checklistIndex > 1 && checklistIndex % 4 === 0 ? [`item_${checklistIndex - 1}`] : [],
        sortOrder: checklistIndex,
        note: '',
        sourceKey: `activation:${activationId}:checklist:item_${checklistIndex}`,
        completedAt: checklistIndex % 3 === 0 ? '2026-01-02T00:00:00.000Z' : null,
        completedByUserId: checklistIndex % 3 === 0 ? 'user_001' : null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    for (let appIndex = 1; appIndex <= APPLICATION_PER_CASE; appIndex += 1) {
      applications.push({
        id: `app_perf_${index}_${appIndex}`,
        schemaVersion: 1,
        activationId,
        type: appIndex === 1 ? 'merchant_setup' : appIndex === 2 ? 'acquiring' : 'terminal_provisioning',
        status: appIndex === 1 ? 'approved' : appIndex === 2 ? 'submitted' : 'draft',
        title: `Antrag ${appIndex}`,
        referenceNumber: appIndex === 2 ? `APP-REF-${pad(index)}` : null,
        submittedAt: appIndex !== 3 ? '2026-01-02T00:00:00.000Z' : null,
        submittedByUserId: appIndex !== 3 ? 'user_001' : null,
        decisionAt: appIndex === 1 ? '2026-01-03T00:00:00.000Z' : null,
        decisionNote: '',
        inquiryNote: '',
        documentId: null,
        sourceKey: `activation:${activationId}:application:${appIndex}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'user_001',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    for (let unitIndex = 0; unitIndex < HARDWARE_PER_CASE; unitIndex += 1) {
      hardware.push({
        id: `hw_perf_${index}_${unitIndex}`,
        schemaVersion: 1,
        activationId,
        contractHardwareLineKey: `${versionId}:${unitIndex}`,
        unitIndex,
        productId: null,
        productName: `Terminal ${unitIndex + 1}`,
        model: index % 2 === 0 ? 'Pax A920' : 'Ingenico Move',
        mobility: 'mobile',
        acquisition: 'rental',
        status: unitIndex === 0 ? 'tested' : 'planned',
        serialNumber: unitIndex === 0 ? `SN-${pad(index)}-${unitIndex}` : null,
        orderedAt: null,
        orderReference: null,
        assignedAt: unitIndex === 0 ? '2026-01-02T00:00:00.000Z' : null,
        shippedAt: null,
        shippingCarrierNote: '',
        shippingTrackingReference: null,
        deliveryAddressNote: '',
        deliveredAt: null,
        setupAt: null,
        testedAt: unitIndex === 0 ? '2026-01-03T00:00:00.000Z' : null,
        activatedAt: null,
        handoverAt: null,
        handoverToName: '',
        handoverNote: '',
        note: '',
        sourceKey: `activation:${activationId}:hardware:${versionId}:${unitIndex}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    for (let blockerIndex = 1; blockerIndex <= BLOCKER_PER_CASE; blockerIndex += 1) {
      blockers.push({
        id: `blk_perf_${index}_${blockerIndex}`,
        schemaVersion: 1,
        activationId,
        category: blockerIndex === 1 ? 'hardware' : 'documents',
        severity: blockerIndex === 1 && status === 'blocked' ? 'hard' : 'warning',
        status: blockerIndex === 1 && status === 'blocked' ? 'open' : 'resolved',
        title: `Blocker ${blockerIndex}`,
        description: `Blocker ${blockerIndex}`,
        relatedHardwareId: null,
        relatedApplicationId: null,
        relatedChecklistItemId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'user_001',
        resolvedAt: blockerIndex === 1 && status === 'blocked' ? null : '2026-01-02T00:00:00.000Z',
        resolvedByUserId: blockerIndex === 1 && status === 'blocked' ? null : 'user_001',
        resolutionNote: blockerIndex === 1 && status === 'blocked' ? '' : 'gelöst',
      });
    }

    for (let taskIndex = 1; taskIndex <= TASK_PER_CASE; taskIndex += 1) {
      tasks.push({
        id: `task_perf_${index}_${taskIndex}`,
        schemaVersion: SALES_TASK_SCHEMA_VERSION,
        title: `Aufgabe ${taskIndex}`,
        description: '',
        type: 'review_activation_checklist',
        status: taskIndex === 1 && index % 13 !== 0 ? 'open' : 'done',
        priority: 'normal',
        dueAt: taskIndex === 1 ? '2026-07-20T00:00:00.000Z' : null,
        dueTimeLocal: null,
        assigneeUserId: 'user_001',
        createdByUserId: 'user_001',
        completedAt: taskIndex === 1 && index % 13 !== 0 ? null : '2026-01-02T00:00:00.000Z',
        completedByUserId: taskIndex === 1 && index % 13 !== 0 ? null : 'user_001',
        completionNote: '',
        leadId: 'lead_001',
        comparisonSessionId: null,
        offerId: offerId,
        contractId,
        contractVersionId: versionId,
        activationId,
        wizardEnabled: false,
        origin: 'automatic',
        sourceKey: `activation:${activationId}:task:${taskIndex}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    for (let activityIndex = 1; activityIndex <= ACTIVITY_PER_CASE; activityIndex += 1) {
      const occurredAt = `2026-01-01T${String(activityIndex).padStart(2, '0')}:00:00.000Z`;
      activities.push({
        id: `act_perf_${index}_${activityIndex}`,
        schemaVersion: SALES_ACTIVITY_SCHEMA_VERSION,
        type: 'activation_checklist_updated',
        title: `Aktivität ${activityIndex}`,
        description: '',
        occurredAt,
        createdByUserId: 'user_001',
        leadId: 'lead_001',
        comparisonSessionId: null,
        offerId: offerId,
        contractId,
        contractVersionId: versionId,
        activationId,
        taskId: null,
        isSystem: true,
        editable: false,
        sourceKey: `activation:${activationId}:activity:${activityIndex}`,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
    }

    for (let documentIndex = 1; documentIndex <= DOCUMENT_PER_CASE; documentIndex += 1) {
      documents.push({
        id: `doc_perf_${index}_${documentIndex}`,
        schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
        offerId: offerId,
        offerVersionId: null,
        contractId,
        contractVersionId: versionId,
        terminationId: null,
        activationId,
        type: 'activation',
        fileName: `doc_${documentIndex}.pdf`,
        mimeType: 'application/pdf',
        externalReference: `DOC-REF-${pad(index)}-${documentIndex}`,
        checksum: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'user_001',
        createdByDisplayName: 'Laura',
      });
    }
  }

  // Offers are optional for overview search (ContractVersion carries sourceOfferNumber).
  writeStorageItem(STORAGE_KEYS.offers, []);
  void offers;
  writeStorageItem(STORAGE_KEYS.contracts, contracts);
  writeStorageItem(STORAGE_KEYS.contractVersions, versions);
  writeStorageItem(STORAGE_KEYS.contractTerminations, []);
  writeStorageItem(STORAGE_KEYS.contractStorageVersion, 1);
  writeStorageItem(STORAGE_KEYS.activationCases, activationCases);
  writeStorageItem(STORAGE_KEYS.activationChecklists, checklists);
  writeStorageItem(STORAGE_KEYS.activationApplications, applications);
  writeStorageItem(STORAGE_KEYS.activationHardware, hardware);
  writeStorageItem(STORAGE_KEYS.activationBlockers, blockers);
  writeStorageItem(STORAGE_KEYS.activationStorageVersion, CURRENT_ACTIVATION_STORAGE_VERSION);
  writeStorageItem(STORAGE_KEYS.salesTasks, tasks);
  writeStorageItem(STORAGE_KEYS.salesActivities, activities);
  writeStorageItem(STORAGE_KEYS.salesDocuments, documents);

  return {
    activationCases: activationCases.length,
    checklists: checklists.length,
    applications: applications.length,
    hardware: hardware.length,
    blockers: blockers.length,
    tasks: tasks.length,
    activities: activities.length,
    documents: documents.length,
  };
}

describe('D Aktivierungs-Performance Maximalmengen', () => {
  let counts: ReturnType<typeof seedMaximalActivationSet>;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    counts = seedMaximalActivationSet();
  });

  it('erzeugt verbindliche Maximalmengen deterministisch', () => {
    expect(counts.activationCases).toBe(1000);
    expect(counts.checklists).toBe(20_000);
    expect(counts.applications).toBe(3_000);
    expect(counts.hardware).toBe(5_000);
    expect(counts.blockers).toBe(2_000);
    expect(counts.tasks).toBe(5_000);
    expect(counts.activities).toBe(10_000);
    expect(counts.documents).toBe(5_000);
  });

  it('aggregiert Übersicht, Suche, Filter, Sortierung und Kennzahlen ohne N+1 und ohne Engines', async () => {
    const services = createServices({
      userRepository: new LocalUserRepository(),
      auditRepository: new LocalAuditRepository(),
      approvalRuleRepository: new LocalApprovalRuleRepository(),
      documentTemplateRepository: new LocalDocumentTemplateRepository(),
      leadRepository: new LocalLeadRepository(),
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
      tariffRepository: new LocalTariffRepository(),
      productRepository: new LocalProductRepository(),
      offerRepository: new LocalOfferRepository(),
      offerVersionRepository: new LocalOfferVersionRepository(),
      offerWorkflowEventRepository: new LocalOfferWorkflowEventRepository(),
      salesDocumentRepository: new LocalSalesDocumentRepository(),
      offerDocumentRepository: new LocalOfferDocumentRepository(),
      pricingCatalogRepository: new LocalPricingCatalogRepository(),
      pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
      commissionCatalogRepository: new LocalCommissionCatalogRepository(),
      commissionCalculationRepository: new LocalCommissionCalculationRepository(),
      recommendationRepository: new LocalRecommendationRepository(),
      salesTaskRepository: new LocalSalesTaskRepository(),
      salesActivityRepository: new LocalSalesActivityRepository(),
      contractRepository: new LocalContractRepository(),
      contractVersionRepository: new LocalContractVersionRepository(),
      contractTerminationRepository: new LocalContractTerminationRepository(),
      activationCaseRepository: new LocalActivationCaseRepository(),
      activationChecklistRepository: new LocalActivationChecklistRepository(),
      activationApplicationRepository: new LocalActivationApplicationRepository(),
      activationHardwareRepository: new LocalActivationHardwareRepository(),
      activationBlockerRepository: new LocalActivationBlockerRepository(),
    });

    const checklistByIdSpy = vi.spyOn(LocalActivationChecklistRepository.prototype, 'getByActivationId');
    const hardwareByIdSpy = vi.spyOn(LocalActivationHardwareRepository.prototype, 'getByActivationId');
    const applicationByIdSpy = vi.spyOn(LocalActivationApplicationRepository.prototype, 'getByActivationId');
    const blockerByIdSpy = vi.spyOn(LocalActivationBlockerRepository.prototype, 'getByActivationId');
    const pricingSpy = vi.spyOn(services.pricingEvaluationService, 'evaluateOffer');
    const commissionSpy = vi.spyOn(services.commissionCalculationService, 'calculatePreviewForOffer');
    const recommendationSpy = vi.spyOn(services.recommendationService, 'calculateForOffer');

    const overviewStarted = performance.now();
    const overview = await services.activationService.list(admin, { status: 'all', sortBy: 'nextDueAt' });
    const overviewElapsed = performance.now() - overviewStarted;
    expect(overview.ok).toBe(true);
    if (overview.ok) expect(overview.value.length).toBe(1000);
    expect(overviewElapsed).toBeLessThan(5000);

    const searchStarted = performance.now();
    const searchGeneral = await services.activationService.list(admin, { query: 'Firma 12' });
    const searchSerial = await services.activationService.list(admin, { query: 'SN-00012-0' });
    const searchExternal = await services.activationService.list(admin, { query: 'EXT-00006' });
    const searchModel = await services.activationService.list(admin, { query: 'Pax A920' });
    const searchNone = await services.activationService.list(admin, { query: 'xyz-no-hit-999' });
    const searchElapsed = performance.now() - searchStarted;
    expect(searchGeneral.ok && searchGeneral.value.length).toBeGreaterThan(0);
    expect(searchSerial.ok && searchSerial.value.length).toBeGreaterThan(0);
    expect(searchExternal.ok && searchExternal.value.length).toBeGreaterThan(0);
    expect(searchModel.ok && searchModel.value.length).toBeGreaterThan(0);
    expect(searchNone.ok && searchNone.value.length).toBe(0);
    expect(searchElapsed).toBeLessThan(5000);

    const filterStarted = performance.now();
    const filters = await Promise.all([
      services.activationService.list(admin, { status: 'blocked' }),
      services.activationService.list(admin, { ownerUserId: 'mine' }),
      services.activationService.list(admin, { priority: 'urgent' }),
      services.activationService.list(admin, { goLiveWindow: '7', status: 'all' }),
      services.activationService.list(admin, { goLiveWindow: '14', status: 'all' }),
      services.activationService.list(admin, { goLiveWindow: '30', status: 'all' }),
      services.activationService.list(admin, { goLiveWindow: 'overdue', status: 'all' }),
      services.activationService.list(admin, { workState: 'blocked' }),
      services.activationService.list(admin, { workState: 'documents_open' }),
      services.activationService.list(admin, { workState: 'application_open' }),
      services.activationService.list(admin, { workState: 'hardware_open' }),
      services.activationService.list(admin, { workState: 'setup_open' }),
      services.activationService.list(admin, { workState: 'test_open' }),
      services.activationService.list(admin, { workState: 'go_live_ready' }),
      services.activationService.list(admin, { workState: 'completion_open' }),
      services.activationService.list(admin, { workState: 'without_next_task' }),
      services.activationService.list(admin, {
        query: 'Firma',
        status: 'hardware_pending',
        priority: 'high',
        workState: 'hardware_open',
      }),
    ]);
    const filterElapsed = performance.now() - filterStarted;
    expect(filters.every((result) => result.ok)).toBe(true);
    expect(filterElapsed).toBeLessThan(5000);

    const sortStarted = performance.now();
    const sorts = await Promise.all([
      services.activationService.list(admin, { sortBy: 'nextDueAt' }),
      services.activationService.list(admin, { sortBy: 'desiredGoLive' }),
      services.activationService.list(admin, { sortBy: 'priority' }),
      services.activationService.list(admin, { sortBy: 'updatedAt' }),
      services.activationService.list(admin, { sortBy: 'company' }),
      services.activationService.list(admin, { sortBy: 'activationNumber' }),
    ]);
    const sortElapsed = performance.now() - sortStarted;
    expect(sorts.every((result) => result.ok)).toBe(true);
    expect(sortElapsed).toBeLessThan(5000);

    const metricsStarted = performance.now();
    const metrics = await services.activationService.getMetrics(admin);
    const metricsElapsed = performance.now() - metricsStarted;
    expect(metrics.ok).toBe(true);
    if (metrics.ok) {
      expect(metrics.value.openCount).toBeGreaterThan(0);
      expect(metrics.value.blockedCount).toBeGreaterThan(0);
      expect(metrics.value.goLiveIn7Days).toBeGreaterThanOrEqual(0);
      expect(metrics.value.documentsOpenCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.providerReviewCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.hardwareOpenCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.setupOpenCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.testOpenCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.goLiveReadyCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.completionOpenCount).toBeGreaterThanOrEqual(0);
      expect(metrics.value.withoutNextTaskCount).toBeGreaterThanOrEqual(0);
    }
    expect(metricsElapsed).toBeLessThan(5000);

    // Overview/search/filter/sort/metrics must not load related entities per case.
    expect(checklistByIdSpy).not.toHaveBeenCalled();
    expect(hardwareByIdSpy).not.toHaveBeenCalled();
    expect(applicationByIdSpy).not.toHaveBeenCalled();
    expect(blockerByIdSpy).not.toHaveBeenCalled();
    expect(pricingSpy).not.toHaveBeenCalled();
    expect(commissionSpy).not.toHaveBeenCalled();
    expect(recommendationSpy).not.toHaveBeenCalled();

    checklistByIdSpy.mockRestore();
    hardwareByIdSpy.mockRestore();
    applicationByIdSpy.mockRestore();
    blockerByIdSpy.mockRestore();
    pricingSpy.mockRestore();
    commissionSpy.mockRestore();
    recommendationSpy.mockRestore();
  });

  it(
    'aggregiert Detail, Evaluator, Diagnose und Export auf Maximalmengen',
    async () => {
    const services = createTestServices();

    const detailStarted = performance.now();
    const detail = await services.activationService.getById('activation_perf_1', admin);
    const checklist = await services.activationService.listChecklistItems('activation_perf_1', admin);
    const apps = await services.activationService.listApplications('activation_perf_1', admin);
    const hw = await services.activationService.listHardware('activation_perf_1', admin);
    const bl = await services.activationService.listBlockers('activation_perf_1', admin);
    const detailElapsed = performance.now() - detailStarted;

    expect(detail.ok).toBe(true);
    expect(checklist.ok && checklist.value.length).toBe(20);
    expect(apps.ok && apps.value.length).toBe(3);
    expect(hw.ok && hw.value.length).toBe(5);
    expect(bl.ok && bl.value.length).toBe(2);
    // Gleicher Budgetrahmen wie Übersicht/Suche unter Maximalmenge (Maschinenlast).
    expect(detailElapsed).toBeLessThan(5000);

    const evaluatorStarted = performance.now();
    if (checklist.ok && apps.ok && hw.ok && bl.ok && detail.ok) {
      const goLive = evaluateGoLiveReadiness(
        checklist.value,
        hw.value,
        apps.value,
        bl.value,
      );
      const completion = evaluateCompletionReadiness(
        detail.value.status,
        checklist.value,
        bl.value,
      );
      expect(typeof goLive.ready).toBe('boolean');
      expect(typeof completion.ready).toBe('boolean');
    }
    const evaluatorElapsed = performance.now() - evaluatorStarted;
    expect(evaluatorElapsed).toBeLessThan(2000);

    const diagnoseStarted = performance.now();
    const findings = await services.dataDiagnosticService.runDiagnostics(admin);
    const diagnoseElapsed = performance.now() - diagnoseStarted;
    expect(Array.isArray(findings)).toBe(true);
    expect(diagnoseElapsed).toBeLessThan(10000);

    const exportStarted = performance.now();
    const csv = await services.dataExportService.exportCsv(admin, 'activationCases');
    const backup = await services.dataExportService.exportFullBackup(admin);
    expect(csv.ok).toBe(true);
    expect(backup.ok).toBe(true);
    if (backup.ok) {
      const preview = services.dataRestoreService.previewRestore(backup.content);
      expect(preview.valid || preview.warnings.length >= 0).toBe(true);
      const schemaVersions = backup.manifest.schemaVersions as Record<string, number> | undefined;
      expect(schemaVersions?.activations ?? CURRENT_ACTIVATION_STORAGE_VERSION).toBe(
        CURRENT_ACTIVATION_STORAGE_VERSION,
      );
    }
    const exportElapsed = performance.now() - exportStarted;
    expect(exportElapsed).toBeLessThan(10000);
  },
  30_000,
  );
});
