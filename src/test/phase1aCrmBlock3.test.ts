import { beforeEach, describe, expect, it } from 'vitest';
import {
  contactTouchpoints,
  filterTimelineEntries,
  formatLastCustomerContact,
  groupDocumentsByType,
  groupTimelineByRecency,
  lastCustomerContactForContact,
  latestCustomerContact,
  matchesCrmTimelineFilter,
  matchesTimelineSearch,
  resolveDocumentGroup,
  resolveTimelineRecencyGroup,
} from '../features/lead/customerRecordUi';
import type { Contact } from '../domain/contact/contact';
import type { SalesActivity } from '../domain/salesWorkspace/salesActivity';
import { LocalContactRepository } from '../repositories/local/LocalContactRepository';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { ContactService } from '../services/contactService';
import { LeadService } from '../services/leadService';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import type { CustomerDocumentRef } from '../services/customerDocumentAggregationService';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };

function activity(
  partial: Pick<SalesActivity, 'id' | 'type' | 'title' | 'occurredAt'> &
    Partial<SalesActivity>,
): SalesActivity {
  return {
    schemaVersion: 1,
    description: '',
    createdByUserId: 'user_001',
    leadId: 'lead_001',
    comparisonSessionId: null,
    offerId: null,
    contractId: null,
    contractVersionId: null,
    activationId: null,
    taskId: null,
    contactId: null,
    isSystem: false,
    editable: true,
    sourceKey: null,
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    ...partial,
  };
}

describe('Phase 1A Block 3 – Timeline-Automatik und CRM-Komfort', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  describe('Auto-Timeline Hooks', () => {
    it('erzeugt Timeline-Eintrag beim Anlegen eines Kunden', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const leadService = new LeadService(new LocalLeadRepository());
      leadService.setActivityService(activityService);

      const created = await leadService.createLead(
        {
          ...DEFAULT_CREATE_LEAD_INPUT,
          companyName: 'Timeline GmbH',
          contactFirstName: 'Tim',
          contactLastName: 'Line',
          phone: '+49 111',
          email: 'tim@example.com',
        },
        context.userId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok || !('lead' in created)) {
        return;
      }

      const timeline = await activityService.getTimelineForLead(created.lead.id, context);
      expect(timeline.filter((entry) => entry.type === 'lead_created')).toHaveLength(1);
    });

    it('bleibt beim wiederholten Lead-Anlegen idempotent (sourceKey)', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const first = await activityService.recordSystemActivity(
        {
          type: 'lead_created',
          title: 'Kunde angelegt',
          leadId: 'lead_test',
          sourceKey: 'lead_created:lead_test',
        },
        context,
      );
      const second = await activityService.recordSystemActivity(
        {
          type: 'lead_created',
          title: 'Kunde angelegt',
          leadId: 'lead_test',
          sourceKey: 'lead_created:lead_test',
        },
        context,
      );
      expect(second.id).toBe(first.id);
      const all = await activityService.getTimelineForLead('lead_test', context);
      expect(all.filter((entry) => entry.type === 'lead_created')).toHaveLength(1);
    });

    it('dokumentiert Ansprechpartner-Anlage, Änderung und Primärkontakt', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const contactService = new ContactService(
        new LocalContactRepository(),
        new LocalLeadRepository(),
      );
      contactService.setActivityService(activityService);

      const created = await contactService.create(
        {
          leadId: 'lead_001',
          firstName: 'Anna',
          lastName: 'Alpha',
          phone: '1',
          email: 'a@example.com',
          isPrimary: true,
        },
        context,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const second = await contactService.create(
        {
          leadId: 'lead_001',
          firstName: 'Bert',
          lastName: 'Beta',
          phone: '2',
          email: 'b@example.com',
          isPrimary: false,
        },
        context,
      );
      expect(second.ok).toBe(true);
      if (!second.ok) {
        return;
      }

      await contactService.update(second.contact.id, { role: 'Einkauf' }, context);
      await contactService.setPrimary(second.contact.id, context);
      await contactService.setPrimary(second.contact.id, context);

      const timeline = await activityService.getTimelineForLead('lead_001', context);
      expect(timeline.filter((entry) => entry.type === 'contact_created')).toHaveLength(2);
      expect(timeline.filter((entry) => entry.type === 'contact_updated').length).toBeGreaterThanOrEqual(
        1,
      );
      expect(
        timeline.filter(
          (entry) =>
            entry.type === 'contact_primary_changed' && entry.contactId === second.contact.id,
        ),
      ).toHaveLength(1);
    });

    it('deckt alle geforderten System-Ereignistypen über stabile sourceKeys ab', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const events: Array<{ type: SalesActivity['type']; sourceKey: string }> = [
        { type: 'lead_created', sourceKey: 'lead_created:evt' },
        { type: 'contact_created', sourceKey: 'contact_created:evt' },
        { type: 'contact_updated', sourceKey: 'contact_updated:evt' },
        { type: 'contact_primary_changed', sourceKey: 'contact_primary_changed:lead:evt' },
        { type: 'advice_started', sourceKey: 'advice_started:evt' },
        { type: 'advice_completed', sourceKey: 'advice_completed:evt' },
        { type: 'offer_created', sourceKey: 'offer_created:evt' },
        { type: 'offer_updated', sourceKey: 'offer_updated:evt' },
        { type: 'offer_sent', sourceKey: 'offer_sent:evt' },
        { type: 'approval_requested', sourceKey: 'approval_requested:evt' },
        { type: 'approval_completed', sourceKey: 'approval_completed:evt' },
        { type: 'approval_rejected', sourceKey: 'approval_rejected:evt' },
        { type: 'offer_accepted', sourceKey: 'offer_accepted:evt' },
        { type: 'bestpay_handoff', sourceKey: 'bestpay_handoff:evt' },
        { type: 'activation_started', sourceKey: 'activation_started:evt' },
        { type: 'activation_completed', sourceKey: 'activation_completed:evt' },
        { type: 'commission_approved', sourceKey: 'commission_released:evt' },
        { type: 'commission_paid', sourceKey: 'commission_paid:evt' },
      ];

      for (const event of events) {
        await activityService.recordSystemActivity(
          {
            type: event.type,
            title: event.type,
            leadId: 'lead_001',
            sourceKey: event.sourceKey,
          },
          context,
        );
        await activityService.recordSystemActivity(
          {
            type: event.type,
            title: event.type,
            leadId: 'lead_001',
            sourceKey: event.sourceKey,
          },
          context,
        );
      }

      const timeline = await activityService.getTimelineForLead('lead_001', context, {
        limit: 100,
      });
      for (const event of events) {
        expect(timeline.filter((entry) => entry.sourceKey === event.sourceKey)).toHaveLength(1);
      }
    });
  });

  describe('Schnellaktionen / manuelle Activities', () => {
    it('speichert Telefonat und Besuch mit Ansprechpartner und optionaler Aufgabe', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const taskService = new SalesTaskService(new LocalSalesTaskRepository());
      taskService.setActivityService(activityService);

      const call = await activityService.createManualActivity(
        {
          type: 'call',
          title: 'Telefonat',
          description: 'Rückruf',
          leadId: 'lead_001',
          contactId: 'contact_a',
          occurredAt: '2026-08-02T10:00:00.000Z',
        },
        context,
      );
      expect(call.ok).toBe(true);

      const visit = await activityService.createManualActivity(
        {
          type: 'visit',
          title: 'Besuch',
          description: 'Vor-Ort',
          leadId: 'lead_001',
          contactId: 'contact_a',
          occurredAt: '2026-08-01T10:00:00.000Z',
        },
        context,
      );
      expect(visit.ok).toBe(true);

      const followUp = await taskService.createTask(
        {
          title: 'Nachfassen',
          type: 'phone',
          leadId: 'lead_001',
          contactId: 'contact_a',
          dueAt: '2026-08-05T17:00:00.000Z',
        },
        context,
      );
      expect(followUp.ok).toBe(true);

      const timeline = await activityService.getTimelineForLead('lead_001', context, {
        limit: 50,
      });
      expect(timeline.filter((entry) => entry.type === 'call')).toHaveLength(1);
      expect(timeline.filter((entry) => entry.type === 'visit')).toHaveLength(1);
      expect(timeline.filter((entry) => entry.type === 'task_created')).toHaveLength(1);
    });

    it('erzeugt beim Erledigen höchstens eine task_completed-Activity, Abbrechen keine Kontakt-Activity', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const taskService = new SalesTaskService(new LocalSalesTaskRepository());
      taskService.setActivityService(activityService);

      const created = await taskService.createTask(
        { title: 'Rückruf', type: 'phone', leadId: 'lead_001', contactId: 'contact_a' },
        context,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      await taskService.completeTask(created.task.id, context);
      await taskService.completeTask(created.task.id, context);

      const cancelled = await taskService.createTask(
        { title: 'Abgesagt', type: 'visit', leadId: 'lead_001' },
        context,
      );
      expect(cancelled.ok).toBe(true);
      if (!cancelled.ok) {
        return;
      }
      await taskService.cancelTask(cancelled.task.id, context);

      const timeline = await activityService.getTimelineForLead('lead_001', context, {
        limit: 50,
      });
      expect(
        timeline.filter(
          (entry) => entry.type === 'task_completed' && entry.taskId === created.task.id,
        ),
      ).toHaveLength(1);
      expect(timeline.filter((entry) => entry.type === 'visit')).toHaveLength(0);
      expect(
        timeline.filter(
          (entry) => entry.type === 'task_completed' && entry.taskId === cancelled.task.id,
        ),
      ).toHaveLength(0);
    });
  });

  describe('UI-Helfer', () => {
    it('gruppiert Timeline nach Heute / Gestern / Diese Woche / Älter', () => {
      const now = new Date('2026-08-02T15:00:00.000Z');
      const items = [
        activity({
          id: 'a1',
          type: 'call',
          title: 'Heute',
          occurredAt: '2026-08-02T10:00:00.000Z',
        }),
        activity({
          id: 'a2',
          type: 'visit',
          title: 'Gestern',
          occurredAt: '2026-08-01T10:00:00.000Z',
        }),
        activity({
          id: 'a3',
          type: 'note',
          title: 'Woche',
          occurredAt: '2026-07-28T10:00:00.000Z',
        }),
        activity({
          id: 'a4',
          type: 'email',
          title: 'Älter',
          occurredAt: '2026-07-01T10:00:00.000Z',
        }),
      ];

      expect(resolveTimelineRecencyGroup(items[0]!.occurredAt, now)).toBe('today');
      expect(resolveTimelineRecencyGroup(items[1]!.occurredAt, now)).toBe('yesterday');
      expect(resolveTimelineRecencyGroup(items[2]!.occurredAt, now)).toBe('this_week');
      expect(resolveTimelineRecencyGroup(items[3]!.occurredAt, now)).toBe('older');

      const groups = groupTimelineByRecency(items, now);
      expect(groups.map((group) => group.group)).toEqual([
        'today',
        'yesterday',
        'this_week',
        'older',
      ]);
    });

    it('kombiniert Volltextsuche mit Kommunikations-/Vertriebsfilter', () => {
      const contacts: Contact[] = [
        {
          id: 'c1',
          schemaVersion: 1,
          leadId: 'lead_001',
          firstName: 'Clara',
          lastName: 'Kontakt',
          role: '',
          email: '',
          phone: '',
          mobile: '',
          notes: '',
          preferredChannel: '',
          isPrimary: true,
          isActive: true,
          createdByUserId: 'user_001',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      const entries = [
        activity({
          id: 'a1',
          type: 'call',
          title: 'Rückruf Tarif',
          description: 'Telefon',
          occurredAt: '2026-08-02T10:00:00.000Z',
          contactId: 'c1',
        }),
        activity({
          id: 'a2',
          type: 'offer_created',
          title: 'Angebot erstellt',
          occurredAt: '2026-08-02T09:00:00.000Z',
        }),
        activity({
          id: 'a3',
          type: 'note',
          title: 'Intern Tarif',
          occurredAt: '2026-08-02T08:00:00.000Z',
        }),
      ];

      const communication = filterTimelineEntries(entries, 'communication', 'tarif', contacts);
      expect(communication.map((entry) => entry.id)).toEqual(['a1']);

      const sales = filterTimelineEntries(entries, 'sales', 'angebot', contacts);
      expect(sales.map((entry) => entry.id)).toEqual(['a2']);

      expect(matchesTimelineSearch(entries[0]!, 'clara', contacts)).toBe(true);
      expect(matchesCrmTimelineFilter(entries[2]!, 'sales')).toBe(false);
    });

    it('leitet letzten Kundenkontakt je Ansprechpartner ab (note zählt nicht, Isolation)', () => {
      const touchA = lastCustomerContactForContact('c1', [
        activity({
          id: '1',
          type: 'call',
          title: 'Call',
          occurredAt: '2026-08-02T10:00:00.000Z',
          contactId: 'c1',
        }),
        activity({
          id: '2',
          type: 'note',
          title: 'Note',
          occurredAt: '2026-08-03T10:00:00.000Z',
          contactId: 'c1',
        }),
      ]);
      expect(touchA?.kind).toBe('call');
      expect(touchA?.occurredAt).toBe('2026-08-02T10:00:00.000Z');

      const touchB = lastCustomerContactForContact('c2', [
        activity({
          id: '3',
          type: 'visit',
          title: 'Visit',
          occurredAt: '2026-08-01T10:00:00.000Z',
          contactId: 'c2',
        }),
      ]);
      expect(touchB?.kind).toBe('visit');

      expect(
        formatLastCustomerContact(lastCustomerContactForContact('c3', []), (iso) => iso),
      ).toBe('Noch kein Kontakt');

      const customer = latestCustomerContact([
        activity({
          id: '4',
          type: 'email',
          title: 'Mail',
          occurredAt: '2026-07-30T10:00:00.000Z',
        }),
        activity({
          id: '5',
          type: 'note',
          title: 'Note',
          occurredAt: '2026-08-04T10:00:00.000Z',
        }),
      ]);
      expect(customer?.kind).toBe('email');

      const channels = contactTouchpoints('c1', [
        activity({
          id: '6',
          type: 'note',
          title: 'Note',
          occurredAt: '2026-08-04T10:00:00.000Z',
          contactId: 'c1',
        }),
      ]);
      expect(channels.lastNote).toBe('2026-08-04T10:00:00.000Z');
      expect(channels.lastAny).toBeNull();
    });

    it('gruppiert Dokumente und zeigt Version nur aus Metadaten', () => {
      const docs: CustomerDocumentRef[] = [
        {
          id: 'd1',
          source: 'offer_document',
          leadId: 'lead_001',
          typeKey: 'offer_document',
          typeLabel: 'Angebot',
          fileName: 'a.pdf',
          createdAt: '2026-01-01T00:00:00.000Z',
          offerId: 'o1',
          contractId: null,
          activationId: null,
          versionNumber: 2,
        },
        {
          id: 'd2',
          source: 'sales_document',
          leadId: 'lead_001',
          typeKey: 'contract',
          typeLabel: 'Vertrag',
          fileName: 'v.pdf',
          createdAt: '2026-01-02T00:00:00.000Z',
          offerId: 'o1',
          contractId: 'c1',
          activationId: null,
          versionNumber: null,
        },
        {
          id: 'd3',
          source: 'sales_document',
          leadId: 'lead_001',
          typeKey: 'activation',
          typeLabel: 'Aktivierung',
          fileName: 'act.pdf',
          createdAt: '2026-01-03T00:00:00.000Z',
          offerId: null,
          contractId: 'c1',
          activationId: 'a1',
          versionNumber: null,
        },
        {
          id: 'd4',
          source: 'sales_document',
          leadId: 'lead_001',
          typeKey: 'other',
          typeLabel: 'Sonstiges',
          fileName: 'x.pdf',
          createdAt: '2026-01-04T00:00:00.000Z',
          offerId: null,
          contractId: null,
          activationId: null,
          versionNumber: null,
        },
      ];
      expect(resolveDocumentGroup(docs[0]!)).toBe('offers');
      expect(resolveDocumentGroup(docs[1]!)).toBe('contracts');
      expect(resolveDocumentGroup(docs[2]!)).toBe('activations');
      expect(resolveDocumentGroup(docs[3]!)).toBe('other');
      expect(groupDocumentsByType(docs).map((group) => group.key)).toEqual([
        'offers',
        'contracts',
        'activations',
        'other',
      ]);
      expect(docs[0]!.versionNumber).toBe(2);
      expect(docs[1]!.versionNumber).toBeNull();
    });
  });
});
