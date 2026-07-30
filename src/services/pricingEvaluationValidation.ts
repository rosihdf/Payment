import type { PricingEvaluationInput } from '../domain/pricing/pricingEvaluation';

export interface PricingEvaluationValidationErrors {
  evaluationDate?: string;
  salesRepresentativeId?: string;
  currency?: string;
  quantity?: string;
  requestedSpecialTermMonths?: string;
  specialTermReason?: string;
  overrideReason?: string;
}

export function validatePricingEvaluationInput(
  input: PricingEvaluationInput,
): PricingEvaluationValidationErrors {
  const errors: PricingEvaluationValidationErrors = {};

  if (!input.evaluationDate.trim()) {
    errors.evaluationDate = 'Stichtag ist erforderlich.';
  }

  if (!input.salesRepresentativeId.trim()) {
    errors.salesRepresentativeId = 'Außendienstmitarbeiter ist erforderlich.';
  }

  if (!input.currency.trim()) {
    errors.currency = 'Währung ist erforderlich.';
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    errors.quantity = 'Menge muss mindestens 1 sein.';
  }

  if (
    input.requestedSpecialTermMonths !== null &&
    (!Number.isInteger(input.requestedSpecialTermMonths) || input.requestedSpecialTermMonths < 1)
  ) {
    errors.requestedSpecialTermMonths = 'Sonderlaufzeit muss eine positive ganze Monatszahl sein.';
  }

  if (input.requestedSpecialTermMonths !== null && !input.specialTermReason.trim()) {
    errors.specialTermReason = 'Sonderlaufzeit benötigt eine Begründung.';
  }

  if (input.manualPriceOverride && !input.overrideReason.trim()) {
    errors.overrideReason = 'Manuelle Preisabweichung benötigt eine Begründung.';
  }

  return errors;
}

export function hasPricingEvaluationValidationErrors(
  errors: PricingEvaluationValidationErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
