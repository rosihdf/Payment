import type {
  ActivationApplication,
  ActivationApplicationStatus,
  ActivationApplicationType,
} from '../domain/activation/activationApplication';
import { CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION } from '../domain/activation/activationApplication';
import type { ActivationBlocker, ActivationBlockerCategory, ActivationBlockerSeverity } from '../domain/activation/activationBlocker';
import { CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION } from '../domain/activation/activationBlocker';
import type { ActivationCase, ActivationListItem, ActivationMetrics, ActivationPriority } from '../domain/activation/activationCase';
import { CURRENT_ACTIVATION_CASE_SCHEMA_VERSION } from '../domain/activation/activationCase';
import type { ActivationChecklistItem, ActivationChecklistItemStatus } from '../domain/activation/activationChecklist';
import { CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION } from '../domain/activation/activationChecklist';
import { ACTIVATION_CHECKLIST_TEMPLATE_VERSION, buildChecklistTemplateFromContractVersion } from '../domain/activation/activationChecklistTemplate';
import {
  areDependenciesSatisfied,
  computeProgress,
  deriveCurrentAndNextStep,
  evaluateCompletionReadiness,
  evaluateGoLiveReadiness,
  suggestStatus,
} from '../domain/activation/activationEvaluator';
import type { ActivationHardwareAssignment } from '../domain/activation/activationHardware';
import { CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION } from '../domain/activation/activationHardware';
import { buildActivationSourceKey, generateNextActivationNumber } from '../domain/activation/activationNumber';
import {
  filterActivationCases,
  getActivationOverviewMetrics,
  sortActivationCases,
  type ActivationGoLiveWindowFilter,
  type ActivationOverviewFilters,
  type ActivationOverviewItem,
  type ActivationSortBy,
  type ActivationSortDirection,
  type ActivationWorkStateFilter,
} from '../domain/activation/activationOverview';
import { canTransitionActivationStatus, type ActivationStatus } from '../domain/activation/activationStatus';
import { toIsoDateOnly } from '../domain/contract/contractDates';
import type { Permission } from '../domain/permission/permission';
import { hasPermission } from '../domain/permission/permission';
import { SALES_DOCUMENT_SCHEMA_VERSION, type SalesDocument, type SalesDocumentType } from '../domain/salesDocument/salesDocument';
import type { UserContext } from '../domain/user/user';
import type { ActivationApplicationRepository } from '../repositories/interfaces/ActivationApplicationRepository';
import type { ActivationBlockerRepository } from '../repositories/interfaces/ActivationBlockerRepository';
import type { ActivationCaseRepository } from '../repositories/interfaces/ActivationCaseRepository';
import type { ActivationChecklistRepository } from '../repositories/interfaces/ActivationChecklistRepository';
import type { ActivationHardwareRepository } from '../repositories/interfaces/ActivationHardwareRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { ContractVersionRepository } from '../repositories/interfaces/ContractVersionRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { SalesDocumentRepository } from '../repositories/interfaces/SalesDocumentRepository';
import type { SalesTaskRepository } from '../repositories/interfaces/SalesTaskRepository';
import { generateId, nowIso } from '../utils/id';
import { requirePermission } from './auditService';
import type { AuditService } from './auditService';
import type { ContractService } from './contractService';
import type { SalesActivityService } from './salesActivityService';
import { endOfDayIso, type SalesTaskService } from './salesTaskService';

export type ActivationError =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'invalid_status'
  | 'conflict'
  | 'not_ready';

type Result<T> = { ok: true; value: T; warning?: string } | { ok: false; error: ActivationError; message?: string };

export interface ActivationFilters {
  query?: string;
  status?: ActivationStatus | 'all' | 'open_group' | 'blocked_group';
  ownerUserId?: string | 'all' | 'mine' | 'unassigned';
  priority?: ActivationPriority | 'all';
  goLiveWindow?: ActivationGoLiveWindowFilter;
  workState?: ActivationWorkStateFilter;
  sortBy?: ActivationSortBy;
  sortDirection?: ActivationSortDirection;
  /** @deprecated Prefer workState === 'blocked'. Kept for backward compatibility. */
  hasOpenBlocker?: boolean;
}

interface RelatedRecords {
  checklist: ActivationChecklistItem[];
  hardware: ActivationHardwareAssignment[];
  applications: ActivationApplication[];
  blockers: ActivationBlocker[];
}

function guard(context: UserContext, permission: Permission): { ok: true } | { ok: false; error: 'forbidden' } {
  const result = requirePermission(context, permission);
  return result.ok ? { ok: true } : { ok: false, error: 'forbidden' };
}

function canViewActivation(activationCase: ActivationCase, context: UserContext): boolean {
  if (hasPermission(context.role, 'activations.view_team')) return true;
  if (!hasPermission(context.role, 'activations.view_own')) return false;
  return activationCase.ownerUserId === context.userId || activationCase.createdByUserId === context.userId;
}

export class ActivationService {
  private taskService: SalesTaskService | null = null;
  private activityService: SalesActivityService | null = null;
  private contractService: ContractService | null = null;
  private readonly activationRepository: ActivationCaseRepository;
  private readonly checklistRepository: ActivationChecklistRepository;
  private readonly applicationRepository: ActivationApplicationRepository;
  private readonly hardwareRepository: ActivationHardwareRepository;
  private readonly blockerRepository: ActivationBlockerRepository;
  private readonly contractRepository: ContractRepository;
  private readonly contractVersionRepository: ContractVersionRepository;
  private readonly offerRepository: OfferRepository;
  private readonly salesTaskRepository: SalesTaskRepository;
  private readonly salesDocumentRepository: SalesDocumentRepository;
  private readonly auditService: AuditService;

  constructor(
    activationRepository: ActivationCaseRepository,
    checklistRepository: ActivationChecklistRepository,
    applicationRepository: ActivationApplicationRepository,
    hardwareRepository: ActivationHardwareRepository,
    blockerRepository: ActivationBlockerRepository,
    contractRepository: ContractRepository,
    contractVersionRepository: ContractVersionRepository,
    offerRepository: OfferRepository,
    salesTaskRepository: SalesTaskRepository,
    salesDocumentRepository: SalesDocumentRepository,
    auditService: AuditService,
  ) {
    this.activationRepository = activationRepository;
    this.checklistRepository = checklistRepository;
    this.applicationRepository = applicationRepository;
    this.hardwareRepository = hardwareRepository;
    this.blockerRepository = blockerRepository;
    this.contractRepository = contractRepository;
    this.contractVersionRepository = contractVersionRepository;
    this.offerRepository = offerRepository;
    this.salesTaskRepository = salesTaskRepository;
    this.salesDocumentRepository = salesDocumentRepository;
    this.auditService = auditService;
  }

  setSalesTaskService(service: SalesTaskService): void {
    this.taskService = service;
  }

  setSalesActivityService(service: SalesActivityService): void {
    this.activityService = service;
  }

  setContractService(service: ContractService): void {
    this.contractService = service;
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  private async loadRelated(activationId: string): Promise<RelatedRecords> {
    const [checklist, hardware, applications, blockers] = await Promise.all([
      this.checklistRepository.getByActivationId(activationId),
      this.hardwareRepository.getByActivationId(activationId),
      this.applicationRepository.getByActivationId(activationId),
      this.blockerRepository.getByActivationId(activationId),
    ]);
    return { checklist, hardware, applications, blockers };
  }

  /**
   * Recomputes cache-only derived fields (progress, step labels, counts) and persists them
   * if changed. Never touches `status`, never logs audit/activity entries – safe to call from
   * read paths (list/detail) without side effects beyond harmless field caching.
   */
  async refreshDerivedFields(activationId: string): Promise<ActivationCase | null> {
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return null;
    const related = await this.loadRelated(activationId);
    const updated = this.computeDerivedCase(activationCase, related, { allowStatusChange: false });
    if (this.hasDerivedDiff(activationCase, updated)) {
      return this.activationRepository.update(updated);
    }
    return activationCase;
  }

  private hasDerivedDiff(before: ActivationCase, after: ActivationCase): boolean {
    return (
      before.progressPercent !== after.progressPercent ||
      before.openMandatoryCount !== after.openMandatoryCount ||
      before.openBlockerCount !== after.openBlockerCount ||
      before.currentStep !== after.currentStep ||
      before.nextStep !== after.nextStep
    );
  }

  private computeDerivedCase(
    activationCase: ActivationCase,
    related: RelatedRecords,
    options: { allowStatusChange: boolean },
  ): ActivationCase {
    const progress = computeProgress(related.checklist);
    const { currentStep, nextStep } = deriveCurrentAndNextStep(related.checklist);
    const openBlockerCount = related.blockers.filter((blocker) => blocker.status === 'open').length;
    const hasOpenHardBlocker = related.blockers.some(
      (blocker) => blocker.status === 'open' && blocker.severity === 'hard',
    );

    let status = activationCase.status;
    if (options.allowStatusChange) {
      const suggested = suggestStatus(
        activationCase.status,
        related.checklist,
        related.hardware,
        related.applications,
        hasOpenHardBlocker,
      );
      if (suggested !== activationCase.status && canTransitionActivationStatus(activationCase.status, suggested)) {
        status = suggested;
      }
    }

    return {
      ...activationCase,
      status,
      progressPercent: progress.progressPercent,
      openMandatoryCount: progress.openMandatoryCount,
      openBlockerCount,
      currentStep,
      nextStep,
    };
  }

  /** Applies computed derived fields (incl. possible auto status advance) and persists. */
  private async applyDerivedUpdate(activationId: string, context: UserContext): Promise<ActivationCase | null> {
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return null;
    const related = await this.loadRelated(activationId);
    const updated = this.computeDerivedCase(activationCase, related, { allowStatusChange: true });
    const finalized: ActivationCase = { ...updated, updatedAt: nowIso(), updatedByUserId: context.userId };
    const saved = await this.activationRepository.update(finalized);

    if (saved.status !== activationCase.status) {
      await this.activityService?.recordSystemActivity(
        {
          type: 'activation_status_changed',
          title: `Aktivierungsstatus: ${saved.status}`,
          description: `${activationCase.status} → ${saved.status}`,
          leadId: saved.leadId,
          offerId: saved.sourceOfferId,
          contractId: saved.contractId,
          activationId: saved.id,
          sourceKey: `activation_status:${saved.id}:${saved.status}:${saved.updatedAt}`,
        },
        context,
      );
      await this.ensureAutomaticTasks(saved, context);
    }

    return saved;
  }

  async getById(id: string, context: UserContext): Promise<Result<ActivationCase>> {
    if (!hasPermission(context.role, 'activations.view_own') && !hasPermission(context.role, 'activations.view_team')) {
      return { ok: false, error: 'forbidden' };
    }
    const activationCase = await this.activationRepository.getById(id);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!canViewActivation(activationCase, context)) return { ok: false, error: 'forbidden' };
    const refreshed = (await this.refreshDerivedFields(id)) ?? activationCase;
    return { ok: true, value: refreshed };
  }

  async getByContractId(contractId: string, context: UserContext): Promise<ActivationCase | null> {
    const activationCase = await this.activationRepository.getByContractId(contractId);
    if (!activationCase || !canViewActivation(activationCase, context)) return null;
    return (await this.refreshDerivedFields(activationCase.id)) ?? activationCase;
  }

  /**
   * Bulk-loads overview rows once (no per-row repository calls) and applies pure filter/sort helpers.
   * Read path does not create tasks/activities and does not mutate activation status.
   */
  async list(context: UserContext, filters: ActivationFilters = {}): Promise<Result<ActivationListItem[]>> {
    if (!hasPermission(context.role, 'activations.view_own') && !hasPermission(context.role, 'activations.view_team')) {
      return { ok: false, error: 'forbidden' };
    }

    const [cases, contracts, versions, hardware, offers, tasks] = await Promise.all([
      this.activationRepository.getAll(),
      this.contractRepository.getAll(),
      this.contractVersionRepository.getAll(),
      this.hardwareRepository.getAll(),
      this.offerRepository.getAll(),
      this.salesTaskRepository.getAll(),
    ]);

    const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
    const versionsById = new Map(versions.map((version) => [version.id, version]));
    const offersById = new Map(offers.map((offer) => [offer.id, offer]));

    const hardwareByActivation = new Map<string, ActivationHardwareAssignment[]>();
    for (const unit of hardware) {
      const list = hardwareByActivation.get(unit.activationId) ?? [];
      list.push(unit);
      hardwareByActivation.set(unit.activationId, list);
    }

    const openTaskActivationIds = new Set<string>();
    for (const task of tasks) {
      if (task.activationId && (task.status === 'open' || task.status === 'in_progress')) {
        openTaskActivationIds.add(task.activationId);
      }
    }

    const enriched: ActivationOverviewItem[] = cases
      .filter((entry) => canViewActivation(entry, context))
      .map((entry) => {
        const contract = contractsById.get(entry.contractId);
        const version = entry.contractVersionId
          ? versionsById.get(entry.contractVersionId)
          : null;
        const offer =
          (entry.sourceOfferId ? offersById.get(entry.sourceOfferId) : null) ??
          (contract?.sourceOfferId ? offersById.get(contract.sourceOfferId) : null);
        const units = hardwareByActivation.get(entry.id) ?? [];
        const contactName = version
          ? `${version.snapshot.customerSnapshot.contactFirstName} ${version.snapshot.customerSnapshot.contactLastName}`.trim()
          : '';
        const warnings: string[] = [];
        if (entry.status === 'blocked') warnings.push('Blockiert');
        if (entry.openMandatoryCount > 0 && entry.status === 'go_live_ready') {
          warnings.push('Pflichtpunkte offen');
        }
        if (!contract) warnings.push('Vertrag fehlt');

        return {
          ...entry,
          contractNumber: contract?.contractNumber ?? '–',
          customerCompanyName: contract?.customerCompanyName ?? 'Unbekannt',
          contactName,
          offerNumber:
            offer?.offerNumber ??
            version?.snapshot.sourceOfferNumber ??
            '',
          externalReferenceText: entry.externalReferences
            .map((ref) => `${ref.system} ${ref.reference}`)
            .join(' '),
          serialNumbers: units
            .map((unit) => unit.serialNumber)
            .filter((serial): serial is string => Boolean(serial && serial.trim())),
          hardwareModels: units.map((unit) => unit.model).filter(Boolean),
          hasOpenTask: openTaskActivationIds.has(entry.id),
          warningLabels: warnings,
        };
      });

    const overviewFilters: ActivationOverviewFilters = {
      query: filters.query,
      status: filters.status,
      ownerUserId: filters.ownerUserId,
      priority: filters.priority,
      goLiveWindow: filters.goLiveWindow,
      workState: filters.hasOpenBlocker ? 'blocked' : filters.workState,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      todayIso: toIsoDateOnly(new Date()),
      currentUserId: context.userId,
    };

    const filtered = filterActivationCases(enriched, overviewFilters);
    const sorted = sortActivationCases(
      filtered,
      overviewFilters.sortBy ?? 'nextDueAt',
      overviewFilters.sortDirection,
    );

    return { ok: true, value: sorted };
  }

  async getMetrics(context: UserContext): Promise<Result<ActivationMetrics>> {
    const listResult = await this.list(context, { status: 'all' });
    if (!listResult.ok) return listResult;
    return {
      ok: true,
      value: getActivationOverviewMetrics(listResult.value, toIsoDateOnly(new Date())),
    };
  }

  // ---------------------------------------------------------------------
  // Lifecycle: start / status / checklist
  // ---------------------------------------------------------------------

  async startFromContract(contractId: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.create');
    if (!permission.ok) return permission;

    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found', message: 'Vertrag nicht gefunden.' };

    const sourceKey = buildActivationSourceKey(contractId);
    const existing = await this.activationRepository.getBySourceKey(sourceKey);
    if (existing) return { ok: true, value: existing };

    if (!['preparation', 'activation'].includes(contract.status)) {
      return {
        ok: false,
        error: 'invalid_status',
        message: 'Aktivierung nur aus Verträgen in Vorbereitung oder Aktivierung möglich.',
      };
    }

    if (!contract.currentVersionId) {
      return { ok: false, error: 'validation', message: 'Vertrag ohne aktuelle Version.' };
    }
    const version = await this.contractVersionRepository.getById(contract.currentVersionId);
    if (!version) return { ok: false, error: 'validation', message: 'Vertragsversion fehlt.' };

    const timestamp = nowIso();
    const allCases = await this.activationRepository.getAll();
    const activationNumber = generateNextActivationNumber(allCases, timestamp);
    const activationId = generateId('activation_case');

    const template = buildChecklistTemplateFromContractVersion(version);
    const checklistItems: ActivationChecklistItem[] = template.map((item) => ({
      id: generateId('activation_checklist'),
      schemaVersion: CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION,
      activationId,
      category: item.category,
      key: item.key,
      title: item.title,
      description: item.description,
      status: 'open',
      required: item.required,
      evidenceRequired: item.evidenceRequired,
      documentId: null,
      dependsOnKeys: item.dependsOnKeys,
      sortOrder: item.sortOrder,
      note: '',
      sourceKey: `activation:${activationId}:checklist:${item.key}`,
      completedAt: null,
      completedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const hardwareUnits: ActivationHardwareAssignment[] = [];
    version.snapshot.hardware.forEach((line, lineIndex) => {
      for (let unitIndex = 0; unitIndex < line.quantity; unitIndex += 1) {
        hardwareUnits.push({
          id: generateId('activation_hardware'),
          schemaVersion: CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION,
          activationId,
          contractHardwareLineKey: `${version.id}:${lineIndex}`,
          unitIndex,
          productId: line.productId,
          productName: line.productName,
          model: line.model,
          mobility: line.mobility,
          acquisition: line.acquisition,
          status: 'planned',
          serialNumber: null,
          orderedAt: null,
          orderReference: null,
          assignedAt: null,
          shippedAt: null,
          shippingCarrierNote: '',
          shippingTrackingReference: null,
          deliveryAddressNote: '',
          deliveredAt: null,
          setupAt: null,
          testedAt: null,
          activatedAt: null,
          handoverAt: null,
          handoverToName: '',
          handoverNote: '',
          note: '',
          sourceKey: `activation:${activationId}:hardware:${version.id}:${lineIndex}:${unitIndex}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    });

    const progress = computeProgress(checklistItems);
    const { currentStep, nextStep } = deriveCurrentAndNextStep(checklistItems);

    const activationCase: ActivationCase = {
      id: activationId,
      schemaVersion: CURRENT_ACTIVATION_CASE_SCHEMA_VERSION,
      activationNumber,
      contractId,
      contractVersionId: version.id,
      leadId: contract.leadId,
      sourceOfferId: contract.sourceOfferId,
      sourceKey,
      status: 'preparation',
      ownerUserId: contract.ownerUserId,
      priority: 'normal',
      plannedStart: timestamp.slice(0, 10),
      desiredGoLive: null,
      confirmedGoLive: null,
      currentStep,
      progressPercent: progress.progressPercent,
      nextStep,
      nextDueAt: endOfDayIso(),
      openBlockerCount: 0,
      openMandatoryCount: progress.openMandatoryCount,
      externalReferences: [],
      templateSnapshotId: version.id,
      templateSnapshotVersion: ACTIVATION_CHECKLIST_TEMPLATE_VERSION,
      createdAt: timestamp,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
      completedAt: null,
      handedOverAt: null,
      cancelledAt: null,
      blockedFromStatus: null,
    };

    await this.activationRepository.create(activationCase);
    if (checklistItems.length > 0) {
      await this.checklistRepository.createMany(checklistItems);
    }
    if (hardwareUnits.length > 0) {
      await this.hardwareRepository.createMany(hardwareUnits);
    }

    if (this.contractService && contract.status === 'preparation') {
      await this.contractService.transitionStatus(contractId, 'activation', context);
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_started',
        title: `Aktivierung ${activationCase.activationNumber} gestartet`,
        description: `Aus Vertrag ${contract.contractNumber}`,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        contractId,
        contractVersionId: version.id,
        activationId,
        sourceKey: `activation_started:${activationId}`,
      },
      context,
    );

    await this.ensureAutomaticTasks(activationCase, context);

    await this.auditService.logChange({
      context,
      action: 'activation_started',
      entityType: 'activation_case',
      entityId: activationId,
      summary: `Aktivierung ${activationCase.activationNumber} aus Vertrag ${contract.contractNumber} gestartet`,
    });

    return { ok: true, value: activationCase };
  }

  async transitionStatus(
    activationId: string,
    nextStatus: ActivationStatus,
    context: UserContext,
    reason = '',
  ): Promise<Result<ActivationCase>> {
    const permissionNeeded: Permission =
      nextStatus === 'live'
        ? 'activations.go_live'
        : nextStatus === 'cancelled'
          ? 'activations.cancel'
          : nextStatus === 'completed'
            ? 'activations.complete'
            : 'activations.update';
    const permission = guard(context, permissionNeeded);
    if (!permission.ok) return permission;

    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!canViewActivation(activationCase, context)) return { ok: false, error: 'forbidden' };
    if (!canTransitionActivationStatus(activationCase.status, nextStatus)) {
      return { ok: false, error: 'invalid_status', message: 'Statusübergang nicht erlaubt.' };
    }

    const updated: ActivationCase = {
      ...activationCase,
      status: nextStatus,
      blockedFromStatus: nextStatus === 'blocked' ? activationCase.status : null,
      updatedAt: nowIso(),
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_status_changed',
        title: `Aktivierungsstatus: ${nextStatus}`,
        description: reason || `${activationCase.status} → ${nextStatus}`,
        leadId: updated.leadId,
        offerId: updated.sourceOfferId,
        contractId: updated.contractId,
        activationId: updated.id,
        sourceKey: `activation_status:${updated.id}:${nextStatus}:${updated.updatedAt}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'activation_status_changed',
      entityType: 'activation_case',
      entityId: activationId,
      summary: `Status ${activationCase.status} → ${nextStatus}`,
      changes: [{ field: 'status', before: activationCase.status, after: nextStatus }],
    });

    await this.ensureAutomaticTasks(updated, context);
    return { ok: true, value: updated };
  }

  async listChecklistItems(activationId: string, context: UserContext): Promise<Result<ActivationChecklistItem[]>> {
    const activationResult = await this.getById(activationId, context);
    if (!activationResult.ok) return activationResult;
    return { ok: true, value: await this.checklistRepository.getByActivationId(activationId) };
  }

  async updateChecklistItem(
    activationId: string,
    itemId: string,
    patch: { status?: ActivationChecklistItemStatus; note?: string; documentId?: string | null },
    context: UserContext,
  ): Promise<Result<ActivationChecklistItem>> {
    const permission = guard(context, 'activations.update');
    if (!permission.ok) return permission;

    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!canViewActivation(activationCase, context)) return { ok: false, error: 'forbidden' };

    const item = await this.checklistRepository.getById(itemId);
    if (!item || item.activationId !== activationId) return { ok: false, error: 'not_found' };

    if (patch.status === 'done') {
      const allItems = await this.checklistRepository.getByActivationId(activationId);
      if (!areDependenciesSatisfied(item, allItems)) {
        return { ok: false, error: 'conflict', message: 'Abhängige Punkte sind noch nicht erledigt.' };
      }
      if (item.evidenceRequired && !item.documentId && !patch.documentId) {
        return { ok: false, error: 'validation', message: 'Für diesen Punkt ist ein Belegdokument erforderlich.' };
      }
    }

    const timestamp = nowIso();
    const updated: ActivationChecklistItem = {
      ...item,
      status: patch.status ?? item.status,
      note: patch.note !== undefined ? patch.note : item.note,
      documentId: patch.documentId !== undefined ? patch.documentId : item.documentId,
      completedAt: patch.status === 'done' ? timestamp : patch.status ? null : item.completedAt,
      completedByUserId: patch.status === 'done' ? context.userId : item.completedByUserId,
      updatedAt: timestamp,
    };
    const saved = await this.checklistRepository.update(updated);

    if (patch.status && patch.status !== item.status) {
      await this.activityService?.recordSystemActivity(
        {
          type: 'activation_checklist_updated',
          title: `Checkliste: ${saved.title}`,
          description: `Status ${item.status} → ${saved.status}`,
          leadId: activationCase.leadId,
          offerId: activationCase.sourceOfferId,
          contractId: activationCase.contractId,
          activationId,
          sourceKey: `activation_checklist:${saved.id}:${saved.status}:${timestamp}`,
        },
        context,
      );
    }

    await this.applyDerivedUpdate(activationId, context);
    return { ok: true, value: saved };
  }

  // ---------------------------------------------------------------------
  // Documents (metadata only)
  // ---------------------------------------------------------------------

  async requestDocument(
    activationId: string,
    input: { checklistItemId: string; note?: string },
    context: UserContext,
  ): Promise<Result<ActivationChecklistItem>> {
    const permission = guard(context, 'activations.documents');
    if (!permission.ok) return permission;

    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    const item = await this.checklistRepository.getById(input.checklistItemId);
    if (!item || item.activationId !== activationId) return { ok: false, error: 'not_found' };

    const updated: ActivationChecklistItem = {
      ...item,
      status: item.status === 'open' ? 'in_progress' : item.status,
      note: input.note !== undefined ? input.note : item.note,
      updatedAt: nowIso(),
    };
    const saved = await this.checklistRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_document_requested',
        title: `Unterlage angefordert: ${saved.title}`,
        leadId: activationCase.leadId,
        offerId: activationCase.sourceOfferId,
        contractId: activationCase.contractId,
        activationId,
        sourceKey: `activation_document_requested:${saved.id}:${saved.updatedAt}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: `Unterlage nachfordern: ${saved.title}`,
          type: 'request_activation_document',
          priority: 'normal',
          dueAt: endOfDayIso(),
          leadId: activationCase.leadId,
          offerId: activationCase.sourceOfferId,
          contractId: activationCase.contractId,
          activationId,
          sourceKey: `auto:request_activation_document:${saved.id}`,
        },
        context,
      );
    }

    return { ok: true, value: saved };
  }

  async reviewDocument(
    activationId: string,
    input: {
      checklistItemId: string;
      type: SalesDocumentType;
      fileName: string;
      mimeType: string;
      externalReference?: string | null;
    },
    context: UserContext,
  ): Promise<Result<{ document: SalesDocument; checklistItem: ActivationChecklistItem }>> {
    const permission = guard(context, 'activations.documents');
    if (!permission.ok) return permission;

    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    const item = await this.checklistRepository.getById(input.checklistItemId);
    if (!item || item.activationId !== activationId) return { ok: false, error: 'not_found' };

    const document: SalesDocument = {
      id: generateId('sales_document'),
      schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
      offerId: activationCase.sourceOfferId,
      offerVersionId: null,
      contractId: activationCase.contractId,
      contractVersionId: activationCase.contractVersionId,
      terminationId: null,
      activationId,
      type: input.type,
      fileName: input.fileName,
      mimeType: input.mimeType,
      externalReference: input.externalReference ?? null,
      checksum: null,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };
    await this.salesDocumentRepository.create(document);

    const checklistResult = await this.updateChecklistItem(
      activationId,
      item.id,
      { status: 'done', documentId: document.id },
      context,
    );
    if (!checklistResult.ok) return checklistResult;

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_document_reviewed',
        title: `Unterlage geprüft: ${item.title}`,
        leadId: activationCase.leadId,
        offerId: activationCase.sourceOfferId,
        contractId: activationCase.contractId,
        activationId,
        sourceKey: `activation_document_reviewed:${document.id}`,
      },
      context,
    );

    return { ok: true, value: { document, checklistItem: checklistResult.value } };
  }

  async listDocuments(activationId: string, context: UserContext): Promise<Result<SalesDocument[]>> {
    const activationResult = await this.getById(activationId, context);
    if (!activationResult.ok) return activationResult;
    const all = await this.salesDocumentRepository.getAll();
    return { ok: true, value: all.filter((document) => document.activationId === activationId) };
  }

  // ---------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------

  async createApplication(
    activationId: string,
    input: { type: ActivationApplicationType; title: string },
    context: UserContext,
  ): Promise<Result<ActivationApplication>> {
    const permission = guard(context, 'activations.applications');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };

    const timestamp = nowIso();
    const application: ActivationApplication = {
      id: generateId('activation_application'),
      schemaVersion: CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION,
      activationId,
      type: input.type,
      status: 'draft',
      title: input.title.trim() || 'Antrag',
      referenceNumber: null,
      submittedAt: null,
      submittedByUserId: null,
      decisionAt: null,
      decisionNote: '',
      inquiryNote: '',
      documentId: null,
      sourceKey: null,
      createdAt: timestamp,
      createdByUserId: context.userId,
      updatedAt: timestamp,
    };
    const saved = await this.applicationRepository.create(application);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_application_created',
        title: `Antrag angelegt: ${saved.title}`,
        contractId: activationCase.contractId,
        leadId: activationCase.leadId,
        offerId: activationCase.sourceOfferId,
        activationId,
        sourceKey: `activation_application_created:${saved.id}`,
      },
      context,
    );

    return { ok: true, value: saved };
  }

  async updateApplication(
    applicationId: string,
    patch: { title?: string; referenceNumber?: string | null; documentId?: string | null },
    context: UserContext,
  ): Promise<Result<ActivationApplication>> {
    const permission = guard(context, 'activations.applications');
    if (!permission.ok) return permission;
    const application = await this.applicationRepository.getById(applicationId);
    if (!application) return { ok: false, error: 'not_found' };
    const updated: ActivationApplication = {
      ...application,
      title: patch.title?.trim() ?? application.title,
      referenceNumber: patch.referenceNumber !== undefined ? patch.referenceNumber : application.referenceNumber,
      documentId: patch.documentId !== undefined ? patch.documentId : application.documentId,
      updatedAt: nowIso(),
    };
    return { ok: true, value: await this.applicationRepository.update(updated) };
  }

  private async transitionApplication(
    applicationId: string,
    nextStatus: ActivationApplicationStatus,
    context: UserContext,
    patch: Partial<ActivationApplication> = {},
  ): Promise<Result<ActivationApplication>> {
    const permission = guard(context, 'activations.applications');
    if (!permission.ok) return permission;
    const application = await this.applicationRepository.getById(applicationId);
    if (!application) return { ok: false, error: 'not_found' };

    const updated: ActivationApplication = {
      ...application,
      ...patch,
      status: nextStatus,
      updatedAt: nowIso(),
    };
    const saved = await this.applicationRepository.update(updated);
    const activationCase = await this.activationRepository.getById(application.activationId);
    if (activationCase) {
      await this.applyDerivedUpdate(activationCase.id, context);
    }
    return { ok: true, value: saved };
  }

  async submitApplication(applicationId: string, context: UserContext): Promise<Result<ActivationApplication>> {
    const application = await this.applicationRepository.getById(applicationId);
    if (!application) return { ok: false, error: 'not_found' };
    if (application.status !== 'draft' && application.status !== 'ready') {
      return { ok: false, error: 'invalid_status' };
    }
    const result = await this.transitionApplication(applicationId, 'submitted', context, {
      submittedAt: nowIso(),
      submittedByUserId: context.userId,
    });
    if (!result.ok) return result;

    const activationCase = await this.activationRepository.getById(application.activationId);
    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_application_submitted',
        title: `Antrag eingereicht: ${result.value.title}`,
        contractId: activationCase?.contractId ?? null,
        leadId: activationCase?.leadId ?? null,
        offerId: activationCase?.sourceOfferId ?? null,
        activationId: application.activationId,
        sourceKey: `activation_application_submitted:${applicationId}:${result.value.updatedAt}`,
      },
      context,
    );
    if (this.taskService && activationCase) {
      await this.taskService.ensureAutomaticTask(
        {
          title: `Antrag nachfassen: ${result.value.title}`,
          type: 'follow_up_activation_application',
          priority: 'normal',
          dueAt: endOfDayIso(new Date(Date.now() + 5 * 86400000)),
          leadId: activationCase.leadId,
          offerId: activationCase.sourceOfferId,
          contractId: activationCase.contractId,
          activationId: application.activationId,
          sourceKey: `auto:follow_up_activation_application:${applicationId}`,
        },
        context,
      );
    }
    await this.auditService.logChange({
      context,
      action: 'activation_application_submitted',
      entityType: 'activation_application',
      entityId: applicationId,
      summary: `Antrag ${result.value.title} eingereicht`,
    });
    return result;
  }

  async markInquiry(applicationId: string, note: string, context: UserContext): Promise<Result<ActivationApplication>> {
    return this.transitionApplication(applicationId, 'inquiry', context, { inquiryNote: note.trim() });
  }

  async approveApplication(applicationId: string, note = '', context: UserContext): Promise<Result<ActivationApplication>> {
    const result = await this.transitionApplication(applicationId, 'approved', context, {
      decisionAt: nowIso(),
      decisionNote: note.trim(),
    });
    if (result.ok) {
      await this.auditService.logChange({
        context,
        action: 'activation_application_decided',
        entityType: 'activation_application',
        entityId: applicationId,
        summary: `Antrag ${result.value.title} genehmigt`,
      });
    }
    return result;
  }

  async rejectApplication(applicationId: string, note: string, context: UserContext): Promise<Result<ActivationApplication>> {
    if (!note.trim()) {
      return { ok: false, error: 'validation', message: 'Ablehnung erfordert eine Begründung.' };
    }
    const result = await this.transitionApplication(applicationId, 'rejected', context, {
      decisionAt: nowIso(),
      decisionNote: note.trim(),
    });
    if (result.ok) {
      await this.auditService.logChange({
        context,
        action: 'activation_application_decided',
        entityType: 'activation_application',
        entityId: applicationId,
        summary: `Antrag ${result.value.title} abgelehnt`,
      });
    }
    return result;
  }

  async listApplications(activationId: string, context: UserContext): Promise<Result<ActivationApplication[]>> {
    const activationResult = await this.getById(activationId, context);
    if (!activationResult.ok) return activationResult;
    return { ok: true, value: await this.applicationRepository.getByActivationId(activationId) };
  }

  // ---------------------------------------------------------------------
  // Hardware
  // ---------------------------------------------------------------------

  async listHardware(activationId: string, context: UserContext): Promise<Result<ActivationHardwareAssignment[]>> {
    const activationResult = await this.getById(activationId, context);
    if (!activationResult.ok) return activationResult;
    return { ok: true, value: await this.hardwareRepository.getByActivationId(activationId) };
  }

  private validateHardwareDateOrder(unit: ActivationHardwareAssignment, patch: Partial<ActivationHardwareAssignment>): string | null {
    const orderedAt = patch.orderedAt ?? unit.orderedAt;
    const shippedAt = patch.shippedAt ?? unit.shippedAt;
    const deliveredAt = patch.deliveredAt ?? unit.deliveredAt;
    const setupAt = patch.setupAt ?? unit.setupAt;
    const testedAt = patch.testedAt ?? unit.testedAt;

    if (orderedAt && shippedAt && shippedAt < orderedAt) return 'Versand darf nicht vor Bestellung liegen.';
    if (shippedAt && deliveredAt && deliveredAt < shippedAt) return 'Zustellung darf nicht vor Versand liegen.';
    if (deliveredAt && setupAt && setupAt < deliveredAt) return 'Einrichtung darf nicht vor Zustellung liegen.';
    if (setupAt && testedAt && testedAt < setupAt) return 'Test darf nicht vor Einrichtung liegen.';
    return null;
  }

  async updateHardware(
    activationId: string,
    hardwareId: string,
    action:
      | { kind: 'order'; orderReference?: string | null }
      | { kind: 'assign'; serialNumber: string }
      | { kind: 'ship'; trackingReference?: string | null; carrierNote?: string; deliveryAddressNote?: string }
      | { kind: 'deliver' }
      | { kind: 'setup' }
      | { kind: 'test' }
      | { kind: 'handover'; toName: string; note?: string },
    context: UserContext,
  ): Promise<Result<ActivationHardwareAssignment>> {
    const permission = guard(context, action.kind === 'setup' ? 'activations.setup' : action.kind === 'test' ? 'activations.test' : 'activations.hardware');
    if (!permission.ok) return permission;

    const unit = await this.hardwareRepository.getById(hardwareId);
    if (!unit || unit.activationId !== activationId) return { ok: false, error: 'not_found' };

    const timestamp = nowIso();
    let patch: Partial<ActivationHardwareAssignment> = {};
    let warning: string | undefined;

    switch (action.kind) {
      case 'order':
        patch = { status: 'ordered', orderedAt: timestamp, orderReference: action.orderReference ?? null };
        break;
      case 'assign': {
        const serial = action.serialNumber.trim();
        if (!serial) return { ok: false, error: 'validation', message: 'Seriennummer ist erforderlich.' };
        const allHardware = await this.hardwareRepository.getAll();
        const allCases = await this.activationRepository.getAll();
        const activeCaseIds = new Set(
          allCases.filter((entry) => !['cancelled', 'archived'].includes(entry.status)).map((entry) => entry.id),
        );
        const duplicate = allHardware.find(
          (entry) =>
            entry.id !== hardwareId &&
            entry.serialNumber === serial &&
            activeCaseIds.has(entry.activationId),
        );
        if (duplicate) {
          warning = `Seriennummer ${serial} ist bereits einer weiteren aktiven Aktivierung zugeordnet.`;
        }
        patch = { status: 'assigned', serialNumber: serial, assignedAt: timestamp };
        break;
      }
      case 'ship':
        patch = {
          status: 'shipped',
          shippedAt: timestamp,
          shippingTrackingReference: action.trackingReference ?? unit.shippingTrackingReference,
          shippingCarrierNote: action.carrierNote ?? unit.shippingCarrierNote,
          deliveryAddressNote: action.deliveryAddressNote ?? unit.deliveryAddressNote,
        };
        break;
      case 'deliver':
        patch = { status: 'delivered', deliveredAt: timestamp };
        break;
      case 'setup':
        patch = { status: 'setup', setupAt: timestamp };
        break;
      case 'test':
        patch = { status: 'tested', testedAt: timestamp };
        break;
      case 'handover':
        if (!action.toName.trim()) return { ok: false, error: 'validation', message: 'Empfänger der Übergabe ist erforderlich.' };
        patch = {
          status: 'active',
          activatedAt: timestamp,
          handoverAt: timestamp,
          handoverToName: action.toName.trim(),
          handoverNote: action.note ?? '',
        };
        break;
      default:
        break;
    }

    const dateError = this.validateHardwareDateOrder(unit, patch);
    if (dateError) return { ok: false, error: 'validation', message: dateError };

    const updated: ActivationHardwareAssignment = { ...unit, ...patch, updatedAt: timestamp };
    const saved = await this.hardwareRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_hardware_updated',
        title: `Hardware ${saved.model || saved.productName || saved.id}: ${saved.status}`,
        contractId: (await this.activationRepository.getById(activationId))?.contractId ?? null,
        activationId,
        sourceKey: `activation_hardware:${saved.id}:${saved.status}:${timestamp}`,
      },
      context,
    );

    await this.applyDerivedUpdate(activationId, context);
    return { ok: true, value: saved, warning };
  }

  async recordHardwareDeviation(
    activationId: string,
    hardwareId: string,
    input: { description: string; contractChangeNote?: string },
    context: UserContext,
  ): Promise<Result<ActivationBlocker>> {
    const permission = guard(context, 'activations.hardware');
    if (!permission.ok) return permission;
    if (!input.description.trim()) {
      return { ok: false, error: 'validation', message: 'Beschreibung der Abweichung ist erforderlich.' };
    }
    const unit = await this.hardwareRepository.getById(hardwareId);
    if (!unit || unit.activationId !== activationId) return { ok: false, error: 'not_found' };

    const timestamp = nowIso();
    await this.hardwareRepository.update({
      ...unit,
      status: 'deviation',
      note: input.contractChangeNote ? `${unit.note}\n${input.contractChangeNote}`.trim() : unit.note,
      updatedAt: timestamp,
    });

    const blocker = await this.createBlockerInternal(
      activationId,
      {
        category: 'hardware',
        severity: 'hard',
        title: `Hardwareabweichung: ${unit.model || unit.productName}`,
        description: input.description.trim(),
        relatedHardwareId: hardwareId,
      },
      context,
    );

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_hardware_deviation',
        title: `Hardwareabweichung: ${unit.model || unit.productName}`,
        description: input.description,
        contractId: (await this.activationRepository.getById(activationId))?.contractId ?? null,
        activationId,
        sourceKey: `activation_hardware_deviation:${hardwareId}:${timestamp}`,
      },
      context,
    );

    if (this.taskService) {
      const activationCase = await this.activationRepository.getById(activationId);
      await this.taskService.ensureAutomaticTask(
        {
          title: `Hardwareabweichung bearbeiten: ${unit.model || unit.productName}`,
          type: 'process_hardware_deviation',
          priority: 'high',
          dueAt: endOfDayIso(),
          leadId: activationCase?.leadId ?? null,
          offerId: activationCase?.sourceOfferId ?? null,
          contractId: activationCase?.contractId ?? null,
          activationId,
          sourceKey: `auto:process_hardware_deviation:${hardwareId}`,
        },
        context,
      );
    }

    await this.auditService.logChange({
      context,
      action: 'activation_hardware_deviation',
      entityType: 'activation_hardware',
      entityId: hardwareId,
      summary: input.description,
    });

    return { ok: true, value: blocker };
  }

  // ---------------------------------------------------------------------
  // Setup / test
  // ---------------------------------------------------------------------

  async updateSetup(
    activationId: string,
    input: { checklistItemId?: string; note?: string },
    context: UserContext,
  ): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.setup');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };

    if (input.checklistItemId) {
      const result = await this.updateChecklistItem(
        activationId,
        input.checklistItemId,
        { status: 'done', note: input.note },
        context,
      );
      if (!result.ok) return result;
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_setup_updated',
        title: 'Einrichtung aktualisiert',
        description: input.note ?? '',
        contractId: activationCase.contractId,
        activationId,
        sourceKey: `activation_setup_updated:${activationId}:${nowIso()}`,
      },
      context,
    );

    const updated = await this.applyDerivedUpdate(activationId, context);
    return { ok: true, value: updated ?? activationCase };
  }

  /** No card data: only an optional amount, an anonymized reference and a boolean result. */
  async recordTestPayment(
    activationId: string,
    input: { hardwareId?: string; checklistItemId?: string; amountCents?: number | null; anonymizedReference: string; result: 'success' | 'failed' },
    context: UserContext,
  ): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.test');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!input.anonymizedReference.trim()) {
      return { ok: false, error: 'validation', message: 'Anonymisierte Referenz ist erforderlich.' };
    }

    if (input.hardwareId) {
      const unit = await this.hardwareRepository.getById(input.hardwareId);
      if (unit && unit.activationId === activationId && input.result === 'success') {
        await this.hardwareRepository.update({ ...unit, status: 'tested', testedAt: nowIso(), updatedAt: nowIso() });
      }
    }

    if (input.result === 'success' && input.checklistItemId) {
      const checklistResult = await this.updateChecklistItem(
        activationId,
        input.checklistItemId,
        { status: 'done' },
        context,
      );
      if (!checklistResult.ok) return checklistResult;
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_test_recorded',
        title: `Testzahlung ${input.result === 'success' ? 'erfolgreich' : 'fehlgeschlagen'}`,
        description: `Referenz ${input.anonymizedReference}`,
        contractId: activationCase.contractId,
        activationId,
        sourceKey: `activation_test:${activationId}:${input.anonymizedReference}`,
      },
      context,
    );

    if (input.result === 'failed') {
      await this.createBlockerInternal(
        activationId,
        {
          category: 'test',
          severity: 'warning',
          title: 'Testzahlung fehlgeschlagen',
          description: `Referenz ${input.anonymizedReference}`,
          relatedHardwareId: input.hardwareId ?? null,
        },
        context,
      );
    }

    const updated = await this.applyDerivedUpdate(activationId, context);
    return { ok: true, value: updated ?? activationCase };
  }

  // ---------------------------------------------------------------------
  // Blockers
  // ---------------------------------------------------------------------

  private async createBlockerInternal(
    activationId: string,
    input: {
      category: ActivationBlockerCategory;
      severity: ActivationBlockerSeverity;
      title: string;
      description: string;
      relatedHardwareId?: string | null;
      relatedApplicationId?: string | null;
      relatedChecklistItemId?: string | null;
    },
    context: UserContext,
  ): Promise<ActivationBlocker> {
    const timestamp = nowIso();
    const blocker: ActivationBlocker = {
      id: generateId('activation_blocker'),
      schemaVersion: CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION,
      activationId,
      category: input.category,
      severity: input.severity,
      status: 'open',
      title: input.title,
      description: input.description,
      relatedHardwareId: input.relatedHardwareId ?? null,
      relatedApplicationId: input.relatedApplicationId ?? null,
      relatedChecklistItemId: input.relatedChecklistItemId ?? null,
      createdAt: timestamp,
      createdByUserId: context.userId,
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: '',
    };
    const saved = await this.blockerRepository.create(blocker);

    if (input.severity === 'hard') {
      const activationCase = await this.activationRepository.getById(activationId);
      if (activationCase && canTransitionActivationStatus(activationCase.status, 'blocked')) {
        await this.activationRepository.update({
          ...activationCase,
          status: 'blocked',
          blockedFromStatus: activationCase.status,
          updatedAt: nowIso(),
          updatedByUserId: context.userId,
        });
      }
    } else {
      await this.applyDerivedUpdate(activationId, context);
    }

    return saved;
  }

  async createBlocker(
    activationId: string,
    input: {
      category: ActivationBlockerCategory;
      severity: ActivationBlockerSeverity;
      title: string;
      description: string;
    },
    context: UserContext,
  ): Promise<Result<ActivationBlocker>> {
    const permission = guard(context, 'activations.blockers');
    if (!permission.ok) return permission;
    if (!input.title.trim() || !input.description.trim()) {
      return { ok: false, error: 'validation', message: 'Titel und Beschreibung sind erforderlich.' };
    }
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };

    const blocker = await this.createBlockerInternal(activationId, input, context);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_blocker_created',
        title: `Blocker erfasst: ${blocker.title}`,
        description: blocker.description,
        contractId: activationCase.contractId,
        leadId: activationCase.leadId,
        activationId,
        sourceKey: `activation_blocker_created:${blocker.id}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: `Blocker lösen: ${blocker.title}`,
          type: 'resolve_activation_blocker',
          priority: blocker.severity === 'hard' ? 'urgent' : 'high',
          dueAt: endOfDayIso(),
          leadId: activationCase.leadId,
          offerId: activationCase.sourceOfferId,
          contractId: activationCase.contractId,
          activationId,
          sourceKey: `auto:resolve_activation_blocker:${blocker.id}`,
        },
        context,
      );
    }

    await this.auditService.logChange({
      context,
      action: 'activation_blocker_created',
      entityType: 'activation_blocker',
      entityId: blocker.id,
      summary: blocker.title,
    });

    return { ok: true, value: blocker };
  }

  async resolveBlocker(
    blockerId: string,
    solutionNote: string,
    context: UserContext,
  ): Promise<Result<ActivationBlocker>> {
    const permission = guard(context, 'activations.blockers');
    if (!permission.ok) return permission;
    if (!solutionNote.trim()) {
      return { ok: false, error: 'validation', message: 'Lösung ist erforderlich, um einen Blocker zu schließen.' };
    }
    const blocker = await this.blockerRepository.getById(blockerId);
    if (!blocker) return { ok: false, error: 'not_found' };
    if (blocker.status === 'resolved') return { ok: true, value: blocker };

    const timestamp = nowIso();
    const resolved: ActivationBlocker = {
      ...blocker,
      status: 'resolved',
      resolvedAt: timestamp,
      resolvedByUserId: context.userId,
      resolutionNote: solutionNote.trim(),
    };
    const saved = await this.blockerRepository.update(resolved);

    const activationCase = await this.activationRepository.getById(blocker.activationId);
    if (activationCase) {
      const remainingHard = (await this.blockerRepository.getByActivationId(blocker.activationId)).some(
        (entry) => entry.status === 'open' && entry.severity === 'hard',
      );
      if (!remainingHard && activationCase.status === 'blocked' && activationCase.blockedFromStatus) {
        await this.activationRepository.update({
          ...activationCase,
          status: activationCase.blockedFromStatus,
          blockedFromStatus: null,
          updatedAt: timestamp,
          updatedByUserId: context.userId,
        });
      }
      await this.applyDerivedUpdate(blocker.activationId, context);
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_blocker_resolved',
        title: `Blocker gelöst: ${saved.title}`,
        description: saved.resolutionNote,
        contractId: activationCase?.contractId ?? null,
        activationId: blocker.activationId,
        sourceKey: `activation_blocker_resolved:${saved.id}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'activation_blocker_resolved',
      entityType: 'activation_blocker',
      entityId: blockerId,
      summary: `${saved.title}: ${saved.resolutionNote}`,
    });

    return { ok: true, value: saved };
  }

  async listBlockers(activationId: string, context: UserContext): Promise<Result<ActivationBlocker[]>> {
    const activationResult = await this.getById(activationId, context);
    if (!activationResult.ok) return activationResult;
    return { ok: true, value: await this.blockerRepository.getByActivationId(activationId) };
  }

  // ---------------------------------------------------------------------
  // Go-live / completion / cancellation
  // ---------------------------------------------------------------------

  async confirmGoLive(activationId: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.go_live');
    if (!permission.ok) return permission;

    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!canTransitionActivationStatus(activationCase.status, 'live')) {
      return { ok: false, error: 'invalid_status', message: 'Go-live ist aus dem aktuellen Status nicht möglich.' };
    }

    const related = await this.loadRelated(activationId);
    const readiness = evaluateGoLiveReadiness(related.checklist, related.hardware, related.applications, related.blockers);
    if (!readiness.ready) {
      return { ok: false, error: 'not_ready', message: readiness.reasons.join('; ') };
    }

    const timestamp = nowIso();
    const updated: ActivationCase = {
      ...activationCase,
      status: 'live',
      confirmedGoLive: timestamp.slice(0, 10),
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    if (this.contractService) {
      const contract = await this.contractRepository.getById(activationCase.contractId);
      if (contract && contract.status !== 'active') {
        await this.contractService.transitionStatus(activationCase.contractId, 'active', context);
      }
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_go_live_confirmed',
        title: `Go-live bestätigt: ${updated.activationNumber}`,
        contractId: updated.contractId,
        leadId: updated.leadId,
        offerId: updated.sourceOfferId,
        activationId,
        sourceKey: `activation_go_live_confirmed:${activationId}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Aktivierung abschließen',
          type: 'complete_activation',
          priority: 'normal',
          dueAt: endOfDayIso(),
          leadId: updated.leadId,
          offerId: updated.sourceOfferId,
          contractId: updated.contractId,
          activationId,
          sourceKey: `auto:complete_activation:${activationId}`,
        },
        context,
      );
    }

    // Commission remains untouched here by design – only an audit note is recorded.
    // CommissionCalculationService is intentionally not called: go-live must never
    // implicitly set or change a commission status (esp. never "paid").
    await this.auditService.logChange({
      context,
      action: 'activation_go_live_confirmed',
      entityType: 'activation_case',
      entityId: activationId,
      summary: `Go-live für ${updated.activationNumber} bestätigt (Provision unverändert)`,
    });

    return { ok: true, value: updated };
  }

  async revokeGoLive(activationId: string, reason: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.go_live');
    if (!permission.ok) return permission;
    if (!reason.trim()) {
      return { ok: false, error: 'validation', message: 'Für die Rücknahme ist eine Begründung erforderlich.' };
    }
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (activationCase.status !== 'live') {
      return { ok: false, error: 'invalid_status', message: 'Nur eine live geschaltete Aktivierung kann zurückgenommen werden.' };
    }

    const timestamp = nowIso();
    const updated: ActivationCase = {
      ...activationCase,
      status: 'go_live_ready',
      confirmedGoLive: null,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_go_live_revoked',
        title: `Go-live zurückgenommen: ${updated.activationNumber}`,
        description: reason,
        contractId: updated.contractId,
        activationId,
        sourceKey: `activation_go_live_revoked:${activationId}:${timestamp}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'activation_go_live_revoked',
      entityType: 'activation_case',
      entityId: activationId,
      summary: reason,
    });

    return { ok: true, value: updated };
  }

  async completeActivation(activationId: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.complete');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };

    const related = await this.loadRelated(activationId);
    const readiness = evaluateCompletionReadiness(activationCase.status, related.checklist, related.blockers);
    if (!readiness.ready) {
      return { ok: false, error: 'not_ready', message: readiness.reasons.join('; ') };
    }

    const timestamp = nowIso();
    const updated: ActivationCase = {
      ...activationCase,
      status: 'completed',
      completedAt: timestamp,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_completed',
        title: `Aktivierung abgeschlossen: ${updated.activationNumber}`,
        contractId: updated.contractId,
        activationId,
        sourceKey: `activation_completed:${activationId}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Übergabe vorbereiten',
          type: 'handover_activation',
          priority: 'normal',
          dueAt: endOfDayIso(),
          leadId: updated.leadId,
          offerId: updated.sourceOfferId,
          contractId: updated.contractId,
          activationId,
          sourceKey: `auto:handover_activation:${activationId}`,
        },
        context,
      );
    }

    await this.auditService.logChange({
      context,
      action: 'activation_completed',
      entityType: 'activation_case',
      entityId: activationId,
      summary: `Aktivierung ${updated.activationNumber} abgeschlossen`,
    });

    return { ok: true, value: updated };
  }

  async cancelActivation(activationId: string, reason: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.cancel');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (!canTransitionActivationStatus(activationCase.status, 'cancelled')) {
      return { ok: false, error: 'invalid_status' };
    }

    const timestamp = nowIso();
    const updated: ActivationCase = {
      ...activationCase,
      status: 'cancelled',
      cancelledAt: timestamp,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_cancelled',
        title: `Aktivierung abgebrochen: ${updated.activationNumber}`,
        description: reason,
        contractId: updated.contractId,
        activationId,
        sourceKey: `activation_cancelled:${activationId}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'activation_cancelled',
      entityType: 'activation_case',
      entityId: activationId,
      summary: reason || `Aktivierung ${updated.activationNumber} abgebrochen`,
    });

    return { ok: true, value: updated };
  }

  async markHandoverReady(activationId: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.complete');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (activationCase.status !== 'completed') {
      return { ok: false, error: 'invalid_status', message: 'Übergabe erst nach Abschluss möglich.' };
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_handover_ready',
        title: `Übergabe vorbereitet: ${activationCase.activationNumber}`,
        contractId: activationCase.contractId,
        activationId,
        sourceKey: `activation_handover_ready:${activationId}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Übergabe an Kundenbetreuung bestätigen',
          type: 'handover_activation',
          priority: 'normal',
          dueAt: endOfDayIso(),
          contractId: activationCase.contractId,
          activationId,
          sourceKey: `auto:handover_activation:${activationId}`,
        },
        context,
      );
    }

    return { ok: true, value: activationCase };
  }

  async confirmHandover(activationId: string, context: UserContext): Promise<Result<ActivationCase>> {
    const permission = guard(context, 'activations.complete');
    if (!permission.ok) return permission;
    const activationCase = await this.activationRepository.getById(activationId);
    if (!activationCase) return { ok: false, error: 'not_found' };
    if (activationCase.status !== 'completed') {
      return { ok: false, error: 'invalid_status', message: 'Übergabe erst nach Abschluss möglich.' };
    }
    if (activationCase.handedOverAt) {
      return { ok: true, value: activationCase };
    }

    const timestamp = nowIso();
    const updated: ActivationCase = {
      ...activationCase,
      handedOverAt: timestamp,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    await this.activationRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'activation_handover_confirmed',
        title: `Übergabe bestätigt: ${updated.activationNumber}`,
        contractId: updated.contractId,
        activationId,
        sourceKey: `activation_handover_confirmed:${activationId}`,
      },
      context,
    );

    return { ok: true, value: updated };
  }

  // ---------------------------------------------------------------------
  // Automation / migration / diagnostics
  // ---------------------------------------------------------------------

  async ensureAutomaticTasks(activationCase: ActivationCase, context: UserContext): Promise<void> {
    if (!this.taskService) return;
    if (['completed', 'archived', 'cancelled'].includes(activationCase.status)) return;

    const stepTitles: Partial<Record<ActivationStatus, string>> = {
      draft: 'Aktivierung vorbereiten',
      preparation: 'Stammdaten und Vertrag prüfen',
      documents_pending: 'Unterlagen einholen',
      application_pending: 'Antrag einreichen',
      provider_review: 'Antrag nachverfolgen',
      hardware_pending: 'Hardware bestellen/versenden',
      setup_pending: 'Einrichtung durchführen',
      testing: 'Testzahlung durchführen',
      go_live_ready: 'Go-live bestätigen',
      live: 'Aktivierung abschließen',
      blocked: 'Blocker lösen',
    };
    const title = stepTitles[activationCase.status];
    if (!title) return;

    const taskType =
      activationCase.status === 'blocked'
        ? 'resolve_activation_blocker'
        : activationCase.status === 'go_live_ready'
          ? 'confirm_go_live'
          : activationCase.status === 'live'
            ? 'complete_activation'
            : activationCase.status === 'testing'
              ? 'record_test_payment'
              : activationCase.status === 'hardware_pending'
                ? 'ship_hardware'
                : activationCase.status === 'setup_pending'
                  ? 'setup_hardware'
                  : activationCase.status === 'application_pending' || activationCase.status === 'provider_review'
                    ? 'submit_activation_application'
                    : activationCase.status === 'documents_pending'
                      ? 'request_activation_document'
                      : 'review_activation_checklist';

    await this.taskService.ensureAutomaticTask(
      {
        title,
        type: taskType,
        priority: activationCase.priority === 'urgent' ? 'urgent' : activationCase.priority === 'high' ? 'high' : 'normal',
        dueAt: activationCase.nextDueAt ?? endOfDayIso(),
        assigneeUserId: activationCase.ownerUserId,
        leadId: activationCase.leadId,
        offerId: activationCase.sourceOfferId,
        contractId: activationCase.contractId,
        activationId: activationCase.id,
        sourceKey: `auto:activation_step:${activationCase.id}:${activationCase.status}`,
      },
      context,
    );
  }

  /** Conservative migration hint: contracts in an active fulfillment status without an ActivationCase. */
  async migrateCandidates(
    context: UserContext,
  ): Promise<Array<{ contractId: string; contractNumber: string; status: string }>> {
    if (!hasPermission(context.role, 'activations.view_team') && context.role !== 'admin') {
      return [];
    }
    const [contracts, cases] = await Promise.all([
      this.contractRepository.getAll(),
      this.activationRepository.getAll(),
    ]);
    const activatedContractIds = new Set(cases.map((entry) => entry.contractId));
    return contracts
      .filter((contract) => ['activation', 'active'].includes(contract.status))
      .filter((contract) => !activatedContractIds.has(contract.id))
      .map((contract) => ({ contractId: contract.id, contractNumber: contract.contractNumber, status: contract.status }));
  }
}
