import type { OfferVersionSnapshot } from './offerVersion';

export type PublicOfferViewErrorCode =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'superseded'
  | 'unavailable'
  | 'technical';

export interface PublicOfferLineItem {
  name: string;
  description: string;
  quantity: number;
  priceType: string;
  unitPriceLabel: string;
  lineTotalLabel: string;
  category: 'terminal' | 'accessory' | 'other';
}

export interface PublicOfferView {
  companyName: string;
  contactName: string;
  offerNumber: string;
  versionNumber: number;
  versionCreatedAt: string;
  salesContactName: string;
  tariffName: string | null;
  tariffProvider: string | null;
  termMonths: number | null;
  oneTimeTotalLabel: string;
  monthlyTotalLabel: string;
  transactionCostHint: string;
  validUntil: string | null;
  linkValidUntil: string;
  statusLabel: string;
  reviewHint: string;
  competitorComparisonHint: string;
  terminals: PublicOfferLineItem[];
  accessories: PublicOfferLineItem[];
  hasPdf: boolean;
}

export interface PublicOfferPdfPayload {
  offerNumber: string;
  versionNumber: number;
  snapshot: OfferVersionSnapshot;
  documentSnapshot: unknown | null;
}

export function buildPublicOfferView(input: {
  snapshot: OfferVersionSnapshot;
  versionNumber: number;
  versionCreatedAt: string;
  salesContactName: string;
  linkValidUntil: string;
  hasPdf: boolean;
  formatMoney: (cents: number) => string;
  formatItemPrice: (priceType: string, cents: number | null) => string;
}): PublicOfferView {
  const { snapshot } = input;
  const contactName = [snapshot.customerSnapshot.contactFirstName, snapshot.customerSnapshot.contactLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const mapLine = (
    item: (typeof snapshot.items)[number],
    category: PublicOfferLineItem['category'],
  ): PublicOfferLineItem => ({
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    priceType: item.priceType,
    unitPriceLabel: input.formatItemPrice(item.priceType, item.unitPriceCents),
    lineTotalLabel: input.formatMoney(
      item.priceType === 'monthly'
        ? (item.unitPriceCents ?? 0) * item.quantity
        : item.priceType === 'one_time'
          ? (item.unitPriceCents ?? 0) * item.quantity
          : 0,
    ),
    category,
  });

  return {
    companyName: snapshot.customerSnapshot.companyName,
    contactName,
    offerNumber: snapshot.offerNumber,
    versionNumber: input.versionNumber,
    versionCreatedAt: input.versionCreatedAt,
    salesContactName: input.salesContactName,
    tariffName: snapshot.tariffSnapshot?.name ?? null,
    tariffProvider: snapshot.tariffSnapshot?.providerName ?? null,
    termMonths: snapshot.termMonths,
    oneTimeTotalLabel: input.formatMoney(snapshot.totals.oneTimeTotalCents),
    monthlyTotalLabel: input.formatMoney(snapshot.totals.monthlyTotalCents),
    transactionCostHint: snapshot.tariffSnapshot
      ? 'Transaktionsbezogene Kosten gemäß Tarifblatt'
      : 'Keine Tariftransaktionskosten hinterlegt',
    validUntil: snapshot.validUntil,
    linkValidUntil: input.linkValidUntil,
    statusLabel: 'Zur Prüfung bereitgestellt',
    reviewHint: 'Bitte prüfen Sie das Angebot in Ruhe. Der Link ist zeitlich begrenzt gültig.',
    competitorComparisonHint:
      'Ein Vergleich mit anderen Anbietern ist ausdrücklich möglich und empfohlen.',
    terminals: snapshot.terminalLines.map((item) => mapLine(item, 'terminal')),
    accessories: snapshot.accessoryLines.map((item) => mapLine(item, 'accessory')),
    hasPdf: input.hasPdf,
  };
}
