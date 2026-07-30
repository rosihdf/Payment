import { describe, expect, it } from 'vitest';
import { normalizeLead } from '../domain/lead/normalizeLead';

describe('Lead normalization', () => {
  it('loads a legacy lead without crashing', () => {
    const lead = normalizeLead({
      id: 'lead_legacy',
      company: 'Legacy GmbH',
      contact: 'Anna Legacy',
      phone: '+49 30 12345678',
      email: 'anna@legacy.de',
      status: 'qualified',
      interest: 'high',
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-02T09:00:00.000Z',
    });

    expect(lead.companyName).toBe('Legacy GmbH');
    expect(lead.contactFirstName).toBe('Anna');
    expect(lead.contactLastName).toBe('Legacy');
    expect(lead.status).toBe('offer');
  });

  it('fills missing fields with safe defaults', () => {
    const lead = normalizeLead({
      id: 'lead_defaults',
      company: 'Defaults AG',
      contact: 'Max Demo',
      phone: '+49 40 11111111',
      email: '',
      status: 'new',
      interest: 'medium',
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-01T08:00:00.000Z',
    });

    expect(lead.paymentUsage).toEqual({
      stationary: false,
      mobile: false,
      ecommerce: false,
      softPos: false,
    });
    expect(lead.cardMix).toEqual({
      girocardPercent: 0,
      debitPercent: 0,
      creditPercent: 0,
      otherPercent: 0,
    });
    expect(lead.syncState).toBe('pending');
    expect(lead.requiredTerminalCount).toBe(1);
  });

  it('preserves existing values during normalization', () => {
    const lead = normalizeLead({
      id: 'lead_001',
      companyName: 'Bestehende Firma',
      contactFirstName: 'Erika',
      contactLastName: 'Bestehend',
      phone: '+49 221 99998888',
      email: 'erika@bestehend.de',
      city: 'Köln',
      paymentUsage: { stationary: true, mobile: false, ecommerce: true, softPos: false },
      cardMix: { girocardPercent: 50, debitPercent: 20, creditPercent: 20, otherPercent: 10 },
      syncState: 'synced',
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_002',
      status: 'contacted',
      interest: 'high',
      createdAt: '2026-07-10T08:00:00.000Z',
      updatedAt: '2026-07-11T08:00:00.000Z',
    });

    expect(lead.companyName).toBe('Bestehende Firma');
    expect(lead.city).toBe('Köln');
    expect(lead.paymentUsage.stationary).toBe(true);
    expect(lead.cardMix.girocardPercent).toBe(50);
    expect(lead.syncState).toBe('synced');
    expect(lead.assignedSalesUserId).toBe('user_002');
  });
});
