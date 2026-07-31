import { normalizeDocumentTemplates } from '../../domain/template/normalizeDocumentTemplate';
import type { DocumentTemplate } from '../../domain/template/documentTemplate';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { DocumentTemplateRepository } from '../interfaces/DocumentTemplateRepository';

export class LocalDocumentTemplateRepository implements DocumentTemplateRepository {
  async getAll(): Promise<DocumentTemplate[]> {
    return normalizeDocumentTemplates(readStorageItem<unknown[]>(STORAGE_KEYS.documentTemplates));
  }

  async getById(id: string): Promise<DocumentTemplate | null> {
    const templates = await this.getAll();
    return templates.find((entry) => entry.id === id) ?? null;
  }

  async save(template: DocumentTemplate): Promise<DocumentTemplate> {
    const templates = await this.getAll();
    const index = templates.findIndex((entry) => entry.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    writeStorageItem(STORAGE_KEYS.documentTemplates, templates);
    return template;
  }

  async saveAll(templates: DocumentTemplate[]): Promise<DocumentTemplate[]> {
    writeStorageItem(STORAGE_KEYS.documentTemplates, templates);
    return templates;
  }
}
