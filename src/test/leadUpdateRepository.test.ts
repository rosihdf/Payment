import { beforeEach, describe, expect, it } from 'vitest';
import { leadToEditInput } from '../domain/lead/leadFormMapping';
import { LeadNotFoundError } from '../repositories/errors/LeadNotFoundError';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestLead } from './helpers/leadTestHelpers';

describe('LocalLeadRepository update', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('updates an existing lead', async () => {
    const repository = new LocalLeadRepository();
    const lead = createTestLead({ id: 'lead_update_001' });
    await repository.create(lead);

    const updated = await repository.update({
      ...lead,
      companyName: 'Aktualisiert GmbH',
      updatedAt: '2026-07-31T10:00:00.000Z',
    });

    expect(updated.companyName).toBe('Aktualisiert GmbH');
    expect(await repository.getById('lead_update_001')).toEqual(updated);
  });

  it('throws for an unknown lead id', async () => {
    const repository = new LocalLeadRepository();

    await expect(
      repository.update(createTestLead({ id: 'lead_missing' })),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it('does not create a new lead on update', async () => {
    const repository = new LocalLeadRepository();
    const initialCount = await repository.count();

    await expect(
      repository.update(createTestLead({ id: 'lead_missing_002' })),
    ).rejects.toThrow();

    expect(await repository.count()).toBe(initialCount);
  });

  it('leaves other leads unchanged', async () => {
    const repository = new LocalLeadRepository();
    const first = createTestLead({ id: 'lead_keep', companyName: 'Bleibt GmbH' });
    const second = createTestLead({ id: 'lead_change', companyName: 'Alt GmbH' });
    await repository.create(first);
    await repository.create(second);

    await repository.update({
      ...second,
      companyName: 'Neu GmbH',
      updatedAt: '2026-07-31T11:00:00.000Z',
    });

    expect((await repository.getById('lead_keep'))?.companyName).toBe('Bleibt GmbH');
  });

  it('preserves createdAt on update', async () => {
    const repository = new LocalLeadRepository();
    const createdAt = '2026-07-01T08:00:00.000Z';
    const lead = createTestLead({ id: 'lead_created_at', createdAt });
    await repository.create(lead);

    const updated = await repository.update({
      ...lead,
      companyName: 'Geändert GmbH',
      updatedAt: '2026-07-31T12:00:00.000Z',
    });

    expect(updated.createdAt).toBe(createdAt);
  });
});

describe('leadToEditInput', () => {
  it('maps all editable lead fields including status', () => {
    const lead = createTestLead({
      companyName: 'Mapping GmbH',
      monthlyCardTurnoverCents: 150000,
      status: 'contacted',
    });

    expect(leadToEditInput(lead)).toEqual({
      companyName: 'Mapping GmbH',
      contactFirstName: lead.contactFirstName,
      contactLastName: lead.contactLastName,
      phone: lead.phone,
      email: lead.email,
      street: lead.street,
      postalCode: lead.postalCode,
      city: lead.city,
      industry: lead.industry,
      currentProvider: lead.currentProvider,
      monthlyCardTurnoverCents: 150000,
      monthlyTransactions: lead.monthlyTransactions,
      averageTransactionValueCents: lead.averageTransactionValueCents,
      currentTerminalCount: lead.currentTerminalCount,
      currentTerminalModels: lead.currentTerminalModels,
      paymentUsage: lead.paymentUsage,
      cardMix: lead.cardMix,
      currentContractEndDate: lead.currentContractEndDate,
      currentNoticePeriod: lead.currentNoticePeriod,
      requiredTerminalCount: lead.requiredTerminalCount,
      interest: lead.interest,
      notes: lead.notes,
      nextFollowUpAt: lead.nextFollowUpAt,
      status: 'contacted',
      assignedSalesUserId: lead.assignedSalesUserId,
    });
  });
});
