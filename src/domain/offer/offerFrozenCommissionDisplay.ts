import { contractConfigurationLabel } from '../commission/commissionContractConfiguration';
import type { CommissionPlanKind } from '../commission/commissionPlan';
import type { OfferCommercialCommissionSnapshot, OfferCommercialSnapshot } from './offerCommercialSnapshot';
import { OFFER_FROZEN_COMMISSION_SOURCE_LABEL } from './offerDetailCopy';

const COMMISSION_PLAN_KIND_LABELS: Record<CommissionPlanKind, string> = {
  classic: 'Klassisch',
  variable: 'Variabel',
  variable_model_1: 'Variabel Modell 1',
  variable_model_2: 'Variabel Modell 2',
  hybrid: 'Hybrid',
  individual: 'Individuell',
  campaign: 'Kampagne',
};

const COMMISSION_STATUS_LABELS: Record<OfferCommercialCommissionSnapshot['status'], string> = {
  preview: 'Provisionsvorschau',
  complete: 'Berechnung vollständig',
  incomplete: 'Berechnung unvollständig',
  blocked: 'Berechnung blockiert',
  frozen: 'Eingefrorene Berechnung',
};

export interface OfferFrozenCommissionDisplay {
  statusLabel: string;
  calculatedAt: string;
  sourceLabel: string;
  commissionPlanKindLabel: string | null;
  contractConfigurationLabel: string | null;
  contractTermMonths: number | null;
  oneTimeCommissionAmountCents: number;
  accessoryCommissionAmountCents: number;
  provisionalRecurringAmountCents: number;
  confirmedRecurringAmountCents: number;
  finalExpectedCommissionAmountCents: number;
  currency: string;
  recurringComponents: Array<{
    label: string;
    amountCents: number;
    isProvisional: boolean;
  }>;
  provisionalRecurringHint: string | null;
}

export function buildOfferFrozenCommissionDisplay(
  snapshot: OfferCommercialSnapshot,
): OfferFrozenCommissionDisplay | null {
  const commission = snapshot.commission;
  if (!commission) {
    return null;
  }

  const recurringComponents = commission.preview.components
    .filter((component) => component.isPositive && component.totalAmountCents !== 0)
    .map((component) => ({
      label: component.label,
      amountCents: component.totalAmountCents,
      isProvisional: component.isProvisional,
    }));

  return {
    statusLabel: COMMISSION_STATUS_LABELS[commission.status],
    calculatedAt: commission.calculatedAt,
    sourceLabel: OFFER_FROZEN_COMMISSION_SOURCE_LABEL,
    commissionPlanKindLabel: commission.commissionPlanKind
      ? COMMISSION_PLAN_KIND_LABELS[commission.commissionPlanKind]
      : null,
    contractConfigurationLabel: commission.contractConfiguration
      ? contractConfigurationLabel(commission.contractConfiguration)
      : snapshot.identity.contractConfiguration
        ? contractConfigurationLabel(snapshot.identity.contractConfiguration)
        : null,
    contractTermMonths: snapshot.identity.contractTermMonths,
    oneTimeCommissionAmountCents: commission.baseCommissionAmountCents,
    accessoryCommissionAmountCents: commission.accessoryCommissionAmountCents,
    provisionalRecurringAmountCents: commission.provisionalRecurringAmountCents,
    confirmedRecurringAmountCents: commission.confirmedRecurringAmountCents,
    finalExpectedCommissionAmountCents: commission.finalExpectedCommissionAmountCents,
    currency: commission.currency,
    recurringComponents,
    provisionalRecurringHint:
      commission.provisionalRecurringAmountCents > 0
        ? 'Laufende Beteiligungen sind vorläufig und noch nicht abschließend berechenbar.'
        : null,
  };
}
