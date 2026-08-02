import type { BestPayHandoff } from './bestPayHandoff';
import type { OfferCustomerAcceptance } from './offerCustomerAcceptance';
import type { OfferCustomerStatus } from './offerCustomerStatus';
import type { OfferShare } from './offerShare';
import type { OfferVersionApprovalStatus } from './offerVersionApprovalStatus';
import type { OfferVersion } from './offerVersion';
import type { OfferApproval } from './offerWorkflowEvents';
import type { OfferWorkflowStatus } from './offerWorkflow';

export interface OfferVersionHistoryEntry {
  versionId: string;
  offerId: string;
  versionNumber: number;
  workflowStatus: OfferWorkflowStatus;
  customerStatus: OfferCustomerStatus;
  approvalStatus: OfferVersionApprovalStatus;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  supersededAt: string | null;
  isCurrent: boolean;
}

export interface OfferVersionLifecycleContext {
  version: OfferVersion;
  isCurrent: boolean;
  approvals: OfferApproval[];
  shares: OfferShare[];
  acceptances: OfferCustomerAcceptance[];
  handoffs: BestPayHandoff[];
  hasOpenInquiry?: boolean;
  hasOpenChangeRequest?: boolean;
}

export function deriveOfferVersionApprovalStatus(
  version: OfferVersion,
  approvals: OfferApproval[],
): OfferVersionApprovalStatus {
  if (!version.snapshot.approvalRequired) {
    return version.approvedAt ? 'approved' : 'not_required';
  }

  const versionApprovals = approvals
    .filter((entry) => entry.offerVersionId === version.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (versionApprovals.some((entry) => entry.status === 'approved') || version.approvedAt) {
    return 'approved';
  }
  if (versionApprovals.some((entry) => entry.status === 'changes_requested')) {
    return 'changes_requested';
  }
  if (versionApprovals.some((entry) => entry.status === 'started')) {
    return 'in_review';
  }
  if (versionApprovals.some((entry) => entry.status === 'submitted')) {
    return 'submitted';
  }

  switch (version.workflowStatus) {
    case 'approval_required':
      return 'pending';
    case 'in_approval':
      return 'in_review';
    case 'changes_requested':
      return 'changes_requested';
    case 'approved':
    case 'ready_to_send':
    case 'sent':
    case 'accepted':
    case 'activation_pending':
    case 'activated':
    case 'released':
    case 'accounted':
    case 'paid':
      return 'approved';
    default:
      return 'pending';
  }
}

export function deriveOfferCustomerStatus(
  context: OfferVersionLifecycleContext,
): OfferCustomerStatus {
  const { version, acceptances, handoffs, shares } = context;
  const workflow = version.workflowStatus;

  if (workflow === 'cancelled') {
    return version.declinedAt ? 'declined' : 'completed';
  }
  if (workflow === 'declined') {
    return 'declined';
  }
  if (workflow === 'expired') {
    return 'declined';
  }

  const handoff = handoffs.find((entry) => entry.offerVersionId === version.id);
  if (handoff && handoff.status !== 'rejected' && handoff.status !== 'error') {
    if (handoff.status === 'accepted') {
      return 'completed';
    }
    return 'handed_to_bestpay';
  }

  if (
    workflow === 'activated' ||
    workflow === 'released' ||
    workflow === 'accounted' ||
    workflow === 'paid'
  ) {
    return 'completed';
  }

  const acceptance = acceptances.find((entry) => entry.offerVersionId === version.id);
  if (acceptance || workflow === 'accepted' || workflow === 'activation_pending') {
    return handoff ? 'handed_to_bestpay' : 'accepted';
  }

  if (context.hasOpenChangeRequest || workflow === 'changes_requested') {
    return 'change_requested';
  }
  if (context.hasOpenInquiry) {
    return 'inquiry';
  }

  const activeShare = shares.find(
    (entry) =>
      entry.offerVersionId === version.id &&
      (entry.status === 'active' || entry.status === 'superseded'),
  );
  if (workflow === 'sent' || activeShare) {
    return 'with_customer';
  }

  if (
    workflow === 'approved' ||
    workflow === 'ready_to_send'
  ) {
    return 'approved';
  }

  if (
    workflow === 'approval_required' ||
    workflow === 'in_approval'
  ) {
    return 'in_review';
  }

  return 'draft';
}

export function buildOfferVersionHistoryEntry(
  context: OfferVersionLifecycleContext,
): OfferVersionHistoryEntry {
  const { version, isCurrent, approvals } = context;
  return {
    versionId: version.id,
    offerId: version.offerId,
    versionNumber: version.versionNumber,
    workflowStatus: version.workflowStatus,
    customerStatus: deriveOfferCustomerStatus(context),
    approvalStatus: deriveOfferVersionApprovalStatus(version, approvals),
    createdAt: version.createdAt,
    createdByUserId: version.createdByUserId,
    createdByDisplayName: version.createdByDisplayName,
    approvedAt: version.approvedAt,
    approvedByUserId: version.approvedByUserId,
    sentAt: version.sentAt,
    acceptedAt: version.acceptedAt,
    declinedAt: version.declinedAt,
    supersededAt: version.supersededAt,
    isCurrent,
  };
}

export function buildOfferVersionHistory(
  versions: OfferVersion[],
  currentVersionId: string | null,
  approvals: OfferApproval[],
  shares: OfferShare[] = [],
  acceptances: OfferCustomerAcceptance[] = [],
  handoffs: BestPayHandoff[] = [],
): OfferVersionHistoryEntry[] {
  return versions
    .slice()
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map((version) =>
      buildOfferVersionHistoryEntry({
        version,
        isCurrent: version.id === currentVersionId && version.supersededAt === null,
        approvals,
        shares: shares.filter((entry) => entry.offerVersionId === version.id),
        acceptances: acceptances.filter((entry) => entry.offerVersionId === version.id),
        handoffs: handoffs.filter((entry) => entry.offerVersionId === version.id),
      }),
    );
}

export function getNextOfferVersionNumber(versions: OfferVersion[]): number {
  if (versions.length === 0) {
    return 1;
  }
  return Math.max(...versions.map((entry) => entry.versionNumber)) + 1;
}
