import {
  normalizeDocumentTemplate,
  normalizeDocumentTemplates,
} from '../../domain/template/normalizeDocumentTemplate';
import type { DocumentTemplate } from '../../domain/template/documentTemplate';
import type { DocumentTemplateRepository } from '../interfaces/DocumentTemplateRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  sbUpsertMany,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'document_templates';

function templateToRow(template: DocumentTemplate): Record<string, unknown> {
  return {
    id: template.id,
    data: template,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

function rowToTemplate(row: JsonTableRow): DocumentTemplate {
  const normalized = normalizeDocumentTemplate(rowData(row, { id: row.id }));
  if (!normalized) {
    throw new Error(`DocumentTemplate konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseDocumentTemplateRepository implements DocumentTemplateRepository {
  async getAll(): Promise<DocumentTemplate[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeDocumentTemplates(rows.map((row) => rowToTemplate(row)));
  }

  async getById(id: string): Promise<DocumentTemplate | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToTemplate(row) : null;
  }

  async save(template: DocumentTemplate): Promise<DocumentTemplate> {
    const existing = await this.getById(template.id);
    const rowPayload = templateToRow(template);
    if (existing) {
      const row = await sbUpdate(TABLE, template.id, rowPayload);
      return rowToTemplate(row);
    }
    const row = await sbInsert(TABLE, rowPayload);
    return rowToTemplate(row);
  }

  async saveAll(templates: DocumentTemplate[]): Promise<DocumentTemplate[]> {
    await sbUpsertMany(TABLE, templates.map(templateToRow));
    return templates;
  }
}
