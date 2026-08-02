import { beforeEach, describe, expect, it } from 'vitest';
import {
  BESTPAY_HANDOFF_STATUS_LABELS,
  isTerminalHandoffStatus,
} from '../domain/offer/bestPayHandoff';
import {
  isCustomerAcceptanceComplete,
  validateCustomerAcceptanceCheckboxes,
} from '../domain/offer/offerCustomerAcceptance';
import {
  OFFER_CUSTOMER_STATUS_LABELS,
  OFFER_CUSTOMER_STATUS_ORDER,
} from '../domain/offer/offerCustomerStatus';
import {
  deriveOfferCustomerStatus,
  deriveOfferVersionApprovalStatus,
  getNextOfferVersionNumber,
} from '../domain/offer/offerVersionLifecycle';
import { SHARE_STATUS_LABELS } from '../domain/offer/offerShare';
import { generateShareToken, hashShareToken, verifyShareToken } from '../domain/offer/shareToken';
import { createServices } from '../services';
import { defaultShareValidUntil } from '../services/offerShareService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import {
  createTestOffer,
  FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
} from './helpers/offerTestHelpers';
import type { OfferVersion } from '../domain/offer/offerVersion';
import { EMPTY_OFFER_RECOMMENDATION_LINK } from '../domain/recommendation/recommendationRecord';

const owner = FIELD_SERVICE_CONTEXT;

function createWorkflow() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  return { repos, services };
}

function baseVersion(overrides: Partial<OfferVersion> = {}): OfferVersion {
  return {
    id: 'ver_1',
    offerId: 'offer_1',
    versionNumber: 1,
    workflowStatus: 'draft',
    snapshot: {
      schemaVersion: 1,
      offerId: 'offer_1',
      offerNumber: 'A-001',
      versionNumber: 1,
      leadId: 'lead_1',
      customerSnapshot: {
        leadId: 'lead_1',
        companyName: 'Test GmbH',
        contactFirstName: 'Max',
        contactLastName: 'Mustermann',
        street: '',
        postalCode: '',
        city: '',
        email: 'max@test.de',
        phone: '',
        taxNumber: '',
        vatId: '',
      },
      tariffSnapshot: null,
      items: [],
      title: 'Test',
      introductionText: '',
      internalNotes: '',
      customerNotes: '',
      validUntil: null,
      recommendationLink: EMPTY_OFFER_RECOMMENDATION_LINK,
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
      termMonths: null,
      terminalCount: 0,
      optionalTerminalCount: 0,
      terminalLines: [],
      accessoryLines: [],
      priceBookVersion: null,
      pricingEvaluationId: null,
      commissionReferenceId: null,
      approvalRequired: false,
      approvalReasons: [],
      costBaselineId: null,
      savingsCents: null,
      createdByUserId: owner.userId,
      createdAt: '2026-08-02T10:00:00.000Z',
    },
    createdAt: '2026-08-02T10:00:00.000Z',
    createdByUserId: owner.userId,
    createdByDisplayName: owner.displayName,
    approvedAt: null,
    approvedByUserId: null,
    sentAt: null,
    acceptedAt: null,
    declinedAt: null,
    activatedAt: null,
    supersededAt: null,
    ...overrides,
  };
}

describe('Phase 1B Block 1 – Digitaler Vertriebsprozess (Vorbereitung)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
  });

  describe('Kundenstatus-Modell', () => {
    it('enthält alle geforderten Status mit deutschen Labels', () => {
      expect(OFFER_CUSTOMER_STATUS_ORDER).toEqual([
        'draft',
        'in_review',
        'approved',
        'with_customer',
        'inquiry',
        'change_requested',
        'accepted',
        'declined',
        'handed_to_bestpay',
        'completed',
      ]);
      expect(OFFER_CUSTOMER_STATUS_LABELS.in_review).toBe('In Prüfung');
      expect(OFFER_CUSTOMER_STATUS_LABELS.with_customer).toBe('Beim Kunden');
      expect(OFFER_CUSTOMER_STATUS_LABELS.handed_to_bestpay).toBe('An BestPay übergeben');
    });

    it('leitet Kundenstatus aus Workflow und Kontext ab', () => {
      expect(
        deriveOfferCustomerStatus({
          version: baseVersion({ workflowStatus: 'in_approval' }),
          isCurrent: true,
          approvals: [],
          shares: [],
          acceptances: [],
          handoffs: [],
        }),
      ).toBe('in_review');

      expect(
        deriveOfferCustomerStatus({
          version: baseVersion({ workflowStatus: 'sent' }),
          isCurrent: true,
          approvals: [],
          shares: [{ id: 's1', offerId: 'offer_1', offerVersionId: 'ver_1', tokenHash: 'abc', status: 'active', validFrom: '2026-08-01T00:00:00.000Z', validUntil: '2026-09-01T00:00:00.000Z', accessCount: 0, lastAccessAt: null, createdAt: '2026-08-02T10:00:00.000Z', createdByUserId: owner.userId, revokedAt: null, revokedByUserId: null }],
          acceptances: [],
          handoffs: [],
        }),
      ).toBe('with_customer');
    });
  });

  describe('Freigabestatus je Version', () => {
    it('kennt not_required wenn keine Freigabe nötig', () => {
      const status = deriveOfferVersionApprovalStatus(baseVersion(), []);
      expect(status).toBe('not_required');
    });

    it('kennt approved nach Freigabe-Event', () => {
      const status = deriveOfferVersionApprovalStatus(
        baseVersion({ snapshot: { ...baseVersion().snapshot, approvalRequired: true } }),
        [{
          id: 'ap1',
          schemaVersion: 1,
          type: 'approval',
          offerId: 'offer_1',
          offerVersionId: 'ver_1',
          createdAt: '2026-08-02T10:00:00.000Z',
          createdByUserId: owner.userId,
          createdByDisplayName: owner.displayName,
          note: '',
          status: 'approved',
          requestedByUserId: owner.userId,
          approvedByUserId: 'reviewer',
        }],
      );
      expect(status).toBe('approved');
    });
  });

  describe('Versionierung und Historie', () => {
    it('erzeugt keine zweite Angebotswelt – nur Versionen innerhalb desselben Angebots', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer({ title: 'V1' }));
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);

      await repos.offerRepository.update({
        ...(await repos.offerRepository.getById(offer.id))!,
        title: 'V2',
      });
      await services.offerWorkflowService.createNewVersionIfNeeded(offer.id, 'Änderung', owner);

      const history = await services.offerVersionService.buildVersionHistory(offer.id);
      expect(history).toHaveLength(2);
      expect(history.map((entry) => entry.versionNumber)).toEqual([1, 2]);
      expect(history[0]?.offerId).toBe(offer.id);
      expect(history[1]?.offerId).toBe(offer.id);
      expect(history[0]?.supersededAt).toBeTruthy();
      expect(history[1]?.isCurrent).toBe(true);
    });

    it('liefert nächste Versionsnummer korrekt', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer());
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);
      expect(await services.offerVersionService.getNextVersionNumber(offer.id)).toBe(2);
      expect(getNextOfferVersionNumber([])).toBe(1);
    });
  });

  describe('Share-Modell', () => {
    it('speichert nur Token-Hash, nicht Klartext', async () => {
      const token = generateShareToken();
      const hash = await hashShareToken(token);
      expect(hash).toHaveLength(64);
      expect(await verifyShareToken(token, hash)).toBe(true);
      expect(await verifyShareToken('wrong', hash)).toBe(false);
    });

    it('bereitet Share ohne öffentlichen Link vor', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer());
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);
      const version = await services.offerVersionService.getCurrentVersion(offer.id);

      const result = await services.offerShareService.prepareShare({
        offerId: offer.id,
        offerVersionId: version!.id,
        createdByUserId: owner.userId,
        validUntil: defaultShareValidUntil(),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.token.length).toBeGreaterThan(20);
        expect(result.share.tokenHash).not.toBe(result.token);
        expect(result.share.status).toBe('active');
        expect(SHARE_STATUS_LABELS.active).toBe('Aktiv');
      }
    });
  });

  describe('Annahmeobjekt', () => {
    it('validiert Pflicht-Checkboxen und Name', () => {
      const issues = validateCustomerAcceptanceCheckboxes({
        offerReviewed: false,
        termsUnderstood: true,
        acceptanceIntended: true,
      });
      expect(issues).toContain('Bestätigung „Angebot geprüft“ fehlt.');
    });

    it('persistiert Annahme ohne Signatur', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer());
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);
      const version = await services.offerVersionService.getCurrentVersion(offer.id);

      const result = await services.offerAcceptanceService.prepareAcceptance({
        offerId: offer.id,
        offerVersionId: version!.id,
        acceptorName: 'Maria Kunde',
        checkboxes: {
          offerReviewed: true,
          termsUnderstood: true,
          acceptanceIntended: true,
        },
        comment: 'Einverstanden',
        ipAddress: '192.168.1.1',
        userAgent: 'TestBrowser/1.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(isCustomerAcceptanceComplete(result.acceptance)).toBe(true);
        expect(result.acceptance.acceptorName).toBe('Maria Kunde');
        expect(result.acceptance.ipAddress).toBe('192.168.1.1');
      }
    });
  });

  describe('BestPay-Handoff-Status', () => {
    it('kennt alle geforderten Status', () => {
      expect(Object.keys(BESTPAY_HANDOFF_STATUS_LABELS)).toEqual([
        'handed_over',
        'submitted',
        'accepted',
        'rejected',
        'error',
      ]);
      expect(BESTPAY_HANDOFF_STATUS_LABELS.handed_over).toBe('Übergeben');
      expect(BESTPAY_HANDOFF_STATUS_LABELS.submitted).toBe('Eingereicht');
    });

    it('bereitet Handoff ohne API-Anbindung vor', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer());
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);
      const version = await services.offerVersionService.getCurrentVersion(offer.id);

      const acceptance = await services.offerAcceptanceService.prepareAcceptance({
        offerId: offer.id,
        offerVersionId: version!.id,
        acceptorName: 'Maria Kunde',
        checkboxes: {
          offerReviewed: true,
          termsUnderstood: true,
          acceptanceIntended: true,
        },
      });
      expect(acceptance.ok).toBe(true);

      const handoff = await services.bestPayHandoffService.prepareHandoff({
        offerId: offer.id,
        offerVersionId: version!.id,
        acceptanceId: acceptance.ok ? acceptance.acceptance.id : null,
        bestPayReference: 'BP-12345',
        createdByUserId: owner.userId,
      });
      expect(handoff.ok).toBe(true);
      if (handoff.ok) {
        expect(handoff.handoff.status).toBe('handed_over');
        expect(handoff.handoff.bestPayReference).toBe('BP-12345');
        expect(isTerminalHandoffStatus('accepted')).toBe(true);
      }
    });

    it('reflektiert Handoff in Versionshistorie', async () => {
      const { repos, services } = createWorkflow();
      let offer = await repos.offerRepository.create(createTestOffer());
      offer = await services.offerWorkflowService.ensureInitialVersion(offer);
      const version = await services.offerVersionService.getCurrentVersion(offer.id);

      await services.bestPayHandoffService.prepareHandoff({
        offerId: offer.id,
        offerVersionId: version!.id,
        createdByUserId: owner.userId,
      });

      const history = await services.offerVersionService.buildVersionHistory(offer.id);
      expect(history[0]?.customerStatus).toBe('handed_to_bestpay');
    });
  });
});
