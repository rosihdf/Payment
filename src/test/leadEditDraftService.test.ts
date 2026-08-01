import { beforeEach, describe, expect, it } from 'vitest';
import { leadToEditInput } from '../domain/lead/leadFormMapping';
import { LocalLeadEditDraftRepository } from '../repositories/local/LocalLeadEditDraftRepository';
import { LeadEditDraftService } from '../services/leadEditDraftService';
import { clearDemoDataForTests } from '../services/demoDataService';
import { createTestLead, createValidEditInput } from './helpers/leadTestHelpers';

describe('LeadEditDraftService', () => {
  let service: LeadEditDraftService;

  beforeEach(() => {
    clearDemoDataForTests();
    service = new LeadEditDraftService(new LocalLeadEditDraftRepository());
  });

  it('stores edit drafts per lead id', async () => {
    const baseline = leadToEditInput(createTestLead({ id: 'lead_a' }));
    const changed = createValidEditInput({ companyName: 'Draft A' });

    await service.saveDraft('lead_a', changed, baseline);

    expect(await service.getDraft('lead_a', '2026-07-01T08:00:00.000Z', baseline)).toEqual(changed);
  });

  it('does not mix drafts between leads', async () => {
    const baselineA = leadToEditInput(createTestLead({ id: 'lead_a' }));
    const baselineB = leadToEditInput(createTestLead({ id: 'lead_b', companyName: 'B GmbH' }));

    await service.saveDraft('lead_a', createValidEditInput({ companyName: 'Draft A' }), baselineA);
    await service.saveDraft('lead_b', createValidEditInput({ companyName: 'Draft B' }), baselineB);

    expect(
      (await service.getDraft('lead_a', '2026-07-01T08:00:00.000Z', baselineA))?.companyName,
    ).toBe('Draft A');
    expect(
      (await service.getDraft('lead_b', '2026-07-01T08:00:00.000Z', baselineB))?.companyName,
    ).toBe('Draft B');
  });

  it('restores newer drafts', async () => {
    const baseline = leadToEditInput(createTestLead({ id: 'lead_newer' }));
    const changed = createValidEditInput({ notes: 'Neuer Draft' });

    await service.saveDraft('lead_newer', changed, baseline);

    expect(
      await service.getDraft('lead_newer', '2026-07-01T08:00:00.000Z', baseline),
    ).toEqual(changed);
  });

  it('ignores outdated drafts', async () => {
    const baseline = leadToEditInput(createTestLead({ id: 'lead_old' }));
    const changed = createValidEditInput({ notes: 'Veraltet' });

    await service.saveDraft('lead_old', changed, baseline);

    // Lead-Update muss zeitlich nach dem Draft liegen (festes Datum ist flaky).
    const leadUpdatedAfterDraft = new Date(Date.now() + 60_000).toISOString();
    expect(await service.getDraft('lead_old', leadUpdatedAfterDraft, baseline)).toBeNull();
  });

  it('clears drafts after successful save flow', async () => {
    const baseline = leadToEditInput(createTestLead({ id: 'lead_clear' }));
    await service.saveDraft('lead_clear', createValidEditInput({ city: 'Berlin' }), baseline);
    await service.clearDraft('lead_clear');

    expect(await service.getDraft('lead_clear', '2026-07-01T08:00:00.000Z', baseline)).toBeNull();
  });

  it('clears drafts after confirmed discard', async () => {
    const baseline = leadToEditInput(createTestLead({ id: 'lead_discard' }));
    await service.saveDraft('lead_discard', createValidEditInput({ city: 'Hamburg' }), baseline);
    await service.clearDraft('lead_discard');

    expect(await service.getDraft('lead_discard', '2026-07-01T08:00:00.000Z', baseline)).toBeNull();
  });
});
