import type { BestPayComparisonSession } from '../bestPayComparison/bestPayComparisonSession';
import type { CommissionCaseStatus } from '../commission/commissionCase';
import type { Lead, LeadStatus } from '../lead/lead';
import type { Offer, OfferStatus } from '../offer/offer';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';
import { SALES_WIZARD_NEW_PATH, salesWizardSessionPath } from '../../utils/routes';
import type { SalesActivity } from './salesActivity';
import type { SalesTask } from './salesTask';

export type SalesPipelinePhase =
  | 'new'
  | 'contact'
  | 'billing'
  | 'calculation'
  | 'offer'
  | 'approval'
  | 'follow_up'
  | 'accepted'
  | 'activation'
  | 'accounted'
  | 'won'
  | 'lost';

export const SALES_PIPELINE_PHASES: SalesPipelinePhase[] = [
  'new',
  'contact',
  'billing',
  'calculation',
  'offer',
  'approval',
  'follow_up',
  'accepted',
  'activation',
  'accounted',
  'won',
  'lost',
];

export const SALES_PIPELINE_PHASE_LABELS: Record<SalesPipelinePhase, string> = {
  new: 'Neu',
  contact: 'Kontakt',
  billing: 'Abrechnung',
  calculation: 'Berechnung',
  offer: 'Angebot',
  approval: 'Freigabe',
  follow_up: 'Nachfassen',
  accepted: 'Angenommen',
  activation: 'Aktivierung',
  accounted: 'Abgerechnet',
  won: 'Gewonnen',
  lost: 'Verloren',
};

export const SALES_PIPELINE_PHASE_ORDER: Record<SalesPipelinePhase, number> = {
  new: 1,
  contact: 2,
  billing: 3,
  calculation: 4,
  offer: 5,
  approval: 6,
  follow_up: 7,
  accepted: 8,
  activation: 9,
  accounted: 10,
  won: 11,
  lost: 12,
};

export const SALES_PIPELINE_DEFAULT_ACTION: Record<SalesPipelinePhase, string> = {
  new: 'Kontakt dokumentieren',
  contact: 'Abrechnung anfordern',
  billing: 'Abrechnung prüfen',
  calculation: 'Vorgang fortsetzen',
  offer: 'Angebot öffnen',
  approval: 'Freigabe prüfen',
  follow_up: 'Nachfassen dokumentieren',
  accepted: 'Aktivierung prüfen',
  activation: 'Aktivierung prüfen',
  accounted: 'Provision prüfen',
  won: 'Lead öffnen',
  lost: 'Lead öffnen',
};

export interface SalesPipelineFacts {
  lead: Lead | null;
  sessions: BestPayComparisonSession[];
  offers: Offer[];
  tasks: SalesTask[];
  activities: SalesActivity[];
  /** Highest commission case status for related offers, if any */
  commissionCaseStatus: CommissionCaseStatus | null;
  /** Approval required on selected/latest draft offer or wizard scenario */
  approvalRequired: boolean;
  approvalBlocked: boolean;
}

function maxPhase(left: SalesPipelinePhase, right: SalesPipelinePhase): SalesPipelinePhase {
  if (left === 'lost' || right === 'lost') {
    return 'lost';
  }
  return SALES_PIPELINE_PHASE_ORDER[left] >= SALES_PIPELINE_PHASE_ORDER[right] ? left : right;
}

function phaseFromLeadStatus(status: LeadStatus): SalesPipelinePhase | null {
  switch (status) {
    case 'new':
      return 'new';
    case 'contacted':
    case 'in_progress':
      return 'contact';
    case 'offer':
      return 'offer';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    default:
      return null;
  }
}

function phaseFromOfferStatus(status: OfferStatus): SalesPipelinePhase | null {
  switch (status) {
    case 'draft':
      return 'offer';
    case 'completed':
      return 'accepted';
    case 'cancelled':
      return 'lost';
    default:
      return null;
  }
}

function phaseFromWorkflowStatus(status: OfferWorkflowStatus): SalesPipelinePhase {
  if (['approval_required', 'in_approval', 'changes_requested'].includes(status)) return 'approval';
  if (['approved', 'ready_to_send', 'draft'].includes(status)) return 'offer';
  if (['sent', 'expired'].includes(status)) return 'follow_up';
  if (status === 'accepted') return 'accepted';
  if (['activation_pending', 'activated'].includes(status)) return 'activation';
  if (['released', 'accounted'].includes(status)) return 'accounted';
  if (status === 'paid') return 'won';
  return 'lost';
}

function phaseFromCommission(status: CommissionCaseStatus | null): SalesPipelinePhase | null {
  if (!status) {
    return null;
  }
  switch (status) {
    case 'expected':
    case 'reserved':
      return 'activation';
    case 'released':
    case 'settled':
      return 'accounted';
    case 'partially_paid':
    case 'paid':
      return 'won';
    case 'cancelled':
    case 'clawed_back':
      return 'lost';
    case 'corrected':
      return 'accounted';
    default:
      return null;
  }
}

/**
 * Deterministic pipeline phase from existing facts.
 * Never invents a parallel OfferStatus; uses OfferStatus + commission + activities + tasks.
 */
export function deriveSalesPipelinePhase(facts: SalesPipelineFacts): SalesPipelinePhase {
  const { lead, sessions, offers, tasks, activities, commissionCaseStatus, approvalRequired } =
    facts;

  if (
    lead?.status === 'lost' ||
    offers.some((offer) => offer.status === 'cancelled' || offer.workflowStatus === 'cancelled')
  ) {
    if (lead?.status === 'won') {
      return 'won';
    }
    return 'lost';
  }

  let phase: SalesPipelinePhase = lead ? (phaseFromLeadStatus(lead.status) ?? 'new') : 'calculation';

  const activeSessions = sessions.filter(
    (session) => session.status !== 'discarded' && !session.archivedAt,
  );
  const hasBilling = activeSessions.some(
    (session) =>
      Boolean(session.billingImportSessionId) ||
      session.status === 'billing_import' ||
      session.status === 'review_required' ||
      Boolean(session.costBaselineId),
  );
  const hasCalculation = activeSessions.some(
    (session) =>
      Boolean(session.result) ||
      session.status === 'calculated' ||
      session.status === 'recommendation_selected' ||
      session.status === 'offer_created' ||
      (session.wizard.enabled &&
        ['need', 'variants', 'offer', 'approval', 'closing'].includes(session.wizard.currentStep)),
  );
  const draftOffers = offers.filter((offer) => offer.status === 'draft');
  const completedOffers = offers.filter((offer) => offer.status === 'completed');
  const openFollowUp = tasks.some(
    (task) =>
      (task.status === 'open' || task.status === 'in_progress') &&
      (task.type === 'follow_up_offer' || task.type === 'callback'),
  );
  const hasOfferSentActivity = activities.some((activity) => activity.type === 'offer_sent');
  const hasContactSignal =
    Boolean(lead && (lead.status === 'contacted' || lead.status === 'in_progress')) ||
    activities.some((activity) =>
      ['call', 'email', 'meeting', 'note', 'status_change'].includes(activity.type),
    );

  if (hasContactSignal) {
    phase = maxPhase(phase, 'contact');
  }
  if (hasBilling) {
    phase = maxPhase(phase, 'billing');
  }
  if (hasCalculation) {
    phase = maxPhase(phase, 'calculation');
  }
  if (draftOffers.length > 0 || offers.length > 0) {
    phase = maxPhase(phase, 'offer');
  }
  if (draftOffers.length > 0 && (approvalRequired || facts.approvalBlocked)) {
    phase = maxPhase(phase, 'approval');
  }
  if (hasOfferSentActivity || openFollowUp) {
    phase = maxPhase(phase, 'follow_up');
  }
  for (const offer of offers) {
    const offerPhase = offer.workflowStatus
      ? phaseFromWorkflowStatus(offer.workflowStatus)
      : phaseFromOfferStatus(offer.status);
    if (offerPhase) {
      phase = maxPhase(phase, offerPhase);
    }
  }
  if (completedOffers.length > 0) {
    phase = maxPhase(phase, 'accepted');
  }

  const commissionPhase = phaseFromCommission(commissionCaseStatus);
  if (commissionPhase) {
    phase = maxPhase(phase, commissionPhase);
  }

  if (lead?.status === 'won') {
    phase = 'won';
  }

  return phase;
}

export function resolvePrimaryNextAction(phase: SalesPipelinePhase, facts: SalesPipelineFacts): {
  label: string;
  href: string | null;
} {
  const latestSession =
    [...facts.sessions]
      .filter((session) => session.status !== 'discarded')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const latestOffer =
    [...facts.offers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ??
    null;
  const openTask =
    facts.tasks
      .filter((task) => task.status === 'open' || task.status === 'in_progress')
      .sort((left, right) => (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999'))[0] ??
    null;

  switch (phase) {
    case 'new':
    case 'contact':
      return {
        label: SALES_PIPELINE_DEFAULT_ACTION[phase],
        href: facts.lead ? `/leads/${facts.lead.id}` : '/sales',
      };
    case 'billing':
      return {
        label: 'Abrechnung prüfen',
        href: latestSession
          ? latestSession.entryMode === 'wizard' || latestSession.wizard.enabled
            ? salesWizardSessionPath(latestSession.id)
            : `/calculator/bestpay?session=${latestSession.id}`
          : SALES_WIZARD_NEW_PATH,
      };
    case 'calculation':
      return {
        label: 'Vorgang fortsetzen',
        href: latestSession ? salesWizardSessionPath(latestSession.id) : SALES_WIZARD_NEW_PATH,
      };
    case 'offer':
    case 'approval':
    case 'follow_up':
    case 'accepted':
    case 'activation':
    case 'accounted':
      return {
        label: SALES_PIPELINE_DEFAULT_ACTION[phase],
        href: latestOffer ? `/offers/${latestOffer.id}` : facts.lead ? `/leads/${facts.lead.id}` : '/sales',
      };
    case 'won':
    case 'lost':
      return {
        label: 'Lead öffnen',
        href: facts.lead ? `/leads/${facts.lead.id}` : latestOffer ? `/offers/${latestOffer.id}` : '/sales',
      };
    default:
      return {
        label: openTask ? openTask.title : 'Vertrieb öffnen',
        href: facts.lead ? `/leads/${facts.lead.id}` : '/sales',
      };
  }
}
