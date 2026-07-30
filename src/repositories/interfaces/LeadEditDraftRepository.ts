import type { EditLeadInput } from '../../domain/lead/lead';

export interface LeadEditDraft {
  input: EditLeadInput;
  savedAt: string;
}

export interface LeadEditDraftRepository {
  getByLeadId(leadId: string): Promise<LeadEditDraft | null>;
  save(leadId: string, draft: LeadEditDraft): Promise<void>;
  clear(leadId: string): Promise<void>;
}
