import { beforeEach, describe, expect, it } from 'vitest';
import {
  compareOfferVersions,
  hasCustomerRelevantVersionChanges,
} from '../domain/offer/compareOfferVersions';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import {
  deriveOfferPresentationGroup,
  evaluateOfferPublicationReadiness,
  isBlockedFromCustomerTemplate,
} from '../domain/offer/offerPublicationReadiness';
import { createOfferDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import {
  allCounselingPrinciplesConfirmed,
  createTestOffer,
  FIELD_SERVICE_CONTEXT,
  OTHER_FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';

const owner = FIELD_SERVICE_CONTEXT;
const reviewer = OTHER_FIELD_SERVICE_CONTEXT;

function createWorkflow() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return {
    repos,
    offers: repos.offerRepository,
    versions: repos.offerVersionRepository,
    documents: repos.offerDocumentRepository,
    service: services.offerWorkflowService,
    offerDocumentService: services.offerDocumentService,
  };
}

describe('Phase 1B Block 1 – Angebotsversionen und Freigabewahrheit', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  describe('Versionen', () => {
    it('erstellt Version 1 und bei Änderung Version 2 ohne Mutation von Version 1', async () => {
      const { offers, service, versions } = createWorkflow();
      let offer = await offers.create(createTestOffer({ title: 'V1', validUntil: '2026-12-31T23:59:59.000Z' }));
      offer = await service.ensureInitialVersion(offer);

      const v1 = await service.getCurrentVersion(offer.id);
      expect(v1?.versionNumber).toBe(1);
      expect(offer.currentVersionId).toBe(v1?.id);
      const v1SnapshotTitle = v1!.snapshot.title;

      await offers.update({
        ...(await offers.getById(offer.id))!,
        title: 'V2',
        validUntil: '2027-06-30T23:59:59.000Z',
      });
      const v2 = await service.createNewVersionIfNeeded(offer.id, 'Tarif/Konditionen geändert', owner);
      expect(v2?.versionNumber).toBe(2);

      const refreshed = await offers.getById(offer.id);
      expect(refreshed?.currentVersionId).toBe(v2?.id);
      expect(refreshed?.currentVersionNumber).toBe(2);
      expect(refreshed?.workflowStatus).toBe('draft');

      const storedV1 = await versions.getById(v1!.id);
      expect(storedV1?.snapshot.title).toBe(v1SnapshotTitle);
      expect(storedV1?.supersededAt).toBeTruthy();
      expect(storedV1?.versionNumber).toBe(1);

      // Snapshot-Mutation über update wird verworfen
      await versions.update({
        ...storedV1!,
        snapshot: { ...storedV1!.snapshot, title: 'manipuliert' },
      });
      expect((await versions.getById(v1!.id))?.snapshot.title).toBe(v1SnapshotTitle);

      const all = await service.getVersions(offer.id);
      expect(all.map((entry) => entry.versionNumber)).toEqual([1, 2]);
      expect(new Set(all.map((entry) => entry.versionNumber)).size).toBe(2);
    });

    it('erzwingt keine neue Version bei rein internen Notizen', async () => {
      const { offers, service } = createWorkflow();
      let offer = await offers.create(createTestOffer());
      offer = await service.ensureInitialVersion(offer);
      const currentId = offer.currentVersionId;

      await offers.update({
        ...(await offers.getById(offer.id))!,
        internalNotes: 'nur intern',
      });
      const version = await service.createNewVersionIfNeeded(offer.id, 'Notiz', owner);
      expect(version?.id).toBe(currentId);
      expect(await service.getVersions(offer.id)).toHaveLength(1);
    });

    it('erkennt kundenrelevante Diffs ohne Render-Mutation', async () => {
      const offer = createTestOffer({ title: 'A' });
      const before = {
        id: 'v1',
        offerId: offer.id,
        versionNumber: 1,
        workflowStatus: 'draft' as const,
        snapshot: buildOfferVersionSnapshot(offer, undefined, 1),
        createdAt: offer.createdAt,
        createdByUserId: owner.userId,
        createdByDisplayName: owner.displayName,
        approvedAt: null,
        approvedByUserId: null,
        sentAt: null,
        acceptedAt: null,
        declinedAt: null,
        activatedAt: null,
        supersededAt: null,
      };
      const afterOffer = { ...offer, title: 'B', tariffSnapshot: { ...offer.tariffSnapshot! } };
      const after = {
        ...before,
        snapshot: buildOfferVersionSnapshot(afterOffer, undefined, 1),
      };
      const diffs = compareOfferVersions(before, after);
      expect(hasCustomerRelevantVersionChanges(diffs)).toBe(true);
      expect(before.snapshot.title).toBe('A');
    });
  });

  describe('Freigabe versionsbezogen', () => {
    it('gilt Freigabe nur für exakt eine Version und wird durch neue Version unwirksam', async () => {
      const { offers, service } = createWorkflow();
      let offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      offer = await service.ensureInitialVersion(offer);
      const v1 = (await service.getCurrentVersion(offer.id))!;

      expect((await service.approve(offer.id, reviewer)).ok).toBe(true);
      expect(await service.hasApprovalForVersion(offer.id, v1.id)).toBe(true);

      await offers.update({
        ...(await offers.getById(offer.id))!,
        title: 'Neue Konditionen',
        validUntil: '2027-01-01T00:00:00.000Z',
      });
      const v2 = await service.createNewVersion(offer.id, 'Änderung', owner);
      expect(v2?.versionNumber).toBe(2);
      expect(await service.hasApprovalForVersion(offer.id, v1.id)).toBe(true);
      expect(await service.hasApprovalForVersion(offer.id, v2!.id)).toBe(false);

      const wizard = await service.getWizardWorkflowView(offer.id);
      expect(wizard.approved).toBe(false);
      expect((await offers.getById(offer.id))?.workflowStatus).toBe('draft');
    });

    it('lässt Standardangebot ohne Abweichung ready_to_send erreichen', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'draft' }));
      await service.ensureInitialVersion(offer);

      const submitted = await service.submitForApproval(offer.id, owner);
      expect(submitted.ok && submitted.offer.workflowStatus).toBe('ready_to_send');
      expect(await service.detectApprovalRequired(offer.id)).toBe(false);
    });

    it('blockiert ready_to_send bei fehlender versionsbezogener Freigabe', async () => {
      const { offers, service, repos } = createWorkflow();
      let offer = await offers.create(createTestOffer({ workflowStatus: 'approved' }));
      offer = await service.ensureInitialVersion(offer);

      // Draft-Pricing mit Freigabepflicht (ohne Approval-Event für die Version)
      await repos.pricingEvaluationRepository.create({
        id: 'eval_block',
        offerId: offer.id,
        status: 'draft',
        inputFingerprint: 'fp',
        result: {
          evaluationId: 'eval_block',
          evaluatedAt: new Date().toISOString(),
          engineVersion: '1.0.0',
          inputFingerprint: 'fp',
          stale: false,
          approval: {
            adminReviewRequired: true,
            reasons: ['Sonderkondition'],
          },
          snapshot: {},
        } as never,
        createdByUserId: owner.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(await service.detectApprovalRequired(offer.id)).toBe(true);
      expect(await service.hasApprovalForVersion(offer.id, offer.currentVersionId!)).toBe(false);
      expect((await service.markReadyToSend(offer.id, owner)).ok).toBe(false);

      const readiness = await service.evaluatePublicationReadiness(offer.id);
      expect(readiness?.readyForCustomerTemplate).toBe(false);
      expect(readiness?.blockers.some((entry) => /Freigabe/.test(entry))).toBe(true);
      expect(readiness?.deviations).toContain('Sonderkondition');
    });

    it('blockiert Kundenvorlage bei changes_requested', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      await service.ensureInitialVersion(offer);
      // start_approval nur durch Owner/Admin; request_changes durch Reviewer
      expect((await service.startApproval(offer.id, owner)).ok).toBe(true);
      expect((await service.requestChanges(offer.id, reviewer, 'Bitte Laufzeit anpassen')).ok).toBe(true);

      const refreshed = await offers.getById(offer.id);
      expect(refreshed?.workflowStatus).toBe('changes_requested');
      expect(isBlockedFromCustomerTemplate(refreshed!.workflowStatus)).toBe(true);

      const readiness = await service.evaluatePublicationReadiness(offer.id);
      expect(readiness?.presentationGroup).toBe('changes_required');
      expect(readiness?.readyForCustomerTemplate).toBe(false);
    });
  });

  describe('Publication Readiness', () => {
    it('erlaubt Veröffentlichung bei vollständiger Version + Freigabe + Counseling', async () => {
      const { offers, service } = createWorkflow();
      const offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      await service.ensureInitialVersion(offer);
      await service.approve(offer.id, reviewer);
      await service.markReadyToSend(offer.id, owner);
      const version = (await service.getCurrentVersion(offer.id))!;
      await service.confirmCounselingPrinciples(
        offer.id,
        version.id,
        owner,
        allCounselingPrinciplesConfirmed(),
      );

      const readiness = await service.evaluatePublicationReadiness(offer.id);
      expect(readiness?.readyForCustomerTemplate).toBe(true);
      expect(readiness?.publicationAllowed).toBe(true);
      expect(readiness?.blockers).toEqual([]);
      expect(readiness?.presentationGroup).toBe('ready_for_customer');
    });

    it('blockiert bei stale Pricing, fehlender Freigabe und fehlenden Beratungsgrundsätzen', () => {
      const offer = createTestOffer({
        workflowStatus: 'approved',
        currentVersionId: 'ver_1',
        currentVersionNumber: 1,
      });
      const version = {
        id: 'ver_1',
        offerId: offer.id,
        versionNumber: 1,
        workflowStatus: 'approved' as const,
        snapshot: buildOfferVersionSnapshot(offer, undefined, 1),
        createdAt: offer.createdAt,
        createdByUserId: owner.userId,
        createdByDisplayName: owner.displayName,
        approvedAt: null,
        approvedByUserId: null,
        sentAt: null,
        acceptedAt: null,
        declinedAt: null,
        activatedAt: null,
        supersededAt: null,
      };

      const blocked = evaluateOfferPublicationReadiness({
        offer,
        version,
        approvalRequired: true,
        hasApprovalForVersion: false,
        hasCounselingConfirmation: false,
        pricingStale: true,
        recommendationStale: true,
        deviations: ['Sonderpreis'],
      });
      expect(blocked.publicationAllowed).toBe(false);
      expect(blocked.readyForCustomerTemplate).toBe(false);
      expect(blocked.blockers).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Pricing/),
          expect.stringMatching(/Empfehlung/),
          expect.stringMatching(/Freigabe/),
        ]),
      );
      expect(blocked.deviations).toContain('Sonderpreis');

      const withoutCounseling = evaluateOfferPublicationReadiness({
        offer: { ...offer, workflowStatus: 'ready_to_send' },
        version,
        approvalRequired: false,
        hasApprovalForVersion: false,
        hasCounselingConfirmation: false,
        pricingStale: false,
        recommendationStale: false,
      });
      expect(withoutCounseling.readyForCustomerTemplate).toBe(true);
      expect(withoutCounseling.publicationAllowed).toBe(false);
      expect(withoutCounseling.blockers).toEqual([
        'Beratungsgrundsätze sind für diese Angebotsversion nicht bestätigt.',
      ]);
    });

    it('leitet Statusgruppen und Kundenvorlagen-Sperre korrekt ab', () => {
      expect(deriveOfferPresentationGroup('draft')).toBe('draft');
      expect(deriveOfferPresentationGroup('in_approval')).toBe('internal_review');
      expect(deriveOfferPresentationGroup('changes_requested')).toBe('changes_required');
      expect(deriveOfferPresentationGroup('ready_to_send')).toBe('ready_for_customer');
      expect(deriveOfferPresentationGroup('sent')).toBe('customer_reviewing');
      expect(deriveOfferPresentationGroup('accepted')).toBe('accepted');
      expect(deriveOfferPresentationGroup('declined')).toBe('closed');

      expect(isBlockedFromCustomerTemplate('draft')).toBe(true);
      expect(isBlockedFromCustomerTemplate('in_approval')).toBe(true);
      expect(isBlockedFromCustomerTemplate('changes_requested')).toBe(true);
      expect(isBlockedFromCustomerTemplate('ready_to_send')).toBe(false);
    });
  });

  describe('Dokumente', () => {
    it('bindet PDF/Dokument an OfferVersion und behält Historie', async () => {
      const { offers, service, offerDocumentService } = createWorkflow();
      let offer = await offers.create(
        createTestOffer({
          // accepted → legacy status completed (Final-PDF-Voraussetzung)
          status: 'completed',
          workflowStatus: 'accepted',
          title: 'Dokument V1',
        }),
      );
      offer = await service.ensureInitialVersion(offer);
      expect(offer.status).toBe('completed');
      const version1 = offer.currentVersionId!;

      const first = await offerDocumentService.createFinalDocument(offer.id, owner);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.document.offerVersionId).toBe(version1);
      expect(first.document.snapshot.offerVersionId).toBe(version1);
      expect(JSON.stringify(first.document.snapshot)).not.toMatch(/commissionReferenceId|Provision/i);

      await offers.update({
        ...(await offers.getById(offer.id))!,
        title: 'Dokument V2',
        validUntil: '2027-12-31T00:00:00.000Z',
        workflowStatus: 'accepted',
      });
      const v2 = await service.createNewVersion(offer.id, 'neue Version', owner);
      // createNewVersion setzt draft – für Final-PDF wieder auf accepted heben
      await offers.update({
        ...(await offers.getById(offer.id))!,
        workflowStatus: 'accepted',
      });

      const second = await offerDocumentService.createNewFinalVersion(offer.id, owner);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.document.offerVersionId).toBe(v2!.id);
      expect(second.document.version).toBe(2);

      const docs = await offerDocumentService.getDocumentsForOffer(offer.id, owner);
      expect(docs).toHaveLength(2);
      expect(docs.find((doc) => doc.id === first.document.id)?.status).toBe('superseded');
      expect(docs.find((doc) => doc.id === first.document.id)?.offerVersionId).toBe(version1);
    });

    it('schreibt offerVersionId in Snapshot-Hash-Input', async () => {
      const offer = createTestOffer({ currentVersionId: 'ver_hash', currentVersionNumber: 1 });
      const snapshot = await createOfferDocumentSnapshot({
        documentId: 'doc_1',
        documentVersion: 1,
        offer,
        offerVersionId: 'ver_hash',
        generatedAt: offer.createdAt,
        generatedByUserId: owner.userId,
        generatedByDisplayName: owner.displayName,
      });
      expect(snapshot.offerVersionId).toBe('ver_hash');
      expect(snapshot.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Beratungsgrundsätze versionsgebunden', () => {
    it('verlangt erneute Bestätigung nach neuer Version', async () => {
      const { offers, service } = createWorkflow();
      let offer = await offers.create(createTestOffer({ workflowStatus: 'approval_required' }));
      offer = await service.ensureInitialVersion(offer);
      await service.approve(offer.id, reviewer);
      await service.markReadyToSend(offer.id, owner);
      const v1 = (await service.getCurrentVersion(offer.id))!;
      await service.confirmCounselingPrinciples(
        offer.id,
        v1.id,
        owner,
        allCounselingPrinciplesConfirmed(),
      );
      expect(await service.hasCounselingConfirmationForVersion(offer.id, v1.id)).toBe(true);

      await offers.update({
        ...(await offers.getById(offer.id))!,
        title: 'Neue Vorlage',
        validUntil: '2028-01-01T00:00:00.000Z',
      });
      const v2 = await service.createNewVersion(offer.id, 'relevant', owner);
      expect(await service.hasCounselingConfirmationForVersion(offer.id, v2!.id)).toBe(false);
      expect(await service.hasCounselingConfirmationForVersion(offer.id, v1.id)).toBe(true);
    });
  });
});
