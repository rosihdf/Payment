import type {
  BestPayComparisonResultSummary,
  BestPayComparisonVariantSummary,
  BestPayManualInput,
} from './bestPayComparisonSession';

export type SalesWizardStepId =
  | 'prospect'
  | 'costs'
  | 'need'
  | 'variants'
  | 'offer'
  | 'approval'
  | 'closing';

export const SALES_WIZARD_STEPS: Array<{
  id: SalesWizardStepId;
  number: number;
  label: string;
}> = [
  { id: 'prospect', number: 1, label: 'Interessent' },
  { id: 'costs', number: 2, label: 'Aktuelle Kosten' },
  { id: 'need', number: 3, label: 'Bedarf' },
  { id: 'variants', number: 4, label: 'Variantenvergleich' },
  { id: 'offer', number: 5, label: 'Angebot' },
  { id: 'approval', number: 6, label: 'Freigabe' },
  { id: 'closing', number: 7, label: 'Abschluss' },
];

export interface SalesWizardProspectDraft {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  phone: string;
  email: string;
  industry: string;
  notes: string;
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
  prospectDraft: SalesWizardProspectDraft;
  scenarios: SalesWizardScenario[];
  selectedScenarioId: string | null;
  approvalAcknowledgedAt: string | null;
  approvalNotes: string;
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
};

export const DEFAULT_SALES_WIZARD_STATE: SalesWizardState = {
  enabled: false,
  currentStep: 'prospect',
  prospectDraft: { ...DEFAULT_SALES_WIZARD_PROSPECT },
  scenarios: [],
  selectedScenarioId: null,
  approvalAcknowledgedAt: null,
  approvalNotes: '',
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
