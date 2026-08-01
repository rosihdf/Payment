export type CommissionBonusType =
  | 'bonus'
  | 'special_commission'
  | 'premium'
  | 'sales_campaign'
  | 'project_bonus'
  | 'goodwill'
  | 'correction'
  | 'other';

export type CommissionBonusStatus = 'open' | 'approved' | 'paid' | 'cancelled';

export const COMMISSION_BONUS_TYPE_LABELS: Record<CommissionBonusType, string> = {
  bonus: 'Bonus',
  special_commission: 'Sonderprovision',
  premium: 'Prämie',
  sales_campaign: 'Verkaufsaktion',
  project_bonus: 'Projektbonus',
  goodwill: 'Kulanz',
  correction: 'Korrektur',
  other: 'Sonstiges',
};

export const COMMISSION_BONUS_STATUS_LABELS: Record<CommissionBonusStatus, string> = {
  open: 'Offen',
  approved: 'Freigegeben',
  paid: 'Ausgezahlt',
  cancelled: 'Storniert',
};

export interface CommissionBonusPayment {
  id: string;
  salesRepresentativeId: string;
  amountCents: number;
  currency: string;
  bonusType: CommissionBonusType;
  title: string;
  description: string;
  reason: string;
  periodFrom: string | null;
  periodUntil: string | null;
  leadId: string | null;
  offerId: string | null;
  contractId: string | null;
  activationId: string | null;
  documentReference: string | null;
  status: CommissionBonusStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
}
