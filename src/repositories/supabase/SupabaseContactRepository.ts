import type { Contact } from '../../domain/contact/contact';
import { normalizeContact } from '../../domain/contact/normalizeContact';
import type { ContactRepository } from '../interfaces/ContactRepository';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'lead_contacts';

function contactToRow(contact: Contact): Record<string, unknown> {
  return {
    id: contact.id,
    lead_id: contact.leadId,
    is_primary: contact.isPrimary,
    is_active: contact.isActive,
    created_by_user_id: contact.createdByUserId,
    data: contact,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

function rowToContact(row: JsonTableRow): Contact {
  const normalized = normalizeContact(
    rowData(row, {
      id: row.id,
      leadId: row.lead_id,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
  if (!normalized) {
    throw new Error(`Contact konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseContactRepository implements ContactRepository {
  async getAll(): Promise<Contact[]> {
    const rows = await sbSelectAll(TABLE);
    return rows.map((row) => rowToContact(row));
  }

  async getById(id: string): Promise<Contact | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToContact(row) : null;
  }

  async getByLeadId(leadId: string): Promise<Contact[]> {
    const all = await this.getAll();
    return all
      .filter((contact) => contact.leadId === leadId)
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }
        return left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName);
      });
  }

  async create(contact: Contact): Promise<Contact> {
    const row = await sbInsert(TABLE, contactToRow(contact));
    return rowToContact(row);
  }

  async update(contact: Contact): Promise<Contact> {
    const existing = await this.getById(contact.id);
    if (!existing) {
      throw new Error(`Contact not found: ${contact.id}`);
    }
    const row = await sbUpdate(TABLE, contact.id, contactToRow(contact));
    return rowToContact(row);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }
    await sbDelete(TABLE, id);
    return true;
  }
}
