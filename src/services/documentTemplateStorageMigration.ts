import type { DocumentTemplate } from '../domain/template/documentTemplate';
import { createProductionDocumentTemplates } from '../domain/catalog/documentTemplateCatalogSeed';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_DOCUMENT_TEMPLATE_STORAGE_VERSION = 1;

export function migrateDocumentTemplatesIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.documentTemplateStorageVersion) ?? 0;
  const existing = readStorageItem<DocumentTemplate[]>(STORAGE_KEYS.documentTemplates);

  if (!existing || existing.length === 0) {
    writeStorageItem(STORAGE_KEYS.documentTemplates, createProductionDocumentTemplates());
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
