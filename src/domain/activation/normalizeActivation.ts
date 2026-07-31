import { generateId, nowIso } from '../../utils/id';
import type {
  ActivationApplication,
  ActivationApplicationStatus,
  ActivationApplicationType,
} from './activationApplication';
import { CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION } from './activationApplication';
import type { ActivationBlocker, ActivationBlockerCategory, ActivationBlockerSeverity, ActivationBlockerStatus } from './activationBlocker';
import { CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION } from './activationBlocker';
import type { ActivationCase, ActivationExternalReference, ActivationPriority } from './activationCase';
import { CURRENT_ACTIVATION_CASE_SCHEMA_VERSION } from './activationCase';
import type { ActivationChecklistCategory, ActivationChecklistItem, ActivationChecklistItemStatus } from './activationChecklist';
import { ACTIVATION_CHECKLIST_CATEGORY_ORDER, CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION } from './activationChecklist';
import type { ActivationHardwareAssignment, ActivationHardwareStatus } from './activationHardware';
import { CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION } from './activationHardware';
import { ACTIVATION_STATUSES, type ActivationStatus } from './activationStatus';

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback);
const nullable = (value: unknown): string | null => (text(value) ? text(value) : null);
const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asBoolean = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const ACTIVATION_PRIORITIES: ActivationPriority[] = ['normal', 'high', 'urgent'];
const CHECKLIST_ITEM_STATUSES: ActivationChecklistItemStatus[] = ['open', 'in_progress', 'done', 'not_applicable', 'blocked'];
const APPLICATION_TYPES: ActivationApplicationType[] = ['merchant_setup', 'acquiring', 'terminal_provisioning', 'add_on', 'other'];
const APPLICATION_STATUSES: ActivationApplicationStatus[] = [
  'draft', 'ready', 'submitted', 'inquiry', 'in_review', 'approved', 'rejected', 'cancelled',
];
const HARDWARE_STATUSES: ActivationHardwareStatus[] = [
  'planned', 'ordered', 'assigned', 'shipped', 'delivered', 'setup', 'tested', 'active', 'returned', 'deviation',
];
const HARDWARE_MOBILITY = ['stationary', 'mobile', 'unknown'] as const;
const HARDWARE_ACQUISITION = ['purchase', 'rental', 'unknown'] as const;
const BLOCKER_CATEGORIES: ActivationBlockerCategory[] = [
  'documents', 'application', 'hardware', 'setup', 'test', 'customer', 'provider', 'other',
];
const BLOCKER_SEVERITIES: ActivationBlockerSeverity[] = ['note', 'warning', 'hard'];
const BLOCKER_STATUSES: ActivationBlockerStatus[] = ['open', 'resolved'];

function normalizeExternalReference(value: unknown): ActivationExternalReference | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const reference = text(raw.reference);
  if (!reference) return null;
  return { system: text(raw.system), reference, note: text(raw.note) };
}

export function normalizeActivationCase(value: unknown): ActivationCase | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id);
  const contractId = text(raw.contractId);
  const activationNumber = text(raw.activationNumber);
  if (!id || !contractId || !activationNumber) return null;
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNumber(raw.schemaVersion, CURRENT_ACTIVATION_CASE_SCHEMA_VERSION) || CURRENT_ACTIVATION_CASE_SCHEMA_VERSION,
    activationNumber,
    contractId,
    contractVersionId: text(raw.contractVersionId),
    leadId: nullable(raw.leadId),
    sourceOfferId: nullable(raw.sourceOfferId),
    sourceKey: text(raw.sourceKey) || `contract:${contractId}:initial-activation`,
    status: asEnum<ActivationStatus>(raw.status, ACTIVATION_STATUSES, 'draft'),
    ownerUserId: text(raw.ownerUserId),
    priority: asEnum<ActivationPriority>(raw.priority, ACTIVATION_PRIORITIES, 'normal'),
    plannedStart: nullable(raw.plannedStart),
    desiredGoLive: nullable(raw.desiredGoLive),
    confirmedGoLive: nullable(raw.confirmedGoLive),
    currentStep: text(raw.currentStep),
    progressPercent: Math.min(100, Math.max(0, asNumber(raw.progressPercent, 0))),
    nextStep: nullable(raw.nextStep),
    nextDueAt: nullable(raw.nextDueAt),
    openBlockerCount: Math.max(0, asNumber(raw.openBlockerCount, 0)),
    openMandatoryCount: Math.max(0, asNumber(raw.openMandatoryCount, 0)),
    externalReferences: Array.isArray(raw.externalReferences)
      ? raw.externalReferences.map(normalizeExternalReference).filter((entry): entry is ActivationExternalReference => entry !== null)
      : [],
    templateSnapshotId: nullable(raw.templateSnapshotId),
    templateSnapshotVersion: asNumber(raw.templateSnapshotVersion, 1),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    createdByDisplayName: text(raw.createdByDisplayName),
    updatedAt: text(raw.updatedAt) || timestamp,
    updatedByUserId: text(raw.updatedByUserId) || text(raw.createdByUserId),
    completedAt: nullable(raw.completedAt),
    handedOverAt: nullable(raw.handedOverAt),
    cancelledAt: nullable(raw.cancelledAt),
    blockedFromStatus: raw.blockedFromStatus
      ? asEnum<ActivationStatus>(raw.blockedFromStatus, ACTIVATION_STATUSES, 'preparation')
      : null,
  };
}

export function normalizeActivationCases(values: unknown[]): ActivationCase[] {
  return values
    .map((value) => {
      try {
        return normalizeActivationCase(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ActivationCase => value !== null);
}

export function normalizeActivationChecklistItem(value: unknown): ActivationChecklistItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id) || generateId('activation_checklist');
  const activationId = text(raw.activationId);
  const key = text(raw.key);
  if (!activationId || !key) return null;
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNumber(raw.schemaVersion, CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION) || CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION,
    activationId,
    category: asEnum<ActivationChecklistCategory>(raw.category, ACTIVATION_CHECKLIST_CATEGORY_ORDER, 'stammdaten'),
    key,
    title: text(raw.title),
    description: text(raw.description),
    status: asEnum<ActivationChecklistItemStatus>(raw.status, CHECKLIST_ITEM_STATUSES, 'open'),
    required: asBoolean(raw.required, true),
    evidenceRequired: asBoolean(raw.evidenceRequired, false),
    documentId: nullable(raw.documentId),
    dependsOnKeys: asStringArray(raw.dependsOnKeys),
    sortOrder: asNumber(raw.sortOrder, 0),
    note: text(raw.note),
    sourceKey: text(raw.sourceKey) || `activation:${activationId}:checklist:${key}`,
    completedAt: nullable(raw.completedAt),
    completedByUserId: nullable(raw.completedByUserId),
    createdAt: text(raw.createdAt) || timestamp,
    updatedAt: text(raw.updatedAt) || timestamp,
  };
}

export function normalizeActivationChecklistItems(values: unknown[]): ActivationChecklistItem[] {
  return values
    .map((value) => {
      try {
        return normalizeActivationChecklistItem(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ActivationChecklistItem => value !== null);
}

export function normalizeActivationApplication(value: unknown): ActivationApplication | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id) || generateId('activation_application');
  const activationId = text(raw.activationId);
  if (!activationId) return null;
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNumber(raw.schemaVersion, CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION) || CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION,
    activationId,
    type: asEnum<ActivationApplicationType>(raw.type, APPLICATION_TYPES, 'other'),
    status: asEnum<ActivationApplicationStatus>(raw.status, APPLICATION_STATUSES, 'draft'),
    title: text(raw.title),
    referenceNumber: nullable(raw.referenceNumber),
    submittedAt: nullable(raw.submittedAt),
    submittedByUserId: nullable(raw.submittedByUserId),
    decisionAt: nullable(raw.decisionAt),
    decisionNote: text(raw.decisionNote),
    inquiryNote: text(raw.inquiryNote),
    documentId: nullable(raw.documentId),
    sourceKey: nullable(raw.sourceKey),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    updatedAt: text(raw.updatedAt) || timestamp,
  };
}

export function normalizeActivationApplications(values: unknown[]): ActivationApplication[] {
  return values
    .map((value) => {
      try {
        return normalizeActivationApplication(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ActivationApplication => value !== null);
}

export function normalizeActivationHardware(value: unknown): ActivationHardwareAssignment | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id) || generateId('activation_hardware');
  const activationId = text(raw.activationId);
  const contractHardwareLineKey = text(raw.contractHardwareLineKey);
  if (!activationId) return null;
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNumber(raw.schemaVersion, CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION) || CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION,
    activationId,
    contractHardwareLineKey,
    unitIndex: Math.max(0, asNumber(raw.unitIndex, 0)),
    productId: nullable(raw.productId),
    productName: text(raw.productName),
    model: text(raw.model),
    mobility: asEnum(raw.mobility, HARDWARE_MOBILITY, 'unknown'),
    acquisition: asEnum(raw.acquisition, HARDWARE_ACQUISITION, 'unknown'),
    status: asEnum<ActivationHardwareStatus>(raw.status, HARDWARE_STATUSES, 'planned'),
    serialNumber: nullable(raw.serialNumber),
    orderedAt: nullable(raw.orderedAt),
    orderReference: nullable(raw.orderReference),
    assignedAt: nullable(raw.assignedAt),
    shippedAt: nullable(raw.shippedAt),
    shippingCarrierNote: text(raw.shippingCarrierNote),
    shippingTrackingReference: nullable(raw.shippingTrackingReference),
    deliveryAddressNote: text(raw.deliveryAddressNote),
    deliveredAt: nullable(raw.deliveredAt),
    setupAt: nullable(raw.setupAt),
    testedAt: nullable(raw.testedAt),
    activatedAt: nullable(raw.activatedAt),
    handoverAt: nullable(raw.handoverAt),
    handoverToName: text(raw.handoverToName),
    handoverNote: text(raw.handoverNote),
    note: text(raw.note),
    sourceKey: text(raw.sourceKey) || `activation:${activationId}:hardware:${contractHardwareLineKey}`,
    createdAt: text(raw.createdAt) || timestamp,
    updatedAt: text(raw.updatedAt) || timestamp,
  };
}

export function normalizeActivationHardwareList(values: unknown[]): ActivationHardwareAssignment[] {
  return values
    .map((value) => {
      try {
        return normalizeActivationHardware(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ActivationHardwareAssignment => value !== null);
}

export function normalizeActivationBlocker(value: unknown): ActivationBlocker | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id) || generateId('activation_blocker');
  const activationId = text(raw.activationId);
  if (!activationId) return null;
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNumber(raw.schemaVersion, CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION) || CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION,
    activationId,
    category: asEnum<ActivationBlockerCategory>(raw.category, BLOCKER_CATEGORIES, 'other'),
    severity: asEnum<ActivationBlockerSeverity>(raw.severity, BLOCKER_SEVERITIES, 'warning'),
    status: asEnum<ActivationBlockerStatus>(raw.status, BLOCKER_STATUSES, 'open'),
    title: text(raw.title),
    description: text(raw.description),
    relatedHardwareId: nullable(raw.relatedHardwareId),
    relatedApplicationId: nullable(raw.relatedApplicationId),
    relatedChecklistItemId: nullable(raw.relatedChecklistItemId),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    resolvedAt: nullable(raw.resolvedAt),
    resolvedByUserId: nullable(raw.resolvedByUserId),
    resolutionNote: text(raw.resolutionNote),
  };
}

export function normalizeActivationBlockers(values: unknown[]): ActivationBlocker[] {
  return values
    .map((value) => {
      try {
        return normalizeActivationBlocker(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ActivationBlocker => value !== null);
}
