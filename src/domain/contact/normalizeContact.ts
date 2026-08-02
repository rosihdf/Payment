import { CONTACT_SCHEMA_VERSION, type Contact } from './contact';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeContact(raw: unknown): Contact | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.leadId !== 'string') {
    return null;
  }
  if (typeof raw.firstName !== 'string' || typeof raw.lastName !== 'string') {
    return null;
  }
  if (typeof raw.createdByUserId !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    schemaVersion: CONTACT_SCHEMA_VERSION,
    leadId: raw.leadId,
    firstName: raw.firstName.trim(),
    lastName: raw.lastName.trim(),
    role: typeof raw.role === 'string' ? raw.role : '',
    email: typeof raw.email === 'string' ? raw.email.trim() : '',
    phone: typeof raw.phone === 'string' ? raw.phone.trim() : '',
    mobile: typeof raw.mobile === 'string' ? raw.mobile.trim() : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    preferredChannel:
      raw.preferredChannel === 'phone' ||
      raw.preferredChannel === 'mobile' ||
      raw.preferredChannel === 'email'
        ? raw.preferredChannel
        : '',
    isPrimary: Boolean(raw.isPrimary),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    createdByUserId: raw.createdByUserId,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

export function normalizeContacts(raw: unknown): Contact[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeContact).filter((entry): entry is Contact => entry !== null);
}
