import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import { LocalLeadDraftRepository } from '../repositories/local/LocalLeadDraftRepository';
import { LeadDraftService } from '../services/leadDraftService';
import { clearDemoDataForTests } from '../services/demoDataService';
import { createValidLeadInput } from './helpers/leadTestHelpers';

describe('LeadDraftService', () => {
  let draftService: LeadDraftService;

  beforeEach(() => {
    clearDemoDataForTests();
    draftService = new LeadDraftService(new LocalLeadDraftRepository());
  });

  it('saves a draft', async () => {
    const draft = createValidLeadInput({ companyName: 'Draft GmbH' });

    await draftService.saveDraft('user_001', draft);

    expect(await draftService.getDraft('user_001')).toEqual(draft);
  });

  it('restores a saved draft', async () => {
    const draft = createValidLeadInput({ notes: 'Entwurf merken' });
    await draftService.saveDraft('user_001', draft);

    const restored = await draftService.getDraft('user_001');

    expect(restored?.notes).toBe('Entwurf merken');
  });

  it('clears a draft after successful save flow', async () => {
    await draftService.saveDraft('user_001', createValidLeadInput());
    await draftService.clearDraft('user_001');

    expect(await draftService.getDraft('user_001')).toBeNull();
  });

  it('clears a draft after confirmed discard', async () => {
    await draftService.saveDraft('user_001', createValidLeadInput({ city: 'Berlin' }));
    await draftService.clearDraft('user_001');

    expect(await draftService.getDraft('user_001')).toBeNull();
  });

  it('does not treat an empty draft as restorable content', async () => {
    await draftService.saveDraft('user_001', DEFAULT_CREATE_LEAD_INPUT);

    expect(await draftService.getDraft('user_001')).toBeNull();
  });
});
