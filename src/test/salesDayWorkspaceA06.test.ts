import { beforeEach, describe, expect, it } from 'vitest';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { SALES_TASK_SCHEMA_VERSION } from '../domain/salesWorkspace/salesTask';
import {
  buildSalesDayWorkspaceSections,
  type SalesDayCaseCard,
} from '../services/salesDayWorkspace';

function card(partial: Partial<SalesDayCaseCard> & Pick<SalesDayCaseCard, 'id' | 'leadId' | 'companyName'>): SalesDayCaseCard {
  return {
    standLabel: 'Beratung',
    phaseLabel: 'Beratung',
    nextTaskTitle: 'Aktion',
    nextTaskDueAt: null,
    nextActionLabel: 'Aktion',
    warning: null,
    isOverdue: false,
    lastActivityAt: '2026-07-01T10:00:00.000Z',
    primaryKind: 'continue_advice',
    isHardBlocked: false,
    ...partial,
  };
}

function task(partial: Partial<SalesTask> & Pick<SalesTask, 'id' | 'title' | 'dueAt'>): SalesTask {
  return {
    schemaVersion: SALES_TASK_SCHEMA_VERSION,
    type: 'follow_up_offer',
    status: 'open',
    priority: 'normal',
    description: '',
    dueTimeLocal: null,
    leadId: 'lead_a',
    offerId: null,
    contractId: null,
    contractVersionId: null,
    activationId: null,
    contactId: null,
    comparisonSessionId: null,
    wizardEnabled: false,
    assigneeUserId: 'user_001',
    createdByUserId: 'user_001',
    completedAt: null,
    completedByUserId: null,
    completionNote: '',
    origin: 'manual',
    sourceKey: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...partial,
  };
}

describe('Aufräumblock 6 – Tagesarbeitsplatz Ableitung', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  beforeEach(() => {
    // deterministic
  });

  it('ordnet überfällige Aufgaben korrekt ein', () => {
    const sections = buildSalesDayWorkspaceSections({
      now,
      cards: [card({ id: 'lead_a', leadId: 'lead_a', companyName: 'Alpha GmbH' })],
      tasks: [
        task({
          id: 't1',
          title: 'Rückruf',
          dueAt: '2026-07-10T09:00:00.000Z',
          leadId: 'lead_a',
        }),
      ],
    });
    expect(sections.overdue).toHaveLength(1);
    expect(sections.overdue[0]?.taskTitle).toBe('Rückruf');
    expect(sections.overdue[0]?.companyName).toBe('Alpha GmbH');
    expect(sections.overdue[0]?.customerHref).toBe('/leads/lead_a');
    expect(sections.today).toHaveLength(0);
  });

  it('ordnet heutige Aufgaben korrekt ein', () => {
    const sections = buildSalesDayWorkspaceSections({
      now,
      cards: [card({ id: 'lead_a', leadId: 'lead_a', companyName: 'Alpha GmbH' })],
      tasks: [
        task({
          id: 't1',
          title: 'Heute nachfassen',
          dueAt: '2026-07-15T15:00:00.000Z',
          leadId: 'lead_a',
        }),
      ],
    });
    expect(sections.today).toHaveLength(1);
    expect(sections.today[0]?.taskTitle).toBe('Heute nachfassen');
    expect(sections.overdue).toHaveLength(0);
  });

  it('zeigt harte Blocker und nicht nur Warnungen', () => {
    const sections = buildSalesDayWorkspaceSections({
      now,
      cards: [
        card({
          id: 'lead_block',
          leadId: 'lead_block',
          companyName: 'Block GmbH',
          isHardBlocked: true,
          primaryKind: 'blocker',
          warning: 'Harter Blocker',
          nextActionLabel: 'Blocker bearbeiten',
        }),
        card({
          id: 'lead_warn',
          leadId: 'lead_warn',
          companyName: 'Warn GmbH',
          isHardBlocked: false,
          primaryKind: 'continue_advice',
          warning: 'Berechnung veraltet',
          nextActionLabel: 'Beratung fortsetzen',
        }),
      ],
      tasks: [],
    });
    expect(sections.blocked.map((entry) => entry.companyName)).toEqual(['Block GmbH']);
    expect(sections.blocked.some((entry) => entry.companyName === 'Warn GmbH')).toBe(false);
    expect(sections.nextCases.some((entry) => entry.companyName === 'Warn GmbH')).toBe(true);
  });

  it('nächste Kundenfälle haben genau eine Hauptaktion und Kundenakte-Link', () => {
    const sections = buildSalesDayWorkspaceSections({
      now,
      cards: [
        card({
          id: 'lead_next',
          leadId: 'lead_next',
          companyName: 'Next GmbH',
          primaryKind: 'offer_prepare',
          nextActionLabel: 'Angebot zur Prüfung bereitstellen',
        }),
        card({
          id: 'lead_idle',
          leadId: 'lead_idle',
          companyName: 'Idle GmbH',
          primaryKind: 'none',
          nextActionLabel: 'Kein Handlungsbedarf',
        }),
      ],
      tasks: [],
    });
    expect(sections.nextCases).toHaveLength(1);
    expect(sections.nextCases[0]?.nextActionLabel).toBe('Angebot zur Prüfung bereitstellen');
    expect(sections.nextCases[0]?.customerHref).toBe('/leads/lead_next');
  });

  it('priorisiert Blocker vor Überfällig vor Heute', () => {
    const sections = buildSalesDayWorkspaceSections({
      now,
      cards: [
        card({
          id: 'lead_a',
          leadId: 'lead_a',
          companyName: 'Alpha',
          isHardBlocked: true,
          primaryKind: 'blocker',
        }),
      ],
      tasks: [
        task({
          id: 't1',
          title: 'Überfällig trotz Blocker',
          dueAt: '2026-07-01T09:00:00.000Z',
          leadId: 'lead_a',
        }),
      ],
    });
    expect(sections.blocked).toHaveLength(1);
    expect(sections.overdue).toHaveLength(0);
  });
});
