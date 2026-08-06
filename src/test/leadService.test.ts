import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '../domain/lead/lead';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import { LeadService } from '../services/leadService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createValidLeadInput } from './helpers/leadTestHelpers';

class FailingLeadRepository implements LeadRepository {
  async getAll(): Promise<Lead[]> {
    return [];
  }

  async getById(): Promise<Lead | null> {
    return null;
  }

  async count(): Promise<number> {
    return 0;
  }

  async create(): Promise<Lead> {
    throw new Error('storage failed');
  }

  async update(): Promise<Lead> {
    throw new Error('storage failed');
  }
}

describe('LeadService', () => {
  let leadService: LeadService;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    leadService = new LeadService(new LocalLeadRepository());
  });

  it('validates required fields for new leads', () => {
    const errors = leadService.validateCreateLeadInput(createValidLeadInput({
      companyName: '',
      contactFirstName: '',
      contactLastName: '',
      phone: '',
    }));

    expect(errors.companyName).toBeDefined();
    expect(errors.contactFirstName).toBeDefined();
    expect(errors.contactLastName).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  it('validates email format', () => {
    const errors = leadService.validateCreateLeadInput(
      createValidLeadInput({ email: 'ungueltig' }),
    );

    expect(errors.email).toBeDefined();
  });

  it('creates a lead and persists it locally', async () => {
    const initialCount = await leadService.getLeadCount();
    const input = createValidLeadInput({
      companyName: 'Test Payment AG',
      contactFirstName: 'Erika',
      contactLastName: 'Test',
      interest: 'high',
    });

    const result = await leadService.createLead(input, 'user_001');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.lead.companyName).toBe('Test Payment AG');
    expect(result.lead.contactFirstName).toBe('Erika');
    expect(result.lead.contactLastName).toBe('Test');
    expect(result.lead.interest).toBe('high');
    expect(result.lead.status).toBe('new');
    expect(result.lead.syncState).toBe('pending');
    expect(result.lead.createdByUserId).toBe('user_001');
    expect(result.lead.assignedSalesUserId).toBe('user_001');

    const storedLead = await leadService.getLeadById(result.lead.id);
    expect(storedLead).toEqual(result.lead);
    expect(await leadService.getLeadCount()).toBe(initialCount + 1);
  });

  it('returns validation errors instead of creating invalid leads', async () => {
    const initialCount = await leadService.getLeadCount();

    const result = await leadService.createLead(
      createValidLeadInput({
        companyName: '',
        contactFirstName: '',
        contactLastName: '',
        phone: '',
        email: 'bad-email',
      }),
      'user_001',
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    if ('errors' in result) {
      expect(result.errors.companyName).toBeDefined();
      expect(result.errors.contactFirstName).toBeDefined();
      expect(result.errors.email).toBeDefined();
    }

    expect(await leadService.getLeadCount()).toBe(initialCount);
  });

  it('returns a storage error without losing form data', async () => {
    const failingService = new LeadService(new FailingLeadRepository());
    const input = createValidLeadInput({ companyName: 'Storage Fail GmbH' });

    const result = await failingService.createLead(input, 'user_001');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect('error' in result && result.error).toBe('storage');
  });

  it('filters leads for field service users', async () => {
    const visibleLeads = await leadService.getVisibleLeads({
      userId: 'user_001',
      role: 'field_service',
    });

    expect(visibleLeads.every((lead) => lead.assignedSalesUserId === 'user_001')).toBe(true);
    expect(visibleLeads.length).toBeGreaterThan(0);
  });

  it('shows all leads for admin users', async () => {
    const allLeads = await leadService.getVisibleLeads({
      userId: 'user_004',
      role: 'admin',
    });

    expect(allLeads.length).toBeGreaterThanOrEqual(8);
  });

  it('creates admin lead without advisor when none selected', async () => {
    const result = await leadService.createLead(
      createValidLeadInput({ companyName: 'Admin ohne Betreuer', assignedSalesUserId: '' }),
      'user_004',
      { userId: 'user_004', role: 'admin' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lead.assignedSalesUserId).toBe('');
    }
  });

  it('hides unassigned leads from field service', async () => {
    await leadService.createLead(
      createValidLeadInput({ companyName: 'Unassigned Sichtbarkeit', assignedSalesUserId: '' }),
      'user_004',
      { userId: 'user_004', role: 'admin' },
    );
    const visible = await leadService.getVisibleLeads({
      userId: 'user_001',
      role: 'field_service',
    });
    expect(visible.every((lead) => lead.assignedSalesUserId === 'user_001')).toBe(true);
    expect(visible.some((lead) => lead.companyName === 'Unassigned Sichtbarkeit')).toBe(false);
  });

  it('returns null for foreign lead by id for field service', async () => {
    const created = await leadService.createLead(
      createValidLeadInput({ companyName: 'Fremd Direktlink' }),
      'user_002',
      { userId: 'user_002', role: 'field_service' },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const foreign = await leadService.getLeadById(created.lead.id, {
      userId: 'user_001',
      role: 'field_service',
    });
    expect(foreign).toBeNull();
  });

  it('searches leads by company name and provider', async () => {
    const results = await leadService.searchLeads('Café Sonnenschein', {
      userId: 'user_004',
      role: 'admin',
    });

    expect(results.some((lead) => lead.companyName.includes('Café Sonnenschein'))).toBe(true);
  });

  it('prevents duplicate creation when called sequentially after validation failure', async () => {
    const initialCount = await leadService.getLeadCount();

    const invalid = await leadService.createLead(
      createValidLeadInput({ phone: '' }),
      'user_001',
    );
    const valid = await leadService.createLead(createValidLeadInput(), 'user_001');

    expect(invalid.ok).toBe(false);
    expect(valid.ok).toBe(true);
    expect(await leadService.getLeadCount()).toBe(initialCount + 1);
  });
});

describe('LeadService createLead guard', () => {
  it('allows only one successful create when repository throws on second call', async () => {
    const createMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'lead_once',
        companyName: 'Once GmbH',
      })
      .mockRejectedValueOnce(new Error('duplicate'));

    class SingleCreateRepository implements LeadRepository {
      getAll = vi.fn().mockResolvedValue([]);
      getById = vi.fn().mockResolvedValue(null);
      count = vi.fn().mockResolvedValue(0);
      create = createMock;
      update = vi.fn().mockRejectedValue(new Error('duplicate'));
    }

    const service = new LeadService(new SingleCreateRepository());
    const input = createValidLeadInput({ companyName: 'Once GmbH' });

    const first = await service.createLead(input, 'user_001');
    const second = await service.createLead(input, 'user_001');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
