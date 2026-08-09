import type { Offer } from './offer';
import type { OfferWorkflowStatus } from './offerWorkflow';

export type OfferDraftDeletionBlocker =
  | 'not_admin'
  | 'not_found'
  | 'forbidden'
  | 'workflow_not_draft'
  | 'has_contract'
  | 'has_share_link'
  | 'has_sent_document'
  | 'has_commission_case'
  | 'has_activation';

export interface OfferDraftDeletionDependencies {
  hasContract: boolean;
  hasShareLink: boolean;
  hasGeneratedDocument: boolean;
  hasCommissionCase: boolean;
  hasActivationCase: boolean;
}

export function evaluateOfferDraftDeletion(input: {
  offer: Offer | null;
  isAdmin: boolean;
  canAccess: boolean;
  dependencies: OfferDraftDeletionDependencies;
}): { allowed: true } | { allowed: false; blocker: OfferDraftDeletionBlocker } {
  if (!input.offer) {
    return { allowed: false, blocker: 'not_found' };
  }
  if (!input.isAdmin) {
    return { allowed: false, blocker: 'not_admin' };
  }
  if (!input.canAccess) {
    return { allowed: false, blocker: 'forbidden' };
  }
  if (input.offer.workflowStatus !== 'draft') {
    return { allowed: false, blocker: 'workflow_not_draft' };
  }
  if (input.dependencies.hasContract) {
    return { allowed: false, blocker: 'has_contract' };
  }
  if (input.dependencies.hasShareLink) {
    return { allowed: false, blocker: 'has_share_link' };
  }
  if (input.dependencies.hasGeneratedDocument) {
    return { allowed: false, blocker: 'has_sent_document' };
  }
  if (input.dependencies.hasCommissionCase) {
    return { allowed: false, blocker: 'has_commission_case' };
  }
  if (input.dependencies.hasActivationCase) {
    return { allowed: false, blocker: 'has_activation' };
  }

  return { allowed: true };
}

export function canCancelOfferWorkflow(status: OfferWorkflowStatus): boolean {
  return ![
    'declined',
    'expired',
    'paid',
    'cancelled',
    'activated',
    'released',
    'accounted',
  ].includes(status);
}

export function offerDraftDeletionBlockerMessage(blocker: OfferDraftDeletionBlocker): string {
  switch (blocker) {
    case 'not_admin':
      return 'Nur Administratoren dürfen Entwürfe löschen.';
    case 'not_found':
      return 'Angebot wurde nicht gefunden.';
    case 'forbidden':
      return 'Kein Zugriff auf dieses Angebot.';
    case 'workflow_not_draft':
      return 'Nur reine Entwürfe ohne Workflow-Fortschritt können gelöscht werden.';
    case 'has_contract':
      return 'Angebot mit Vertrag kann nicht gelöscht werden.';
    case 'has_share_link':
      return 'Angebot mit Kundenlink kann nicht gelöscht werden.';
    case 'has_sent_document':
      return 'Angebot mit erzeugtem Dokument kann nicht gelöscht werden.';
    case 'has_commission_case':
      return 'Angebot mit Provisionsfall kann nicht gelöscht werden.';
    case 'has_activation':
      return 'Angebot mit Aktivierung kann nicht gelöscht werden.';
    default:
      return 'Löschen nicht möglich.';
  }
}
