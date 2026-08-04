import type { CreateLeadInput, EditLeadInput, Lead } from '../domain/lead/lead';
import { enrichLeadWithDisplayName, getLeadDisplayName } from '../domain/lead/getLeadDisplayName';
import type { UserRole } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import { formatContactName } from '../utils/format';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import { LeadNotFoundError } from '../repositories/errors/LeadNotFoundError';
import {
  validateCreateLeadInput,
  type CreateLeadErrors,
} from './leadValidation';
import type { SalesActivityService } from './salesActivityService';

export type CreateLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; errors: CreateLeadErrors }
  | { ok: false; error: 'storage' };

export type UpdateLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; errors: CreateLeadErrors }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export interface LeadSearchContext {
  userId: string;
  role: UserRole;
}

function mapInputToFields(input: CreateLeadInput) {
  return {
    companyName: input.companyName.trim(),
    contactFirstName: input.contactFirstName.trim(),
    contactLastName: input.contactLastName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    street: input.street.trim(),
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
    industry: input.industry.trim(),
    currentProvider: input.currentProvider.trim(),
    monthlyCardTurnoverCents: input.monthlyCardTurnoverCents,
    monthlyTransactions: input.monthlyTransactions,
    averageTransactionValueCents: input.averageTransactionValueCents,
    currentTerminalCount: input.currentTerminalCount,
    currentTerminalModels: input.currentTerminalModels.trim(),
    paymentUsage: { ...input.paymentUsage },
    cardMix: { ...input.cardMix },
    currentContractEndDate: input.currentContractEndDate,
    currentNoticePeriod: input.currentNoticePeriod.trim(),
    requiredTerminalCount: input.requiredTerminalCount,
    interest: input.interest,
    notes: input.notes.trim(),
    nextFollowUpAt: input.nextFollowUpAt,
  };
}

export class LeadService {
  private readonly leadRepository: LeadRepository;
  private activityService: SalesActivityService | null = null;

  constructor(leadRepository: LeadRepository) {
    this.leadRepository = leadRepository;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  validateCreateLeadInput(input: CreateLeadInput): CreateLeadErrors {
    return validateCreateLeadInput(input);
  }

  validateEditLeadInput(input: EditLeadInput): CreateLeadErrors {
    return validateCreateLeadInput(input);
  }

  canUserEditLead(lead: Lead, context: LeadSearchContext): boolean {
    if (context.role === 'admin') {
      return true;
    }

    return (
      lead.assignedSalesUserId === context.userId || lead.createdByUserId === context.userId
    );
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const lead = await this.leadRepository.getById(id);
    return lead ? enrichLeadWithDisplayName(lead) : null;
  }

  async getLeadCount(context?: LeadSearchContext): Promise<number> {
    const leads = await this.getVisibleLeads(context);
    return leads.length;
  }

  async getVisibleLeads(context?: LeadSearchContext): Promise<Lead[]> {
    const leads = await this.leadRepository.getAll();
    return this.filterLeadsByRole(leads, context).map(enrichLeadWithDisplayName);
  }

  async searchLeads(query: string, context?: LeadSearchContext): Promise<Lead[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const leads = await this.getVisibleLeads(context);

    if (!normalizedQuery) {
      return leads;
    }

    return leads.filter((lead) => {
      const searchableText = [
        lead.companyName,
        lead.contactFirstName,
        lead.contactLastName,
        formatContactName(lead.contactFirstName, lead.contactLastName),
        getLeadDisplayName(lead),
        lead.phone,
        lead.email,
        lead.city,
        lead.currentProvider,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }

  async createLead(
    input: CreateLeadInput,
    userId: string,
    context?: LeadSearchContext,
  ): Promise<CreateLeadResult> {
    const errors = validateCreateLeadInput(input);

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const assignedSalesUserId =
      context?.role === 'admin'
        ? input.assignedSalesUserId?.trim() || userId
        : userId;

    const timestamp = nowIso();
    const lead: Lead = {
      id: generateId('lead'),
      ...mapInputToFields(input),
      status: 'new',
      assignedSalesUserId,
      createdByUserId: userId,
      syncState: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const createdLead = await this.leadRepository.create(lead);
      const enriched = enrichLeadWithDisplayName(createdLead);
      try {
        await this.activityService?.recordSystemActivity(
          {
            type: 'lead_created',
            title: `Kunde angelegt: ${getLeadDisplayName(enriched)}`,
            description: '',
            leadId: enriched.id,
            sourceKey: `lead_created:${enriched.id}`,
          },
          { userId, role: 'field_service', displayName: undefined },
        );
      } catch {
        // Timeline-Dokumentation darf die Anlage nicht blockieren.
      }
      return { ok: true, lead: enriched };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async updateLead(
    leadId: string,
    input: EditLeadInput,
    context: LeadSearchContext,
  ): Promise<UpdateLeadResult> {
    const existing = await this.leadRepository.getById(leadId);

    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (!this.canUserEditLead(existing, context)) {
      return { ok: false, error: 'forbidden' };
    }

    const errors = validateCreateLeadInput(input);

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const updatedLead: Lead = {
      ...existing,
      ...mapInputToFields(input),
      id: existing.id,
      status: input.status,
      createdAt: existing.createdAt,
      createdByUserId: existing.createdByUserId,
      assignedSalesUserId:
        context.role === 'admin' && input.assignedSalesUserId?.trim()
          ? input.assignedSalesUserId.trim()
          : existing.assignedSalesUserId,
      syncState: 'pending',
      updatedAt: nowIso(),
    };

    try {
      const lead = await this.leadRepository.update(updatedLead);
      return { ok: true, lead: enrichLeadWithDisplayName(lead) };
    } catch (error) {
      if (error instanceof LeadNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }

  canUserAssignLead(context: LeadSearchContext): boolean {
    return context.role === 'admin';
  }

  private filterLeadsByRole(leads: Lead[], context?: LeadSearchContext): Lead[] {
    if (!context || context.role === 'admin') {
      return leads;
    }

    return leads.filter((lead) => lead.assignedSalesUserId === context.userId);
  }
}
