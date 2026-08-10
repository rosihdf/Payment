import type { Offer } from './offer';
import type { OfferVersion } from './offerVersion';
import { validateOfferVersionSnapshot } from './offerVersionSnapshotValidation';
import type { OfferWorkflowStatus } from './offerWorkflow';
import {
  canCreateInitialFinalDocument,
  canRegenerateFinalDocument,
  isLegacyCompletedDocumentOffer,
} from '../offerDocument/finalDocumentGate';

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

export type OfferPublicationBlocker =
  | 'missing_current_version'
  | 'version_incomplete'
  | 'pricing_stale'
  | 'recommendation_stale'
  | 'approval_missing'
  | 'approval_in_progress'
  | 'changes_requested'
  | 'workflow_not_ready'
  | 'counseling_not_confirmed'
  | 'document_missing'
  | 'document_wrong_version'
  | 'document_integrity_invalid'
  | 'offer_cancelled'
  | 'terminal_status_incompatible';

export type OfferPublicationWarning =
  | 'approval_deviation'
  | 'legacy_document_path';

export const OFFER_PUBLICATION_BLOCKER_MESSAGES: Record<OfferPublicationBlocker, string> = {
  missing_current_version: 'Aktuelle Angebotsversion fehlt oder ist nicht mehr aktiv.',
  version_incomplete: 'Die Angebotsversion ist unvollständig.',
  pricing_stale: 'Pricing-Bewertung ist veraltet und muss aktualisiert werden.',
  recommendation_stale: 'Empfehlung ist veraltet und muss aktualisiert werden.',
  approval_missing: 'Freigabe für genau diese Angebotsversion fehlt.',
  approval_in_progress: 'Freigabe läuft noch – Kundenvorlage ist noch nicht möglich.',
  changes_requested: 'Änderungen wurden angefordert – Kundenvorlage ist gesperrt.',
  workflow_not_ready: 'Workflow-Status erlaubt keine Kundenvorlage.',
  counseling_not_confirmed:
    'Beratungsgrundsätze sind für diese Angebotsversion nicht bestätigt.',
  document_missing: 'Es fehlt ein finales PDF für die aktuelle Angebotsversion.',
  document_wrong_version: 'Das vorhandene PDF gehört nicht zur aktuellen Angebotsversion.',
  document_integrity_invalid: 'Das finale PDF ist beschädigt oder manipuliert.',
  offer_cancelled: 'Stornierte Angebote können nicht an Kunden übergeben werden.',
  terminal_status_incompatible: 'Der aktuelle Workflow-Status erlaubt keine Kundenvorlage.',
};

export const OFFER_PUBLICATION_WARNING_MESSAGES: Record<OfferPublicationWarning, string> = {
  approval_deviation: 'Freigabe weicht von der Standardempfehlung ab.',
  legacy_document_path: 'Legacy-Angebot ohne eingefrorenen Commercial Snapshot.',
};

export interface OfferPublicationReadiness {
  offerId: string;
  /** Primärer Alias für currentVersionId – eine Versionswahrheit für Handoff/Publication. */
  offerVersionId: string | null;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  documentId: string | null;
  hasCurrentVersion: boolean;
  versionComplete: boolean;
  pricingCurrent: boolean;
  recommendationCurrent: boolean;
  counselingConfirmed: boolean;
  approvalRequired: boolean;
  approvalPresentForVersion: boolean;
  approvalSatisfied: boolean;
  documentReady: boolean;
  /** Freigegeben / ready_to_send + Version/Freigabe/Pricing ok (ohne Counseling). */
  readyForCustomerTemplate: boolean;
  /** Kundenvorlage inkl. bestätigter Beratungsgrundsätze (Versand / Share). */
  publicationAllowed: boolean;
  /** Alias für publicationAllowed – zentrale Freigabe für Kundenübergabe. */
  allowed: boolean;
  shareAllowed: boolean;
  sendAllowed: boolean;
  pdfCreateAllowed: boolean;
  pdfRegenerateAllowed: boolean;
  presentationGroup: OfferPresentationGroup;
  blockers: OfferPublicationBlocker[];
  blockerMessages: string[];
  warnings: OfferPublicationWarning[];
  warningMessages: string[];
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
  currentGeneratedDocument?: {
    id: string;
    offerVersionId: string;
    integrityValid?: boolean;
  } | null;
  staleDocumentForOtherVersion?: boolean;
}

export function primaryPublicationBlockerMessage(
  readiness: Pick<OfferPublicationReadiness, 'blockerMessages'>,
): string | null {
  return readiness.blockerMessages[0] ?? null;
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

function pushBlocker(
  codes: OfferPublicationBlocker[],
  messages: string[],
  code: OfferPublicationBlocker,
  message = OFFER_PUBLICATION_BLOCKER_MESSAGES[code],
): void {
  if (!codes.includes(code)) {
    codes.push(code);
    messages.push(message);
  }
}

function documentReadyCandidate(input: OfferPublicationReadinessInput): boolean {
  const versionId = input.version?.id ?? input.offer.currentVersionId;
  return Boolean(
    input.currentGeneratedDocument &&
      versionId &&
      input.currentGeneratedDocument.offerVersionId === versionId,
  );
}

function pushWarning(
  codes: OfferPublicationWarning[],
  messages: string[],
  code: OfferPublicationWarning,
  message = OFFER_PUBLICATION_WARNING_MESSAGES[code],
): void {
  if (!codes.includes(code)) {
    codes.push(code);
    messages.push(message);
  }
}

function resolvePublicationBlockers(input: OfferPublicationReadinessInput): {
  codes: OfferPublicationBlocker[];
  messages: string[];
  versionComplete: boolean;
  versionIssues: string[];
} {
  const { offer, version } = input;
  const codes: OfferPublicationBlocker[] = [];
  const messages: string[] = [];
  const versionValidation = version
    ? validateOfferVersionSnapshot(version.snapshot)
    : { valid: false, issues: ['Aktuelle Angebotsversion fehlt.'] };

  const hasCurrentVersion = Boolean(
    version &&
      offer.currentVersionId === version.id &&
      version.supersededAt === null,
  );
  if (!hasCurrentVersion) {
    pushBlocker(codes, messages, 'missing_current_version');
  }

  const versionComplete = versionValidation.valid;
  if (!versionComplete) {
    pushBlocker(codes, messages, 'version_incomplete');
    if (versionValidation.issues[0]) {
      messages[messages.length - 1] = versionValidation.issues[0];
    }
  }

  if (input.pricingStale) {
    pushBlocker(codes, messages, 'pricing_stale');
  }

  if (input.recommendationStale) {
    pushBlocker(codes, messages, 'recommendation_stale');
  }

  if (offer.workflowStatus === 'cancelled' || offer.status === 'cancelled') {
    pushBlocker(codes, messages, 'offer_cancelled');
  }

  if (offer.workflowStatus === 'changes_requested') {
    pushBlocker(codes, messages, 'changes_requested');
  } else if (
    offer.workflowStatus === 'approval_required' ||
    offer.workflowStatus === 'in_approval'
  ) {
    pushBlocker(codes, messages, 'approval_in_progress');
  }

  if (input.approvalRequired && !input.hasApprovalForVersion) {
    pushBlocker(codes, messages, 'approval_missing');
  }

  if (input.staleDocumentForOtherVersion) {
    pushBlocker(codes, messages, 'document_wrong_version');
  }

  if (isBlockedFromCustomerTemplate(offer.workflowStatus)) {
    if (
      offer.workflowStatus !== 'changes_requested' &&
      offer.workflowStatus !== 'approval_required' &&
      offer.workflowStatus !== 'in_approval' &&
      offer.workflowStatus !== 'cancelled'
    ) {
      pushBlocker(codes, messages, 'workflow_not_ready');
    }
  } else if (
    offer.workflowStatus !== 'approved' &&
    offer.workflowStatus !== 'ready_to_send' &&
    offer.workflowStatus !== 'sent'
  ) {
    pushBlocker(codes, messages, 'workflow_not_ready');
  }

  return { codes, messages, versionComplete, versionIssues: versionValidation.issues };
}

/**
 * Zentrale Ableitung für Kundenvorlage / Versand / Share-Link / Final-PDF.
 * Keine zweite Freigabewahrheit – nutzt versionsbezogene Freigabe + bestehende Checks.
 */
export function evaluateOfferPublicationReadiness(
  input: OfferPublicationReadinessInput,
): OfferPublicationReadiness {
  const { offer, version } = input;
  const { codes, messages, versionComplete, versionIssues } = resolvePublicationBlockers(input);

  const hasCurrentVersion = Boolean(
    version &&
      offer.currentVersionId === version.id &&
      version.supersededAt === null,
  );
  const pricingCurrent = !input.pricingStale;
  const recommendationCurrent = !input.recommendationStale;
  const approvalSatisfied = !input.approvalRequired || input.hasApprovalForVersion;
  const statusReady =
    offer.workflowStatus === 'approved' || offer.workflowStatus === 'ready_to_send';

  const readyForCustomerTemplate =
    hasCurrentVersion &&
    versionComplete &&
    pricingCurrent &&
    recommendationCurrent &&
    approvalSatisfied &&
    statusReady;

  if (!input.hasCounselingConfirmation && readyForCustomerTemplate) {
    pushBlocker(codes, messages, 'counseling_not_confirmed');
  }

  const legacyDocumentPath = isLegacyCompletedDocumentOffer(offer);
  if (
    readyForCustomerTemplate &&
    input.hasCounselingConfirmation &&
    !legacyDocumentPath &&
    !documentReadyCandidate(input)
  ) {
    pushBlocker(codes, messages, 'document_missing');
  }

  if (
    input.currentGeneratedDocument &&
    input.currentGeneratedDocument.integrityValid === false
  ) {
    pushBlocker(codes, messages, 'document_integrity_invalid');
  }

  const handoffReady =
    readyForCustomerTemplate &&
    input.hasCounselingConfirmation &&
    (legacyDocumentPath || documentReadyCandidate(input)) &&
    !input.staleDocumentForOtherVersion &&
    input.currentGeneratedDocument?.integrityValid !== false;

  const publicationAllowed = handoffReady;
  const offerVersionId = version?.id ?? offer.currentVersionId;
  const documentReady = Boolean(
    input.currentGeneratedDocument &&
      offerVersionId &&
      input.currentGeneratedDocument.offerVersionId === offerVersionId,
  );
  const documentId = documentReady ? input.currentGeneratedDocument!.id : null;

  const warnings: OfferPublicationWarning[] = [];
  const warningMessages: string[] = [];

  if ((input.deviations?.length ?? 0) > 0) {
    pushWarning(warnings, warningMessages, 'approval_deviation');
  }
  if (legacyDocumentPath) {
    pushWarning(warnings, warningMessages, 'legacy_document_path');
  }

  const pdfCreateAllowed =
    offer.status !== 'cancelled' &&
    offer.workflowStatus !== 'cancelled' &&
    (legacyDocumentPath ||
      (canCreateInitialFinalDocument(offer.workflowStatus) &&
        readyForCustomerTemplate &&
        input.hasCounselingConfirmation));
  const pdfRegenerateAllowed =
    offer.status !== 'cancelled' &&
    offer.workflowStatus !== 'cancelled' &&
    (legacyDocumentPath || canRegenerateFinalDocument(offer.workflowStatus));

  const visibleBlockers = publicationAllowed
    ? { blockers: [] as OfferPublicationBlocker[], blockerMessages: [] as string[] }
    : {
        blockers: codes.filter((code) => code !== 'counseling_not_confirmed'),
        blockerMessages: messages.filter(
          (_, index) => codes[index] !== 'counseling_not_confirmed',
        ),
      };

  if (!publicationAllowed && readyForCustomerTemplate && !input.hasCounselingConfirmation) {
    visibleBlockers.blockers = ['counseling_not_confirmed'];
    visibleBlockers.blockerMessages = [OFFER_PUBLICATION_BLOCKER_MESSAGES.counseling_not_confirmed];
  }

  return {
    offerId: offer.id,
    offerVersionId,
    currentVersionId: offerVersionId,
    currentVersionNumber: version?.versionNumber ?? (offer.currentVersionNumber || null),
    documentId,
    hasCurrentVersion,
    versionComplete,
    pricingCurrent,
    recommendationCurrent,
    counselingConfirmed: input.hasCounselingConfirmation,
    approvalRequired: input.approvalRequired,
    approvalPresentForVersion: input.hasApprovalForVersion,
    approvalSatisfied,
    documentReady,
    readyForCustomerTemplate,
    publicationAllowed,
    allowed: publicationAllowed,
    shareAllowed: publicationAllowed,
    sendAllowed: publicationAllowed,
    pdfCreateAllowed,
    pdfRegenerateAllowed,
    presentationGroup: deriveOfferPresentationGroup(offer.workflowStatus),
    blockers: visibleBlockers.blockers,
    blockerMessages: visibleBlockers.blockerMessages,
    warnings,
    warningMessages,
    deviations: input.deviations ?? [],
    versionIssues,
  };
}
