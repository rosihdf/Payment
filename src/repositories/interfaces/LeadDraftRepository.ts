import type { CreateLeadInput } from '../../domain/lead/lead';

export interface LeadDraftRepository {
  getByUserId(userId: string): Promise<CreateLeadInput | null>;
  save(userId: string, draft: CreateLeadInput): Promise<void>;
  clear(userId: string): Promise<void>;
}
