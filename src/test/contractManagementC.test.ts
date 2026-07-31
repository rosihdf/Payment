import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canTransitionContractStatus } from '../domain/contract/contractStatus';
import { generateNextContractNumber, buildContractSourceKey } from '../domain/contract/contractNumber';
import {
  computeContractEndDate,
  computeEarliestTerminationDate,
  toIsoDateOnly,
  validateContractDateRange,
} from '../domain/contract/contractDates';
import { compareContractVersions } from '../domain/contract/compareContractVersions';
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
import {
  createTestOffer,
  FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';

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

const field = createUserContext({
  id: 'user_001',
  name: 'Laura',
  role: 'field_service',
  status: 'active',
});

const foreignField = createUserContext({
  id: 'user_002',
  name: 'Thomas',
  role: 'field_service',
  status: 'active',
});

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const reviewer = { userId: 'user_004', role: 'admin' as const, displayName: 'Admin' };

async function createAcceptedOffer(services: ReturnType<typeof createTestServices>) {
  const offerRepository = new LocalOfferRepository();
  const workflow = services.offerWorkflowService;
  let offer = await offerRepository.create(
    createTestOffer({ workflowStatus: 'approval_required' }),
  );
  offer = await workflow.ensureInitialVersion(offer);
  await workflow.approve(offer.id, reviewer);
  await workflow.markReadyToSend(offer.id, owner);
  await workflow.documentSent(offer.id, owner, 'kunde@example.test');
  const accepted = await workflow.acceptOffer(offer.id, owner, {
    acceptedByName: 'Kunde',
    acceptanceType: 'email_confirmation',
    otherText: null,
    note: 'ok',
  });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) throw new Error('accept failed');
  return accepted.offer;
}

describe('C Vertragsmanagement', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.contracts, []);
    writeStorageItem(STORAGE_KEYS.contractVersions, []);
    writeStorageItem(STORAGE_KEYS.contractTerminations, []);
  });

  it('erzeugt Vertrag aus accepted Offer idempotent mit Initialversion', async () => {
    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    // accept already creates via workflow hook; second call must be idempotent
    const first = await services.contractService.createFromAcceptedOffer(offer.id, field);
    const second = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.id).toBe(second.value.id);
    expect(first.value.contractNumber).toMatch(/^V-\d{4}-\d{5}$/);
    expect(first.value.acceptedOfferVersionId).toBe(offer.currentVersionId);
    expect(first.value.sourceKey).toBe(
      buildContractSourceKey(offer.id, offer.currentVersionId!),
    );

    const versions = await services.contractService.listVersions(first.value.id, field);
    expect(versions.ok).toBe(true);
    if (!versions.ok) return;
    expect(versions.value).toHaveLength(1);
    expect(versions.value[0]?.versionNumber).toBe(1);
    expect(versions.value[0]?.status).toBe('active');
    expect(versions.value[0]?.snapshot.sourceOfferVersionId).toBe(offer.currentVersionId);
  });

  it('blockiert Vertrag aus nicht angenommenem Offer', async () => {
    const services = createTestServices();
    const offerRepository = new LocalOfferRepository();
    const offer = await offerRepository.create(createTestOffer({ workflowStatus: 'draft' }));
    const result = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_accepted');
  });

  it('schützt Statusübergänge und mutiert nicht durch List-Queries', async () => {
    expect(canTransitionContractStatus('preparation', 'activation')).toBe(true);
    expect(canTransitionContractStatus('ended', 'active')).toBe(false);
    expect(canTransitionContractStatus('archived', 'active')).toBe(false);

    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const before = created.value.status;
    await services.contractService.list(field);
    const after = await services.contractService.getById(created.value.id, field);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.status).toBe(before);

    const invalid = await services.contractService.transitionStatus(created.value.id, 'archived', admin);
    expect(invalid.ok).toBe(false);
  });

  it('erzeugt neue Version bei Änderung und hält alte unverändert', async () => {
    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const versionsBefore = await services.contractService.listVersions(created.value.id, field);
    expect(versionsBefore.ok).toBe(true);
    if (!versionsBefore.ok) return;
    const v1 = structuredClone(versionsBefore.value[0]!);

    const change = await services.contractService.startChange(
      created.value.id,
      {
        changeReason: 'tariff_change',
        changeNote: 'Tariftest',
        patch: {
          termMonths: (v1.snapshot.termMonths ?? 12) + 12,
          fees: { ...v1.snapshot.fees, monthlyFeeCents: (v1.snapshot.fees.monthlyFeeCents ?? 0) + 500 },
        },
      },
      field,
    );
    expect(change.ok).toBe(true);
    if (!change.ok) return;
    expect(change.value.versionNumber).toBe(2);

    const activated = await services.contractService.activateVersion(
      created.value.id,
      change.value.id,
      admin,
    );
    expect(activated.ok).toBe(true);

    const versions = await services.contractService.listVersions(created.value.id, field);
    expect(versions.ok).toBe(true);
    if (!versions.ok) return;
    const old = versions.value.find((version) => version.versionNumber === 1)!;
    const next = versions.value.find((version) => version.versionNumber === 2)!;
    expect(old.status).toBe('expired');
    expect(old.snapshot.termMonths).toBe(v1.snapshot.termMonths);
    expect(next.status).toBe('active');
    expect(versions.value.filter((version) => version.status === 'active')).toHaveLength(1);
    expect(compareContractVersions(old, next).length).toBeGreaterThan(0);
  });

  it('berechnet Laufzeiten zentral und erfasst Kündigung strukturiert', async () => {
    expect(computeContractEndDate('2026-01-01', 12)).toBe('2026-12-31');
    expect(computeEarliestTerminationDate('2026-12-31', 3)).toBe('2026-09-30');
    expect(validateContractDateRange('2026-01-01', '2025-01-01')).toBeTruthy();

    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const blockedOther = await services.contractService.recordTermination(
      created.value.id,
      { reason: 'other', otherReasonText: null },
      field,
    );
    expect(blockedOther.ok).toBe(false);

    const recorded = await services.contractService.recordTermination(
      created.value.id,
      {
        reason: 'price',
        requestedEndDate: created.value.endDate,
        winbackPossible: true,
      },
      field,
    );
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const confirmed = await services.contractService.confirmTermination(recorded.value.id, admin);
    expect(confirmed.ok).toBe(true);
  });

  it('prüft Rechte service-seitig', async () => {
    const services = createTestServices();
    const offerRepository = new LocalOfferRepository();
    const offer = await offerRepository.create(
      createTestOffer({ workflowStatus: 'accepted', currentVersionId: 'ver_x' }),
    );
    // ensure version exists for create path
    writeStorageItem(STORAGE_KEYS.offerVersions, [
      {
        id: 'ver_x',
        offerId: offer.id,
        versionNumber: 1,
        workflowStatus: 'accepted',
        snapshot: {
          schemaVersion: 1,
          offerId: offer.id,
          offerNumber: offer.offerNumber,
          versionNumber: 1,
          leadId: offer.leadId,
          customerSnapshot: offer.customerSnapshot,
          tariffSnapshot: offer.tariffSnapshot,
          items: offer.items,
          title: offer.title,
          introductionText: '',
          internalNotes: '',
          customerNotes: '',
          validUntil: null,
          recommendationLink: offer.recommendationLink,
          totals: {
            monthlyItemsTotalCents: 0,
            oneTimeItemsTotalCents: 0,
            tariffMonthlyFixedTotalCents: 0,
            tariffSetupTotalCents: 0,
            monthlyTotalCents: 0,
            oneTimeTotalCents: 0,
            hasOnRequestItems: false,
            onRequestItemCount: 0,
          },
          sourceComparisonSessionId: null,
          sourceScenarioId: null,
          contractModel: 'not_specified',
          termMonths: 12,
          terminalCount: 0,
          optionalTerminalCount: 0,
          terminalLines: [],
          accessoryLines: [],
          priceBookVersion: null,
          commissionReferenceId: null,
          approvalRequired: false,
          approvalReasons: [],
          costBaselineId: null,
          savingsCents: null,
          createdByUserId: offer.createdByUserId,
          createdAt: offer.createdAt,
        },
        createdAt: offer.createdAt,
        createdByUserId: offer.createdByUserId,
        createdByDisplayName: offer.createdByDisplayName,
        approvedAt: null,
        approvedByUserId: null,
        sentAt: null,
        acceptedAt: null,
        declinedAt: null,
        activatedAt: null,
        supersededAt: null,
      },
    ]);

    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const foreignChange = await services.contractService.startChange(
      created.value.id,
      { changeReason: 'contact_change', patch: { customerContactLastName: 'Neu' } },
      foreignField,
    );
    expect(foreignChange.ok).toBe(false);
    if (!foreignChange.ok) {
      expect(foreignChange.error).toBe('forbidden');
    }
  });

  it('erzeugt Fristaufgaben idempotent', async () => {
    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const nearEnd = toIsoDateOnly(new Date());
    const change = await services.contractService.startChange(
      created.value.id,
      {
        changeReason: 'other_amendment',
        patch: { endDate: nearEnd },
      },
      field,
    );
    expect(change.ok).toBe(true);
    if (!change.ok) return;
    const activated = await services.contractService.activateVersion(
      created.value.id,
      change.value.id,
      admin,
    );
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.endDate).toBe(nearEnd);

    await services.contractService.ensureDeadlineTasks(created.value.id, admin);
    await services.contractService.ensureDeadlineTasks(created.value.id, admin);
    const tasks = await services.salesTaskService.listVisible(field);
    const deadlineTasks = tasks.filter(
      (task) => task.sourceKey?.startsWith(`auto:contract_deadline:${created.value.id}:`),
    );
    const keys = deadlineTasks.map((task) => task.sourceKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ändert Offer nicht bei Vertragsversion', async () => {
    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const offerBefore = structuredClone(offer);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const change = await services.contractService.startChange(
      created.value.id,
      {
        changeReason: 'fee_change',
        patch: {
          fees: {
            monthlyFeeCents: 9999,
            setupFeeCents: 0,
            transactionFeeNote: null,
            clearingNote: null,
            discountNote: null,
          },
        },
      },
      field,
    );
    expect(change.ok).toBe(true);
    if (!change.ok) return;
    await services.contractService.activateVersion(created.value.id, change.value.id, admin);
    const offerAfter = await services.offerService.getOfferById(offer.id, FIELD_SERVICE_CONTEXT);
    expect(offerAfter?.updatedAt).toBe(offerBefore.updatedAt);
    expect(offerAfter?.currentVersionId).toBe(offerBefore.currentVersionId);
  });

  it('synchronisiert Aktivierung kontrolliert ohne Schleife', async () => {
    const services = createTestServices();
    const offer = await createAcceptedOffer(services);
    const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const spy = vi.spyOn(services.contractService, 'createFromAcceptedOffer');
    await services.offerWorkflowService.prepareActivation(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      checks: { docs: true, hardware: true, merchant: true },
    });
    await services.offerWorkflowService.activate(offer.id, owner, {
      externalReference: 'ACT-1',
    });
    const after = await services.contractService.getById(created.value.id, field);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.status).toBe('active');
    expect(spy.mock.calls.length).toBeLessThan(5);
    spy.mockRestore();
  });

  it('erweitert Diagnose und Export um Verträge', async () => {
    const services = createTestServices();
    const offerRepository = new LocalOfferRepository();
    await offerRepository.create(
      createTestOffer({
        id: 'offer_diag_accepted',
        workflowStatus: 'accepted',
        offerNumber: 'BP-ANG-2026-9999',
      }),
    );

    const findings = await services.dataDiagnosticService.runDiagnostics(admin);
    expect(Array.isArray(findings)).toBe(true);
    if (!Array.isArray(findings)) return;
    expect(
      findings.some((finding) => finding.description.includes('Angenommenes Offer ohne Vertrag')),
    ).toBe(true);

    const offer = await createAcceptedOffer(services);
    await services.contractService.createFromAcceptedOffer(offer.id, field);
    const csv = await services.dataExportService.exportCsv(admin, 'contracts');
    expect(csv.ok).toBe(true);
    const backup = await services.dataExportService.exportFullBackup(admin);
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.manifest.schemaVersions).toMatchObject({ contracts: 1 });
    expect(JSON.stringify(backup.manifest.includedAreas)).toContain('amrtech.contracts');
  });

  it('vergibt stabile Vertragsnummern ohne Arraylängen-Ableitung', () => {
    const a = generateNextContractNumber([], '2026-01-01T00:00:00.000Z');
    const b = generateNextContractNumber(
      [{ contractNumber: 'V-2026-00007' } as never],
      '2026-06-01T00:00:00.000Z',
    );
    expect(a).toBe('V-2026-00001');
    expect(b).toBe('V-2026-00008');
  });
});
