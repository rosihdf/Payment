import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildActivationSourceKey,
  formatActivationNumber,
  generateNextActivationNumber,
  isValidActivationNumberFormat,
} from '../domain/activation/activationNumber';
import { canTransitionActivationStatus } from '../domain/activation/activationStatus';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from '../domain/contract/contract';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from '../domain/contract/contractVersion';
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
import {
  CURRENT_ACTIVATION_STORAGE_VERSION,
  migrateActivationStorageIfNeeded,
} from '../services/activationStorageMigration';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';
import { createTestOffer, resetOfferTestSequence } from './helpers/offerTestHelpers';

function createTestServices() {
  const contractRepository = new LocalContractRepository();
  const contractVersionRepository = new LocalContractVersionRepository();
  const salesTaskRepository = new LocalSalesTaskRepository();
  const salesActivityRepository = new LocalSalesActivityRepository();
  const salesDocumentRepository = new LocalSalesDocumentRepository();
  const activationCaseRepository = new LocalActivationCaseRepository();
  const activationChecklistRepository = new LocalActivationChecklistRepository();
  const activationApplicationRepository = new LocalActivationApplicationRepository();
  const activationHardwareRepository = new LocalActivationHardwareRepository();
  const activationBlockerRepository = new LocalActivationBlockerRepository();

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
    salesDocumentRepository,
    offerDocumentRepository: new LocalOfferDocumentRepository(),
    pricingCatalogRepository: new LocalPricingCatalogRepository(),
    pricingEvaluationRepository: new LocalPricingEvaluationRepository(),
    commissionCatalogRepository: new LocalCommissionCatalogRepository(),
    commissionCalculationRepository: new LocalCommissionCalculationRepository(),
    recommendationRepository: new LocalRecommendationRepository(),
    salesTaskRepository,
    salesActivityRepository,
    contractRepository,
    contractVersionRepository,
    contractTerminationRepository: new LocalContractTerminationRepository(),
    activationCaseRepository,
    activationChecklistRepository,
    activationApplicationRepository,
    activationHardwareRepository,
    activationBlockerRepository,
  });

  return {
    services,
    contractRepository,
    contractVersionRepository,
    salesTaskRepository,
    salesDocumentRepository,
    activationCaseRepository,
    activationHardwareRepository,
  };
}

type TestServices = ReturnType<typeof createTestServices>;

const admin = createUserContext({ id: 'user_004', name: 'Admin', role: 'admin', status: 'active' });
const field = createUserContext({ id: 'user_001', name: 'Laura', role: 'field_service', status: 'active' });
const foreignField = createUserContext({
  id: 'user_002',
  name: 'Thomas',
  role: 'field_service',
  status: 'active',
});

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const reviewer = { userId: 'user_004', role: 'admin' as const, displayName: 'Admin' };

async function createAcceptedOffer(services: TestServices['services']) {
  const offerRepository = new LocalOfferRepository();
  const workflow = services.offerWorkflowService;
  let offer = await offerRepository.create(createTestOffer({ workflowStatus: 'approval_required' }));
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
  if (!accepted.ok) throw new Error('accept failed');
  return accepted.offer;
}

/** Contract without terminal hardware (default demo catalog has no `payment_terminal` products). */
async function createContractInPreparation(services: TestServices['services']) {
  const offer = await createAcceptedOffer(services);
  const created = await services.contractService.createFromAcceptedOffer(offer.id, field);
  if (!created.ok) throw new Error('contract creation failed');
  return created.value;
}

interface SeedHardwareOptions {
  contractId: string;
  hardwareQuantity: number;
  status?: 'preparation' | 'activation';
}

/** Seeds a Contract + ContractVersion directly (bypassing the offer flow) with a hardware line. */
async function seedContractWithHardware(
  contractRepository: LocalContractRepository,
  contractVersionRepository: LocalContractVersionRepository,
  options: SeedHardwareOptions,
) {
  const versionId = `${options.contractId}_v1`;
  const version = await contractVersionRepository.create({
    id: versionId,
    schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
    contractId: options.contractId,
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
        companyName: 'Hardware Testfirma',
        contactFirstName: 'Max',
        contactLastName: 'Muster',
        street: 'Teststr. 1',
        postalCode: '10115',
        city: 'Berlin',
        email: 'max@example.test',
        phone: '',
        taxNumber: '',
        vatId: '',
      },
      tariffSnapshot: null,
      contractModel: 'terminal_plus_acq',
      termMonths: 36,
      startDate: '2026-01-01',
      endDate: '2029-01-01',
      noticePeriodMonths: 3,
      autoRenewal: true,
      renewalMonths: 12,
      terminalCount: options.hardwareQuantity,
      terminalLines: [],
      accessoryLines: [],
      hardware: [
        {
          productId: null,
          productName: 'Kartenterminal',
          model: 'A920',
          quantity: options.hardwareQuantity,
          mobility: 'mobile',
          acquisition: 'rental',
          activationStatus: 'pending',
          serialNumber: null,
          validFrom: '2026-01-01',
          validTo: null,
          unitPriceCents: 2500,
        },
      ],
      fees: {
        monthlyFeeCents: 2900,
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
        monthlyTotalCents: 2900,
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

  const contract = await contractRepository.create({
    id: options.contractId,
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    contractNumber: `V-2026-${options.contractId}`,
    sourceKey: `hw_test:${options.contractId}`,
    leadId: 'lead_001',
    sourceOfferId: null,
    acceptedOfferVersionId: null,
    currentVersionId: versionId,
    status: options.status ?? 'preparation',
    ownerUserId: 'user_001',
    startDate: '2026-01-01',
    termMonths: 36,
    endDate: '2029-01-01',
    noticePeriodMonths: 3,
    earliestTerminationDate: '2028-10-01',
    autoRenewal: true,
    renewalMonths: 12,
    activationOfferId: null,
    commissionCaseId: null,
    expectedCommissionCents: null,
    hardwareCount: options.hardwareQuantity,
    tariffName: 'Hardware-Tarif',
    customerCompanyName: 'Hardware Testfirma',
    nextDeadlineAt: null,
    nextDeadlineLabel: null,
    plannedChangeAt: null,
    terminationId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdByUserId: 'user_001',
    createdByDisplayName: 'Laura',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedByUserId: 'user_001',
  });

  return { contract, version };
}

function rawActivationCase(id: string, contractId: string, activationNumber: string, extra: Record<string, unknown> = {}) {
  return { id, contractId, activationNumber, status: 'preparation', ...extra };
}

describe('D Aktivierung & Onboarding', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.contracts, []);
    writeStorageItem(STORAGE_KEYS.contractVersions, []);
    writeStorageItem(STORAGE_KEYS.contractTerminations, []);
    writeStorageItem(STORAGE_KEYS.activationCases, []);
    writeStorageItem(STORAGE_KEYS.activationChecklists, []);
    writeStorageItem(STORAGE_KEYS.activationApplications, []);
    writeStorageItem(STORAGE_KEYS.activationHardware, []);
    writeStorageItem(STORAGE_KEYS.activationBlockers, []);
    writeStorageItem(STORAGE_KEYS.activationStorageVersion, CURRENT_ACTIVATION_STORAGE_VERSION);
  });

  describe('Domain-Grundlagen', () => {
    it('formatiert und validiert Aktivierungsnummern und generiert fortlaufende Sequenzen', () => {
      expect(isValidActivationNumberFormat('A-2026-00001')).toBe(true);
      expect(isValidActivationNumberFormat('X-2026-1')).toBe(false);
      expect(formatActivationNumber(2026, 7)).toBe('A-2026-00007');
      const next = generateNextActivationNumber(
        [
          { activationNumber: 'A-2026-00003' } as never,
          { activationNumber: 'A-2025-00099' } as never,
        ],
        '2026-05-01T00:00:00.000Z',
      );
      expect(next).toBe('A-2026-00004');
    });

    it('erlaubt nur definierte Statusübergänge', () => {
      expect(canTransitionActivationStatus('preparation', 'documents_pending')).toBe(true);
      expect(canTransitionActivationStatus('preparation', 'live')).toBe(false);
      expect(canTransitionActivationStatus('application_pending', 'setup_pending')).toBe(false);
      expect(canTransitionActivationStatus('go_live_ready', 'live')).toBe(true);
      expect(canTransitionActivationStatus('archived', 'preparation')).toBe(false);
    });

    it('baut den Idempotenz-Schlüssel stabil aus der Vertrags-ID', () => {
      expect(buildActivationSourceKey('contract_123')).toBe('contract:contract_123:initial-activation');
    });
  });

  describe('Start der Aktivierung', () => {
    it('startet eine Aktivierung aus einem Vertrag idempotent per sourceKey und überführt den Vertrag', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      expect(contract.status).toBe('preparation');

      const first = await services.activationService.startFromContract(contract.id, field);
      const second = await services.activationService.startFromContract(contract.id, field);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.value.id).toBe(second.value.id);
      expect(first.value.sourceKey).toBe(buildActivationSourceKey(contract.id));
      expect(first.value.activationNumber).toMatch(/^A-\d{4}-\d{5}$/);
      expect(first.value.status).toBe('preparation');

      const contractAfter = await services.contractService.getById(contract.id, field);
      expect(contractAfter.ok).toBe(true);
      if (contractAfter.ok) {
        expect(contractAfter.value.status).toBe('activation');
      }

      const checklist = await services.activationService.listChecklistItems(first.value.id, field);
      expect(checklist.ok).toBe(true);
      if (checklist.ok) {
        expect(checklist.value.length).toBeGreaterThan(0);
        expect(checklist.value.map((item) => item.key)).toContain('stammdaten_pruefung');
      }
    });

    it('lehnt Start aus einem Vertrag in ungültigem Status ab', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      const activated = await services.contractService.transitionStatus(contract.id, 'active', admin);
      expect(activated.ok).toBe(true);

      const started = await services.activationService.startFromContract(contract.id, field);
      expect(started.ok).toBe(false);
      if (!started.ok) {
        expect(started.error).toBe('invalid_status');
      }
    });
  });

  describe('Checkliste und Unterlagen', () => {
    it('prüft Abhängigkeiten, erzwingt Belegdokumente und treibt den Status automatisch voran', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;

      const listResult = await services.activationService.listChecklistItems(activationId, field);
      if (!listResult.ok) throw new Error('checklist failed');
      const byKey = new Map(listResult.value.map((item) => [item.key, item]));
      const stammdaten = byKey.get('stammdaten_pruefung')!;
      const vertrag = byKey.get('vertrag_bestaetigt')!;
      const unterlagenVertrag = byKey.get('unterlagen_vertrag')!;
      const unterlagenLegitimation = byKey.get('unterlagen_legitimation')!;

      const blockedByDependency = await services.activationService.updateChecklistItem(
        activationId,
        vertrag.id,
        { status: 'done' },
        field,
      );
      expect(blockedByDependency.ok).toBe(false);
      if (!blockedByDependency.ok) expect(blockedByDependency.error).toBe('conflict');

      const stammdatenDone = await services.activationService.updateChecklistItem(
        activationId,
        stammdaten.id,
        { status: 'done' },
        field,
      );
      expect(stammdatenDone.ok).toBe(true);

      const vertragDone = await services.activationService.updateChecklistItem(
        activationId,
        vertrag.id,
        { status: 'done' },
        field,
      );
      expect(vertragDone.ok).toBe(true);

      const missingEvidence = await services.activationService.updateChecklistItem(
        activationId,
        unterlagenVertrag.id,
        { status: 'done' },
        field,
      );
      expect(missingEvidence.ok).toBe(false);
      if (!missingEvidence.ok) expect(missingEvidence.error).toBe('validation');

      const afterVertrag = await services.activationService.getById(activationId, field);
      expect(afterVertrag.ok).toBe(true);
      if (afterVertrag.ok) expect(afterVertrag.value.status).toBe('documents_pending');

      const reviewedVertrag = await services.activationService.reviewDocument(
        activationId,
        { checklistItemId: unterlagenVertrag.id, type: 'contract', fileName: 'vertrag.pdf', mimeType: 'application/pdf' },
        field,
      );
      expect(reviewedVertrag.ok).toBe(true);
      if (reviewedVertrag.ok) {
        expect(reviewedVertrag.value.document.activationId).toBe(activationId);
        expect(reviewedVertrag.value.checklistItem.status).toBe('done');
      }

      const reviewedLegitimation = await services.activationService.reviewDocument(
        activationId,
        {
          checklistItemId: unterlagenLegitimation.id,
          type: 'activation_identification',
          fileName: 'ausweis.pdf',
          mimeType: 'application/pdf',
        },
        field,
      );
      expect(reviewedLegitimation.ok).toBe(true);

      const afterUnterlagen = await services.activationService.getById(activationId, field);
      expect(afterUnterlagen.ok).toBe(true);
      if (afterUnterlagen.ok) expect(afterUnterlagen.value.status).toBe('application_pending');

      const documents = await services.activationService.listDocuments(activationId, field);
      expect(documents.ok).toBe(true);
      if (documents.ok) expect(documents.value).toHaveLength(2);
    });
  });

  describe('Voller Lebenszyklus ohne Hardware', () => {
    it('durchläuft Vorbereitung bis Übergabe und lässt Provision unangetastet', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;

      const listResult = await services.activationService.listChecklistItems(activationId, field);
      if (!listResult.ok) throw new Error('checklist failed');
      const byKey = new Map(listResult.value.map((item) => [item.key, item]));

      async function markDone(key: string) {
        const item = byKey.get(key);
        if (!item) throw new Error(`missing checklist item ${key}`);
        const result = await services.activationService.updateChecklistItem(activationId, item.id, { status: 'done' }, field);
        expect(result.ok).toBe(true);
      }

      await markDone('stammdaten_pruefung');
      await markDone('vertrag_bestaetigt');

      const docVertrag = await services.activationService.reviewDocument(
        activationId,
        { checklistItemId: byKey.get('unterlagen_vertrag')!.id, type: 'contract', fileName: 'vertrag.pdf', mimeType: 'application/pdf' },
        field,
      );
      expect(docVertrag.ok).toBe(true);
      const docLegitimation = await services.activationService.reviewDocument(
        activationId,
        {
          checklistItemId: byKey.get('unterlagen_legitimation')!.id,
          type: 'activation_identification',
          fileName: 'ausweis.pdf',
          mimeType: 'application/pdf',
        },
        field,
      );
      expect(docLegitimation.ok).toBe(true);

      await markDone('haendlerantrag_erstellen');
      await markDone('acquiring_antrag');

      const stuck = await services.activationService.getById(activationId, field);
      expect(stuck.ok).toBe(true);
      if (stuck.ok) expect(stuck.value.status).toBe('application_pending');

      const toProviderReview = await services.activationService.transitionStatus(activationId, 'provider_review', field);
      expect(toProviderReview.ok).toBe(true);
      const toSetupPending = await services.activationService.transitionStatus(activationId, 'setup_pending', field);
      expect(toSetupPending.ok).toBe(true);

      await markDone('einrichtung_ohne_hardware');
      const afterSetup = await services.activationService.getById(activationId, field);
      if (afterSetup.ok) expect(afterSetup.value.status).toBe('testing');

      await markDone('test_ohne_hardware');
      const afterTest = await services.activationService.getById(activationId, field);
      if (afterTest.ok) expect(afterTest.value.status).toBe('go_live_ready');

      await markDone('go_live_freigabe');
      await markDone('abschluss_dokumentation');
      await markDone('uebergabe_kunde');

      const deniedGoLive = await services.activationService.confirmGoLive(activationId, field);
      expect(deniedGoLive.ok).toBe(false);
      if (!deniedGoLive.ok) expect(deniedGoLive.error).toBe('forbidden');

      const goLive = await services.activationService.confirmGoLive(activationId, admin);
      expect(goLive.ok).toBe(true);
      if (goLive.ok) {
        expect(goLive.value.status).toBe('live');
        expect(goLive.value.confirmedGoLive).not.toBeNull();
      }

      const contractAfterGoLive = await services.contractService.getById(contract.id, field);
      expect(contractAfterGoLive.ok).toBe(true);
      if (contractAfterGoLive.ok) expect(contractAfterGoLive.value.status).toBe('active');

      const deniedComplete = await services.activationService.completeActivation(activationId, field);
      expect(deniedComplete.ok).toBe(false);

      const completed = await services.activationService.completeActivation(activationId, admin);
      expect(completed.ok).toBe(true);
      if (completed.ok) {
        expect(completed.value.status).toBe('completed');
        expect(completed.value.completedAt).not.toBeNull();
      }

      const handoverReady = await services.activationService.markHandoverReady(activationId, admin);
      expect(handoverReady.ok).toBe(true);

      const handoverConfirmed = await services.activationService.confirmHandover(activationId, admin);
      expect(handoverConfirmed.ok).toBe(true);
      if (handoverConfirmed.ok) expect(handoverConfirmed.value.handedOverAt).not.toBeNull();

      const handoverAgain = await services.activationService.confirmHandover(activationId, admin);
      expect(handoverAgain.ok).toBe(true);
      if (handoverAgain.ok && handoverConfirmed.ok) {
        expect(handoverAgain.value.handedOverAt).toBe(handoverConfirmed.value.handedOverAt);
      }
    });
  });

  describe('Hardware', () => {
    it('verwaltet Bestellung, Zuordnung, Duplikatwarnung, Versand und Test', async () => {
      const { services, contractRepository, contractVersionRepository } = createTestServices();
      await seedContractWithHardware(contractRepository, contractVersionRepository, {
        contractId: 'contract_hw_1',
        hardwareQuantity: 2,
      });

      const start = await services.activationService.startFromContract('contract_hw_1', field);
      expect(start.ok).toBe(true);
      if (!start.ok) return;
      const activationId = start.value.id;

      const hardwareResult = await services.activationService.listHardware(activationId, field);
      expect(hardwareResult.ok).toBe(true);
      if (!hardwareResult.ok) return;
      expect(hardwareResult.value).toHaveLength(2);
      const [unit1, unit2] = hardwareResult.value;

      const ordered = await services.activationService.updateHardware(
        activationId,
        unit1!.id,
        { kind: 'order', orderReference: 'PO-1' },
        field,
      );
      expect(ordered.ok).toBe(true);
      if (ordered.ok) expect(ordered.value.status).toBe('ordered');

      const assigned1 = await services.activationService.updateHardware(
        activationId,
        unit1!.id,
        { kind: 'assign', serialNumber: 'SN-100' },
        field,
      );
      expect(assigned1.ok).toBe(true);
      if (assigned1.ok) {
        expect(assigned1.value.status).toBe('assigned');
        expect(assigned1.warning).toBeUndefined();
      }

      const assigned2 = await services.activationService.updateHardware(
        activationId,
        unit2!.id,
        { kind: 'assign', serialNumber: 'SN-100' },
        field,
      );
      expect(assigned2.ok).toBe(true);
      if (assigned2.ok) {
        expect(assigned2.warning).toMatch(/SN-100/);
      }

      await services.activationService.updateHardware(activationId, unit1!.id, { kind: 'ship', trackingReference: 'TRACK-1' }, field);
      await services.activationService.updateHardware(activationId, unit1!.id, { kind: 'deliver' }, field);
      await services.activationService.updateHardware(activationId, unit1!.id, { kind: 'setup' }, field);
      const tested = await services.activationService.updateHardware(activationId, unit1!.id, { kind: 'test' }, field);
      expect(tested.ok).toBe(true);
      if (tested.ok) expect(tested.value.status).toBe('tested');

      const handedOver = await services.activationService.updateHardware(
        activationId,
        unit1!.id,
        { kind: 'handover', toName: 'Kunde GmbH' },
        field,
      );
      expect(handedOver.ok).toBe(true);
      if (handedOver.ok) expect(handedOver.value.status).toBe('active');
    });

    it('warnt bei Seriennummer-Duplikaten über verschiedene aktive Aktivierungen hinweg', async () => {
      const { services, contractRepository, contractVersionRepository } = createTestServices();
      await seedContractWithHardware(contractRepository, contractVersionRepository, { contractId: 'contract_hw_3a', hardwareQuantity: 1 });
      await seedContractWithHardware(contractRepository, contractVersionRepository, { contractId: 'contract_hw_3b', hardwareQuantity: 1 });

      const startA = await services.activationService.startFromContract('contract_hw_3a', field);
      const startB = await services.activationService.startFromContract('contract_hw_3b', field);
      if (!startA.ok || !startB.ok) throw new Error('start failed');

      const hwA = await services.activationService.listHardware(startA.value.id, field);
      const hwB = await services.activationService.listHardware(startB.value.id, field);
      if (!hwA.ok || !hwB.ok) throw new Error('hw failed');

      const first = await services.activationService.updateHardware(
        startA.value.id,
        hwA.value[0]!.id,
        { kind: 'assign', serialNumber: 'SN-DUP' },
        field,
      );
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.warning).toBeUndefined();

      const second = await services.activationService.updateHardware(
        startB.value.id,
        hwB.value[0]!.id,
        { kind: 'assign', serialNumber: 'SN-DUP' },
        field,
      );
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.warning).toMatch(/SN-DUP/);
    });

    it('erfasst eine Hardwareabweichung als harten Blocker und löst ihn wieder auf', async () => {
      const { services, contractRepository, contractVersionRepository } = createTestServices();
      await seedContractWithHardware(contractRepository, contractVersionRepository, { contractId: 'contract_hw_2', hardwareQuantity: 1 });
      const start = await services.activationService.startFromContract('contract_hw_2', field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;
      const statusBefore = start.value.status;

      const hardware = await services.activationService.listHardware(activationId, field);
      if (!hardware.ok) throw new Error('hw failed');
      const unit = hardware.value[0]!;

      const deviation = await services.activationService.recordHardwareDeviation(
        activationId,
        unit.id,
        { description: 'Gerät beschädigt angekommen', contractChangeNote: 'Austausch angefragt' },
        field,
      );
      expect(deviation.ok).toBe(true);
      if (!deviation.ok) return;
      expect(deviation.value.severity).toBe('hard');
      expect(deviation.value.status).toBe('open');

      const blockedCase = await services.activationService.getById(activationId, field);
      expect(blockedCase.ok).toBe(true);
      if (blockedCase.ok) {
        expect(blockedCase.value.status).toBe('blocked');
        expect(blockedCase.value.blockedFromStatus).toBe(statusBefore);
      }

      const goLiveAttempt = await services.activationService.confirmGoLive(activationId, admin);
      expect(goLiveAttempt.ok).toBe(false);

      const resolveWithoutNote = await services.activationService.resolveBlocker(deviation.value.id, '', field);
      expect(resolveWithoutNote.ok).toBe(false);

      const resolved = await services.activationService.resolveBlocker(
        deviation.value.id,
        'Gerät ausgetauscht, neues Gerät funktionsfähig',
        field,
      );
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.value.status).toBe('resolved');

      const afterResolve = await services.activationService.getById(activationId, field);
      expect(afterResolve.ok).toBe(true);
      if (afterResolve.ok) {
        expect(afterResolve.value.status).toBe(statusBefore);
        expect(afterResolve.value.blockedFromStatus).toBeNull();
      }
    });
  });

  describe('Anträge', () => {
    it('durchläuft Antragsworkflow inklusive Rückfrage, Genehmigung und Ablehnung', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;

      const created = await services.activationService.createApplication(
        activationId,
        { type: 'merchant_setup', title: 'Händlerantrag' },
        field,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.value.status).toBe('draft');

      const submitted = await services.activationService.submitApplication(created.value.id, field);
      expect(submitted.ok).toBe(true);
      if (submitted.ok) {
        expect(submitted.value.status).toBe('submitted');
        expect(submitted.value.submittedAt).not.toBeNull();
      }

      const inquiry = await services.activationService.markInquiry(created.value.id, 'Bitte Ausweiskopie nachreichen', field);
      expect(inquiry.ok).toBe(true);
      if (inquiry.ok) {
        expect(inquiry.value.status).toBe('inquiry');
        expect(inquiry.value.inquiryNote).toContain('Ausweiskopie');
      }

      const approved = await services.activationService.approveApplication(created.value.id, 'Alles vollständig', admin);
      expect(approved.ok).toBe(true);
      if (approved.ok) expect(approved.value.status).toBe('approved');

      const rejectedWithoutNote = await services.activationService.rejectApplication(created.value.id, '', admin);
      expect(rejectedWithoutNote.ok).toBe(false);

      const second = await services.activationService.createApplication(
        activationId,
        { type: 'acquiring', title: 'Acquiring-Antrag' },
        field,
      );
      if (!second.ok) throw new Error('second application failed');
      await services.activationService.submitApplication(second.value.id, field);
      const rejected = await services.activationService.rejectApplication(second.value.id, 'Bonität unzureichend', admin);
      expect(rejected.ok).toBe(true);
      if (rejected.ok) expect(rejected.value.status).toBe('rejected');

      const applications = await services.activationService.listApplications(activationId, field);
      expect(applications.ok).toBe(true);
      if (applications.ok) expect(applications.value).toHaveLength(2);
    });
  });

  describe('Berechtigungen', () => {
    it('verweigert Außendienst kritische Freigabeaktionen und fremde Detailansicht', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);

      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;

      const deniedForeignView = await services.activationService.getById(activationId, foreignField);
      expect(deniedForeignView.ok).toBe(false);
      if (!deniedForeignView.ok) expect(deniedForeignView.error).toBe('forbidden');

      const deniedGoLive = await services.activationService.confirmGoLive(activationId, field);
      expect(deniedGoLive.ok).toBe(false);
      if (!deniedGoLive.ok) expect(deniedGoLive.error).toBe('forbidden');

      const deniedComplete = await services.activationService.completeActivation(activationId, field);
      expect(deniedComplete.ok).toBe(false);
      if (!deniedComplete.ok) expect(deniedComplete.error).toBe('forbidden');

      const deniedCancel = await services.activationService.cancelActivation(activationId, 'Testabbruch', field);
      expect(deniedCancel.ok).toBe(false);
      if (!deniedCancel.ok) expect(deniedCancel.error).toBe('forbidden');

      const allowedCancel = await services.activationService.cancelActivation(activationId, 'Testabbruch', admin);
      expect(allowedCancel.ok).toBe(true);
      if (allowedCancel.ok) expect(allowedCancel.value.status).toBe('cancelled');
    });

    it('lässt Blocker für berechtigten Außendienst zu und verweigert fremde Detailansicht', async () => {
      const { services } = createTestServices();
      const contract = await createContractInPreparation(services);
      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');

      const deniedView = await services.activationService.getById(start.value.id, foreignField);
      expect(deniedView.ok).toBe(false);
      if (!deniedView.ok) expect(deniedView.error).toBe('forbidden');

      const allowed = await services.activationService.createBlocker(
        start.value.id,
        { category: 'other', severity: 'note', title: 'Hinweis', description: 'Test' },
        field,
      );
      expect(allowed.ok).toBe(true);
    });
  });

  describe('Automatisierung & Migration', () => {
    it('erstellt automatische Folgeaufgaben idempotent über den sourceKey', async () => {
      const { services, salesTaskRepository } = createTestServices();
      const contract = await createContractInPreparation(services);
      const start = await services.activationService.startFromContract(contract.id, field);
      if (!start.ok) throw new Error('start failed');
      const activationId = start.value.id;

      await services.activationService.ensureAutomaticTasks(start.value, field);
      await services.activationService.ensureAutomaticTasks(start.value, field);

      const tasks = await salesTaskRepository.getAll();
      const stepTasks = tasks.filter(
        (task) => task.activationId === activationId && (task.sourceKey ?? '').startsWith('auto:activation_step:'),
      );
      expect(stepTasks).toHaveLength(1);
    });

    it('listet Verträge ohne Aktivierung als Migrationskandidaten und entfernt sie nach Start', async () => {
      const { services, contractRepository, contractVersionRepository } = createTestServices();
      await seedContractWithHardware(contractRepository, contractVersionRepository, {
        contractId: 'contract_migrate_1',
        hardwareQuantity: 1,
        status: 'activation',
      });

      const candidatesBefore = await services.activationService.migrateCandidates(admin);
      expect(candidatesBefore.some((entry) => entry.contractId === 'contract_migrate_1')).toBe(true);

      const started = await services.activationService.startFromContract('contract_migrate_1', field);
      expect(started.ok).toBe(true);

      const candidatesAfter = await services.activationService.migrateCandidates(admin);
      expect(candidatesAfter.some((entry) => entry.contractId === 'contract_migrate_1')).toBe(false);
    });

    it('normalisiert und isoliert defekte Aktivierungsdatensätze konservativ und idempotent', () => {
      writeStorageItem(STORAGE_KEYS.activationStorageVersion, 0);
      writeStorageItem(STORAGE_KEYS.activationCases, [
        rawActivationCase('case_valid', 'contract_x', 'A-2026-00001'),
        rawActivationCase('', 'contract_x', 'A-2026-00002'),
        { contractId: 'contract_x', activationNumber: 'A-2026-00003' },
        null,
      ]);

      migrateActivationStorageIfNeeded();

      const stored = readStorageItem<unknown[]>(STORAGE_KEYS.activationCases) ?? [];
      expect(stored).toHaveLength(1);
      expect(readStorageItem<number>(STORAGE_KEYS.activationStorageVersion)).toBe(CURRENT_ACTIVATION_STORAGE_VERSION);

      const before = JSON.stringify(readStorageItem(STORAGE_KEYS.activationCases));
      migrateActivationStorageIfNeeded();
      const after = JSON.stringify(readStorageItem(STORAGE_KEYS.activationCases));
      expect(after).toBe(before);
    });
  });

  describe('Diagnose & Export', () => {
    it('erkennt verwaiste Aktivierungs-Entitäten und doppelte Aktivierungsnummern/Seriennummern', async () => {
      const { services } = createTestServices();
      writeStorageItem(STORAGE_KEYS.activationCases, [
        rawActivationCase('case_1', 'missing_contract', 'A-2026-00001'),
        rawActivationCase('case_2', 'missing_contract', 'A-2026-00001'),
      ]);
      writeStorageItem(STORAGE_KEYS.activationChecklists, [
        { id: 'chk_orphan', activationId: 'unknown_case', key: 'k1', schemaVersion: 1 },
      ]);
      writeStorageItem(STORAGE_KEYS.activationHardware, [
        { id: 'hw_orphan', activationId: 'unknown_case', schemaVersion: 1, serialNumber: 'SN-X' },
        { id: 'hw_dup1', activationId: 'case_1', schemaVersion: 1, serialNumber: 'SN-DUP2' },
        { id: 'hw_dup2', activationId: 'case_1', schemaVersion: 1, serialNumber: 'SN-DUP2' },
      ]);
      writeStorageItem(STORAGE_KEYS.activationBlockers, [
        { id: 'blk_orphan', activationId: 'unknown_case', schemaVersion: 1, status: 'open' },
        { id: 'blk_unresolved_note', activationId: 'case_1', schemaVersion: 1, status: 'resolved', resolutionNote: '' },
      ]);

      const findings = await services.dataDiagnosticService.runDiagnostics(admin);
      expect(Array.isArray(findings)).toBe(true);
      if (!Array.isArray(findings)) return;

      const areas = findings.map((finding) => finding.area);
      expect(areas).toContain('activation_case');
      expect(areas).toContain('activation_checklist');
      expect(areas).toContain('activation_hardware');
      expect(areas).toContain('activation_blocker');
      expect(findings.some((finding) => finding.description.includes('Doppelte Aktivierungsnummer'))).toBe(true);
      expect(findings.some((finding) => finding.description.includes('mehrfach vergeben'))).toBe(true);
      expect(findings.some((finding) => finding.description.includes('ohne gültigen Vertrag'))).toBe(true);
    });

    it('nimmt Aktivierungsbereiche in das Exportmanifest und Backup auf', async () => {
      const { services } = createTestServices();
      const backup = await services.dataExportService.exportFullBackup(admin);
      expect(backup.ok).toBe(true);
      if (!backup.ok) return;
      expect(backup.manifest.schemaVersions).toMatchObject({ activations: CURRENT_ACTIVATION_STORAGE_VERSION });
      expect(backup.manifest.includedAreas).toEqual(
        expect.arrayContaining([
          STORAGE_KEYS.activationCases,
          STORAGE_KEYS.activationChecklists,
          STORAGE_KEYS.activationApplications,
          STORAGE_KEYS.activationHardware,
          STORAGE_KEYS.activationBlockers,
        ]),
      );
    });
  });
});
