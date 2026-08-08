/**
 * Provisionsquellen – Phase 2D: PPT ist operative AD-Wahrheit (Fachentscheidung Auftraggeber).
 * Vertragsanlage bleibt als Vertrags-/Dokumentationsquelle erhalten.
 */

export type CommissionSourceConflictCode =
  | 'CONTRACT_CLOSURE_PPT_VS_VERTRAG'
  | 'TERM_EXACT_36_MONTHS';

export type CommissionSourceConflictStatus =
  | 'open_business_decision'
  | 'resolved_ppt_priority'
  | 'resolved_long_term_includes_36';

export interface CommissionSourceConflict {
  code: CommissionSourceConflictCode;
  pptDescription: string;
  contractDescription: string;
  status: CommissionSourceConflictStatus;
  resolution: string;
}

export const COMMISSION_SOURCE_CONFLICTS: CommissionSourceConflict[] = [
  {
    code: 'CONTRACT_CLOSURE_PPT_VS_VERTRAG',
    pptDescription:
      'Klassisch/variabel: laufzeitabhängige Vertragskonstellationen (300/200/150 € bzw. 150/100/100 €).',
    contractDescription: 'Vertragsanlage: pauschal „Vertragsabschluss Payment 150 €“ für Modell 1 und 2.',
    status: 'resolved_ppt_priority',
    resolution:
      'Fachentscheidung Auftraggeber (Phase 2D): Provisionsodell.pptx ist für die operative AD-Provisionsberechnung maßgeblich. Vertragsanlage bleibt dokumentiert, ersetzt PPT nicht.',
  },
  {
    code: 'TERM_EXACT_36_MONTHS',
    pptDescription: 'Sprachlich „größer 36“ / „kleiner 36“ – 36 Monate als long_term interpretiert.',
    contractDescription: 'Vertragsanlage definiert exakt 36 Monate nicht.',
    status: 'resolved_long_term_includes_36',
    resolution:
      'Fachentscheidung Auftraggeber (Phase 2D): 36 abgeschlossene Monate erfüllen bereits die lange Laufzeitstufe (>=36 → long_term).',
  },
];

export function getOpenCommissionSourceConflicts(): CommissionSourceConflict[] {
  return COMMISSION_SOURCE_CONFLICTS.filter(
    (entry) => entry.status === 'open_business_decision',
  );
}

export function getResolvedCommissionSourceDecisions(): CommissionSourceConflict[] {
  return COMMISSION_SOURCE_CONFLICTS.filter(
    (entry) => entry.status !== 'open_business_decision',
  );
}
