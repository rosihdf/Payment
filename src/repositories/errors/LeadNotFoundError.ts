export class LeadNotFoundError extends Error {
  readonly leadId: string;

  constructor(leadId: string) {
    super(`Lead with id "${leadId}" was not found.`);
    this.name = 'LeadNotFoundError';
    this.leadId = leadId;
  }
}
