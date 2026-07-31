import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from '../domain/contract/contract';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from '../domain/contract/contractVersion';
import { CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION } from '../domain/contract/contractTermination';
import { SALES_ACTIVITY_SCHEMA_VERSION } from '../domain/salesWorkspace/salesActivity';
import { SALES_TASK_SCHEMA_VERSION } from '../domain/salesWorkspace/salesTask';
import { SALES_DOCUMENT_SCHEMA_VERSION } from '../domain/salesDocument/salesDocument';

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

function seedLargeContractSet() {
  const contracts = [];
  const versions = [];
  const terminations = [];
  const activities = [];
  const tasks = [];
  const documents = [];

  for (let index = 1; index <= 1000; index += 1) {
    const contractId = `contract_perf_${index}`;
    const versionIds = [];
    for (let version = 1; version <= 5; version += 1) {
      const versionId = `${contractId}_v${version}`;
      versionIds.push(versionId);
      versions.push({
        id: versionId,
        schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
        contractId,
        versionNumber: version,
        status: version === 5 ? 'active' : 'expired',
        validFrom: '2026-01-01',
        validTo: version === 5 ? null : '2026-06-01',
        changeReason: version === 1 ? 'initial' : 'other_amendment',
        changeNote: '',
        previousVersionId: version === 1 ? null : `${contractId}_v${version - 1}`,
        sourceOfferVersionId: null,
        snapshot: {
          schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
          customerSnapshot: {
            leadId: 'lead_001',
            companyName: `Firma ${index}`,
            contactFirstName: 'A',
            contactLastName: 'B',
            street: 'Str. 1',
            postalCode: '12345',
            city: 'Berlin',
            email: 'a@b.de',
            phone: '',
            taxNumber: '',
            vatId: '',
          },
          tariffSnapshot: null,
          contractModel: 'not_specified',
          termMonths: 36,
          startDate: '2026-01-01',
          endDate: '2028-12-31',
          noticePeriodMonths: 3,
          autoRenewal: true,
          renewalMonths: 12,
          terminalCount: 1,
          terminalLines: [],
          accessoryLines: [],
          hardware: [
            {
              productId: null,
              productName: 'Terminal',
              model: 'T1',
              quantity: 1,
              mobility: 'unknown',
              acquisition: 'rental',
              activationStatus: 'active',
              serialNumber: null,
              validFrom: '2026-01-01',
              validTo: null,
              unitPriceCents: 1000,
            },
          ],
          fees: {
            monthlyFeeCents: 1000,
            setupFeeCents: 0,
            transactionFeeNote: null,
            clearingNote: null,
            discountNote: null,
          },
          optionalItems: [],
          totals: {
            monthlyItemsTotalCents: 0,
            oneTimeItemsTotalCents: 0,
            tariffMonthlyFixedTotalCents: 0,
            tariffSetupTotalCents: 0,
            monthlyTotalCents: 1000,
            oneTimeTotalCents: 0,
            hasOnRequestItems: false,
            onRequestItemCount: 0,
          },
          priceBookVersion: null,
          commissionReferenceId: null,
          expectedCommissionCents: null,
          sourceOfferId: null,
          sourceOfferVersionId: null,
          sourceOfferNumber: null,
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
    }

    contracts.push({
      id: contractId,
      schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
      contractNumber: `V-2026-${String(index).padStart(5, '0')}`,
      sourceKey: `perf:${index}`,
      leadId: 'lead_001',
      sourceOfferId: null,
      acceptedOfferVersionId: null,
      currentVersionId: versionIds[4],
      status: index % 20 === 0 ? 'termination_pending' : 'active',
      ownerUserId: 'user_001',
      startDate: '2026-01-01',
      termMonths: 36,
      endDate: '2028-12-31',
      noticePeriodMonths: 3,
      earliestTerminationDate: '2028-09-30',
      autoRenewal: true,
      renewalMonths: 12,
      activationOfferId: null,
      commissionCaseId: null,
      expectedCommissionCents: null,
      hardwareCount: 1,
      tariffName: 'Perf-Tarif',
      customerCompanyName: `Firma ${index}`,
      nextDeadlineAt: '2028-09-30',
      nextDeadlineLabel: 'Kündigungsfrist',
      plannedChangeAt: null,
      terminationId: index <= 500 ? `term_perf_${index}` : null,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      createdByDisplayName: 'Laura',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedByUserId: 'user_001',
    });

    if (index <= 500) {
      terminations.push({
        id: `term_perf_${index}`,
        schemaVersion: CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION,
        contractId,
        contractVersionId: versionIds[4],
        status: 'recorded',
        receivedAt: '2026-06-01',
        requestedEndDate: '2028-12-31',
        effectiveEndDate: '2028-12-31',
        reason: 'price',
        otherReasonText: null,
        channel: 'email',
        party: 'customer',
        documentedByUserId: 'user_001',
        documentedAt: '2026-06-01T00:00:00.000Z',
        winbackPossible: true,
        winbackStatus: 'open',
        confirmedAt: null,
        completedAt: null,
        withdrawnAt: null,
        comment: '',
        evidenceDocumentId: null,
        noticePeriodClear: true,
        reviewNote: null,
      });
    }
  }

  for (let index = 1; index <= 5000; index += 1) {
    const contractId = `contract_perf_${(index % 1000) + 1}`;
    activities.push({
      id: `act_perf_${index}`,
      schemaVersion: SALES_ACTIVITY_SCHEMA_VERSION,
      type: 'contract_created',
      title: 'Perf Activity',
      description: '',
      occurredAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      leadId: 'lead_001',
      comparisonSessionId: null,
      offerId: null,
      contractId,
      contractVersionId: null,
      taskId: null,
      isSystem: true,
      editable: false,
      sourceKey: `perf_activity_${index}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  for (let index = 1; index <= 2000; index += 1) {
    const contractId = `contract_perf_${(index % 1000) + 1}`;
    tasks.push({
      id: `task_perf_${index}`,
      schemaVersion: SALES_TASK_SCHEMA_VERSION,
      title: 'Perf Task',
      description: '',
      type: 'review_contract',
      status: 'open',
      priority: 'normal',
      dueAt: '2026-12-31T00:00:00.000Z',
      dueTimeLocal: null,
      assigneeUserId: 'user_001',
      createdByUserId: 'user_001',
      completedAt: null,
      completedByUserId: null,
      completionNote: '',
      leadId: 'lead_001',
      comparisonSessionId: null,
      offerId: null,
      contractId,
      contractVersionId: null,
      wizardEnabled: false,
      origin: 'automatic',
      sourceKey: `perf_task_${index}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  for (let index = 1; index <= 3000; index += 1) {
    const contractId = `contract_perf_${(index % 1000) + 1}`;
    documents.push({
      id: `doc_perf_${index}`,
      schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
      offerId: null,
      offerVersionId: null,
      contractId,
      contractVersionId: `${contractId}_v5`,
      terminationId: null,
      activationId: null,
      type: 'contract',
      fileName: `doc_${index}.pdf`,
      mimeType: 'application/pdf',
      externalReference: `ref_${index}`,
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user_001',
      createdByDisplayName: 'Laura',
    });
  }

  writeStorageItem(STORAGE_KEYS.contracts, contracts);
  writeStorageItem(STORAGE_KEYS.contractVersions, versions);
  writeStorageItem(STORAGE_KEYS.contractTerminations, terminations);
  writeStorageItem(STORAGE_KEYS.salesActivities, activities);
  writeStorageItem(STORAGE_KEYS.salesTasks, tasks);
  writeStorageItem(STORAGE_KEYS.salesDocuments, documents);
  writeStorageItem(STORAGE_KEYS.contractStorageVersion, 1);
}

describe('C Vertrags-Performance', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedLargeContractSet();
  });

  it('listet 1000 Contracts ohne Engine-Aufrufe', async () => {
    const services = createTestServices();
    const pricingSpy = vi.spyOn(services.pricingEvaluationService, 'evaluateOffer');
    const commissionSpy = vi.spyOn(services.commissionCalculationService, 'calculatePreviewForOffer');
    const recommendationSpy = vi.spyOn(services.recommendationService, 'calculateForOffer');

    const started = performance.now();
    const list = await services.contractService.list(admin, { query: 'Firma 12', sortBy: 'deadline' });
    const metrics = await services.contractService.getMetrics(admin);
    const detail = await services.contractService.getById('contract_perf_1', admin);
    const elapsed = performance.now() - started;

    expect(list.ok).toBe(true);
    expect(metrics.ok).toBe(true);
    expect(detail.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000);
    expect(pricingSpy).not.toHaveBeenCalled();
    expect(commissionSpy).not.toHaveBeenCalled();
    expect(recommendationSpy).not.toHaveBeenCalled();

    pricingSpy.mockRestore();
    commissionSpy.mockRestore();
    recommendationSpy.mockRestore();
  });

  it('Diagnose und Exportmanifest skalieren mit Vertragsstores', async () => {
    const services = createTestServices();
    const started = performance.now();
    const findings = await services.dataDiagnosticService.runDiagnostics(admin);
    const backup = await services.dataExportService.exportFullBackup(admin);
    const elapsed = performance.now() - started;
    expect(Array.isArray(findings)).toBe(true);
    expect(backup.ok).toBe(true);
    expect(elapsed).toBeLessThan(10000);
  });
});
