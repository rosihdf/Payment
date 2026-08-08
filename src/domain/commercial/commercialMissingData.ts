/** Maschinenlesbare Codes für fehlende Need- oder Commercial-Daten. */
export type CommercialMissingCode =
  | 'need.monthlyCardVolumeCents'
  | 'need.monthlyTransactions'
  | 'need.cardMix.girocardPercent'
  | 'need.cardMix.debitPercent'
  | 'need.cardMix.creditPercent'
  | 'need.cardMix.otherPercent'
  | 'need.cardMix.incomplete'
  | 'need.paymentUsage'
  | 'commercial.tariff'
  | 'commercial.hardwarePrice'
  | 'commercial.simPrice'
  | 'commercial.contractTerm'
  | 'commercial.flatNonEwrMarkup'
  | 'commercial.flatCommercialMarkup'
  | 'commission.rule';

export interface CommercialMissingEntry {
  code: CommercialMissingCode;
  label: string;
  severity: 'error' | 'warning';
}

const LABELS: Record<CommercialMissingCode, string> = {
  'need.monthlyCardVolumeCents': 'Monatsumsatz',
  'need.monthlyTransactions': 'Transaktionsanzahl',
  'need.cardMix.girocardPercent': 'Kartenmix Girocard',
  'need.cardMix.debitPercent': 'Kartenmix Debit',
  'need.cardMix.creditPercent': 'Kartenmix Kredit',
  'need.cardMix.otherPercent': 'Kartenmix Sonstige',
  'need.cardMix.incomplete': 'Kartenmix unvollständig',
  'need.paymentUsage': 'Einsatzart',
  'commercial.tariff': 'Tarif',
  'commercial.hardwarePrice': 'Hardwarepreis',
  'commercial.simPrice': 'SIM-Preis',
  'commercial.contractTerm': 'Vertragslaufzeit',
  'commercial.flatNonEwrMarkup': 'Flat Non-EWR-Aufschlag',
  'commercial.flatCommercialMarkup': 'Flat Commercial-Card-Aufschlag',
  'commission.rule': 'Provisionsregel',
};

export function commercialMissingEntry(
  code: CommercialMissingCode,
  severity: CommercialMissingEntry['severity'] = 'error',
): CommercialMissingEntry {
  return { code, label: LABELS[code], severity };
}

export function mapLegacyMissingBasis(code: string): CommercialMissingCode | null {
  if (code === 'tariff') {
    return 'commercial.tariff';
  }
  if (code === 'monthlyTransactions') {
    return 'need.monthlyTransactions';
  }
  if (code === 'monthlyCardVolumeCents') {
    return 'need.monthlyCardVolumeCents';
  }
  if (code === 'girocardSharePercent') {
    return 'need.cardMix.girocardPercent';
  }
  if (code.startsWith('hardware:') || code.startsWith('hardware_price:')) {
    return 'commercial.hardwarePrice';
  }
  return null;
}
