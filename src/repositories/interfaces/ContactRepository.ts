import type { Contact } from '../../domain/contact/contact';

export interface ContactRepository {
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  getByLeadId(leadId: string): Promise<Contact[]>;
  create(contact: Contact): Promise<Contact>;
  update(contact: Contact): Promise<Contact>;
  delete(id: string): Promise<boolean>;
}
