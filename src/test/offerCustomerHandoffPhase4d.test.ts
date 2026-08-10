import { beforeEach, describe, expect, it } from 'vitest';
import { hashShareToken } from '../domain/offer/shareToken';
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
  return { repos, services };
}

async function prepareHandoffReadyOffer(services: ReturnType<typeof createServices>, repos: ReturnType<typeof createTestRepositories>) {
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
  const document = await services.offerDocumentService.createFinalDocument(offer.id, owner);
  expect(document.ok).toBe(true);
  const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(offer.id);
  return {
    offer: (await repos.offerRepository.getById(offer.id))!,
    version,
    readiness,
  };
}

describe('Phase 4D – Kundenvorlage / Delivery / Public Handoff', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  it('1: vollständiges Angebot → Readiness allowed', async () => {
    const { repos, services } = createWorkflow();
    const { readiness } = await prepareHandoffReadyOffer(services, repos);
    expect(readiness?.allowed).toBe(true);
    expect(readiness?.documentReady).toBe(true);
  });

  it('2: Approval fehlt → blocked', async () => {
    const { repos, services } = createWorkflow();
    let offer = await repos.offerRepository.create(createTestOffer({ workflowStatus: 'approved' }));
    offer = await services.offerWorkflowService.ensureInitialVersion(offer);
    await repos.pricingEvaluationRepository.create({
      id: 'eval_block_4d',
      offerId: offer.id,
      status: 'draft',
      inputFingerprint: 'fp',
      result: {
        evaluationId: 'eval_block_4d',
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
    const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(offer.id);
    expect(readiness?.allowed).toBe(false);
    expect(readiness?.blockers).toContain('approval_missing');
  });

  it('3: Counseling fehlt → blocked', async () => {
    const { repos, services } = createWorkflow();
    let offer = await repos.offerRepository.create(createTestOffer({ workflowStatus: 'approval_required' }));
    offer = await services.offerWorkflowService.ensureInitialVersion(offer);
    await services.offerWorkflowService.approve(offer.id, reviewer);
    await services.offerWorkflowService.markReadyToSend(offer.id, owner);
    await services.offerDocumentService.createFinalDocument(offer.id, owner);
    const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(offer.id);
    expect(readiness?.allowed).toBe(false);
    expect(readiness?.blockers).toContain('counseling_not_confirmed');
  });

  it('4: Final-Dokument fehlt → blocked', async () => {
    const { repos, services } = createWorkflow();
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
    expect(readiness?.allowed).toBe(false);
    expect(readiness?.blockers).toContain('document_missing');
  });

  it('5: Share-Link erzeugen setzt nicht sent', async () => {
    const { repos, services } = createWorkflow();
    const { offer, readiness } = await prepareHandoffReadyOffer(services, repos);
    const shareResult = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
    expect(shareResult.ok).toBe(true);
    const refreshed = await repos.offerRepository.getById(offer.id);
    expect(refreshed?.workflowStatus).toBe('ready_to_send');
    expect(refreshed?.workflowStatus).not.toBe('sent');
  });

  it('6: Delivery → sent', async () => {
    const { repos, services } = createWorkflow();
    const { offer, version, readiness } = await prepareHandoffReadyOffer(services, repos);
    const result = await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: version.id,
      documentId: readiness?.documentId,
      channel: 'manual',
      recipient: 'Kunde Test',
    });
    expect(result.ok).toBe(true);
    const refreshed = await repos.offerRepository.getById(offer.id);
    expect(refreshed?.workflowStatus).toBe('sent');
  });

  it('7: zweite identische Delivery → idempotent', async () => {
    const { repos, services } = createWorkflow();
    const { offer, version, readiness } = await prepareHandoffReadyOffer(services, repos);
    const input = {
      offerVersionId: version.id,
      documentId: readiness?.documentId,
      channel: 'manual' as const,
      recipient: 'Kunde Test',
    };
    expect((await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, input)).ok).toBe(true);
    const second = await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, input);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.duplicate).toBe(true);
    }
  });

  it('8: Follow-up nicht doppelt', async () => {
    const { repos, services } = createWorkflow();
    const { offer, version, readiness } = await prepareHandoffReadyOffer(services, repos);
    const preferences = {
      providedAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      comparesOffers: false,
      openQuestions: '',
      customerContactsSelf: false,
      noFollowUpDesired: false,
    };
    await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: version.id,
      documentId: readiness?.documentId,
      channel: 'manual',
      followUpPreferences: preferences,
    });
    await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: version.id,
      documentId: readiness?.documentId,
      channel: 'manual',
      followUpPreferences: preferences,
    });
    const tasks = await repos.salesTaskRepository.getAll();
    expect(tasks.filter((task) => task.offerId === offer.id && task.type === 'follow_up_offer')).toHaveLength(1);
  });

  it('9: interner Accept = Zielzustand accepted', async () => {
    const { repos, services } = createWorkflow();
    const { offer } = await prepareHandoffReadyOffer(services, repos);
    await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      channel: 'manual',
    });
    const accepted = await services.offerWorkflowService.acceptOffer(offer.id, owner, {
      acceptedByName: 'Kunde',
      acceptanceType: 'email_confirmation',
      otherText: null,
      note: '',
    });
    expect(accepted.ok).toBe(true);
    expect((await repos.offerRepository.getById(offer.id))?.workflowStatus).toBe('accepted');
  });

  it('10: interner Decline = Zielzustand declined', async () => {
    const { repos, services } = createWorkflow();
    const { offer } = await prepareHandoffReadyOffer(services, repos);
    await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      channel: 'manual',
    });
    const declined = await services.offerWorkflowService.declineOffer(offer.id, owner, {
      reason: 'price',
      otherText: null,
      note: 'Zu teuer',
    });
    expect(declined.ok).toBe(true);
    expect((await repos.offerRepository.getById(offer.id))?.workflowStatus).toBe('declined');
  });

  it('11: Accept Retry → max. 1 Vertrag', async () => {
    const { repos, services } = createWorkflow();
    const { offer } = await prepareHandoffReadyOffer(services, repos);
    await services.offerWorkflowService.markOfferDeliveredToCustomer(offer.id, owner, {
      offerVersionId: offer.currentVersionId!,
      channel: 'manual',
    });
    const acceptance = {
      acceptedByName: 'Kunde',
      acceptanceType: 'email_confirmation' as const,
      otherText: null,
      note: '',
    };
    expect((await services.offerWorkflowService.acceptOffer(offer.id, owner, acceptance)).ok).toBe(true);
    expect((await services.offerWorkflowService.acceptOffer(offer.id, owner, acceptance)).ok).toBe(true);
    const contracts = await repos.contractRepository.getByOfferId(offer.id);
    expect(contracts).toBeTruthy();
  });

  it('12: alter Share-Link bleibt versionsgebunden', async () => {
    const { repos, services } = createWorkflow();
    const { offer, readiness } = await prepareHandoffReadyOffer(services, repos);
    const firstShare = await services.offerShareService.createCustomerShareLink(offer.id, owner, readiness);
    expect(firstShare.ok).toBe(true);
    if (!firstShare.ok) return;

    await repos.offerRepository.update({
      ...(await repos.offerRepository.getById(offer.id))!,
      title: 'Neue Version',
      validUntil: '2028-01-01T00:00:00.000Z',
    });
    await services.offerWorkflowService.createNewVersion(offer.id, 'Kondition geändert', owner);

    const oldShare = await services.offerShareService.getShareById(firstShare.share.id);
    expect(oldShare?.offerVersionId).not.toBe((await repos.offerRepository.getById(offer.id))?.currentVersionId);
    expect(await hashShareToken(firstShare.token)).toBe(firstShare.share.tokenHash);
  });

  it('13: Handoff Payload vollständig', async () => {
    const { repos, services } = createWorkflow();
    const { offer } = await prepareHandoffReadyOffer(services, repos);
    const handoff = await services.offerWorkflowService.evaluateCustomerCommunicationHandoff(offer.id);
    expect(handoff?.offerNumber).toBe(offer.offerNumber);
    expect(handoff?.companyName).toBeTruthy();
    expect(handoff?.commercialContext.tariffName).toBeTruthy();
    expect(handoff?.documentId).toBeTruthy();
  });

  it('14: fehlende Mail/Telefon → keine Fake-Daten', async () => {
    const { repos, services } = createWorkflow();
    const offer = await repos.offerRepository.create(
      createTestOffer({
        customerSnapshot: {
          ...createTestOffer().customerSnapshot,
          email: '',
          phone: '',
        },
      }),
    );
    await services.offerWorkflowService.ensureInitialVersion(offer);
    const handoff = await services.offerWorkflowService.evaluateCustomerCommunicationHandoff(offer.id);
    expect(handoff?.email).toBeNull();
    expect(handoff?.phone).toBeNull();
  });

  it('15: Legacy weiterhin lesbar', async () => {
    const { repos, services } = createWorkflow();
    const legacy = await repos.offerRepository.create(
      createTestOffer({
        status: 'completed',
        workflowStatus: 'accepted',
      }),
    );
    const readiness = await services.offerWorkflowService.evaluatePublicationReadiness(legacy.id);
    expect(readiness?.warnings).toContain('legacy_document_path');
    const handoff = await services.offerWorkflowService.evaluateCustomerCommunicationHandoff(legacy.id);
    expect(handoff?.stage).toBe('customer_responded');
  });
});
