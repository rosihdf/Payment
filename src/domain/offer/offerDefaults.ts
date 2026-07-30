import type { CreateOfferInput } from './offer';

export const DEFAULT_OFFER_TITLE = 'BestPay Angebot';

export const DEFAULT_CREATE_OFFER_INPUT: CreateOfferInput = {
  leadId: '',
  tariffId: null,
  title: DEFAULT_OFFER_TITLE,
  introductionText: '',
  internalNotes: '',
  customerNotes: '',
  validUntil: null,
  items: [],
};
