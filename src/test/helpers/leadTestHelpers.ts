import { DEFAULT_CREATE_LEAD_INPUT } from '../../domain/lead/defaults';
import type { CreateLeadInput, EditLeadInput, Lead } from '../../domain/lead/lead';

export function createValidLeadInput(
  overrides: Partial<CreateLeadInput> = {},
): CreateLeadInput {
  return {
    ...DEFAULT_CREATE_LEAD_INPUT,
    companyName: 'Test GmbH',
    contactFirstName: 'Max',
    contactLastName: 'Mustermann',
    phone: '+49 30 11111111',
    email: 'max@test.de',
    ...overrides,
  };
}

export function createValidEditInput(
  overrides: Partial<EditLeadInput> = {},
): EditLeadInput {
  return {
    ...createValidLeadInput(),
    status: 'new',
    ...overrides,
  };
}

export function createTestLead(overrides: Partial<Lead> = {}): Lead {
  const timestamp = '2026-07-30T00:00:00.000Z';

  return {
    id: 'lead_test',
    companyName: 'Repository Test',
    contactFirstName: 'Repo',
    contactLastName: 'Tester',
    phone: '+49 30 99999999',
    email: 'repo@test.de',
    street: '',
    postalCode: '',
    city: '',
    industry: '',
    currentProvider: '',
    monthlyCardTurnoverCents: null,
    monthlyTransactions: null,
    averageTransactionValueCents: null,
    currentTerminalCount: null,
    currentTerminalModels: '',
    paymentUsage: {
      stationary: false,
      mobile: false,
      ecommerce: false,
      softPos: false,
    },
    cardMix: {
      girocardPercent: 0,
      debitPercent: 0,
      creditPercent: 0,
      otherPercent: 0,
    },
    currentContractEndDate: null,
    currentNoticePeriod: '',
    requiredTerminalCount: 1,
    status: 'new',
    interest: 'medium',
    notes: '',
    nextFollowUpAt: null,
    assignedSalesUserId: 'user_001',
    createdByUserId: 'user_001',
    syncState: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
