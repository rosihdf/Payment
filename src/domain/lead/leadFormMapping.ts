import type { EditLeadInput, Lead } from './lead';

export function leadToEditInput(lead: Lead): EditLeadInput {
  return {
    companyName: lead.companyName,
    contactFirstName: lead.contactFirstName,
    contactLastName: lead.contactLastName,
    phone: lead.phone,
    email: lead.email,
    street: lead.street,
    postalCode: lead.postalCode,
    city: lead.city,
    industry: lead.industry,
    currentProvider: lead.currentProvider,
    monthlyCardTurnoverCents: lead.monthlyCardTurnoverCents,
    monthlyTransactions: lead.monthlyTransactions,
    averageTransactionValueCents: lead.averageTransactionValueCents,
    currentTerminalCount: lead.currentTerminalCount,
    currentTerminalModels: lead.currentTerminalModels,
    paymentUsage: { ...lead.paymentUsage },
    cardMix: { ...lead.cardMix },
    currentContractEndDate: lead.currentContractEndDate,
    currentNoticePeriod: lead.currentNoticePeriod,
    requiredTerminalCount: lead.requiredTerminalCount,
    interest: lead.interest,
    notes: lead.notes,
    nextFollowUpAt: lead.nextFollowUpAt,
    status: lead.status,
    assignedSalesUserId: lead.assignedSalesUserId,
  };
}

export function isSameEditInput(left: EditLeadInput, right: EditLeadInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
