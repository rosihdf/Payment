import {
  DEMO_TEMPLATE_VALUES,
  DOCUMENT_TEMPLATE_SCHEMA_VERSION,
  validateTemplatePlaceholders,
  renderTemplatePreview,
  type DocumentTemplate,
  type DocumentTemplateType,
} from '../domain/template/documentTemplate';
import type { UserContext } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { DocumentTemplateRepository } from '../repositories/interfaces/DocumentTemplateRepository';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';

export interface TemplateFilter {
  query?: string;
  type?: DocumentTemplateType | 'all';
  status?: DocumentTemplate['status'] | 'all';
}

export class DocumentTemplateService {
  private readonly documentTemplateRepository: DocumentTemplateRepository;
  private readonly auditService: AuditService;

  constructor(documentTemplateRepository: DocumentTemplateRepository, auditService: AuditService) {
    this.documentTemplateRepository = documentTemplateRepository;
    this.auditService = auditService;
  }

  filterTemplates(templates: DocumentTemplate[], filter: TemplateFilter): DocumentTemplate[] {
    return templates.filter((template) => {
      if (filter.type && filter.type !== 'all' && template.type !== filter.type) {
        return false;
      }
      if (filter.status && filter.status !== 'all' && template.status !== filter.status) {
        return false;
      }
      if (filter.query) {
        const query = filter.query.toLowerCase();
        if (!`${template.name} ${template.body}`.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }

  async getTemplates(
    context: UserContext,
    filter: TemplateFilter = {},
  ): Promise<DocumentTemplate[] | { error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.templates');
    if (!guard.ok) {
      return { error: 'forbidden' };
    }
    const templates = await this.documentTemplateRepository.getAll();
    return this.filterTemplates(templates, filter);
  }

  validateTemplate(template: DocumentTemplate): string[] {
    const errors: string[] = [];
    if (!template.name.trim()) {
      errors.push('Name ist erforderlich.');
    }
    const unknownPlaceholders = validateTemplatePlaceholders(template.body);
    if (unknownPlaceholders.length > 0) {
      errors.push(`Unbekannte Platzhalter: ${unknownPlaceholders.join(', ')}`);
    }
    return errors;
  }

  previewTemplate(template: DocumentTemplate): string {
    return renderTemplatePreview(template.body, DEMO_TEMPLATE_VALUES);
  }

  async activateTemplate(
    context: UserContext,
    templateId: string,
  ): Promise<{ ok: true; template: DocumentTemplate } | { ok: false; error: 'forbidden' | 'not_found' | 'validation'; messages?: string[] }> {
    const guard = requirePermission(context, 'admin.templates');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.documentTemplateRepository.getById(templateId);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    const validationErrors = this.validateTemplate(existing);
    if (validationErrors.length > 0) {
      return { ok: false, error: 'validation', messages: validationErrors };
    }

    const templates = await this.documentTemplateRepository.getAll();
    const updatedTemplates = templates.map((template) => {
      if (template.type === existing.type && template.id !== existing.id && template.status === 'active') {
        return { ...template, status: 'archived' as const, updatedAt: nowIso() };
      }
      return template;
    });

    const activated: DocumentTemplate = {
      ...existing,
      status: 'active',
      updatedAt: nowIso(),
    };

    await this.documentTemplateRepository.saveAll(
      updatedTemplates.map((template) => (template.id === activated.id ? activated : template)),
    );

    await this.auditService.logChange({
      context,
      action: 'template_activated',
      entityType: 'template',
      entityId: activated.id,
      entityVersion: String(activated.versionNumber),
      summary: `Vorlage ${activated.name} aktiviert`,
    });

    return { ok: true, template: activated };
  }

  createDraftTemplate(context: UserContext, type: DocumentTemplateType): DocumentTemplate {
    const timestamp = nowIso();
    return {
      id: generateId('document_template'),
      schemaVersion: DOCUMENT_TEMPLATE_SCHEMA_VERSION,
      type,
      name: 'Neue Vorlage',
      versionNumber: 1,
      status: 'draft',
      validFrom: null,
      body: 'Angebot {{offerNumber}} für {{customerName}}',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };
  }
}
