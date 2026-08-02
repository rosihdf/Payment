import { beforeEach, describe, expect, it } from 'vitest';
import { SALES_DOCUMENT_SCHEMA_VERSION } from '../domain/salesDocument/salesDocument';
import { LocalContactRepository } from '../repositories/local/LocalContactRepository';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalSalesActivityRepository } from '../repositories/local/LocalSalesActivityRepository';
import { LocalSalesTaskRepository } from '../repositories/local/LocalSalesTaskRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { ContactService } from '../services/contactService';
import { CustomerDocumentAggregationService } from '../services/customerDocumentAggregationService';
import { SalesActivityService } from '../services/salesActivityService';
import { SalesTaskService } from '../services/salesTaskService';
import { CURRENT_CONTACT_STORAGE_VERSION, migrateContactStorageIfNeeded } from '../services/contactStorageMigration';
import { createTestRepositories } from './helpers/createTestRepositories';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };

describe('Phase 1A Block 1 – CRM Datenmodell + Services', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  describe('ContactService', () => {
    function createContactService() {
      return new ContactService(new LocalContactRepository(), new LocalLeadRepository());
    }

    it('legt mehrere Ansprechpartner an und synchronisiert nur den Primärkontakt auf den Lead', async () => {
      const service = createContactService();
      const leadRepo = new LocalLeadRepository();
      const lead = await leadRepo.getById('lead_001');
      expect(lead).not.toBeNull();
      if (!lead) {
        return;
      }

      const primary = await service.create(
        {
          leadId: 'lead_001',
          firstName: 'Primär',
          lastName: 'Kontakt',
          phone: '+49 111',
          email: 'primaer@example.com',
          isPrimary: true,
        },
        context,
      );
      expect(primary.ok).toBe(true);

      const secondary = await service.create(
        {
          leadId: 'lead_001',
          firstName: 'Zweit',
          lastName: 'Person',
          phone: '+49 222',
          email: 'zweit@example.com',
          role: 'Buchhaltung',
          mobile: '+49 333',
          isPrimary: false,
        },
        context,
      );
      expect(secondary.ok).toBe(true);

      const listed = await service.listByLead('lead_001', context);
      expect(listed.ok).toBe(true);
      if (!listed.ok) {
        return;
      }
      expect(listed.contacts).toHaveLength(2);
      expect(listed.contacts.filter((contact) => contact.isPrimary)).toHaveLength(1);

      const updatedLead = await leadRepo.getById('lead_001');
      expect(updatedLead?.contactFirstName).toBe('Primär');
      expect(updatedLead?.contactLastName).toBe('Kontakt');
      expect(updatedLead?.phone).toBe('+49 111');
      expect(updatedLead?.email).toBe('primaer@example.com');
    });

    it('wechselt den Primärkontakt und aktualisiert Lead-Stammdaten', async () => {
      const service = createContactService();
      const first = await service.create(
        {
          leadId: 'lead_001',
          firstName: 'A',
          lastName: 'Eins',
          phone: '1',
          email: 'a@example.com',
          isPrimary: true,
        },
        context,
      );
      const second = await service.create(
        {
          leadId: 'lead_001',
          firstName: 'B',
          lastName: 'Zwei',
          phone: '2',
          email: 'b@example.com',
        },
        context,
      );
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        return;
      }

      const set = await service.setPrimary(second.contact.id, context);
      expect(set.ok).toBe(true);

      const lead = await new LocalLeadRepository().getById('lead_001');
      expect(lead?.contactFirstName).toBe('B');
      expect(lead?.email).toBe('b@example.com');

      const listed = await service.listByLead('lead_001', context, { includeInactive: true });
      expect(listed.ok).toBe(true);
      if (!listed.ok) {
        return;
      }
      expect(listed.contacts.find((contact) => contact.id === first.contact.id)?.isPrimary).toBe(
        false,
      );
      expect(listed.contacts.find((contact) => contact.id === second.contact.id)?.isPrimary).toBe(
        true,
      );
    });

    it('bootstrappt Primärkontakt aus Lead-Stammdaten idempotent', async () => {
      const service = createContactService();
      const first = await service.ensurePrimaryFromLead('lead_001', context);
      const second = await service.ensurePrimaryFromLead('lead_001', context);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        return;
      }
      expect(first.contact?.id).toBe(second.contact?.id);
      const listed = await service.listByLead('lead_001', context);
      expect(listed.ok && listed.contacts).toHaveLength(1);
    });

    it('migriert Contact-Store fehlertolerant', () => {
      writeStorageItem(STORAGE_KEYS.contacts, [{ broken: true }, { id: 'c1', leadId: 'lead_001', firstName: 'Ok', lastName: 'Person', createdByUserId: 'u' }]);
      writeStorageItem(STORAGE_KEYS.contactStorageVersion, 0);
      migrateContactStorageIfNeeded();
      expect(readStorageItem(STORAGE_KEYS.contactStorageVersion)).toBe(CURRENT_CONTACT_STORAGE_VERSION);
      const contacts = readStorageItem<unknown[]>(STORAGE_KEYS.contacts) ?? [];
      expect(contacts).toHaveLength(1);
    });
  });

  describe('SalesActivityService', () => {
    it('erlaubt visit und note; blockiert andere manuelle Typen', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      const visit = await activityService.createManualActivity(
        {
          type: 'visit',
          title: 'Kundenbesuch',
          description: 'Gespräch vor Ort',
          leadId: 'lead_001',
          contactId: 'contact_1',
        },
        context,
      );
      expect(visit.ok).toBe(true);
      if (!visit.ok) {
        return;
      }
      expect(visit.activity.type).toBe('visit');
      expect(visit.activity.contactId).toBe('contact_1');

      const note = await activityService.createManualActivity(
        { type: 'note', title: 'Interne Notiz', leadId: 'lead_001' },
        context,
      );
      expect(note.ok).toBe(true);

      const invalid = await activityService.createManualActivity(
        { type: 'offer_created', title: 'Nein', leadId: 'lead_001' },
        context,
      );
      expect(invalid.ok).toBe(false);
    });

    it('liefert Timeline gefiltert nach Gruppe und Suche', async () => {
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      await activityService.createManualActivity(
        { type: 'call', title: 'Anruf Buchhaltung', leadId: 'lead_001' },
        context,
      );
      await activityService.createManualActivity(
        { type: 'visit', title: 'Besuch Filiale', leadId: 'lead_001' },
        context,
      );
      await activityService.createManualActivity(
        { type: 'note', title: 'Interne Notiz XYZ', leadId: 'lead_001' },
        context,
      );
      await activityService.recordSystemActivity(
        {
          type: 'offer_created',
          title: 'Angebot erstellt',
          leadId: 'lead_001',
          sourceKey: 'offer_created:test',
        },
        context,
      );

      const communication = await activityService.getTimelineForLead('lead_001', context, {
        group: 'communication',
      });
      expect(communication.every((entry) => entry.type === 'call')).toBe(true);

      const visits = await activityService.getTimelineForLead('lead_001', context, { group: 'visit' });
      expect(visits).toHaveLength(1);

      const notes = await activityService.getTimelineForLead('lead_001', context, { group: 'note' });
      expect(notes).toHaveLength(1);

      const searched = await activityService.getTimelineForLead('lead_001', context, {
        query: 'XYZ',
      });
      expect(searched).toHaveLength(1);
      expect(searched[0]?.type).toBe('note');
    });
  });

  describe('SalesTaskService CRM-Typen', () => {
    it('legt CRM-Tasktypen mit erlaubten Stati an', async () => {
      const taskService = new SalesTaskService(new LocalSalesTaskRepository());
      const activityService = new SalesActivityService(new LocalSalesActivityRepository());
      taskService.setActivityService(activityService);

      for (const type of ['phone', 'mail', 'visit', 'follow_up', 'approval', 'activation', 'other'] as const) {
        const created = await taskService.createTask(
          { title: `Task ${type}`, type, leadId: 'lead_001' },
          context,
        );
        expect(created.ok).toBe(true);
        if (!created.ok) {
          return;
        }
        expect(created.task.type).toBe(type);
        expect(created.task.status).toBe('open');
      }

      const first = await taskService.createTask(
        { title: 'In Arbeit', type: 'phone', leadId: 'lead_001' },
        context,
      );
      expect(first.ok).toBe(true);
      if (!first.ok) {
        return;
      }
      const progressed = await taskService.updateTask(
        first.task.id,
        { status: 'in_progress' },
        context,
      );
      expect(progressed.ok).toBe(true);
      if (!progressed.ok) {
        return;
      }
      expect(progressed.task.status).toBe('in_progress');

      const done = await taskService.completeTask(first.task.id, context, 'ok');
      expect(done.ok).toBe(true);
      if (!done.ok) {
        return;
      }
      expect(done.task.status).toBe('done');
    });

    it('bewahrt bestehende Tasktypen (Regression)', async () => {
      const taskService = new SalesTaskService(new LocalSalesTaskRepository());
      const created = await taskService.createTask(
        { title: 'Legacy', type: 'callback', leadId: 'lead_001' },
        context,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      expect(created.task.type).toBe('callback');
    });
  });

  describe('CustomerDocumentAggregationService', () => {
    it('aggregiert SalesDocuments über Lead-Offers ohne Upload', async () => {
      const repos = createTestRepositories();
      const offers = await repos.offerRepository.getAll();
      let offer = offers.find((entry) => entry.leadId === 'lead_001');
      if (!offer) {
        const lead = await repos.leadRepository.getById('lead_001');
        expect(lead).not.toBeNull();
        if (!lead) {
          return;
        }
        offer = await repos.offerRepository.create({
          id: 'offer_crm_agg_1',
          schemaVersion: 1,
          offerNumber: 'ANG-CRM-1',
          leadId: 'lead_001',
          title: 'Test',
          status: 'draft',
          workflowStatus: 'draft',
          createdByUserId: context.userId,
          assignedSalesUserId: context.userId,
          customerSnapshot: {
            leadId: lead.id,
            companyName: lead.companyName,
            contactName: `${lead.contactFirstName} ${lead.contactLastName}`,
            email: lead.email,
            phone: lead.phone,
            street: lead.street,
            postalCode: lead.postalCode,
            city: lead.city,
            taxId: '',
          },
          tariffSnapshot: null,
          items: [],
          totals: {
            netCents: 0,
            vatCents: 0,
            grossCents: 0,
            monthlyRecurringNetCents: 0,
            oneTimeNetCents: 0,
          },
          internalNotes: '',
          customerNotes: '',
          validUntil: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as never);
      }

      await repos.salesDocumentRepository.create({
        id: 'sales_doc_crm_1',
        schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
        offerId: offer.id,
        offerVersionId: null,
        contractId: null,
        contractVersionId: null,
        terminationId: null,
        activationId: null,
        type: 'offer_pdf',
        fileName: 'angebot.pdf',
        mimeType: 'application/pdf',
        externalReference: null,
        checksum: null,
        createdAt: new Date().toISOString(),
        createdByUserId: context.userId,
        createdByDisplayName: 'Laura',
      });

      const aggregation = new CustomerDocumentAggregationService(
        repos.offerRepository,
        repos.contractRepository,
        repos.activationCaseRepository,
        repos.salesDocumentRepository,
        repos.offerDocumentRepository,
      );
      const docs = await aggregation.listForLead('lead_001');
      expect(docs.some((doc) => doc.id === 'sales_doc_crm_1')).toBe(true);
      expect(docs.every((doc) => doc.leadId === 'lead_001')).toBe(true);
    });
  });

  describe('Services wiring', () => {
    it('stellt Contact- und Aggregationsservice über createServices bereit', async () => {
      const { createServices } = await import('../services');
      const services = createServices(createTestRepositories());
      expect(services.contactService).toBeInstanceOf(ContactService);
      expect(services.customerDocumentAggregationService).toBeInstanceOf(
        CustomerDocumentAggregationService,
      );
      expect(services.salesActivityService).toBeInstanceOf(SalesActivityService);
      expect(services.salesTaskService).toBeInstanceOf(SalesTaskService);
    });
  });
});
