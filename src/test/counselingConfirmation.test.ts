import { beforeEach, describe, expect, it } from 'vitest';
import {
  COUNSELING_PRINCIPLE_KEYS,
  emptyCounselingPrincipleFlags,
} from '../domain/offer/counselingConfirmation';
import {
  validateCounselingPrinciples,
  validateOfferFollowUpPreferences,
} from '../domain/offer/offerWorkflowValidation';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { createTestOffer, resetOfferTestSequence } from './helpers/offerTestHelpers';

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const reviewer = { userId: 'user_002', role: 'field_service' as const, displayName: 'Thomas' };

function allPrinciplesConfirmed() {
  return Object.fromEntries(COUNSELING_PRINCIPLE_KEYS.map((key) => [key, true])) as ReturnType<
    typeof emptyCounselingPrincipleFlags
  >;
}

describe('Beratungsgrundsätze & Bedenkzeit', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  it('blockiert Versand ohne bestätigte Beratungsgrundsätze', async () => {
    const repos = createTestRepositories();
    const { offerWorkflowService } = createServices(repos);
    const offer = await repos.offerRepository.create(createTestOffer());
    await offerWorkflowService.ensureInitialVersion(offer);
    await offerWorkflowService.approve(offer.id, reviewer);
    await offerWorkflowService.markReadyToSend(offer.id, owner);

    const result = await offerWorkflowService.documentSent(offer.id, owner, 'kunde@example.test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation');
    }
  });

  it('erlaubt Versand nach confirmCounselingPrinciples', async () => {
    const repos = createTestRepositories();
    const { offerWorkflowService, offerDocumentService } = createServices(repos);
    const offer = await repos.offerRepository.create(createTestOffer());
    const versioned = await offerWorkflowService.ensureInitialVersion(offer);
    await offerWorkflowService.approve(versioned.id, reviewer);
    await offerWorkflowService.markReadyToSend(versioned.id, owner);

    const version = await offerWorkflowService.getCurrentVersion(versioned.id);
    expect(version).toBeTruthy();

    const confirmResult = await offerWorkflowService.confirmCounselingPrinciples(
      versioned.id,
      version!.id,
      owner,
      allPrinciplesConfirmed(),
    );
    expect(confirmResult.ok).toBe(true);

    const documentResult = await offerDocumentService.createFinalDocument(versioned.id, owner);
    expect(documentResult.ok).toBe(true);

    const sentResult = await offerWorkflowService.documentSent(versioned.id, owner, 'kunde@example.test', 'email', {
      providedAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      comparesOffers: false,
      openQuestions: '',
      customerContactsSelf: false,
      noFollowUpDesired: false,
    });
    expect(sentResult.ok).toBe(true);

    const tasks = await repos.salesTaskRepository.getAll();
    const followUpTasks = tasks.filter(
      (task) => task.offerId === versioned.id && task.type === 'follow_up_offer',
    );
    expect(followUpTasks).toHaveLength(1);
    expect(followUpTasks[0]?.sourceKey).toBe(`auto:follow_up_offer:${versioned.id}`);
    expect(followUpTasks[0]?.title).toMatch(/nachfassen/i);
  });

  it('legt keine Wiedervorlage an, wenn der Kunde sich selbst meldet', async () => {
    const repos = createTestRepositories();
    const { offerWorkflowService, offerDocumentService } = createServices(repos);
    const offer = await repos.offerRepository.create(createTestOffer());
    const versioned = await offerWorkflowService.ensureInitialVersion(offer);
    await offerWorkflowService.approve(versioned.id, reviewer);
    await offerWorkflowService.markReadyToSend(versioned.id, owner);
    const version = await offerWorkflowService.getCurrentVersion(versioned.id);
    await offerWorkflowService.confirmCounselingPrinciples(
      versioned.id,
      version!.id,
      owner,
      allPrinciplesConfirmed(),
    );
    await offerDocumentService.createFinalDocument(versioned.id, owner);

    const sentResult = await offerWorkflowService.documentSent(
      versioned.id,
      owner,
      'kunde@example.test',
      'email',
      {
        providedAt: new Date().toISOString(),
        followUpDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        comparesOffers: false,
        openQuestions: '',
        customerContactsSelf: true,
        noFollowUpDesired: false,
      },
    );
    expect(sentResult.ok).toBe(true);

    const tasks = await repos.salesTaskRepository.getAll();
    expect(
      tasks.filter((task) => task.offerId === versioned.id && task.type === 'follow_up_offer'),
    ).toHaveLength(0);
  });

  it('validiert alle Beratungsgrundsätze', () => {
    expect(validateCounselingPrinciples(allPrinciplesConfirmed())).toBeUndefined();
    expect(validateCounselingPrinciples(emptyCounselingPrincipleFlags())).toMatch(/Beratungsgrundsätze/);
  });

  it('validiert Nachfass-Präferenzen', () => {
    expect(
      validateOfferFollowUpPreferences({
        providedAt: new Date().toISOString(),
        followUpDate: null,
        comparesOffers: false,
        openQuestions: '',
        customerContactsSelf: false,
        noFollowUpDesired: true,
      }),
    ).toBeUndefined();
    expect(
      validateOfferFollowUpPreferences({
        providedAt: new Date().toISOString(),
        followUpDate: null,
        comparesOffers: false,
        openQuestions: '',
        customerContactsSelf: false,
        noFollowUpDesired: false,
      }),
    ).toMatch(/Nachfassoption|Nachfassdatum/);
  });
});
