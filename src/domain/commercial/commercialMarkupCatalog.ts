/**
 * Flat-Tarif-Aufschläge laut Flyer BP (Marc).pdf – nur anwenden, wenn Umsatzbasis bekannt ist.
 */

export const FLAT_NON_EWR_MARKUP_TENTHS_OF_BASIS_POINT = 1490; // +1,49 %
export const FLAT_COMMERCIAL_CARD_MARKUP_TENTHS_OF_BASIS_POINT = 1590; // +1,59 %

export interface FlatMarkupRule {
  code: 'flat_non_ewr' | 'flat_commercial_card';
  label: string;
  markupTenthsOfBasisPoint: number;
  sourceReference: string;
  /** Need muss separaten Umsatzanteil liefern – aktuell nicht im Kartenmix modelliert. */
  requiresVolumeBasis: true;
}

export const FLAT_MARKUP_RULES: FlatMarkupRule[] = [
  {
    code: 'flat_non_ewr',
    label: 'Non-EWR-Aufschlag',
    markupTenthsOfBasisPoint: FLAT_NON_EWR_MARKUP_TENTHS_OF_BASIS_POINT,
    sourceReference: 'Flyer BP (Marc).pdf – +1,49 % Non-EWR',
    requiresVolumeBasis: true,
  },
  {
    code: 'flat_commercial_card',
    label: 'Commercial-Card-Aufschlag',
    markupTenthsOfBasisPoint: FLAT_COMMERCIAL_CARD_MARKUP_TENTHS_OF_BASIS_POINT,
    sourceReference: 'Flyer BP (Marc).pdf – +1,59 % Commercial Card',
    requiresVolumeBasis: true,
  },
];

export function hasFlatMarkupVolumeBasis(_need: {
  cardMix: { otherPercent: number | null };
}): boolean {
  return false;
}
