import {
  COUNSELING_PRINCIPLE_KEYS,
  type CounselingPrincipleFlags,
} from './counselingConfirmation';
import type { OfferFollowUpPreferences } from './offerFollowUpPreferences';
import type {
  OfferAcceptance,
  OfferActivationChecklist,
  OfferActivationDeviation,
  OfferDecline,
} from './offerWorkflowEvents';

export function validateStructuredAcceptance(
  input: Pick<OfferAcceptance, 'acceptedByName' | 'acceptanceType' | 'otherText'>,
): string | undefined {
  if (!input.acceptedByName.trim()) {
    return 'Annehmende Person fehlt.';
  }
  if (input.acceptanceType === 'other' && !input.otherText?.trim()) {
    return 'Bitte geben Sie eine Beschreibung für „Sonstiges“ an.';
  }
  return undefined;
}

export function validateStructuredDecline(
  input: Pick<OfferDecline, 'reason' | 'otherText'>,
): string | undefined {
  if (input.reason === 'other' && !input.otherText?.trim()) {
    return 'Bitte geben Sie einen Ablehnungsgrund an.';
  }
  return undefined;
}

export function validateActivationChecklist(checklist: OfferActivationChecklist): string | undefined {
  const values = Object.values(checklist.checks);
  if (!values.length || !values.every(Boolean)) {
    return 'Alle Checklistenpunkte müssen bestätigt sein.';
  }
  return undefined;
}

export function validateActivationDeviations(
  deviations: OfferActivationDeviation[],
): string | undefined {
  if (deviations.some((entry) => !entry.reason.trim())) {
    return 'Abweichungen benötigen eine Begründung.';
  }
  return undefined;
}

export function validateCounselingPrinciples(principles: CounselingPrincipleFlags): string | undefined {
  const missing = COUNSELING_PRINCIPLE_KEYS.filter((key) => !principles[key]);
  if (missing.length > 0) {
    return 'Alle Beratungsgrundsätze müssen bestätigt sein.';
  }
  return undefined;
}

export function validateOfferFollowUpPreferences(
  preferences: OfferFollowUpPreferences,
): string | undefined {
  if (preferences.noFollowUpDesired) {
    return undefined;
  }
  if (!preferences.followUpDate?.trim()) {
    return 'Bitte geben Sie ein Nachfassdatum an oder wählen Sie „Kein Nachfassen gewünscht“.';
  }
  return undefined;
}
