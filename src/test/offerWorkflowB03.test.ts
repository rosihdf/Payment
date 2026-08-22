import { beforeEach, describe, expect, it } from 'vitest';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import { deriveContractModel, deriveTerminalSnapshot } from '../domain/offer/deriveOfferSnapshotFields';
import { normalizeOfferVersion } from '../domain/offer/normalizeOfferVersion';
import {
  applyWorkflowTransition,
  canTransitionWorkflowStatus,
  isImmutableWorkflowStatus,
} from '../domain/offer/offerWorkflow';
import {
  validateActivationChecklist,
  validateActivationDeviations,
  validateStructuredAcceptance,
  validateStructuredDecline,
} from '../domain/offer/offerWorkflowValidation';
import { validateOfferVersionSnapshot } from '../domain/offer/offerVersionSnapshotValidation';
import { deriveSalesPipelinePhase } from '../domain/salesWorkspace/salesPipeline';
import { createServices } from '../services';
import { createTestRepositories } from './helpers/createTestRepositories';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { migrateOfferStorageIfNeeded } from '../services/offerStorageMigration';
import {
  CURRENT_OFFER_WORKFLOW_STORAGE_VERSION,
  migrateOfferWorkflowStorageIfNeeded,
} from '../services/offerWorkflowStorageMigration';
import { OfferWorkflowService } from '../services/offerWorkflowService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  createTestOffer,
  createValidOfferInput,
  confirmCounselingAndDocumentSent,
  FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const reviewer = { userId: 'user_002', role: 'field_service' as const, displayName: 'Thomas' };

function createWorkflow() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    offers: repos.offerRepository,
    service: services.offerWorkflowService,
    offerDocumentService: services.offerDocumentService,
  };
}

function createWizardService() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    wizard: services.salesWizardService,
    offerWorkflowService: services.offerWorkflowService,
    offerRepository: repos.offerRepository,
    offerService: services.offerService,
  };
}

async function advanceToSent(
  service: OfferWorkflowService,
  offerId: string,
  offerDocumentService: import('../services/offerDocumentService').OfferDocumentService,
) {
  await service.approve(offerId, reviewer);
  await service.markReadyToSend(offerId, owner);
  await confirmCounselingAndDocumentSent(service, offerId, owner, offerDocumentService);
}

describe('B03 Angebotsworkflow', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  describe('Snapshot-Domain', () => {
    it('leitet Terminal- und Vertragsdaten reproduzierbar ab', () => {
      const offer = createTestOffer();
      offer.items = [{
        ...offer.items[0]!,
        quantity: 2,
        priceType: 'monthly',
        productSnapshot: { ...offer.items[0]!.productSnapshot!, category: 'payment_terminal' },
      }, {
        ...offer.items[0]!,
        id: 'optional',
        quantity: 1,
        priceType: 'on_request',
        productSnapshot: { ...offer.items[0]!.productSnapshot!, category: 'payment_terminal' },
      }];
      expect(deriveTerminalSnapshot(offer.items)).toMatchObject({ terminalCount: 2, optionalTerminalCount: 1 });
      expect(deriveContractModel(offer.items, offer.tariffSnapshot)).toBe('rental');
    });

    it('validiert alle verpflichtenden Snapshot-Felder', async () => {
      const { offers, service } = createWorkflow();
      const versioned = await service.ensureInitialVersion(await offers.create(createTestOffer()));
      const version = await service.getCurrentVersion(versioned.id);
      expect(version && validateOfferVersionSnapshot(version.snapshot).valid).toBe(true);
      expect(version && validateOfferVersionSnapshot({ ...version.snapshot, offerNumber: '' }).issues)
        .toContain('Angebotsnummer fehlt.');
    });

    it('normalisiert alle OfferVersionSnapshot-Felder inklusive contractModel und terminalLines', () => {
      const offer = createTestOffer();
      const snapshot = buildOfferVersionSnapshot(offer);
      const normalized = normalizeOfferVersion({
        id: 'offer_version_test',
        offerId: offer.id,
        versionNumber: 1,
        workflowStatus: 'draft',
        snapshot: {
          ...snapshot,
          contractModel: 'invalid_model',
          terminalLines: 'not-an-array',
          accessoryLines: null,
          totals: { monthlyItemsTotalCents: 'bad' },
          approvalReasons: [' ok ', 42, ''],
          termMonths: '36',
          savingsCents: '100',
        },
        createdAt: offer.createdAt,
        createdByUserId: owner.userId,
        createdByDisplayName: owner.displayName,
      });
      expect(normalized?.snapshot.contractModel).toBe(
        deriveContractModel(offer.items, offer.tariffSnapshot),
      );
      expect(Array.isArray(normalized?.snapshot.terminalLines)).toBe(true);
      expect(Array.isArray(normalized?.snapshot.accessoryLines)).toBe(true);
      expect(typeof normalized?.snapshot.totals.monthlyTotalCents).toBe('number');
      expect(normalized?.snapshot.approvalReasons).toEqual(['ok']);
      expect(normalized?.snapshot.termMonths).toBe(36);
      expect(normalized?.snapshot.savingsCents).toBe(100);
    });
  });

  describe('Workflow-Übergänge', () => {
    it('blockiert verbotene Sprünge und erlaubt nur definierte Übergänge', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'draft' }));
      await service.ensureInitialVersion(offer);

      expect(canTransitionWorkflowStatus('draft', 'accept')).toBe(false);
      expect(applyWorkflowTransition('draft', 'accept')).toBeNull();
      expect((await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'email_confirmation',
        otherText: null,
        note: '',
      })).ok).toBe(false);

      expect(canTransitionWorkflowStatus('draft', 'submit_for_approval')).toBe(true);
    });

    it('leitet completeOffer nur über den Workflow ab', async () => {
      const repos = createTestRepositories();
      const services = createServices(repos);
      const offer = await repos.offerRepository.create(createTestOffer({ workflowStatus: 'draft' }));
      await services.offerWorkflowService.ensureInitialVersion(offer);

      const result = await services.offerService.completeOffer(offer.id, owner);

      expect(result.ok).toBe(false);
      if (!result.ok && 'error' in result) {
        expect(result.error).toBe('invalid_status');
      }
    });

    it('erzwingt Vier-Augen-Freigabe', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      await service.ensureInitialVersion(offer);

      expect((await service.approve(offer.id, owner)).ok).toBe(false);
      expect((await service.approve(offer.id, reviewer)).ok).toBe(true);
    });

    it('markiert versendete Angebote als unveränderbar', async () => {
      const { offers, service, offerDocumentService } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      await service.ensureInitialVersion(offer);
      await advanceToSent(service, offer.id, offerDocumentService);

      const summary = await service.getWorkflowSummary(offer.id);
      expect(isImmutableWorkflowStatus(summary.offer!.workflowStatus)).toBe(true);
      expect(summary.immutable).toBe(true);
    });

    it('durchläuft Versand bis Annahme', async () => {
      const { offers, service, offerDocumentService } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      await service.ensureInitialVersion(offer);
      await advanceToSent(service, offer.id, offerDocumentService);

      const accepted = await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'digital_confirmation',
        otherText: null,
        note: '',
      });
      expect(accepted.ok && accepted.offer.workflowStatus).toBe('accepted');
      expect((await service.getWorkflowSummary(offer.id)).events.map((event) => event.type))
        .toEqual(expect.arrayContaining(['approval', 'dispatch', 'acceptance']));
    });
  });

  describe('Versionserstellung bei relevanten Änderungen', () => {
    it('erkennt relevante Änderungen und legt neue Versionen an', async () => {
      const { offers, service } = createWorkflow();
      let offer = await offers.create(createTestOffer({ title: 'Version 1', validUntil: '2026-12-31T23:59:59.000Z' }));
      offer = await service.ensureInitialVersion(offer);

      expect(await service.detectRelevantChanges(offer.id)).toHaveLength(0);

      offer = await offers.update({
        ...(await offers.getById(offer.id))!,
        title: 'Version 2',
        validUntil: '2027-01-31T23:59:59.000Z',
      });
      const diffs = await service.detectRelevantChanges(offer.id);
      expect(diffs.some((entry) => entry.field === 'title' || entry.field === 'validUntil')).toBe(true);

      const version = await service.createNewVersionIfNeeded(offer.id, 'Inhalte geändert', owner);
      expect(version?.versionNumber).toBe(2);
      expect(await service.getVersions(offer.id)).toHaveLength(2);
    });

    it('legt die Initialversion idempotent an', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer());
      const first = await service.ensureInitialVersion(offer);
      const second = await service.ensureInitialVersion(first);
      expect(first.currentVersionNumber).toBe(1);
      expect(second.currentVersionId).toBe(first.currentVersionId);
      expect(await service.getVersions(offer.id)).toHaveLength(1);
    });
  });

  describe('Strukturierte Annahme', () => {
    it('speichert strukturierte Annahmedaten', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'sent' }));
      await service.ensureInitialVersion(offer);
      await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'digital_confirmation',
        otherText: null,
        note: 'Signiert',
      });
      const events = (await service.getWorkflowSummary(offer.id)).events;
      expect(events.find((event) => event.type === 'acceptance')).toMatchObject({
        acceptanceType: 'digital_confirmation',
      });
    });

    it('verlangt Freitext bei acceptanceType other', async () => {
      expect(validateStructuredAcceptance({
        acceptedByName: 'Kunde',
        acceptanceType: 'other',
        otherText: null,
      })).toBeTruthy();

      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'sent' }));
      await service.ensureInitialVersion(offer);

      expect((await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'other',
        otherText: null,
        note: '',
      })).ok).toBe(false);

      const accepted = await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'other',
        otherText: 'Mündliche Zusage per Telefon',
        note: '',
      });
      expect(accepted.ok).toBe(true);
    });

    it('erzeugt genau einen Vertrag bei Annahme und bleibt idempotent', async () => {
      const repos = createTestRepositories();
      const services = createServices(repos);
      const offer = await repos.offerRepository.create(createTestOffer({ workflowStatus: 'sent' }));
      await services.offerWorkflowService.ensureInitialVersion(offer);
      const acceptance = {
        acceptedByName: 'Kunde',
        acceptanceType: 'digital_confirmation' as const,
        otherText: null,
        note: '',
      };

      const accepted = await services.offerWorkflowService.acceptOffer(offer.id, owner, acceptance);
      expect(accepted.ok).toBe(true);
      expect((await repos.contractRepository.getByOfferId(offer.id))?.sourceOfferId).toBe(offer.id);

      const duplicate = await services.offerWorkflowService.acceptOffer(offer.id, owner, acceptance);
      expect(duplicate.ok).toBe(true);
      if (duplicate.ok) {
        expect(duplicate.duplicate).toBe(true);
      }
      expect((await repos.contractRepository.getAll()).filter((contract) => contract.sourceOfferId === offer.id))
        .toHaveLength(1);
    });
  });

  describe('Strukturierte Ablehnung', () => {
    it('speichert strukturierte Ablehnungsgründe', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'sent' }));
      await service.ensureInitialVersion(offer);

      const declined = await service.declineOffer(offer.id, owner, {
        reason: 'price',
        otherText: null,
        note: 'Zu teuer',
      });
      expect(declined.ok).toBe(true);
      const event = (await service.getWorkflowSummary(offer.id)).events.find((entry) => entry.type === 'decline');
      expect(event).toMatchObject({ reason: 'price' });
    });

    it('verlangt Freitext bei reason other', async () => {
      expect(validateStructuredDecline({ reason: 'other', otherText: null })).toBeTruthy();

      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'sent' }));
      await service.ensureInitialVersion(offer);

      expect((await service.declineOffer(offer.id, owner, {
        reason: 'other',
        otherText: '',
        note: '',
      })).ok).toBe(false);

      const declined = await service.declineOffer(offer.id, owner, {
        reason: 'other',
        otherText: 'Projekt verschoben auf nächstes Jahr',
        note: '',
      });
      expect(declined.ok).toBe(true);
    });
  });

  describe('Aktivierungscheckliste und Abweichungen', () => {
    it('blockiert Aktivierung ohne vollständige Checkliste', async () => {
      expect(validateActivationChecklist({ offerVersionId: 'v1', checks: { contract: false } })).toBeTruthy();

      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'accepted' }));
      await service.ensureInitialVersion(offer);
      const versionId = (await service.getCurrentVersion(offer.id))!.id;

      expect((await service.prepareActivation(offer.id, owner, {
        offerVersionId: versionId,
        checks: { contract: true, customer: false },
      })).ok).toBe(false);

      const prepared = await service.prepareActivation(offer.id, owner, {
        offerVersionId: versionId,
        checks: { contract: true, customer: true },
      });
      expect(prepared.ok).toBe(true);
    });

    it('blockiert Aktivierung bei Abweichungen ohne Begründung', async () => {
      expect(validateActivationDeviations([{
        field: 'terminalCount',
        expected: '2',
        actual: '1',
        reason: '',
      }])).toBeTruthy();

      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'activation_pending' }));
      await service.ensureInitialVersion(offer);

      expect((await service.activate(offer.id, owner, {
        deviations: [{ field: 'terminalCount', expected: '2', actual: '1', reason: '' }],
      })).ok).toBe(false);

      const activated = await service.activate(offer.id, owner, {
        externalReference: 'EXT-1',
        deviations: [{ field: 'terminalCount', expected: '2', actual: '1', reason: 'Kunde reduziert' }],
        activatedHardware: ['T1'],
      });
      expect(activated.ok).toBe(true);
    });

    it('speichert Annahme und Aktivierung mit strukturierten Daten', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'sent' }));
      await service.ensureInitialVersion(offer);
      await service.acceptOffer(offer.id, owner, {
        acceptedByName: 'Kunde',
        acceptanceType: 'digital_confirmation',
        otherText: null,
        note: 'Signiert',
      });
      await service.prepareActivation(offer.id, owner, {
        offerVersionId: (await service.getCurrentVersion(offer.id))!.id,
        checks: { contract: true },
      });
      await service.activate(offer.id, owner, { externalReference: 'EXT-1', activatedHardware: ['T1'] });
      const events = (await service.getWorkflowSummary(offer.id)).events;
      expect(events.find((event) => event.type === 'activation' && event.status === 'activated'))
        .toMatchObject({ externalReference: 'EXT-1' });
    });
  });

  describe('Wizard-Integration', () => {
    beforeEach(() => {
      seedTestRecommendationCatalog();
      writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
    });

    it('liefert Wizard-Workflow-View und synchronisiert Angebotsquellen', async () => {
      const { offerWorkflowService, offerRepository } = createWizardService();
      const offer = await offerRepository.create(createTestOffer({ workflowStatus: 'draft' }));
      await offerWorkflowService.ensureInitialVersion(offer);

      const synced = await offerWorkflowService.syncOfferAfterWizardCreation(
        offer.id,
        'session_wizard_1',
        'scenario_wizard_1',
        FIELD_SERVICE_CONTEXT,
      );
      expect(synced?.sourceComparisonSessionId).toBe('session_wizard_1');
      expect(synced?.sourceScenarioId).toBe('scenario_wizard_1');

      const view = await offerWorkflowService.getWizardWorkflowView(offer.id);
      expect(view.workflowStatus).toBe('draft');
      expect(view.version?.versionNumber).toBe(1);
      expect(offerWorkflowService.resolveWizardStepFromWorkflow('approval_required')).toBe('approval');
    });

    it('verknüpft SalesWizardService mit OfferWorkflowService', async () => {
      const { wizard, offerWorkflowService, offerService } = createWizardService();
      const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };
      const created = await offerService.createOffer(createValidOfferInput(), context);
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const view = await offerWorkflowService.getWizardWorkflowView(created.offer.id);
      expect(view.offer?.currentVersionNumber).toBe(1);

      const session = await wizard.startWizard(context);
      expect(session.wizard.enabled).toBe(true);
      expect(offerWorkflowService.resolveWizardStepFromWorkflow(view.workflowStatus ?? 'draft')).toBe('offer');
    });
  });

  describe('Migration-Idempotenz', () => {
    it('migriert Altangebote und leitet Workflow-Pipelinephasen ab', () => {
      const legacy = createTestOffer();
      const { workflowStatus: _workflowStatus, currentVersionNumber: _number, currentVersionId: _id,
        sourceComparisonSessionId: _comparison, sourceScenarioId: _scenario, ...legacyRaw } = legacy;
      writeStorageItem(STORAGE_KEYS.offers, [legacyRaw]);
      writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);
      migrateOfferStorageIfNeeded();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.offerVersions) ?? '[]')).toHaveLength(1);
      expect(deriveSalesPipelinePhase({
        lead: null, sessions: [], offers: [{ ...legacy, workflowStatus: 'sent' }], tasks: [],
        activities: [], commissionCaseStatus: null, approvalRequired: false, approvalBlocked: false,
      })).toBe('follow_up');
    });

    it('ist bei wiederholter Ausführung idempotent', () => {
      writeStorageItem(STORAGE_KEYS.offers, [createTestOffer({ id: 'offer_stable' })]);
      writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);
      writeStorageItem(STORAGE_KEYS.offerWorkflowStorageVersion, 0);

      migrateOfferStorageIfNeeded();
      migrateOfferWorkflowStorageIfNeeded();
      const firstOffers = localStorage.getItem(STORAGE_KEYS.offers);
      const firstVersions = localStorage.getItem(STORAGE_KEYS.offerVersions);

      migrateOfferStorageIfNeeded();
      migrateOfferWorkflowStorageIfNeeded();
      expect(localStorage.getItem(STORAGE_KEYS.offers)).toBe(firstOffers);
      expect(localStorage.getItem(STORAGE_KEYS.offerVersions)).toBe(firstVersions);
      expect(localStorage.getItem(STORAGE_KEYS.offerWorkflowStorageVersion))
        .toBe(String(CURRENT_OFFER_WORKFLOW_STORAGE_VERSION));
    });
  });

  describe('Dokumentmetadaten', () => {
    it('verwaltet Dokumentmetadaten', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer());
      const versioned = await service.ensureInitialVersion(offer);
      await service.registerDocument(offer.id, {
        offerVersionId: versioned.currentVersionId,
        type: 'offer_pdf',
        fileName: 'angebot.pdf',
        mimeType: 'application/pdf',
        externalReference: 'https://example.invalid/angebot.pdf',
        checksum: null,
      }, owner);
      expect((await service.listDocuments(offer.id))[0]?.fileName).toBe('angebot.pdf');
    });
  });
});
