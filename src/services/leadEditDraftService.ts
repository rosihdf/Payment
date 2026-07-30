import { isSameEditInput } from '../domain/lead/leadFormMapping';
import type { EditLeadInput } from '../domain/lead/lead';
import { nowIso } from '../utils/id';
import type { LeadEditDraftRepository } from '../repositories/interfaces/LeadEditDraftRepository';

export class LeadEditDraftService {
  private readonly leadEditDraftRepository: LeadEditDraftRepository;

  constructor(leadEditDraftRepository: LeadEditDraftRepository) {
    this.leadEditDraftRepository = leadEditDraftRepository;
  }

  async getDraft(
    leadId: string,
    leadUpdatedAt: string,
    baseline: EditLeadInput,
  ): Promise<EditLeadInput | null> {
    const draft = await this.leadEditDraftRepository.getByLeadId(leadId);

    if (!draft || isSameEditInput(draft.input, baseline)) {
      if (draft) {
        await this.leadEditDraftRepository.clear(leadId);
      }
      return null;
    }

    if (new Date(draft.savedAt).getTime() < new Date(leadUpdatedAt).getTime()) {
      await this.leadEditDraftRepository.clear(leadId);
      return null;
    }

    return draft.input;
  }

  async saveDraft(
    leadId: string,
    input: EditLeadInput,
    baseline: EditLeadInput,
  ): Promise<void> {
    if (isSameEditInput(input, baseline)) {
      await this.leadEditDraftRepository.clear(leadId);
      return;
    }

    await this.leadEditDraftRepository.save(leadId, {
      input,
      savedAt: nowIso(),
    });
  }

  async clearDraft(leadId: string): Promise<void> {
    await this.leadEditDraftRepository.clear(leadId);
  }
}
