import { describe, expect, it } from 'vitest';
import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import { DEFAULT_SALES_WIZARD_STATE } from '../domain/bestPayComparison/salesWizard';
import type { Lead } from '../domain/lead/lead';
import {
  CUSTOMER_STAND_LABELS,
  deriveCustomerPrimaryAction,
  deriveCustomerStand,
  type CustomerRecordFacts,
} from '../domain/salesWorkspace/customerRecordView';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { createTestOffer } from './helpers/offerTestHelpers';

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_a05',
    schemaVersion: 1,
    companyName: 'Test GmbH',
    contactFirstName: 'Anna',
    contactLastName: 'Muster',
    phone: '123',
    email: 'a@test.de',
    street: '',
    postalCode: '',
    city: '',
    industry: '',
    status: 'new',
    interest: 'medium',
    currentProvider: '',
    monthlyCardTurnoverCents: null,
    monthlyTransactions: null,
    averageTransactionValueCents: null,
    currentTerminalCount: null,
    currentTerminalModels: '',
    paymentUsage: {
      girocard: true,
      debit: false,
      credit: false,
      other: false,
    },
    cardMix: {
      girocardPercent: 60,
      debitPercent: 10,
      creditPercent: 25,
      otherPercent: 5,
    },
    currentContractEndDate: null,
    currentNoticePeriod: '',
    requiredTerminalCount: 1,
    nextFollowUpAt: null,
    notes: '',
    assignedSalesUserId: 'user_001',
    createdByUserId: 'user_001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncState: 'local_only',
    ...overrides,
  } as Lead;
}

function session(overrides: Partial<BestPayComparisonSession> = {}): BestPayComparisonSession {
  return {
    id: 'session_1',
    schemaVersion: 1,
    title: 'Beratung',
    status: 'draft',
    entryMode: 'wizard',
    customerLabel: 'Test',
    leadId: 'lead_a05',
    leadDisplayName: 'Test',
    offerId: null,
    offerNumber: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    completedAt: null,
    archivedAt: null,
    createdByUserId: 'user_001',
    updatedByUserId: 'user_001',
    wizard: { ...DEFAULT_SALES_WIZARD_STATE, enabled: true },
    result: null,
    ...overrides,
  } as BestPayComparisonSession;
}

function task(overrides: Partial<SalesTask> = {}): SalesTask {
  return {
    id: 'task_1',
    schemaVersion: 1,
    title: 'Wiedervorlage',
    type: 'follow_up_offer',
    status: 'open',
    priority: 'normal',
    dueAt: '2026-01-10T12:00:00.000Z',
    leadId: 'lead_a05',
    offerId: null,
    contractId: null,
    activationId: null,
    comparisonSessionId: null,
    assigneeUserId: 'user_001',
    createdByUserId: 'user_001',
    createdByDisplayName: 'Laura',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    completedByUserId: null,
    sourceKey: null,
    note: '',
    ...overrides,
  } as SalesTask;
}

function facts(overrides: Partial<CustomerRecordFacts> = {}): CustomerRecordFacts {
  return {
    lead: baseLead(),
    sessions: [],
    offers: [],
    contracts: [],
    activations: [],
    openTasks: [],
    now: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('Aufräumblock 5 – Kundenakte Ableitung', () => {
  it('leitet genau eine Hauptaktion ab und speichert nichts', () => {
    const action = deriveCustomerPrimaryAction(facts({ sessions: [session()] }));
    expect(action.label).toBe('Beratung fortsetzen');
    expect(action.href).toContain('/advice');
    expect(Object.keys(CUSTOMER_STAND_LABELS).length).toBeGreaterThan(0);
  });

  it('gibt Blocker höchste Priorität', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'accepted', leadId: 'lead_a05' })],
        contracts: [
          {
            id: 'c1',
            contractNumber: 'V-1',
            status: 'activation',
            startDate: null,
            endDate: null,
            tariffName: null,
          },
        ],
        activations: [
          {
            id: 'a1',
            activationNumber: 'A-2026-00001',
            status: 'blocked',
            progressPercent: 40,
            nextStep: 'Blocker',
            openBlockerCount: 2,
            contractId: 'c1',
          },
        ],
        openTasks: [task({ dueAt: '2020-01-01T00:00:00.000Z', title: 'Alt' })],
      }),
    );
    expect(action.kind).toBe('blocker');
    expect(action.label).toBe('Blocker bearbeiten');
  });

  it('stellt überfällige Wiedervorlage vor regulärer Aktion', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'sent', leadId: 'lead_a05' })],
        openTasks: [task({ dueAt: '2026-01-01T00:00:00.000Z', title: 'Überfällig nachfassen' })],
      }),
    );
    expect(action.kind).toBe('overdue_follow_up');
    expect(action.warning).toBe('Überfällig');
  });

  it('stellt Beratung vor Angebot, wenn noch kein Angebot existiert', () => {
    const action = deriveCustomerPrimaryAction(facts({ sessions: [session()] }));
    expect(action.kind).toBe('continue_advice');
    expect(deriveCustomerStand(facts({ sessions: [session()] }))).toBe('advice');
  });

  it('führt versendetes Angebot zu Bedenkzeit/Nachfassen', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'sent', leadId: 'lead_a05' })],
      }),
    );
    expect(action.kind).toBe('offer_follow_up');
    expect(action.label).toMatch(/Bedenkzeit|Nachfassen/);
  });

  it('führt angenommenen Offer zu Vertrag', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'accepted', leadId: 'lead_a05' })],
      }),
    );
    expect(action.kind).toBe('contract');
    expect(action.label).toBe('Vertrag anlegen');
    expect(deriveCustomerStand(
      facts({
        offers: [createTestOffer({ workflowStatus: 'accepted', leadId: 'lead_a05' })],
      }),
    )).toBe('contract');
  });

  it('führt Vertrag ohne Aktivierung zu Aktivierung starten', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'accepted', leadId: 'lead_a05' })],
        contracts: [
          {
            id: 'c1',
            contractNumber: 'V-1',
            status: 'preparation',
            startDate: null,
            endDate: null,
            tariffName: null,
          },
        ],
      }),
    );
    expect(action.kind).toBe('start_activation');
  });

  it('führt laufende Aktivierung zu Aktivierung fortsetzen', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'activated', leadId: 'lead_a05' })],
        contracts: [
          {
            id: 'c1',
            contractNumber: 'V-1',
            status: 'activation',
            startDate: null,
            endDate: null,
            tariffName: null,
          },
        ],
        activations: [
          {
            id: 'a1',
            activationNumber: 'A-2026-00001',
            status: 'setup_pending',
            progressPercent: 55,
            nextStep: 'Einrichtung',
            openBlockerCount: 0,
            contractId: 'c1',
          },
        ],
      }),
    );
    expect(action.kind).toBe('continue_activation');
  });

  it('zeigt bei produktivem Kunden keinen unnötigen Handlungsdruck', () => {
    const action = deriveCustomerPrimaryAction(
      facts({
        offers: [createTestOffer({ workflowStatus: 'activated', leadId: 'lead_a05' })],
        contracts: [
          {
            id: 'c1',
            contractNumber: 'V-1',
            status: 'active',
            startDate: null,
            endDate: null,
            tariffName: null,
          },
        ],
        activations: [
          {
            id: 'a1',
            activationNumber: 'A-2026-00001',
            status: 'completed',
            progressPercent: 100,
            nextStep: null,
            openBlockerCount: 0,
            contractId: 'c1',
          },
        ],
      }),
    );
    expect(action.kind).toBe('none');
    expect(deriveCustomerStand(
      facts({
        activations: [
          {
            id: 'a1',
            activationNumber: 'A-2026-00001',
            status: 'completed',
            progressPercent: 100,
            nextStep: null,
            openBlockerCount: 0,
            contractId: 'c1',
          },
        ],
        contracts: [
          {
            id: 'c1',
            contractNumber: 'V-1',
            status: 'active',
            startDate: null,
            endDate: null,
            tariffName: null,
          },
        ],
      }),
    )).toBe('completed');
  });
});
