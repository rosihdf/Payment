import type { ActivationApplication } from './activationApplication';
import type { ActivationBlocker } from './activationBlocker';
import type { ActivationChecklistItem } from './activationChecklist';
import type { ActivationHardwareAssignment } from './activationHardware';
import type { ActivationStatus } from './activationStatus';

export interface ActivationProgress {
  progressPercent: number;
  openMandatoryCount: number;
  totalMandatoryCount: number;
}

function isItemSatisfied(item: ActivationChecklistItem): boolean {
  return item.status === 'done' || item.status === 'not_applicable';
}

/** Pure, deterministic progress computation based on required checklist items. */
export function computeProgress(checklist: ActivationChecklistItem[]): ActivationProgress {
  const mandatory = checklist.filter((item) => item.required);
  const totalMandatoryCount = mandatory.length;
  const doneMandatory = mandatory.filter(isItemSatisfied).length;
  const openMandatoryCount = totalMandatoryCount - doneMandatory;
  const progressPercent = totalMandatoryCount === 0 ? 0 : Math.round((doneMandatory / totalMandatoryCount) * 100);
  return { progressPercent, openMandatoryCount, totalMandatoryCount };
}

/** Whether an item's dependencies (by key) are all satisfied within the same checklist. */
export function areDependenciesSatisfied(item: ActivationChecklistItem, allItems: ActivationChecklistItem[]): boolean {
  if (item.dependsOnKeys.length === 0) {
    return true;
  }
  const byKey = new Map(allItems.map((entry) => [entry.key, entry]));
  return item.dependsOnKeys.every((key) => {
    const dependency = byKey.get(key);
    return dependency ? isItemSatisfied(dependency) : true;
  });
}

export function findUnmetDependencies(item: ActivationChecklistItem, allItems: ActivationChecklistItem[]): string[] {
  const byKey = new Map(allItems.map((entry) => [entry.key, entry]));
  return item.dependsOnKeys.filter((key) => {
    const dependency = byKey.get(key);
    return dependency ? !isItemSatisfied(dependency) : false;
  });
}

function nextCategoryStep(checklist: ActivationChecklistItem[]): { currentStep: string; nextStep: string | null } {
  const sorted = [...checklist].sort((a, b) => a.sortOrder - b.sortOrder);
  const open = sorted.find((item) => item.required && !isItemSatisfied(item));
  if (!open) {
    return { currentStep: 'Alle Pflichtpunkte erledigt', nextStep: null };
  }
  const upcoming = sorted.find(
    (item) => item.required && !isItemSatisfied(item) && item.sortOrder > open.sortOrder,
  );
  return { currentStep: open.title, nextStep: upcoming?.title ?? null };
}

export function deriveCurrentAndNextStep(checklist: ActivationChecklistItem[]): {
  currentStep: string;
  nextStep: string | null;
} {
  return nextCategoryStep(checklist);
}

/** Suggests the natural next status from current signals. Never mutates, purely advisory. */
export function suggestStatus(
  current: ActivationStatus,
  checklist: ActivationChecklistItem[],
  hardware: ActivationHardwareAssignment[],
  applications: ActivationApplication[],
  hasOpenHardBlocker: boolean,
): ActivationStatus {
  if (current === 'blocked' || current === 'cancelled' || current === 'completed' || current === 'archived' || current === 'live') {
    return current;
  }
  if (hasOpenHardBlocker) {
    return current;
  }

  const byCategory = (category: ActivationChecklistItem['category']) =>
    checklist.filter((item) => item.category === category);

  const stammdatenDone = byCategory('stammdaten').every(isItemSatisfied);
  const vertragspruefungDone = byCategory('vertragspruefung').every(isItemSatisfied);
  const unterlagenDone = byCategory('unterlagen').every(isItemSatisfied);
  const haendlerantragDone = byCategory('haendlerantrag').every(isItemSatisfied);
  const acquiringItems = byCategory('acquiring');
  const acquiringDone = acquiringItems.length === 0 || acquiringItems.every(isItemSatisfied);
  const hardwareItems = byCategory('hardware');
  const hardwareChecklistDone = hardwareItems.length === 0 || hardwareItems.every(isItemSatisfied);
  const versandItems = byCategory('versand');
  const versandDone = versandItems.length === 0 || versandItems.every(isItemSatisfied);
  const einrichtungItems = byCategory('einrichtung');
  const einrichtungDone = einrichtungItems.length === 0 || einrichtungItems.every(isItemSatisfied);
  const testItems = byCategory('test');
  const testDone = testItems.length === 0 || testItems.every(isItemSatisfied);
  const goLiveItems = byCategory('go_live');
  const goLiveDone = goLiveItems.length === 0 || goLiveItems.every(isItemSatisfied);

  const applicationsPending = applications.some(
    (application) => application.status === 'submitted' || application.status === 'inquiry' || application.status === 'in_review',
  );
  const hardwareOutstanding = hardware.some(
    (unit) => unit.status !== 'tested' && unit.status !== 'active' && unit.status !== 'returned',
  );

  if (!stammdatenDone || !vertragspruefungDone) {
    return 'preparation';
  }
  if (!unterlagenDone) {
    return 'documents_pending';
  }
  if (!haendlerantragDone || !acquiringDone) {
    return applicationsPending ? 'provider_review' : 'application_pending';
  }
  if (!hardwareChecklistDone || !versandDone || hardwareOutstanding) {
    return 'hardware_pending';
  }
  if (!einrichtungDone) {
    return 'setup_pending';
  }
  if (!testDone) {
    return 'testing';
  }
  if (!goLiveDone) {
    return 'go_live_ready';
  }
  return current;
}

export interface GoLiveReadiness {
  ready: boolean;
  reasons: string[];
}

/** Deterministic readiness gate for Go-live confirmation – no external calls. */
export function evaluateGoLiveReadiness(
  checklist: ActivationChecklistItem[],
  hardware: ActivationHardwareAssignment[],
  applications: ActivationApplication[],
  blockers: ActivationBlocker[],
): GoLiveReadiness {
  const reasons: string[] = [];

  const openMandatory = checklist.filter((item) => item.required && !isItemSatisfied(item));
  if (openMandatory.length > 0) {
    reasons.push(`${openMandatory.length} Pflichtpunkt(e) der Checkliste offen`);
  }

  const openHardBlockers = blockers.filter((blocker) => blocker.status === 'open' && blocker.severity === 'hard');
  if (openHardBlockers.length > 0) {
    reasons.push(`${openHardBlockers.length} harte(r) Blocker offen`);
  }

  const outstandingHardware = hardware.filter(
    (unit) => unit.status !== 'tested' && unit.status !== 'active' && unit.status !== 'returned',
  );
  if (outstandingHardware.length > 0) {
    reasons.push(`${outstandingHardware.length} Hardware-Einheit(en) nicht getestet`);
  }

  const rejectedApplications = applications.filter((application) => application.status === 'rejected');
  if (rejectedApplications.length > 0) {
    reasons.push(`${rejectedApplications.length} Antrag/Anträge abgelehnt`);
  }

  const pendingApplications = applications.filter(
    (application) =>
      application.status === 'submitted' || application.status === 'inquiry' || application.status === 'in_review',
  );
  if (pendingApplications.length > 0) {
    reasons.push(`${pendingApplications.length} Antrag/Anträge noch nicht entschieden`);
  }

  return { ready: reasons.length === 0, reasons };
}

export interface CompletionReadiness {
  ready: boolean;
  reasons: string[];
}

export function evaluateCompletionReadiness(
  status: ActivationStatus,
  checklist: ActivationChecklistItem[],
  blockers: ActivationBlocker[],
): CompletionReadiness {
  const reasons: string[] = [];
  if (status !== 'live') {
    reasons.push('Aktivierung ist nicht live');
  }
  const openMandatory = checklist.filter((item) => item.required && !isItemSatisfied(item));
  if (openMandatory.length > 0) {
    reasons.push(`${openMandatory.length} Pflichtpunkt(e) offen`);
  }
  const openHardBlockers = blockers.filter((blocker) => blocker.status === 'open' && blocker.severity === 'hard');
  if (openHardBlockers.length > 0) {
    reasons.push(`${openHardBlockers.length} harte(r) Blocker offen`);
  }
  return { ready: reasons.length === 0, reasons };
}
