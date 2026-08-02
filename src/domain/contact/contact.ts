export const CONTACT_SCHEMA_VERSION = 1;

export type ContactPreferredChannel = 'phone' | 'mobile' | 'email' | '';

export const CONTACT_PREFERRED_CHANNEL_LABELS: Record<Exclude<ContactPreferredChannel, ''>, string> = {
  phone: 'Telefon',
  mobile: 'Mobil',
  email: 'E-Mail',
};

export interface Contact {
  id: string;
  schemaVersion: number;
  leadId: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  mobile: string;
  notes: string;
  preferredChannel: ContactPreferredChannel;
  isPrimary: boolean;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  leadId: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  preferredChannel?: ContactPreferredChannel;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  preferredChannel?: ContactPreferredChannel;
  isPrimary?: boolean;
  isActive?: boolean;
}
