/**
 * Dokumentierter Konflikt zwischen PPT-Provisionsmodell und Vertragsanlage –
 * bewusst NICHT automatisch aufgelöst (offene Fachentscheidung A).
 */

export type CommissionSourceConflictCode =
  | 'CONTRACT_CLOSURE_PPT_VS_VERTRAG'
  | 'TERM_EXACT_36_MONTHS';

export interface CommissionSourceConflict {
  code: CommissionSourceConflictCode;
  pptDescription: string;
  contractDescription: string;
  status: 'open_business_decision';
  requiredDecision: string;
}

export const COMMISSION_SOURCE_CONFLICTS: CommissionSourceConflict[] = [
  {
    code: 'CONTRACT_CLOSURE_PPT_VS_VERTRAG',
    pptDescription:
      'Klassisch/variabel: laufzeitabhängige/stufige Abschlussprovision (300/200/150 € bzw. 150/100/100 €).',
    contractDescription: 'Vertragsanlage: pauschal „Vertragsabschluss Payment 150 €“ für Modell 1 und 2.',
    status: 'open_business_decision',
    requiredDecision:
      'Fachentscheidung A: Welche Quelle ist beim Vertragsabschluss verbindlich – PPT oder Vertragsanlage?',
  },
  {
    code: 'TERM_EXACT_36_MONTHS',
    pptDescription: 'Weder „Vertrag größer 36 Monate“ noch „Vertrag kleiner 36 Monate“.',
    contractDescription: 'Vertragsanlage definiert exakt 36 Monate nicht.',
    status: 'open_business_decision',
    requiredDecision:
      'Fachentscheidung B: Welche Provisionsregel gilt exakt bei 36 Monaten Laufzeit?',
  },
];

export function getOpenCommissionSourceConflicts(): CommissionSourceConflict[] {
  return COMMISSION_SOURCE_CONFLICTS.filter((entry) => entry.status === 'open_business_decision');
}
