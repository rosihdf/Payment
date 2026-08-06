import { beforeEach, describe, expect, it } from 'vitest';
import type { Lead } from '../domain/lead/lead';
import { LeadNotFoundError } from '../repositories/errors/LeadNotFoundError';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import { LeadService } from '../services/leadService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestLead, createValidEditInput } from './helpers/leadTestHelpers';

describe('LeadService updateLead', () => {
  let leadService: LeadService;
  let repository: LocalLeadRepository;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    repository = new LocalLeadRepository();
    leadService = new LeadService(repository);
  });

  it('allows field service users to update their own assigned lead', async () => {
    const lead = createTestLead({
      id: 'lead_own',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_own',
      createValidEditInput({ companyName: 'Eigen geändert' }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(true);
  });

  it('forbids field service users from updating leads they only created', async () => {
    const lead = createTestLead({
      id: 'lead_created',
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_001',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_created',
      createValidEditInput({ companyName: 'Ersteller geändert' }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toBe('forbidden');
    }
  });

  it('ignores field service attempts to reassign advisor', async () => {
    const lead = createTestLead({
      id: 'lead_own_assign',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_own_assign',
      createValidEditInput({
        companyName: 'Eigen geändert',
        assignedSalesUserId: 'user_002',
      }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lead.assignedSalesUserId).toBe('user_001');
    }
  });

  it('forbids field service users from updating foreign leads', async () => {
    const lead = createTestLead({
      id: 'lead_foreign',
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_002',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_foreign',
      createValidEditInput({ companyName: 'Fremd geändert' }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    if ('error' in result) {
      expect(result.error).toBe('forbidden');
    }
  });

  it('allows admin users to update any lead', async () => {
    const lead = createTestLead({
      id: 'lead_admin',
      assignedSalesUserId: 'user_003',
      createdByUserId: 'user_003',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_admin',
      createValidEditInput({ companyName: 'Admin geändert' }),
      { userId: 'user_004', role: 'admin' },
    );

    expect(result.ok).toBe(true);
  });

  it('updates updatedAt and syncState while preserving immutable fields', async () => {
    const createdAt = '2026-07-01T08:00:00.000Z';
    const lead = createTestLead({
      id: 'lead_immutable',
      createdAt,
      createdByUserId: 'user_001',
      assignedSalesUserId: 'user_001',
      syncState: 'synced',
    });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_immutable',
      createValidEditInput({ companyName: 'Immutable Test', status: 'offer' }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.lead.createdAt).toBe(createdAt);
    expect(result.lead.createdByUserId).toBe('user_001');
    expect(result.lead.assignedSalesUserId).toBe('user_001');
    expect(result.lead.syncState).toBe('pending');
    expect(result.lead.updatedAt).not.toBe(createdAt);
    expect(result.lead.status).toBe('offer');
  });

  it('returns validation errors for invalid data', async () => {
    const lead = createTestLead({ id: 'lead_invalid', assignedSalesUserId: 'user_001' });
    await repository.create(lead);

    const result = await leadService.updateLead(
      'lead_invalid',
      createValidEditInput({ companyName: '', phone: '' }),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (result.ok || !('errors' in result)) {
      return;
    }

    expect(result.errors.companyName).toBeDefined();
  });

  it('returns not_found for missing leads', async () => {
    const result = await leadService.updateLead(
      'lead_missing',
      createValidEditInput(),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    if ('error' in result) {
      expect(result.error).toBe('not_found');
    }
  });

  it('returns storage errors from the repository', async () => {
    class FailingUpdateRepository implements LeadRepository {
      async getAll(): Promise<Lead[]> {
        return [createTestLead({ id: 'lead_fail' })];
      }

      async getById(id: string): Promise<Lead | null> {
        const leads = await this.getAll();
        return leads.find((lead) => lead.id === id) ?? null;
      }

      async count(): Promise<number> {
        return 1;
      }

      async create(): Promise<Lead> {
        throw new Error('fail');
      }

      async update(): Promise<Lead> {
        throw new Error('storage failed');
      }
    }

    const failingService = new LeadService(new FailingUpdateRepository());
    const result = await failingService.updateLead(
      'lead_fail',
      createValidEditInput(),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    if ('error' in result) {
      expect(result.error).toBe('storage');
    }
  });

  it('propagates LeadNotFoundError as not_found', async () => {
    class DisappearingLeadRepository implements LeadRepository {
      private lead = createTestLead({ id: 'lead_disappear', assignedSalesUserId: 'user_001' });

      async getAll(): Promise<Lead[]> {
        return [this.lead];
      }

      async getById(id: string): Promise<Lead | null> {
        return id === this.lead.id ? this.lead : null;
      }

      async count(): Promise<number> {
        return 1;
      }

      async create(): Promise<Lead> {
        return this.lead;
      }

      async update(): Promise<Lead> {
        throw new LeadNotFoundError('lead_disappear');
      }
    }

    const service = new LeadService(new DisappearingLeadRepository());
    const result = await service.updateLead(
      'lead_disappear',
      createValidEditInput(),
      { userId: 'user_001', role: 'field_service' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    if ('error' in result) {
      expect(result.error).toBe('not_found');
    }
  });
});

describe('LeadService canUserEditLead', () => {
  it('checks assigned ownership only for field service', () => {
    const service = new LeadService(new LocalLeadRepository());
    const lead = createTestLead({
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_001',
    });

    expect(service.canUserEditLead(lead, { userId: 'user_001', role: 'field_service' })).toBe(false);
    expect(service.canUserEditLead(lead, { userId: 'user_002', role: 'field_service' })).toBe(true);
    expect(service.canUserEditLead(lead, { userId: 'user_003', role: 'field_service' })).toBe(false);
    expect(service.canUserEditLead(lead, { userId: 'user_004', role: 'admin' })).toBe(true);
  });
});
