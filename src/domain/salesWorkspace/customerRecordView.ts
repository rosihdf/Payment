import type { BestPayComparisonSession } from '../bestPayComparison/bestPayComparisonSession';
import { isActiveAdviceDraft } from '../bestPayComparison/isActiveAdviceDraft';
import type { ContractStatus } from '../contract/contractStatus';
import type { Lead } from '../lead/lead';
import type { Offer } from '../offer/offer';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';
import type { ActivationStatus } from '../activation/activationStatus';
import { salesWizardSessionPath } from '../../utils/routes';
import type { SalesTask } from './salesTask';

/** Verständlicher Gesamtstand in der Kundenakte (keine Persistenz). */
export type CustomerStand =
  | 'new'
  | 'advice'
  | 'offer_review'
  | 'approval_required'
  | 'contract'
  | 'activation'
  | 'live'
  | 'completed'
  | 'lost';

export const CUSTOMER_STAND_LABELS: Record<CustomerStand, string> = {
  new: 'Neu',
  advice: 'Beratung',
  offer_review: 'Angebot wird geprüft',
  approval_required: 'Freigabe erforderlich',
  contract: 'Vertrag',
  activation: 'Aktivierung',
  live: 'Produktiv',
  completed: 'Abgeschlossen',
  lost: 'Verloren',
};

export interface CustomerRecordContractFact {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  startDate: string | null;
  endDate: string | null;
  tariffName: string | null;
}

export interface CustomerRecordActivationFact {
  id: string;
  activationNumber: string;
  status: ActivationStatus;
  progressPercent: number;
  nextStep: string | null;
  openBlockerCount: number;
  contractId: string;
}

export interface CustomerRecordFacts {
  lead: Lead;
  sessions: BestPayComparisonSession[];
  offers: Offer[];
  contracts: CustomerRecordContractFact[];
  activations: CustomerRecordActivationFact[];
  openTasks: SalesTask[];
  now?: Date;
}

export interface CustomerPrimaryAction {
  label: string;
  href: string | null;
  dueAt: string | null;
  warning: string | null;
  kind:
    | 'blocker'
    | 'overdue_follow_up'
    | 'today_follow_up'
    | 'continue_advice'
    | 'offer_approval'
    | 'offer_prepare'
    | 'offer_follow_up'
    | 'contract'
    | 'start_activation'
    | 'continue_activation'
    | 'go_live'
    | 'none';
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function endOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.getTime();
}

function isOpenTask(task: SalesTask): boolean {
  return task.status === 'open' || task.status === 'in_progress';
}

function sortByDue(tasks: SalesTask[]): SalesTask[] {
  return [...tasks].sort((left, right) => (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999'));
}

export function pickLatestOffer(offers: Offer[]): Offer | null {
  return (
    [...offers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

export function pickLatestSession(sessions: BestPayComparisonSession[]): BestPayComparisonSession | null {
  return (
    [...sessions]
      .filter((session) => session.status !== 'discarded' && !session.archivedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function isIncompleteAdvice(session: BestPayComparisonSession | null): boolean {
  return Boolean(session && isActiveAdviceDraft(session));
}

function offerNeedsApproval(status: OfferWorkflowStatus): boolean {
  return status === 'approval_required' || status === 'in_approval';
}

function offerNeedsPrepare(status: OfferWorkflowStatus): boolean {
  return status === 'draft' || status === 'changes_requested' || status === 'approved' || status === 'ready_to_send';
}

function isAcceptedOffer(status: OfferWorkflowStatus): boolean {
  return ['accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
    status,
  );
}

function isTerminalActivation(status: ActivationStatus): boolean {
  return status === 'completed' || status === 'archived' || status === 'cancelled';
}

/** Reine Ableitung des verständlichen Gesamtstands. */
export function deriveCustomerStand(facts: CustomerRecordFacts): CustomerStand {
  const { lead, offers, contracts, activations, sessions } = facts;
  const offer = pickLatestOffer(offers);
  const activation = activations[0] ?? null;
  const contract = contracts[0] ?? null;
  const session = pickLatestSession(sessions);

  if (lead.status === 'lost' || offer?.workflowStatus === 'declined' || offer?.status === 'cancelled') {
    return 'lost';
  }
  if (activation?.status === 'completed' || activation?.status === 'archived') {
    return 'completed';
  }
  if (activation?.status === 'live' || contract?.status === 'active') {
    return 'live';
  }
  if (activation && !isTerminalActivation(activation.status)) {
    return 'activation';
  }
  if (contract && ['preparation', 'activation'].includes(contract.status)) {
    return 'activation';
  }
  if (offer && isAcceptedOffer(offer.workflowStatus)) {
    return 'contract';
  }
  if (offer && offerNeedsApproval(offer.workflowStatus)) {
    return 'approval_required';
  }
  if (offer && (offer.workflowStatus === 'sent' || offerNeedsPrepare(offer.workflowStatus))) {
    return 'offer_review';
  }
  if (session || lead.status === 'contacted' || lead.status === 'in_progress') {
    return 'advice';
  }
  return 'new';
}

function adviceHref(leadId: string, session: BestPayComparisonSession | null): string {
  if (session && isIncompleteAdvice(session)) {
    return salesWizardSessionPath(session.id);
  }
  // Kanonischer Einstieg: ensureActiveDraftForLead (kein paralleler Anon-Entwurf).
  return `/advice?leadId=${encodeURIComponent(leadId)}`;
}

/**
 * Genau eine sichtbare Hauptaktion – rein abgeleitet, ohne Side Effects.
 * Priorität gemäß Aufräumblock 5.
 */
export function deriveCustomerPrimaryAction(facts: CustomerRecordFacts): CustomerPrimaryAction {
  const now = facts.now ?? new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const leadId = facts.lead.id;
  const offer = pickLatestOffer(facts.offers);
  const session = pickLatestSession(facts.sessions);
  const contract = facts.contracts[0] ?? null;
  const activation = facts.activations[0] ?? null;
  const openTasks = sortByDue(facts.openTasks.filter(isOpenTask));

  const none = (): CustomerPrimaryAction => ({
    label: 'Kein Handlungsbedarf',
    href: null,
    dueAt: null,
    warning: null,
    kind: 'none',
  });

  if (activation && activation.openBlockerCount > 0) {
    return {
      label: 'Blocker bearbeiten',
      href: `/activations/${activation.id}`,
      dueAt: openTasks[0]?.dueAt ?? null,
      warning: `${activation.openBlockerCount} offene Blocker`,
      kind: 'blocker',
    };
  }

  const overdue = openTasks.find((task) => task.dueAt && new Date(task.dueAt).getTime() < dayStart);
  if (overdue) {
    return {
      label: overdue.title || 'Überfällige Wiedervorlage',
      href: `/leads/${leadId}`,
      dueAt: overdue.dueAt,
      warning: 'Überfällig',
      kind: 'overdue_follow_up',
    };
  }

  const dueToday = openTasks.find((task) => {
    if (!task.dueAt) return false;
    const due = new Date(task.dueAt).getTime();
    return due >= dayStart && due <= dayEnd;
  });
  if (dueToday) {
    return {
      label: dueToday.title || 'Wiedervorlage heute',
      href: `/leads/${leadId}`,
      dueAt: dueToday.dueAt,
      warning: null,
      kind: 'today_follow_up',
    };
  }

  if (!offer && isIncompleteAdvice(session)) {
    return {
      label: 'Beratung fortsetzen',
      href: adviceHref(leadId, session),
      dueAt: null,
      warning: null,
      kind: 'continue_advice',
    };
  }

  if (!offer) {
    return {
      label: 'Beratung starten',
      href: adviceHref(leadId, session),
      dueAt: null,
      warning: null,
      kind: 'continue_advice',
    };
  }

  if (offer && offerNeedsApproval(offer.workflowStatus)) {
    return {
      label: 'Angebot intern freigeben lassen',
      href: `/offers/${offer.id}`,
      dueAt: null,
      warning: null,
      kind: 'offer_approval',
    };
  }

  if (offer && offerNeedsPrepare(offer.workflowStatus)) {
    return {
      label: 'Angebot zur Prüfung bereitstellen',
      href: `/offers/${offer.id}`,
      dueAt: null,
      warning: null,
      kind: 'offer_prepare',
    };
  }

  if (offer && offer.workflowStatus === 'sent') {
    return {
      label: 'Bedenkzeit / Nachfassen',
      href: `/offers/${offer.id}`,
      dueAt: facts.lead.nextFollowUpAt,
      warning: null,
      kind: 'offer_follow_up',
    };
  }

  if (offer && isAcceptedOffer(offer.workflowStatus) && !contract) {
    return {
      label: 'Vertrag anlegen',
      href: `/offers/${offer.id}`,
      dueAt: null,
      warning: null,
      kind: 'contract',
    };
  }

  if (contract && !activation && ['preparation', 'activation'].includes(contract.status)) {
    return {
      label: 'Aktivierung starten',
      href: `/contracts/${contract.id}`,
      dueAt: null,
      warning: null,
      kind: 'start_activation',
    };
  }

  if (contract && !activation) {
    return {
      label: 'Vertrag öffnen',
      href: `/contracts/${contract.id}`,
      dueAt: null,
      warning: null,
      kind: 'contract',
    };
  }

  if (activation?.status === 'go_live_ready') {
    return {
      label: 'Go-live prüfen',
      href: `/activations/${activation.id}`,
      dueAt: null,
      warning: null,
      kind: 'go_live',
    };
  }

  if (activation && !isTerminalActivation(activation.status) && activation.status !== 'live') {
    return {
      label: 'Aktivierung fortsetzen',
      href: `/activations/${activation.id}`,
      dueAt: null,
      warning: null,
      kind: 'continue_activation',
    };
  }

  return none();
}
