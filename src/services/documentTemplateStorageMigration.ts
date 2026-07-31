import type { DocumentTemplate } from '../domain/template/documentTemplate';
import { generateId } from '../utils/id';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_DOCUMENT_TEMPLATE_STORAGE_VERSION = 1;

function createDefaultTemplates(): DocumentTemplate[] {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return [
    {
      id: generateId('document_template'),
      schemaVersion: 1,
      type: 'offer_pdf',
      name: 'Standard Angebots-PDF',
      versionNumber: 1,
      status: 'active',
      validFrom: '2026-01-01',
      body: 'Angebot {{offerNumber}} Version {{versionNumber}} für {{customerName}}',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'system',
      createdByDisplayName: 'System',
    },
    {
      id: generateId('document_template'),
      schemaVersion: 1,
      type: 'follow_up_note',
      name: 'Standard Nachfassnotiz',
      versionNumber: 1,
      status: 'active',
      validFrom: '2026-01-01',
      body: 'Nachfassung zu Angebot {{offerNumber}} für {{contactName}}',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'system',
      createdByDisplayName: 'System',
    },
  ];
}

export function migrateDocumentTemplatesIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.documentTemplateStorageVersion) ?? 0;
  const existing = readStorageItem<DocumentTemplate[]>(STORAGE_KEYS.documentTemplates);

  if (!existing || existing.length === 0) {
    writeStorageItem(STORAGE_KEYS.documentTemplates, createDefaultTemplates());
  }

  if (currentVersion < CURRENT_DOCUMENT_TEMPLATE_STORAGE_VERSION) {
    writeStorageItem(
      STORAGE_KEYS.documentTemplateStorageVersion,
      CURRENT_DOCUMENT_TEMPLATE_STORAGE_VERSION,
    );
  }
}

export function resetDocumentTemplatesForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.documentTemplates);
  localStorage.removeItem(STORAGE_KEYS.documentTemplateStorageVersion);
}
