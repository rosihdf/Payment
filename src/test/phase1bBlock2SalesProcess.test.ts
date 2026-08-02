import { beforeEach, describe, expect, it } from 'vitest';
import { buildPublicOfferView } from '../domain/offer/publicOfferView';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import { sanitizeCustomerText } from '../domain/offer/offerCustomerQuestion';
import { hashShareToken } from '../domain/offer/shareToken';
import { createServices } from '../services';
import {
  DEFAULT_SHARE_VALIDITY_DAYS,
  defaultShareValidUntil,
} from '../services/offerShareService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories, createTestWorkspace } from './helpers/createTestRepositories';
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
  return { repos, services };
}

async function preparePublicationReadyOffer(services: ReturnType<typeof createServices>, repos: ReturnType<typeof createTestRepositories>) {
  let offer = await repos.offerRepository.create(createTestOffer({ workflowStatus: 'approval_required' }));
  offer = await services.offerWorkflowService.ensureInitialVersion(offer);
  await services.offerWorkflowService.approve(offer.id, reviewer);
  await services.offerWorkflowService.markReadyToSend(offer.id, owner);
  const version = (await services.offerWorkflowService.getCurrentVersion(offer.id))!;
  await services.offerWorkflowService.confirmCounselingPrinciples(
    offer.id,
    version.id,
    owner,
    allCounselingPrinciplesConfirmed(),
  );
  const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(offer.id);
  return {
    offer: (await repos.offerRepository.getById(offer.id))!,
    version,
    readiness,
  };
}

describe('Phase 1B Block 2 – Kundenlink und Feedback', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  describe('Share-Link', () => {
    it('blockiert Link ohne Publication Readiness', async () => {
      const { repos, services } = createWorkflow();
      const offer = await repos.offerRepository.create(createTestOffer());
      await services.offerWorkflowService.ensureInitialVersion(offer);
      const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(offer.id);
      const result = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      expect(result.ok).toBe(false);
    });

    it('speichert nur Hash und liefert Token einmalig', async () => {
      const { repos, services } = createWorkflow();
      const { offer, readiness } = await preparePublicationReadyOffer(services, repos);
      const result = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.token.length).toBeGreaterThan(20);
      expect(result.share.tokenHash).not.toBe(result.token);
      expect(await hashShareToken(result.token)).toBe(result.share.tokenHash);
      const stored = await services.offerShareService.getShareById(result.share.id);
      expect(stored?.tokenHash).toBe(result.share.tokenHash);
      expect(stored?.tokenHash).not.toContain(result.token);
    });

    it('nutzt 30 Tage Standardlaufzeit', async () => {
      const { repos, services } = createWorkflow();
      const { offer, readiness } = await preparePublicationReadyOffer(services, repos);
      const result = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const from = new Date(result.share.validFrom);
      const until = new Date(result.share.validUntil);
      const diffDays = Math.round((until.getTime() - from.getTime()) / 86400000);
      expect(DEFAULT_SHARE_VALIDITY_DAYS).toBe(30);
      expect(diffDays).toBe(30);
      expect(defaultShareValidUntil(result.share.validFrom)).toBe(result.share.validUntil);
    });

    it('widerruft aktiven Link', async () => {
      const { repos, services } = createWorkflow();
      const { offer, readiness } = await preparePublicationReadyOffer(services, repos);
      const created = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const revoked = await services.offerShareService.revokeShare(created.share.id, owner);
      expect(revoked.ok).toBe(true);
      if (!revoked.ok) return;
      expect(revoked.share.status).toBe('revoked');
      expect(await services.offerShareService.getActiveShareByOfferId(offer.id)).toBeNull();
    });

    it('supersedet alten Link bei Neu-Erzeugung', async () => {
      const { repos, services } = createWorkflow();
      const { offer, readiness } = await preparePublicationReadyOffer(services, repos);
      const first = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      const second = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      const oldShare = await services.offerShareService.getShareById(first.share.id);
      expect(oldShare?.status).toBe('superseded');
      expect(oldShare?.supersededAt).toBeTruthy();
      const active = await services.offerShareService.getActiveShareByOfferId(offer.id);
      expect(active?.id).toBe(second.share.id);
    });

    it('blockiert stale Version', async () => {
      const { repos, services } = createWorkflow();
      const { offer, readiness, version } = await preparePublicationReadyOffer(services, repos);
      await repos.offerRepository.update({
        ...(await repos.offerRepository.getById(offer.id))!,
        title: 'Neue Version nötig',
      });
      await services.offerWorkflowService.createNewVersionIfNeeded(offer.id, 'Änderung', owner);
      const staleReadiness = {
        ...readiness!,
        currentVersionId: version.id,
        publicationAllowed: true,
      };
      const result = await services.offerShareService.createCustomerShareLink(offer.id, owner, staleReadiness);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('stale_version');
    });
  });

  describe('Rückfragen', () => {
    it('speichert Rückfrage und erlaubt Antwort', async () => {
      const { repos, services } = createWorkflow();
      const { offer, version } = await preparePublicationReadyOffer(services, repos);
      const submitted = await services.offerCustomerQuestionService.submitQuestion({
        offerId: offer.id,
        offerVersionId: version.id,
        shareId: null,
        questionText: 'Wie lange gilt das Angebot?',
      });
      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;
      const open = await services.offerCustomerQuestionService.getOpenQuestionsByOfferId(offer.id);
      expect(open).toHaveLength(1);
      const answered = await services.offerCustomerQuestionService.answerQuestion(
        submitted.question.id,
        'Das Angebot gilt 30 Tage.',
        owner,
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      expect(answered.question.status).toBe('answered');
      expect(answered.question.answerText).toContain('30 Tage');
    });

    it('blockiert leere und zu lange Rückfragen', async () => {
      const { repos, services } = createWorkflow();
      const { offer, version } = await preparePublicationReadyOffer(services, repos);
      expect(
        (await services.offerCustomerQuestionService.submitQuestion({
          offerId: offer.id,
          offerVersionId: version.id,
          shareId: null,
          questionText: '   ',
        })).ok,
      ).toBe(false);
      expect(
        (await services.offerCustomerQuestionService.submitQuestion({
          offerId: offer.id,
          offerVersionId: version.id,
          shareId: null,
          questionText: 'x'.repeat(4001),
        })).ok,
      ).toBe(false);
    });
  });

  describe('Änderungswünsche', () => {
    it('speichert Änderungswunsch ohne Angebotsmutation', async () => {
      const { repos, services } = createWorkflow();
      const { offer, version } = await preparePublicationReadyOffer(services, repos);
      const before = await repos.offerRepository.getById(offer.id);
      const submitted = await services.offerChangeRequestService.submitChangeRequest({
        offerId: offer.id,
        offerVersionId: version.id,
        shareId: null,
        requestText: 'Bitte Laufzeit auf 24 Monate ändern.',
      });
      expect(submitted.ok).toBe(true);
      const after = await repos.offerRepository.getById(offer.id);
      expect(after?.updatedAt).toBe(before?.updatedAt);
      expect(after?.currentVersionId).toBe(before?.currentVersionId);
      const updated = await services.offerChangeRequestService.updateStatus(
        submitted.ok ? submitted.request.id : '',
        'completed',
        owner,
      );
      expect(updated.ok).toBe(true);
    });
  });

  describe('Öffentliche Sicht', () => {
    it('blendet interne Felder aus', () => {
      const offer = createTestOffer({
        internalNotes: 'Intern geheim',
        customerNotes: 'Für Kunde sichtbar',
      });
      const snapshot = buildOfferVersionSnapshot(offer, undefined, 1);
      const view = buildPublicOfferView({
        snapshot,
        versionNumber: 1,
        versionCreatedAt: offer.createdAt,
        salesContactName: 'Laura Außendienst',
        linkValidUntil: '2026-09-01T00:00:00.000Z',
        hasPdf: true,
        formatMoney: (cents) => `${cents / 100} EUR`,
        formatItemPrice: () => 'auf Anfrage',
      });
      expect(view.reviewHint).toContain('zeitlich begrenzt');
      expect(view.competitorComparisonHint).toContain('Vergleich');
      expect(JSON.stringify(view)).not.toContain('Intern geheim');
      expect(JSON.stringify(view)).not.toContain('commission');
      expect(JSON.stringify(view)).not.toContain('internalNotes');
    });
  });

  describe('Arbeitsplatz-Hinweise', () => {
    it('zeigt offene Rückfrage und Änderungswunsch', async () => {
      const repos = createTestRepositories();
      const services = createServices(repos);
      const workspace = createTestWorkspace(repos);
      const { offer, version } = await preparePublicationReadyOffer(services, repos);
      await services.offerCustomerQuestionService.submitQuestion({
        offerId: offer.id,
        offerVersionId: version.id,
        shareId: null,
        questionText: 'Frage zur Hardware',
      });
      await services.offerChangeRequestService.submitChangeRequest({
        offerId: offer.id,
        offerVersionId: version.id,
        shareId: null,
        requestText: 'Mehr Terminals',
      });
      const view = await workspace.getWorkspaceView(owner);
      expect(view.notifications.some((entry) => entry.title === 'Offene Kundenrückfrage')).toBe(true);
      expect(view.notifications.some((entry) => entry.title === 'Offener Änderungswunsch')).toBe(true);
    });
  });

  describe('Sicherheit', () => {
    it('entfernt HTML aus Kundentext', () => {
      expect(sanitizeCustomerText('<script>alert(1)</script>Hallo')).toBe('alert(1)Hallo');
    });
  });
});
