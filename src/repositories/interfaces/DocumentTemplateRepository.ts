import type { DocumentTemplate } from '../../domain/template/documentTemplate';

export interface DocumentTemplateRepository {
  getAll(): Promise<DocumentTemplate[]>;
  getById(id: string): Promise<DocumentTemplate | null>;
  save(template: DocumentTemplate): Promise<DocumentTemplate>;
  saveAll(templates: DocumentTemplate[]): Promise<DocumentTemplate[]>;
}
