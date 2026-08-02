import type { Offer } from './offer';
import type { OfferVersion } from './offerVersion';
import { validateOfferVersionSnapshot } from './offerVersionSnapshotValidation';
import type { OfferWorkflowStatus } from './offerWorkflow';

/** Verständliche Statusgruppe für interne Darstellung (keine neue Statuswahrheit). */
export type OfferPresentationGroup =
  | 'draft'
  | 'internal_review'
  | 'changes_required'
  | 'ready_for_customer'
  | 'customer_reviewing'
  | 'accepted'
  | 'closed';

export const OFFER_PRESENTATION_GROUP_LABELS: Record<OfferPresentationGroup, string> = {
  draft: 'Entwurf',
  internal_review: 'Interne Prüfung',
  changes_required: 'Änderung erforderlich',
  ready_for_customer: 'Freigegeben / bereit zur Kundenvorlage',
  customer_reviewing: 'Kunde prüft',
  accepted: 'Angenommen',
  closed: 'Abgelehnt/beendet',
};

export interface OfferPublicationReadiness {
  offerId: string;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  hasCurrentVersion: boolean;
  versionComplete: boolean;
  pricingCurrent: boolean;
  recommendationCurrent: boolean;
  counselingConfirmed: boolean;
  approvalRequired: boolean;
  approvalPresentForVersion: boolean;
  /** Freigegeben / ready_to_send + Version/Freigabe/Pricing ok (ohne Counseling). */
  readyForCustomerTemplate: boolean;
  /** Kundenvorlage inkl. bestätigter Beratungsgrundsätze (Versand / später Share). */
  publicationAllowed: boolean;
  presentationGroup: OfferPresentationGroup;
  blockers: string[];
  deviations: string[];
  versionIssues: string[];
}

export interface OfferPublicationReadinessInput {
  offer: Offer;
  version: OfferVersion | null;
  approvalRequired: boolean;
  hasApprovalForVersion: boolean;
  hasCounselingConfirmation: boolean;
  pricingStale: boolean;
  recommendationStale: boolean;
  deviations?: string[];
}

export function deriveOfferPresentationGroup(
  status: OfferWorkflowStatus,
): OfferPresentationGroup {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'approval_required':
    case 'in_approval':
      return 'internal_review';
    case 'changes_requested':
      return 'changes_required';
    case 'approved':
    case 'ready_to_send':
      return 'ready_for_customer';
    case 'sent':
      return 'customer_reviewing';
    case 'accepted':
    case 'activation_pending':
    case 'activated':
    case 'released':
    case 'accounted':
    case 'paid':
      return 'accepted';
    case 'declined':
    case 'expired':
    case 'cancelled':
      return 'closed';
    default:
      return 'draft';
  }
}

/** Status, für die keine Kundenvorlage zulässig ist. */
export function isBlockedFromCustomerTemplate(status: OfferWorkflowStatus): boolean {
  return (
    status === 'draft' ||
    status === 'approval_required' ||
    status === 'in_approval' ||
    status === 'changes_requested' ||
    status === 'declined' ||
    status === 'expired' ||
    status === 'cancelled'
  );
}

/**
 * Zentrale Ableitung für Kundenvorlage / Versand / späteren Share-Link.
 * Keine zweite Freigabewahrheit – nutzt versionsbezogene Freigabe + bestehende Checks.
 */
export function evaluateOfferPublicationReadiness(
  input: OfferPublicationReadinessInput,
): OfferPublicationReadiness {
  const { offer, version } = input;
  const blockers: string[] = [];
  const versionValidation = version
    ? validateOfferVersionSnapshot(version.snapshot)
    : { valid: false, issues: ['Aktuelle Angebotsversion fehlt.'] };

  const hasCurrentVersion = Boolean(
    version &&
      offer.currentVersionId === version.id &&
      version.supersededAt === null,
  );
  if (!hasCurrentVersion) {
    blockers.push('Aktuelle Angebotsversion fehlt oder ist nicht mehr aktiv.');
  }

  const versionComplete = versionValidation.valid;
  if (!versionComplete) {
    for (const issue of versionValidation.issues) {
      blockers.push(issue);
    }
  }

  const pricingCurrent = !input.pricingStale;
  if (!pricingCurrent) {
    blockers.push('Pricing-Bewertung ist veraltet und muss aktualisiert werden.');
  }

  const recommendationCurrent = !input.recommendationStale;
  if (!recommendationCurrent) {
    blockers.push('Empfehlung ist veraltet und muss aktualisiert werden.');
  }

  if (input.approvalRequired && !input.hasApprovalForVersion) {
    blockers.push('Freigabe für genau diese Angebotsversion fehlt.');
  }

  if (isBlockedFromCustomerTemplate(offer.workflowStatus)) {
    blockers.push('Workflow-Status erlaubt keine Kundenvorlage.');
  } else if (
    offer.workflowStatus !== 'approved' &&
    offer.workflowStatus !== 'ready_to_send'
  ) {
    // z. B. bereits sent/accepted: keine erneute „bereit zur Vorlage“-Ableitung
    if (offer.workflowStatus !== 'sent') {
      blockers.push('Workflow-Status erlaubt keine Kundenvorlage.');
    }
  }

  const statusReady =
    offer.workflowStatus === 'approved' || offer.workflowStatus === 'ready_to_send';

  const readyForCustomerTemplate =
    hasCurrentVersion &&
    versionComplete &&
    pricingCurrent &&
    recommendationCurrent &&
    (!input.approvalRequired || input.hasApprovalForVersion) &&
    statusReady;

  if (!input.hasCounselingConfirmation) {
    blockers.push('Beratungsgrundsätze sind für diese Angebotsversion nicht bestätigt.');
  }

  const publicationAllowed = readyForCustomerTemplate && input.hasCounselingConfirmation;

  return {
    offerId: offer.id,
    currentVersionId: version?.id ?? offer.currentVersionId,
    currentVersionNumber: version?.versionNumber ?? (offer.currentVersionNumber || null),
    hasCurrentVersion,
    versionComplete,
    pricingCurrent,
    recommendationCurrent,
    counselingConfirmed: input.hasCounselingConfirmation,
    approvalRequired: input.approvalRequired,
    approvalPresentForVersion: input.hasApprovalForVersion,
    readyForCustomerTemplate,
    publicationAllowed,
    presentationGroup: deriveOfferPresentationGroup(offer.workflowStatus),
    blockers: publicationAllowed
      ? []
      : readyForCustomerTemplate
        ? ['Beratungsgrundsätze sind für diese Angebotsversion nicht bestätigt.']
        : blockers.filter(
            (entry) =>
              entry !== 'Beratungsgrundsätze sind für diese Angebotsversion nicht bestätigt.',
          ),
    deviations: input.deviations ?? [],
    versionIssues: versionValidation.issues,
  };
}
