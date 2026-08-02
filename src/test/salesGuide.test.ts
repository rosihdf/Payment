import { describe, expect, it } from 'vitest';
import {
  APPROVAL_DEVIATION_FIELD_MESSAGE,
  COMPETITOR_COMPARISON_ALLOWED,
  containsForbiddenSalesPressure,
  CUSTOMER_MAY_REVIEW_AT_HOME,
  NO_SIGNATURE_REQUIRED_MESSAGE,
  OFFER_REVIEW_TIME_MESSAGE,
  pickSalesGuideTip,
  resolveFieldApprovalStatusLabel,
  resolveSalesGuideContextFromOfferStatus,
  SALES_GUIDE_PHASES,
  SALES_GUIDE_PRINCIPLE,
  SALES_GUIDE_TIPS,
  SALES_PROCESS_FLOW,
} from '../domain/sales/salesGuide';
import { validateOfferFollowUpPreferences } from '../domain/offer/offerWorkflowValidation';
import {
  buildSalesGuideNotifications,
  type SalesGuideNotification,
} from '../domain/sales/salesGuideNotifications';
import {
  followUpDateInputValue,
  followUpTaskSourceKey,
  legacyFollowUpTaskSourceKeys,
  resolveFollowUpDueAt,
  resolveFollowUpTaskTitle,
  shouldScheduleFollowUpTask,
  STANDARD_FOLLOW_UP_OFFSETS_DAYS,
} from '../domain/sales/salesFollowUpSchedule';
import type { Offer } from '../domain/offer/offer';
import type { SalesActivity } from '../domain/salesWorkspace/salesActivity';

describe('Verkaufsleitfaden', () => {
  it('definiert alle 13 Prozessphasen in den Wizard-Kontexten', () => {
    expect(SALES_GUIDE_PHASES.hub.phase).toBe(1);
    expect(SALES_GUIDE_PHASES.prospect.phase).toBe(2);
    expect(SALES_GUIDE_PHASES.need.phase).toBe(3);
    expect(SALES_GUIDE_PHASES.variants.phase).toBe(4);
    expect(SALES_GUIDE_PHASES.offer.phase).toBe(5);
    expect(SALES_GUIDE_PHASES.offer_send.phase).toBe(6);
    expect(SALES_GUIDE_PHASES.closing.phase).toBe(7);
    expect(SALES_GUIDE_PHASES.offer_sent.phase).toBe(8);
    expect(SALES_GUIDE_PHASES.approval.phase).toBe(9);
    expect(SALES_GUIDE_PHASES.offer_accept.phase).toBe(10);
    expect(SALES_GUIDE_PHASES.contract.phase).toBe(11);
    expect(SALES_GUIDE_PHASES.activation.phase).toBe(12);
    expect(SALES_GUIDE_PHASES.commission.phase).toBe(13);
  });

  it('betont ausdrücklich keine sofortige Unterschrift und Mitbewerbervergleich', () => {
    expect(SALES_GUIDE_PHASES.offer.hints).toContain(NO_SIGNATURE_REQUIRED_MESSAGE);
    expect(SALES_GUIDE_PHASES.offer.hints).toContain(OFFER_REVIEW_TIME_MESSAGE);
    expect(SALES_GUIDE_PHASES.offer.hints).toContain(COMPETITOR_COMPARISON_ALLOWED);
    expect(SALES_GUIDE_PHASES.offer_send.hints).toContain(NO_SIGNATURE_REQUIRED_MESSAGE);
    expect(SALES_GUIDE_PHASES.offer.emphasis).toBe(CUSTOMER_MAY_REVIEW_AT_HOME);
    expect(SALES_GUIDE_PHASES.variants.hints).toContain(COMPETITOR_COMPARISON_ALLOWED);
    expect(SALES_GUIDE_PHASES.approval.emphasis).toBe(APPROVAL_DEVIATION_FIELD_MESSAGE);
    expect(SALES_GUIDE_PRINCIPLE.reminders.join(' ')).toMatch(/Transparenz statt Verkaufsdruck/);
    expect(containsForbiddenSalesPressure(NO_SIGNATURE_REQUIRED_MESSAGE)).toBe(false);
    expect(containsForbiddenSalesPressure('Bitte heute unterschreiben')).toBe(true);
  });

  it('liefert deterministische Verkaufstipps', () => {
    expect(SALES_GUIDE_TIPS.length).toBeGreaterThanOrEqual(5);
    expect(pickSalesGuideTip('prospect')).toBe(pickSalesGuideTip('prospect'));
    expect(SALES_GUIDE_TIPS).toContain(pickSalesGuideTip('prospect'));
  });

  it('ordnet Angebotsstatus dem Leitfaden-Kontext zu', () => {
    expect(resolveSalesGuideContextFromOfferStatus('approval_required')).toBe('offer_approval');
    expect(resolveSalesGuideContextFromOfferStatus('ready_to_send')).toBe('offer_send');
    expect(resolveSalesGuideContextFromOfferStatus('sent')).toBe('offer_sent');
    expect(resolveSalesGuideContextFromOfferStatus('accepted')).toBe('contract');
  });

  it('beschreibt den Standardprozess ohne Druck', () => {
    expect(SALES_PROCESS_FLOW).toHaveLength(13);
    expect(SALES_PROCESS_FLOW).toContain('Kunde prüft');
    expect(SALES_PROCESS_FLOW).toContain('Freigabe (wenn notwendig)');
    expect(SALES_PROCESS_FLOW.at(-1)).toBe('Provision');
  });

  it('ordnet Freigabestatus für den Außendienst', () => {
    expect(resolveFieldApprovalStatusLabel('in_approval')).toBe('Wartet auf Freigabe');
    expect(resolveFieldApprovalStatusLabel('changes_requested')).toBe('Änderung erforderlich');
    expect(resolveFieldApprovalStatusLabel('approved')).toBe('Freigegeben');
  });
});

describe('Wiedervorlage-Plan', () => {
  it('bietet Schnellauswahl morgen, drei Tage und sieben Tage', () => {
    expect(STANDARD_FOLLOW_UP_OFFSETS_DAYS).toEqual([1, 3, 7]);
    expect(followUpDateInputValue(3)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('erzeugt genau einen idempotenten sourceKey pro Angebot', () => {
    expect(followUpTaskSourceKey('offer_1')).toBe('auto:follow_up_offer:offer_1');
    expect(legacyFollowUpTaskSourceKeys('offer_1')).toEqual([
      'auto:follow_up_offer:1d:offer_1',
      'auto:follow_up_offer:3d:offer_1',
      'auto:follow_up_offer:7d:offer_1',
    ]);
  });

  it('leitet Titel und Fälligkeit aus dem gewählten Datum ab', () => {
    const tomorrow = followUpDateInputValue(1);
    expect(resolveFollowUpTaskTitle({ followUpDate: new Date(tomorrow).toISOString() })).toMatch(
      /morgen/i,
    );
    expect(resolveFollowUpDueAt({ followUpDate: tomorrow }).slice(0, 10)).toBe(tomorrow);
  });

  it('plant keine Aufgabe bei Selbstkontakt oder ohne Nachfassen', () => {
    expect(shouldScheduleFollowUpTask({ noFollowUpDesired: true, customerContactsSelf: false })).toBe(
      false,
    );
    expect(shouldScheduleFollowUpTask({ noFollowUpDesired: false, customerContactsSelf: true })).toBe(
      false,
    );
    expect(shouldScheduleFollowUpTask({ noFollowUpDesired: false, customerContactsSelf: false })).toBe(
      true,
    );
    expect(
      validateOfferFollowUpPreferences({
        providedAt: '2026-08-01T10:00:00.000Z',
        followUpDate: null,
        comparesOffers: false,
        openQuestions: '',
        customerContactsSelf: true,
        noFollowUpDesired: false,
      }),
    ).toBeUndefined();
    expect(
      validateOfferFollowUpPreferences({
        providedAt: '2026-08-01T10:00:00.000Z',
        followUpDate: null,
        comparesOffers: false,
        openQuestions: '',
        customerContactsSelf: false,
        noFollowUpDesired: false,
      }),
    ).toMatch(/genau eine Nachfassoption/i);
  });
});

describe('ensureOrUpdateAutomaticTask', () => {
  it('ersetzt eine bestehende Wiedervorlage statt Dubletten anzulegen', async () => {
    const { SalesTaskService } = await import('../services/salesTaskService');
    const { LocalSalesTaskRepository } = await import(
      '../repositories/local/LocalSalesTaskRepository'
    );
    const taskService = new SalesTaskService(new LocalSalesTaskRepository());
    const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
    const sourceKey = followUpTaskSourceKey('offer_test');

    await taskService.ensureOrUpdateAutomaticTask(
      {
        title: 'Angebot nachfassen (morgen)',
        type: 'follow_up_offer',
        priority: 'normal',
        dueAt: followUpDateInputValue(1),
        offerId: 'offer_test',
        sourceKey,
      },
      context,
    );
    await taskService.ensureOrUpdateAutomaticTask(
      {
        title: 'Angebot nachfassen (3 Tage)',
        type: 'follow_up_offer',
        priority: 'normal',
        dueAt: followUpDateInputValue(3),
        offerId: 'offer_test',
        sourceKey,
      },
      context,
    );

    const tasks = await taskService.listVisible(context);
    const openFollowUps = tasks.filter(
      (task) => task.sourceKey === sourceKey && task.status === 'open',
    );
    expect(openFollowUps).toHaveLength(1);
    expect(openFollowUps[0]?.title).toBe('Angebot nachfassen (3 Tage)');
  });
});

describe('Verkaufs-Benachrichtigungen', () => {
  const baseActivity = (overrides: Partial<SalesActivity>): SalesActivity => ({
    id: 'act_1',
    schemaVersion: 1,
    type: 'approval_requested',
    title: 'Angebot wartet auf Freigabe',
    description: 'Test',
    occurredAt: '2026-08-01T10:00:00.000Z',
    createdByUserId: 'user_001',
    leadId: 'lead_1',
    comparisonSessionId: null,
    offerId: 'offer_1',
    contractId: null,
    contractVersionId: null,
    activationId: null,
    taskId: null,
    isSystem: true,
    editable: false,
    sourceKey: 'test',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  });

  const baseOffer = (overrides: Partial<Offer>): Offer =>
    ({
      id: 'offer_1',
      offerNumber: 'A-1001',
      leadId: 'lead_1',
      currentVersionNumber: 2,
      updatedAt: '2026-08-01T09:00:00.000Z',
      workflowStatus: 'approval_required',
      ...overrides,
    }) as Offer;

  it('zeigt Admins wartende Freigaben mit Version', () => {
    const notifications: SalesGuideNotification[] = buildSalesGuideNotifications(
      [],
      'admin',
      [baseOffer({})],
    );
    expect(notifications.some((entry) => entry.title === 'Angebot wartet auf Freigabe')).toBe(true);
    expect(notifications[0]?.description).toContain('Version 2');
  });

  it('zeigt Außendienst Freigabe und Annahme', () => {
    const notifications = buildSalesGuideNotifications(
      [
        baseActivity({ title: 'Angebot freigegeben', type: 'approval_completed' }),
        baseActivity({ id: 'act_2', title: 'Kunde angenommen', type: 'offer_accepted' }),
        baseActivity({ id: 'act_3', title: 'Änderung erforderlich', type: 'status_change' }),
      ],
      'field_service',
      [],
    );
    expect(notifications.map((entry) => entry.title)).toEqual(
      expect.arrayContaining(['Angebot freigegeben', 'Kunde angenommen', 'Änderung erforderlich']),
    );
  });
});
