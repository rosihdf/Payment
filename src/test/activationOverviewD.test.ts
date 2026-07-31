import { describe, expect, it } from 'vitest';
import type { ActivationOverviewItem } from '../domain/activation/activationOverview';
import {
  filterActivationCases,
  getActivationOverviewMetrics,
  matchesActivationSearch,
  sortActivationCases,
} from '../domain/activation/activationOverview';
import { ACTIVATION_STATUSES } from '../domain/activation/activationStatus';

function item(partial: Partial<ActivationOverviewItem> & { id: string }): ActivationOverviewItem {
  return {
    id: partial.id,
    schemaVersion: 1,
    activationNumber: partial.activationNumber ?? `A-2026-${partial.id.padStart(5, '0')}`,
    contractId: partial.contractId ?? `contract_${partial.id}`,
    contractVersionId: partial.contractVersionId ?? `version_${partial.id}`,
    leadId: null,
    sourceOfferId: partial.sourceOfferId ?? null,
    sourceKey: `contract:contract_${partial.id}:initial-activation`,
    status: partial.status ?? 'preparation',
    ownerUserId: partial.ownerUserId ?? 'user_001',
    priority: partial.priority ?? 'normal',
    plannedStart: null,
    desiredGoLive: partial.desiredGoLive ?? null,
    confirmedGoLive: null,
    currentStep: '',
    progressPercent: partial.progressPercent ?? 10,
    nextStep: partial.nextStep ?? 'next',
    nextDueAt: partial.nextDueAt ?? null,
    openBlockerCount: partial.openBlockerCount ?? 0,
    openMandatoryCount: 0,
    externalReferences: partial.externalReferences ?? [],
    templateSnapshotId: null,
    templateSnapshotVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdByUserId: 'user_001',
    createdByDisplayName: 'Laura',
    updatedAt: partial.updatedAt ?? '2026-01-02T00:00:00.000Z',
    updatedByUserId: 'user_001',
    completedAt: null,
    handedOverAt: null,
    cancelledAt: null,
    blockedFromStatus: null,
    contractNumber: partial.contractNumber ?? `V-2026-${partial.id.padStart(5, '0')}`,
    customerCompanyName: partial.customerCompanyName ?? `Firma ${partial.id}`,
    contactName: partial.contactName ?? 'Max Muster',
    offerNumber: partial.offerNumber ?? `O-2026-${partial.id.padStart(5, '0')}`,
    externalReferenceText: partial.externalReferenceText ?? '',
    serialNumbers: partial.serialNumbers ?? [],
    hardwareModels: partial.hardwareModels ?? [],
    hasOpenTask: partial.hasOpenTask ?? true,
    warningLabels: [],
  };
}

const TODAY = '2026-07-15';

describe('D Aktivierungsübersicht Filter/Suche/Sortierung/Kennzahlen', () => {
  const base: ActivationOverviewItem[] = [
    item({
      id: '1',
      status: 'documents_pending',
      ownerUserId: 'user_001',
      priority: 'high',
      desiredGoLive: '2026-07-18',
      nextDueAt: '2026-07-16',
      serialNumbers: ['SN-AAA'],
      hardwareModels: ['Pax A920'],
      offerNumber: 'O-2026-00011',
      externalReferenceText: 'BestPay REF-11',
      contactName: 'Anna Kontakt',
      customerCompanyName: 'Alpha GmbH',
      contractNumber: 'V-2026-00011',
      activationNumber: 'A-2026-00011',
      hasOpenTask: false,
    }),
    item({
      id: '2',
      status: 'blocked',
      ownerUserId: 'user_002',
      priority: 'urgent',
      desiredGoLive: '2026-07-10',
      nextDueAt: '2026-07-10',
      customerCompanyName: 'Beta AG',
      activationNumber: 'A-2026-00022',
      contractNumber: 'V-2026-00022',
      hasOpenTask: true,
    }),
    item({
      id: '3',
      status: 'hardware_pending',
      ownerUserId: '',
      priority: 'normal',
      desiredGoLive: null,
      nextDueAt: null,
      customerCompanyName: 'Gamma OHG',
      activationNumber: 'A-2026-00033',
      serialNumbers: ['SN-XYZ'],
      hardwareModels: ['Ingenico Move'],
      hasOpenTask: true,
    }),
    item({
      id: '4',
      status: 'go_live_ready',
      ownerUserId: 'user_001',
      priority: 'normal',
      desiredGoLive: '2026-08-01',
      nextDueAt: '2026-07-30',
      activationNumber: 'A-2026-00044',
      customerCompanyName: 'Delta KG',
      hasOpenTask: true,
    }),
    item({
      id: '5',
      status: 'live',
      ownerUserId: 'user_001',
      priority: 'high',
      desiredGoLive: '2026-07-01',
      activationNumber: 'A-2026-00055',
      customerCompanyName: 'Epsilon GmbH',
      hasOpenTask: false,
    }),
    item({
      id: '6',
      status: 'completed',
      ownerUserId: 'user_002',
      priority: 'normal',
      desiredGoLive: '2026-06-01',
      activationNumber: 'A-2026-00066',
      customerCompanyName: 'Zeta GmbH',
      hasOpenTask: false,
    }),
    item({
      id: '7',
      status: 'application_pending',
      ownerUserId: 'user_002',
      priority: 'high',
      desiredGoLive: '2026-07-20',
      activationNumber: 'A-2026-00077',
      customerCompanyName: 'Eta GmbH',
      hasOpenTask: true,
    }),
    item({
      id: '8',
      status: 'provider_review',
      ownerUserId: 'user_001',
      priority: 'normal',
      desiredGoLive: '2026-07-25',
      activationNumber: 'A-2026-00088',
      customerCompanyName: 'Theta GmbH',
      hasOpenTask: true,
    }),
    item({
      id: '9',
      status: 'setup_pending',
      ownerUserId: 'user_001',
      priority: 'urgent',
      desiredGoLive: '2026-07-28',
      activationNumber: 'A-2026-00099',
      customerCompanyName: 'Iota GmbH',
      hasOpenTask: true,
    }),
    item({
      id: '10',
      status: 'testing',
      ownerUserId: 'user_002',
      priority: 'normal',
      desiredGoLive: '2026-08-10',
      activationNumber: 'A-2026-00100',
      customerCompanyName: 'Kappa GmbH',
      hasOpenTask: true,
    }),
  ];

  it('sucht über alle geforderten Felder case-insensitive', () => {
    expect(matchesActivationSearch(base[0]!, 'a-2026-00011')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'V-2026-00011')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'alpha')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'anna kontakt')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'o-2026-00011')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'ref-11')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'sn-aaa')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'pax a920')).toBe(true);
    expect(matchesActivationSearch(base[0]!, '  ALPHA  ')).toBe(true);
    expect(matchesActivationSearch(base[0]!, '')).toBe(true);
    expect(matchesActivationSearch(base[0]!, 'unbekanntxyz')).toBe(false);
  });

  it('filtert jeden Status einzeln', () => {
    for (const status of ACTIVATION_STATUSES) {
      const seeded = item({ id: `s_${status}`, status, activationNumber: `A-2026-${status}` });
      const filtered = filterActivationCases([seeded], { status });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.status).toBe(status);
    }
  });

  it('filtert Verantwortliche inkl. Own/Unassigned', () => {
    expect(
      filterActivationCases(base, { ownerUserId: 'mine', currentUserId: 'user_001' }).every(
        (entry) => entry.ownerUserId === 'user_001',
      ),
    ).toBe(true);
    expect(filterActivationCases(base, { ownerUserId: 'unassigned' }).map((entry) => entry.id)).toEqual([
      '3',
    ]);
    expect(filterActivationCases(base, { ownerUserId: 'user_002' }).every((entry) => entry.ownerUserId === 'user_002')).toBe(
      true,
    );
  });

  it('filtert alle vorhandenen Prioritäten', () => {
    expect(filterActivationCases(base, { priority: 'normal' }).every((entry) => entry.priority === 'normal')).toBe(
      true,
    );
    expect(filterActivationCases(base, { priority: 'high' }).every((entry) => entry.priority === 'high')).toBe(true);
    expect(filterActivationCases(base, { priority: 'urgent' }).every((entry) => entry.priority === 'urgent')).toBe(
      true,
    );
  });

  it('filtert Go-live-Zeitraum UTC-stabil', () => {
    expect(
      filterActivationCases(base, { goLiveWindow: '7', todayIso: TODAY }).map((entry) => entry.id),
    ).toEqual(['1', '7']);
    expect(
      filterActivationCases(base, { goLiveWindow: '14', todayIso: TODAY }).map((entry) => entry.id).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      filterActivationCases(base, { goLiveWindow: '30', todayIso: TODAY }).some((entry) => entry.id === '4'),
    ).toBe(true);
    expect(filterActivationCases(base, { goLiveWindow: 'overdue', todayIso: TODAY }).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['2', '5', '6']),
    );
    expect(filterActivationCases(base, { goLiveWindow: 'none', todayIso: TODAY }).map((entry) => entry.id)).toEqual([
      '3',
    ]);
  });

  it('filtert Arbeitszustände', () => {
    for (const [workState, status] of [
      ['blocked', 'blocked'],
      ['documents_open', 'documents_pending'],
      ['hardware_open', 'hardware_pending'],
      ['setup_open', 'setup_pending'],
      ['test_open', 'testing'],
      ['go_live_ready', 'go_live_ready'],
      ['completion_open', 'live'],
      ['completed', 'completed'],
    ] as const) {
      const filtered = filterActivationCases(base, { workState });
      expect(filtered.every((entry) => entry.status === status)).toBe(true);
    }
    expect(
      filterActivationCases(base, { workState: 'application_open' }).every((entry) =>
        ['application_pending', 'provider_review'].includes(entry.status),
      ),
    ).toBe(true);
    expect(
      filterActivationCases(base, { workState: 'without_next_task' }).every((entry) => !entry.hasOpenTask),
    ).toBe(true);
  });

  it('kombiniert Filter und Reset-Semantik', () => {
    const combined = filterActivationCases(base, {
      query: 'alpha',
      status: 'documents_pending',
      ownerUserId: 'mine',
      currentUserId: 'user_001',
      priority: 'high',
      goLiveWindow: '7',
      workState: 'documents_open',
      todayIso: TODAY,
    });
    expect(combined.map((entry) => entry.id)).toEqual(['1']);

    const reset = filterActivationCases(base, {});
    expect(reset).toHaveLength(base.length);
  });

  it('sortiert stabil mit Aktivierungsnummer und ID als Tie-Breaker', () => {
    const twins = [
      item({
        id: 'b',
        activationNumber: 'A-2026-00002',
        nextDueAt: '2026-07-20',
        customerCompanyName: 'Same',
        priority: 'normal',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      item({
        id: 'a',
        activationNumber: 'A-2026-00001',
        nextDueAt: '2026-07-20',
        customerCompanyName: 'Same',
        priority: 'normal',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ];
    expect(sortActivationCases(twins, 'nextDueAt').map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(sortActivationCases(twins, 'company').map((entry) => entry.activationNumber)).toEqual([
      'A-2026-00001',
      'A-2026-00002',
    ]);
    expect(sortActivationCases(base, 'priority')[0]?.priority).toBe('urgent');
    expect(sortActivationCases(base, 'desiredGoLive')[0]?.desiredGoLive).toBe('2026-06-01');
    const byUpdated = sortActivationCases(base, 'updatedAt');
    expect(byUpdated[0] && byUpdated[1] && byUpdated[0].updatedAt >= byUpdated[1].updatedAt).toBe(true);
    expect(sortActivationCases(base, 'activationNumber')[0]?.activationNumber).toBe('A-2026-00011');
  });

  it('berechnet Kennzahlen ohne Mutation', () => {
    const snapshot = structuredClone(base);
    const metrics = getActivationOverviewMetrics(base, TODAY);
    expect(metrics.openCount).toBeGreaterThan(0);
    expect(metrics.blockedCount).toBe(1);
    expect(metrics.goLiveIn7Days).toBe(2);
    expect(metrics.documentsOpenCount).toBe(1);
    expect(metrics.providerReviewCount).toBe(1);
    expect(metrics.hardwareOpenCount).toBe(1);
    expect(metrics.setupOpenCount).toBe(1);
    expect(metrics.testOpenCount).toBe(1);
    expect(metrics.goLiveReadyCount).toBe(1);
    expect(metrics.completionOpenCount).toBe(1);
    expect(metrics.withoutNextTaskCount).toBeGreaterThanOrEqual(1);
    expect(base).toEqual(snapshot);
  });
});
