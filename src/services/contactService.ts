import {
  CONTACT_SCHEMA_VERSION,
  type Contact,
  type CreateContactInput,
  type UpdateContactInput,
} from '../domain/contact/contact';
import type { Lead } from '../domain/lead/lead';
import type { User } from '../domain/user/user';
import type { ContactRepository } from '../repositories/interfaces/ContactRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import { generateId, nowIso } from '../utils/id';
import { formatContactName } from '../utils/format';
import type { SalesActivityService } from './salesActivityService';

export interface ContactUserContext {
  userId: string;
  role: User['role'];
  displayName?: string;
}

export type ContactError = 'not_found' | 'forbidden' | 'validation' | 'conflict';

function canAccessLead(lead: Lead, context: ContactUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }
  return lead.assignedSalesUserId === context.userId || lead.createdByUserId === context.userId;
}

/** Primärkontakt → Lead-Stammdaten (Name, Telefon, Mail). Eine Wahrheit. */
export function applyPrimaryContactToLead(lead: Lead, contact: Contact): Lead {
  return {
    ...lead,
    contactFirstName: contact.firstName.trim(),
    contactLastName: contact.lastName.trim(),
    phone: contact.phone.trim(),
    email: contact.email.trim(),
    updatedAt: nowIso(),
  };
}

export class ContactService {
  private readonly contactRepository: ContactRepository;
  private readonly leadRepository: LeadRepository;
  private activityService: SalesActivityService | null = null;

  constructor(contactRepository: ContactRepository, leadRepository: LeadRepository) {
    this.contactRepository = contactRepository;
    this.leadRepository = leadRepository;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  async listByLead(
    leadId: string,
    context: ContactUserContext,
    options?: { includeInactive?: boolean },
  ): Promise<{ ok: true; contacts: Contact[] } | { ok: false; error: ContactError }> {
    const lead = await this.leadRepository.getById(leadId);
    if (!lead) {
      return { ok: false, error: 'not_found' };
    }
    if (!canAccessLead(lead, context)) {
      return { ok: false, error: 'forbidden' };
    }
    let contacts = await this.contactRepository.getByLeadId(leadId);
    if (!options?.includeInactive) {
      contacts = contacts.filter((contact) => contact.isActive);
    }
    return { ok: true, contacts };
  }

  async create(
    input: CreateContactInput,
    context: ContactUserContext,
  ): Promise<{ ok: true; contact: Contact } | { ok: false; error: ContactError; message?: string }> {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    if (!firstName || !lastName) {
      return { ok: false, error: 'validation', message: 'Vor- und Nachname sind erforderlich.' };
    }

    const lead = await this.leadRepository.getById(input.leadId);
    if (!lead) {
      return { ok: false, error: 'not_found', message: 'Kunde nicht gefunden.' };
    }
    if (!canAccessLead(lead, context)) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.contactRepository.getByLeadId(input.leadId);
    const wantsPrimary = Boolean(input.isPrimary) || existing.length === 0;
    if (wantsPrimary && input.isActive === false) {
      return {
        ok: false,
        error: 'validation',
        message: 'Der Primärkontakt muss aktiv sein.',
      };
    }

    const timestamp = nowIso();
    const contact: Contact = {
      id: generateId('contact'),
      schemaVersion: CONTACT_SCHEMA_VERSION,
      leadId: input.leadId,
      firstName,
      lastName,
      role: input.role?.trim() ?? '',
      email: input.email?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      mobile: input.mobile?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      preferredChannel: input.preferredChannel ?? '',
      isPrimary: wantsPrimary,
      isActive: input.isActive ?? true,
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (wantsPrimary) {
      await this.clearPrimaryFlags(input.leadId, null);
    }

    const created = await this.contactRepository.create(contact);
    if (created.isPrimary) {
      await this.syncPrimaryToLead(created);
    }
    const contactName = formatContactName(created.firstName, created.lastName);
    await this.activityService?.recordSystemActivity(
      {
        type: 'contact_created',
        title: `Ansprechpartner angelegt: ${contactName}`,
        description: created.role,
        leadId: created.leadId,
        contactId: created.id,
        sourceKey: `contact_created:${created.id}`,
      },
      context,
    );
    if (created.isPrimary) {
      await this.activityService?.recordSystemActivity(
        {
          type: 'contact_primary_changed',
          title: `Primärkontakt: ${contactName}`,
          description: '',
          leadId: created.leadId,
          contactId: created.id,
          sourceKey: `contact_primary_changed:${created.leadId}:${created.id}`,
        },
        context,
      );
    }
    return { ok: true, contact: created };
  }

  async update(
    id: string,
    input: UpdateContactInput,
    context: ContactUserContext,
  ): Promise<{ ok: true; contact: Contact } | { ok: false; error: ContactError; message?: string }> {
    const existing = await this.contactRepository.getById(id);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }
    const lead = await this.leadRepository.getById(existing.leadId);
    if (!lead || !canAccessLead(lead, context)) {
      return { ok: false, error: 'forbidden' };
    }

    const nextPrimary = input.isPrimary ?? existing.isPrimary;
    const nextActive = input.isActive ?? existing.isActive;
    if (nextPrimary && !nextActive) {
      return {
        ok: false,
        error: 'validation',
        message: 'Der Primärkontakt muss aktiv sein.',
      };
    }

    if (existing.isPrimary && input.isPrimary === false) {
      const siblings = (await this.contactRepository.getByLeadId(existing.leadId)).filter(
        (contact) => contact.id !== existing.id && contact.isActive,
      );
      if (siblings.length === 0) {
        return {
          ok: false,
          error: 'validation',
          message: 'Mindestens ein aktiver Primärkontakt ist erforderlich.',
        };
      }
    }

    const updated: Contact = {
      ...existing,
      firstName: input.firstName !== undefined ? input.firstName.trim() : existing.firstName,
      lastName: input.lastName !== undefined ? input.lastName.trim() : existing.lastName,
      role: input.role !== undefined ? input.role.trim() : existing.role,
      email: input.email !== undefined ? input.email.trim() : existing.email,
      phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
      mobile: input.mobile !== undefined ? input.mobile.trim() : existing.mobile,
      notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
      preferredChannel:
        input.preferredChannel !== undefined ? input.preferredChannel : existing.preferredChannel,
      isPrimary: nextPrimary,
      isActive: nextActive,
      updatedAt: nowIso(),
    };

    if (!updated.firstName || !updated.lastName) {
      return { ok: false, error: 'validation', message: 'Vor- und Nachname sind erforderlich.' };
    }

    if (updated.isPrimary) {
      await this.clearPrimaryFlags(updated.leadId, updated.id);
    }

    const saved = await this.contactRepository.update(updated);
    if (saved.isPrimary) {
      await this.syncPrimaryToLead(saved);
    } else if (existing.isPrimary && !saved.isPrimary) {
      const next = (await this.contactRepository.getByLeadId(saved.leadId)).find(
        (contact) => contact.isPrimary && contact.isActive,
      );
      if (next) {
        await this.syncPrimaryToLead(next);
      }
    }
    const contactName = formatContactName(saved.firstName, saved.lastName);
    await this.activityService?.recordSystemActivity(
      {
        type: 'contact_updated',
        title: `Ansprechpartner geändert: ${contactName}`,
        description: '',
        leadId: saved.leadId,
        contactId: saved.id,
        sourceKey: `contact_updated:${saved.id}:${saved.updatedAt}`,
      },
      context,
    );
    if (!existing.isPrimary && saved.isPrimary) {
      await this.activityService?.recordSystemActivity(
        {
          type: 'contact_primary_changed',
          title: `Primärkontakt: ${contactName}`,
          description: '',
          leadId: saved.leadId,
          contactId: saved.id,
          sourceKey: `contact_primary_changed:${saved.leadId}:${saved.id}`,
        },
        context,
      );
    }
    return { ok: true, contact: saved };
  }

  async setPrimary(
    id: string,
    context: ContactUserContext,
  ): Promise<{ ok: true; contact: Contact } | { ok: false; error: ContactError; message?: string }> {
    return this.update(id, { isPrimary: true, isActive: true }, context);
  }

  /**
   * Legt aus Lead-Stammdaten einen Primärkontakt an, wenn noch keine Kontakte existieren.
   * Keine Doppelpflege: Lead bleibt Spiegel des Primärkontakts.
   */
  async ensurePrimaryFromLead(
    leadId: string,
    context: ContactUserContext,
  ): Promise<{ ok: true; contact: Contact | null } | { ok: false; error: ContactError }> {
    const lead = await this.leadRepository.getById(leadId);
    if (!lead) {
      return { ok: false, error: 'not_found' };
    }
    if (!canAccessLead(lead, context)) {
      return { ok: false, error: 'forbidden' };
    }
    const existing = await this.contactRepository.getByLeadId(leadId);
    if (existing.length > 0) {
      return {
        ok: true,
        contact: existing.find((contact) => contact.isPrimary) ?? existing[0] ?? null,
      };
    }
    if (!lead.contactFirstName.trim() && !lead.contactLastName.trim()) {
      return { ok: true, contact: null };
    }
    const created = await this.create(
      {
        leadId,
        firstName: lead.contactFirstName || 'Unbekannt',
        lastName: lead.contactLastName || 'Kontakt',
        email: lead.email,
        phone: lead.phone,
        isPrimary: true,
      },
      context,
    );
    if (!created.ok) {
      return { ok: false, error: created.error };
    }
    return { ok: true, contact: created.contact };
  }

  private async clearPrimaryFlags(leadId: string, exceptId: string | null): Promise<void> {
    const contacts = await this.contactRepository.getByLeadId(leadId);
    await Promise.all(
      contacts
        .filter((contact) => contact.isPrimary && contact.id !== exceptId)
        .map((contact) =>
          this.contactRepository.update({
            ...contact,
            isPrimary: false,
            updatedAt: nowIso(),
          }),
        ),
    );
  }

  private async syncPrimaryToLead(contact: Contact): Promise<void> {
    const lead = await this.leadRepository.getById(contact.leadId);
    if (!lead) {
      return;
    }
    await this.leadRepository.update(applyPrimaryContactToLead(lead, contact));
  }
}
