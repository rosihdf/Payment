import type { Contact } from '../../domain/contact/contact';
import { normalizeContact, normalizeContacts } from '../../domain/contact/normalizeContact';
import { migrateContactStorageIfNeeded } from '../../services/contactStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ContactRepository } from '../interfaces/ContactRepository';

export class LocalContactRepository implements ContactRepository {
  private readAll(): Contact[] {
    migrateContactStorageIfNeeded();
    return normalizeContacts(readStorageItem<unknown[]>(STORAGE_KEYS.contacts) ?? []);
  }

  private writeAll(contacts: Contact[]): void {
    migrateContactStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.contacts, contacts);
  }

  async getAll(): Promise<Contact[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<Contact | null> {
    return this.readAll().find((contact) => contact.id === id) ?? null;
  }

  async getByLeadId(leadId: string): Promise<Contact[]> {
    return this.readAll()
      .filter((contact) => contact.leadId === leadId)
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }
        return left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName);
      });
  }

  async create(contact: Contact): Promise<Contact> {
    const contacts = this.readAll();
    const normalized = normalizeContact(contact);
    if (!normalized) {
      throw new Error('Contact konnte nicht normalisiert werden');
    }
    contacts.push(normalized);
    this.writeAll(contacts);
    return normalized;
  }

  async update(contact: Contact): Promise<Contact> {
    const contacts = this.readAll();
    const index = contacts.findIndex((entry) => entry.id === contact.id);
    if (index < 0) {
      throw new Error(`Contact not found: ${contact.id}`);
    }
    const normalized = normalizeContact(contact);
    if (!normalized) {
      throw new Error('Contact konnte nicht normalisiert werden');
    }
    contacts[index] = normalized;
    this.writeAll(contacts);
    return normalized;
  }

  async delete(id: string): Promise<boolean> {
    const contacts = this.readAll();
    const next = contacts.filter((contact) => contact.id !== id);
    if (next.length === contacts.length) {
      return false;
    }
    this.writeAll(next);
    return true;
  }
}
