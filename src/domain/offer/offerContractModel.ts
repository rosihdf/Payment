export type OfferContractModel =
  | 'rental'
  | 'purchase'
  | 'acq_only'
  | 'terminal_plus_acq'
  | 'not_specified';

export const OFFER_CONTRACT_MODEL_LABELS: Record<OfferContractModel, string> = {
  rental: 'Miete',
  purchase: 'Kauf',
  acq_only: 'Acquiring ohne Terminal',
  terminal_plus_acq: 'Terminal und Acquiring',
  not_specified: 'Nicht angegeben',
};
