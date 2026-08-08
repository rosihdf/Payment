import type {
  BestPayComparisonResultSummary,
  BestPayComparisonVariantSummary,
  BestPayManualInput,
} from './bestPayComparisonSession';
import type { CostCaptureMode } from './costCaptureMode';
import { mapProviderNameToSelection } from './currentProviderCatalog';

export type SalesWizardStepId =
  | 'prospect'
  | 'costs'
  | 'need'
  | 'variants'
  | 'offer'
  | 'approval'
  | 'closing';

/** Interne Schrittfolge (inkl. Freigabe). Sichtbare Nav nutzt SALES_WIZARD_VISIBLE_STEPS. */
export const SALES_WIZARD_STEPS: Array<{
  id: SalesWizardStepId;
  number: number;
  label: string;
}> = [
  { id: 'prospect', number: 1, label: 'Kunde' },
  { id: 'costs', number: 2, label: 'Ausgangslage' },
  { id: 'need', number: 3, label: 'Bedarf' },
  { id: 'variants', number: 4, label: 'Empfehlung' },
  { id: 'offer', number: 5, label: 'Angebot' },
  { id: 'approval', number: 6, label: 'Angebot' },
  { id: 'closing', number: 7, label: 'Prüfung & Nachfassen' },
];

/** Maximal sechs sichtbare Beratungsschritte (Freigabe gehört zu Angebot). */
export const SALES_WIZARD_VISIBLE_STEPS: Array<{
  id: Exclude<SalesWizardStepId, 'approval'>;
  number: number;
  label: string;
  includes: SalesWizardStepId[];
}> = [
  { id: 'prospect', number: 1, label: 'Kunde', includes: ['prospect'] },
  { id: 'costs', number: 2, label: 'Ausgangslage', includes: ['costs'] },
  { id: 'need', number: 3, label: 'Bedarf', includes: ['need'] },
  { id: 'variants', number: 4, label: 'Empfehlung', includes: ['variants'] },
  { id: 'offer', number: 5, label: 'Angebot', includes: ['offer', 'approval'] },
  { id: 'closing', number: 6, label: 'Prüfung & Nachfassen', includes: ['closing'] },
];

export function getVisibleWizardStep(
  step: SalesWizardStepId,
): (typeof SALES_WIZARD_VISIBLE_STEPS)[number] {
  const matched = SALES_WIZARD_VISIBLE_STEPS.find((entry) => entry.includes.includes(step));
  return matched ?? SALES_WIZARD_VISIBLE_STEPS[0]!;
}

export function getVisibleWizardStepIndex(step: SalesWizardStepId): number {
  return Math.max(
    0,
    SALES_WIZARD_VISIBLE_STEPS.findIndex((entry) => entry.includes.includes(step)),
  );
}

export interface SalesWizardProspectDraft {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  phone: string;
  email: string;
  industry: string;
  /** @deprecated Anbieter liegt in currentProviderCode/Other; notes nur noch allgemeine Notiz. */
  notes: string;
  /** Katalogcode: bekannter Anbieter | 'other' | 'none' | '' */
  currentProviderCode: string;
  /** Freitext nur bei currentProviderCode === 'other' */
  currentProviderOther: string;
}

export interface SalesWizardScenarioConfig {
  label: string;
  preferredTermMonths: number | null;
  terminalCount: number;
  paymentUsage: BestPayManualInput['paymentUsage'];
}

export interface SalesWizardScenarioApproval {
  adminReviewRequired: boolean;
  quickReviewPossible: boolean;
  detailReviewRequired: boolean;
  approvalBlocked: boolean;
  reasons: string[];
}

export interface SalesWizardScenario {
  id: string;
  label: string;
  config: SalesWizardScenarioConfig;
  result: BestPayComparisonResultSummary | null;
  selectedCandidateId: string | null;
  approval: SalesWizardScenarioApproval | null;
  createdAt: string;
  updatedAt: string;
  duplicateOfScenarioId: string | null;
}

export interface SalesWizardState {
  enabled: boolean;
  currentStep: SalesWizardStepId;
  /** Höchster jemals per „Weiter“ erreichte Schritt – Rücksprung setzt ihn nicht zurück. */
  maxReachedStep: SalesWizardStepId;
  costCaptureMode: CostCaptureMode | null;
  prospectDraft: SalesWizardProspectDraft;
  scenarios: SalesWizardScenario[];
  selectedScenarioId: string | null;
  approvalAcknowledgedAt: string | null;
  approvalNotes: string;
  /** Interne Notiz für Wiedervorlage / Nachfassen (getrennt von Freigabehinweisen). */
  followUpNotes: string;
  wizardCompletedAt: string | null;
}

export const DEFAULT_SALES_WIZARD_PROSPECT: SalesWizardProspectDraft = {
  companyName: '',
  contactFirstName: '',
  contactLastName: '',
  phone: '',
  email: '',
  industry: '',
  notes: '',
  currentProviderCode: '',
  currentProviderOther: '',
};

/** Normalisiert ältere Sessions, in denen der Anbieter nur in notes lag. */
export function normalizeProspectDraftProvider(
  draft: SalesWizardProspectDraft,
): SalesWizardProspectDraft {
  const code = draft.currentProviderCode ?? '';
  const other = draft.currentProviderOther ?? '';
  if (code) {
    return { ...draft, currentProviderCode: code, currentProviderOther: other };
  }
  const notes = draft.notes?.trim() ?? '';
  if (!notes) {
    return { ...draft, currentProviderCode: '', currentProviderOther: '' };
  }
  const mapped = mapProviderNameToSelection(notes);
  return {
    ...draft,
    currentProviderCode: mapped.code,
    currentProviderOther: mapped.other,
  };
}

export const DEFAULT_SALES_WIZARD_STATE: SalesWizardState = {
  enabled: false,
  currentStep: 'prospect',
  maxReachedStep: 'prospect',
  costCaptureMode: null,
  prospectDraft: { ...DEFAULT_SALES_WIZARD_PROSPECT },
  scenarios: [],
  selectedScenarioId: null,
  approvalAcknowledgedAt: null,
  approvalNotes: '',
  followUpNotes: '',
  wizardCompletedAt: null,
};

export function getSalesWizardStepIndex(step: SalesWizardStepId): number {
  return SALES_WIZARD_STEPS.findIndex((entry) => entry.id === step);
}

export function getNextSalesWizardStep(step: SalesWizardStepId): SalesWizardStepId | null {
  const index = getSalesWizardStepIndex(step);
  return SALES_WIZARD_STEPS[index + 1]?.id ?? null;
}

export function getPreviousSalesWizardStep(step: SalesWizardStepId): SalesWizardStepId | null {
  const index = getSalesWizardStepIndex(step);
  return index > 0 ? (SALES_WIZARD_STEPS[index - 1]?.id ?? null) : null;
}

export function bumpMaxReachedStep(
  step: SalesWizardStepId,
  maxReached: SalesWizardStepId,
): SalesWizardStepId {
  const stepIndex = getSalesWizardStepIndex(step);
  const maxIndex = getSalesWizardStepIndex(maxReached);
  return stepIndex > maxIndex ? step : maxReached;
}

/** Hydration älterer Entwürfe ohne maxReachedStep. */
export function normalizeWizardMaxReachedStep(
  wizard: Pick<SalesWizardState, 'currentStep' | 'maxReachedStep'>,
): SalesWizardStepId {
  const current = wizard.currentStep ?? 'prospect';
  const max = wizard.maxReachedStep ?? current;
  return bumpMaxReachedStep(current, max);
}

export function canJumpToWizardStep(
  target: SalesWizardStepId,
  maxReached: SalesWizardStepId,
): boolean {
  return getSalesWizardStepIndex(target) <= getSalesWizardStepIndex(maxReached);
}

export function resolveSelectedScenarioVariant(
  scenario: SalesWizardScenario | null,
): BestPayComparisonVariantSummary | null {
  if (!scenario?.result) {
    return null;
  }
  return (
    scenario.result.variants.find((variant) => variant.candidateId === scenario.selectedCandidateId) ??
    scenario.result.variants[0] ??
    null
  );
}
