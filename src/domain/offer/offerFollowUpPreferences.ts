export interface OfferFollowUpPreferences {
  providedAt: string;
  followUpDate: string | null;
  comparesOffers: boolean;
  openQuestions: string;
  customerContactsSelf: boolean;
  noFollowUpDesired: boolean;
}

export function normalizeOfferFollowUpPreferences(raw: unknown): OfferFollowUpPreferences | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  const providedAt = typeof entry.providedAt === 'string' ? entry.providedAt.trim() : '';
  if (!providedAt) {
    return null;
  }
  return {
    providedAt,
    followUpDate:
      typeof entry.followUpDate === 'string' && entry.followUpDate.trim()
        ? entry.followUpDate.trim()
        : null,
    comparesOffers: entry.comparesOffers === true,
    openQuestions: typeof entry.openQuestions === 'string' ? entry.openQuestions.trim() : '',
    customerContactsSelf: entry.customerContactsSelf === true,
    noFollowUpDesired: entry.noFollowUpDesired === true,
  };
}
