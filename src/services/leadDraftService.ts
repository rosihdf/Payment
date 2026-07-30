import type { CreateLeadInput } from '../domain/lead/lead';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import type { LeadDraftRepository } from '../repositories/interfaces/LeadDraftRepository';

function isSameDraftValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isDraftEmpty(draft: CreateLeadInput): boolean {
  return isSameDraftValue(draft, DEFAULT_CREATE_LEAD_INPUT);
}

export class LeadDraftService {
  private readonly leadDraftRepository: LeadDraftRepository;

  constructor(leadDraftRepository: LeadDraftRepository) {
    this.leadDraftRepository = leadDraftRepository;
  }

  async getDraft(userId: string): Promise<CreateLeadInput | null> {
    const draft = await this.leadDraftRepository.getByUserId(userId);
    if (!draft || isDraftEmpty(draft)) {
      return null;
    }

    return draft;
  }

  async saveDraft(userId: string, draft: CreateLeadInput): Promise<void> {
    if (isDraftEmpty(draft)) {
      await this.leadDraftRepository.clear(userId);
      return;
    }

    await this.leadDraftRepository.save(userId, draft);
  }

  async clearDraft(userId: string): Promise<void> {
    await this.leadDraftRepository.clear(userId);
  }
}
