import type { DocumentTemplate } from './documentTemplate';
import { DOCUMENT_TEMPLATE_SCHEMA_VERSION } from './documentTemplate';

export function normalizeDocumentTemplate(raw: unknown): DocumentTemplate | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id : '';
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const type = typeof entry.type === 'string' ? entry.type : '';
  const body = typeof entry.body === 'string' ? entry.body : '';

  if (!id || !name || !type) {
    return null;
  }

  const status =
    entry.status === 'draft' || entry.status === 'active' || entry.status === 'archived'
      ? entry.status
      : 'draft';

  return {
    id,
    schemaVersion:
      typeof entry.schemaVersion === 'number' ? entry.schemaVersion : DOCUMENT_TEMPLATE_SCHEMA_VERSION,
    type: type as DocumentTemplate['type'],
    name,
    versionNumber: typeof entry.versionNumber === 'number' ? entry.versionNumber : 1,
    status,
    validFrom: typeof entry.validFrom === 'string' ? entry.validFrom : null,
    body,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '2026-01-01T00:00:00.000Z',
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '2026-01-01T00:00:00.000Z',
    createdByUserId: typeof entry.createdByUserId === 'string' ? entry.createdByUserId : 'system',
    createdByDisplayName:
      typeof entry.createdByDisplayName === 'string' ? entry.createdByDisplayName : 'System',
  };
}

export function normalizeDocumentTemplates(raw: unknown): DocumentTemplate[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => normalizeDocumentTemplate(entry))
    .filter((entry): entry is DocumentTemplate => entry !== null);
}
