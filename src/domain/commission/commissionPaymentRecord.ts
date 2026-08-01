/** Dokumentierte Auszahlung zu einem Provisionsfall. */
export interface CommissionPaymentRecord {
  id: string;
  commissionCaseId: string;
  amountCents: number;
  currency: string;
  paymentDate: string;
  paymentReference: string;
  note: string;
  recordedByUserId: string;
  createdAt: string;
}
