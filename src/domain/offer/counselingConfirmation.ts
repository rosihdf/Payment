export const COUNSELING_PRINCIPLE_KEYS = [
  'customerNeedsAssessed',
  'suitableSolutionExplained',
  'costsTransparent',
  'alternativesDiscussed',
  'contractTermsExplained',
  'cancellationRightsInformed',
  'dataProtectionInformed',
  'noPressureApplied',
  'documentationProvided',
  'questionsAnswered',
] as const;

export type CounselingPrincipleKey = (typeof COUNSELING_PRINCIPLE_KEYS)[number];

export type CounselingPrincipleFlags = Record<CounselingPrincipleKey, boolean>;

export const COUNSELING_PRINCIPLE_LABELS: Record<CounselingPrincipleKey, string> = {
  customerNeedsAssessed: 'Kundenbedarf wurde ermittelt',
  suitableSolutionExplained: 'Passende Lösung wurde erläutert',
  costsTransparent: 'Kosten wurden transparent dargestellt',
  alternativesDiscussed: 'Alternativen wurden besprochen',
  contractTermsExplained: 'Vertragsbedingungen wurden erklärt',
  cancellationRightsInformed: 'Widerrufsrecht wurde informiert',
  dataProtectionInformed: 'Datenschutz wurde erläutert',
  noPressureApplied: 'Es wurde kein Verkaufsdruck ausgeübt',
  documentationProvided: 'Unterlagen wurden bereitgestellt',
  questionsAnswered: 'Offene Fragen wurden beantwortet',
};

export function emptyCounselingPrincipleFlags(): CounselingPrincipleFlags {
  return Object.fromEntries(COUNSELING_PRINCIPLE_KEYS.map((key) => [key, false])) as CounselingPrincipleFlags;
}

export interface CounselingConfirmation {
  offerVersionId: string;
  confirmedAt: string;
  confirmedByUserId: string;
  principles: CounselingPrincipleFlags;
}

export function normalizeCounselingPrincipleFlags(raw: unknown): CounselingPrincipleFlags {
  const flags = emptyCounselingPrincipleFlags();
  if (!raw || typeof raw !== 'object') {
    return flags;
  }
  const entry = raw as Record<string, unknown>;
  for (const key of COUNSELING_PRINCIPLE_KEYS) {
    flags[key] = entry[key] === true;
  }
  return flags;
}

export function normalizeCounselingConfirmation(raw: unknown): CounselingConfirmation | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  const offerVersionId = typeof entry.offerVersionId === 'string' ? entry.offerVersionId.trim() : '';
  const confirmedAt = typeof entry.confirmedAt === 'string' ? entry.confirmedAt.trim() : '';
  const confirmedByUserId =
    typeof entry.confirmedByUserId === 'string' ? entry.confirmedByUserId.trim() : '';
  if (!offerVersionId || !confirmedAt || !confirmedByUserId) {
    return null;
  }
  return {
    offerVersionId,
    confirmedAt,
    confirmedByUserId,
    principles: normalizeCounselingPrincipleFlags(entry.principles),
  };
}
