export type DocumentTemplateType =
  | 'offer_pdf'
  | 'customer_text'
  | 'cover_letter'
  | 'approval_comment'
  | 'follow_up_note'
  | 'acceptance_notice'
  | 'decline_internal'
  | 'activation_notice';

export type DocumentTemplateStatus = 'draft' | 'active' | 'archived';

export interface DocumentTemplate {
  id: string;
  schemaVersion: number;
  type: DocumentTemplateType;
  name: string;
  versionNumber: number;
  status: DocumentTemplateStatus;
  validFrom: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}

export const DOCUMENT_TEMPLATE_SCHEMA_VERSION = 1;

export const DOCUMENT_TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  offer_pdf: 'Angebots-PDF',
  customer_text: 'Kundentext',
  cover_letter: 'Anschreiben',
  approval_comment: 'Freigabekommentar',
  follow_up_note: 'Nachfassnotiz',
  acceptance_notice: 'Annahmehinweis',
  decline_internal: 'Ablehnung intern',
  activation_notice: 'Aktivierungshinweis',
};

export const ALLOWED_TEMPLATE_PLACEHOLDERS = [
  'offerNumber',
  'versionNumber',
  'customerName',
  'contactName',
  'tariffName',
  'contractTermMonths',
  'validUntil',
  'terminalSummary',
  'accessorySummary',
  'totalAmount',
] as const;

export type TemplatePlaceholder = (typeof ALLOWED_TEMPLATE_PLACEHOLDERS)[number];

export function extractTemplatePlaceholders(body: string): string[] {
  const matches = body.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) ?? [];
  return matches.map((match) => match.slice(2, -2));
}

export function validateTemplatePlaceholders(body: string): string[] {
  return extractTemplatePlaceholders(body).filter(
    (placeholder) => !ALLOWED_TEMPLATE_PLACEHOLDERS.includes(placeholder as TemplatePlaceholder),
  );
}

export function renderTemplatePreview(
  body: string,
  values: Partial<Record<TemplatePlaceholder, string>>,
): string {
  return body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => values[key as TemplatePlaceholder] ?? match);
}

export const DEMO_TEMPLATE_VALUES: Record<TemplatePlaceholder, string> = {
  offerNumber: 'BP-ANG-2026-0042',
  versionNumber: '2',
  customerName: 'Demo Café GmbH',
  contactName: 'Max Mustermann',
  tariffName: 'BestPay Mobile A920 Classic',
  contractTermMonths: '36',
  validUntil: '31.08.2026',
  terminalSummary: '1× A920 mobil',
  accessorySummary: 'Kassenrolle',
  totalAmount: '89,00 € / Monat',
};
