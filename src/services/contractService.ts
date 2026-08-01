import { buildContractVersionSnapshotFromOfferVersion } from '../domain/contract/buildContractVersionFromOffer';
import {
  compareContractVersions,
  evaluateContractChangeApproval,
} from '../domain/contract/compareContractVersions';
import type { Contract, ContractListItem, ContractMetrics } from '../domain/contract/contract';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from '../domain/contract/contract';
import {
  addDaysUtc,
  computeContractEndDate,
  computeEarliestTerminationDate,
  CONTRACT_DEADLINE_OFFSETS_DAYS,
  isWithinDays,
  toIsoDateOnly,
  validateContractDateRange,
} from '../domain/contract/contractDates';
import {
  buildContractSourceKey,
  generateNextContractNumber,
} from '../domain/contract/contractNumber';
import {
  canTransitionContractStatus,
  type ContractStatus,
} from '../domain/contract/contractStatus';
import type {
  ContractTermination,
  ContractTerminationChannel,
  ContractTerminationParty,
  ContractTerminationReason,
} from '../domain/contract/contractTermination';
import { CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION } from '../domain/contract/contractTermination';
import type {
  ContractChangeReason,
  ContractVersion,
  ContractVersionDiffEntry,
  ContractVersionSnapshot,
} from '../domain/contract/contractVersion';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from '../domain/contract/contractVersion';
import type { Permission } from '../domain/permission/permission';
import { hasPermission } from '../domain/permission/permission';
import {
  SALES_DOCUMENT_SCHEMA_VERSION,
  type SalesDocument,
  type SalesDocumentType,
} from '../domain/salesDocument/salesDocument';
import type { UserContext } from '../domain/user/user';
import type { CommissionCalculationRepository } from '../repositories/interfaces/CommissionCalculationRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { ContractTerminationRepository } from '../repositories/interfaces/ContractTerminationRepository';
import type { ContractVersionRepository } from '../repositories/interfaces/ContractVersionRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import type { SalesDocumentRepository } from '../repositories/interfaces/SalesDocumentRepository';
import type { SalesTaskRepository } from '../repositories/interfaces/SalesTaskRepository';
import { generateId, nowIso } from '../utils/id';
import { requirePermission } from './auditService';
import type { AuditService } from './auditService';
import type { SalesActivityService } from './salesActivityService';
import { endOfDayIso, type SalesTaskService } from './salesTaskService';

export type ContractError =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'invalid_status'
  | 'conflict'
  | 'not_accepted';

type Result<T> = { ok: true; value: T } | { ok: false; error: ContractError; message?: string };

export interface ContractFilters {
  query?: string;
  status?: ContractStatus | 'all' | 'active_group' | 'activation_group' | 'expiring' | 'termination' | 'ended_group';
  ownerUserId?: string | 'all' | 'mine';
  tariffQuery?: string;
  deadlineDays?: 30 | 60 | 90 | 180 | 'all';
  hasOpenTask?: boolean;
  hasPlannedChange?: boolean;
  sortBy?: 'deadline' | 'endDate' | 'updatedAt' | 'company' | 'contractNumber';
}

export interface CreateChangeInput {
  changeReason: ContractChangeReason;
  changeNote?: string;
  validFrom?: string | null;
  patch: Partial<ContractVersionSnapshot> & {
    customerContactFirstName?: string;
    customerContactLastName?: string;
    customerEmail?: string;
    customerStreet?: string;
    customerPostalCode?: string;
    customerCity?: string;
  };
}

export interface RecordTerminationInput {
  receivedAt?: string;
  requestedEndDate?: string | null;
  reason: ContractTerminationReason;
  otherReasonText?: string | null;
  channel?: ContractTerminationChannel;
  party?: ContractTerminationParty;
  comment?: string;
  winbackPossible?: boolean;
  evidenceDocumentId?: string | null;
  noticePeriodClear?: boolean;
}

function guard(
  context: UserContext,
  permission: Permission,
): { ok: true } | { ok: false; error: 'forbidden' } {
  const result = requirePermission(context, permission);
  return result.ok ? { ok: true } : { ok: false, error: 'forbidden' };
}

function canViewContract(contract: Contract, context: UserContext): boolean {
  if (hasPermission(context.role, 'contracts.view_team')) return true;
  if (!hasPermission(context.role, 'contracts.view_own')) return false;
  return contract.ownerUserId === context.userId || contract.createdByUserId === context.userId;
}

function deriveNextDeadline(contract: Contract): { at: string | null; label: string | null } {
  const candidates: Array<{ at: string; label: string }> = [];
  if (contract.earliestTerminationDate) {
    candidates.push({ at: contract.earliestTerminationDate, label: 'Kündigungsfrist' });
  }
  if (contract.endDate) {
    candidates.push({ at: contract.endDate, label: 'Vertragsende' });
  }
  if (contract.plannedChangeAt) {
    candidates.push({ at: contract.plannedChangeAt, label: 'Geplante Änderung' });
  }
  candidates.sort((a, b) => a.at.localeCompare(b.at));
  const next = candidates[0];
  return next ? { at: next.at, label: next.label } : { at: null, label: null };
}

export class ContractService {
  private taskService: SalesTaskService | null = null;
  private activityService: SalesActivityService | null = null;
  private readonly contractRepository: ContractRepository;
  private readonly versionRepository: ContractVersionRepository;
  private readonly terminationRepository: ContractTerminationRepository;
  private readonly offerRepository: OfferRepository;
  private readonly offerVersionRepository: OfferVersionRepository;
  private readonly salesDocumentRepository: SalesDocumentRepository;
  private readonly salesTaskRepository: SalesTaskRepository;
  private readonly commissionCalculationRepository: CommissionCalculationRepository;
  private readonly auditService: AuditService;

  constructor(
    contractRepository: ContractRepository,
    versionRepository: ContractVersionRepository,
    terminationRepository: ContractTerminationRepository,
    offerRepository: OfferRepository,
    offerVersionRepository: OfferVersionRepository,
    salesDocumentRepository: SalesDocumentRepository,
    salesTaskRepository: SalesTaskRepository,
    commissionCalculationRepository: CommissionCalculationRepository,
    auditService: AuditService,
  ) {
    this.contractRepository = contractRepository;
    this.versionRepository = versionRepository;
    this.terminationRepository = terminationRepository;
    this.offerRepository = offerRepository;
    this.offerVersionRepository = offerVersionRepository;
    this.salesDocumentRepository = salesDocumentRepository;
    this.salesTaskRepository = salesTaskRepository;
    this.commissionCalculationRepository = commissionCalculationRepository;
    this.auditService = auditService;
  }

  setSalesTaskService(service: SalesTaskService): void {
    this.taskService = service;
  }

  setSalesActivityService(service: SalesActivityService): void {
    this.activityService = service;
  }

  async createFromAcceptedOffer(
    offerId: string,
    context: UserContext,
    options: { startDate?: string | null } = {},
  ): Promise<Result<Contract>> {
    const permission = guard(context, 'contracts.create');
    if (!permission.ok) return permission;

    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found', message: 'Angebot nicht gefunden.' };

    const allowed = ['accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'];
    if (!allowed.includes(offer.workflowStatus)) {
      return {
        ok: false,
        error: 'not_accepted',
        message: 'Vertrag nur aus angenommenen Angeboten möglich.',
      };
    }

    const versionId = offer.currentVersionId;
    if (!versionId) {
      return { ok: false, error: 'validation', message: 'Keine angenommene Angebotsversion.' };
    }
    const offerVersion = await this.offerVersionRepository.getById(versionId);
    if (!offerVersion) {
      return { ok: false, error: 'validation', message: 'Angebotsversion fehlt.' };
    }

    const sourceKey = buildContractSourceKey(offerId, versionId);
    const existing = await this.contractRepository.getBySourceKey(sourceKey);
    if (existing) return { ok: true, value: existing };

    const byOffer = await this.contractRepository.getByOfferId(offerId);
    if (byOffer) return { ok: true, value: byOffer };

    const timestamp = nowIso();
    const allContracts = await this.contractRepository.getAll();
    const contractNumber = generateNextContractNumber(allContracts, timestamp);
    const commissionCases = await this.commissionCalculationRepository.getCasesByOfferId(offerId);
    const commissionCase = commissionCases[0] ?? null;

    const snapshot = buildContractVersionSnapshotFromOfferVersion(offerVersion, {
      startDate: options.startDate ?? toIsoDateOnly(new Date()),
      commissionCaseId: commissionCase?.id ?? null,
      expectedCommissionCents: commissionCase?.expectedAmountCents ?? null,
    });
    const dateError = validateContractDateRange(snapshot.startDate, snapshot.endDate);
    if (dateError) return { ok: false, error: 'validation', message: dateError };

    const contractId = generateId('contract');
    const version: ContractVersion = {
      id: generateId('contract_version'),
      schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
      contractId,
      versionNumber: 1,
      status: 'active',
      validFrom: snapshot.startDate,
      validTo: null,
      changeReason: 'initial',
      changeNote: 'Initialversion aus angenommenem Angebot',
      previousVersionId: null,
      sourceOfferVersionId: offerVersion.id,
      snapshot,
      approvalRequired: false,
      approvalReasons: [],
      approvedAt: timestamp,
      approvedByUserId: context.userId,
      activatedAt: timestamp,
      discardedAt: null,
      createdAt: timestamp,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };

    const earliestTerminationDate =
      snapshot.endDate && snapshot.noticePeriodMonths != null
        ? computeEarliestTerminationDate(snapshot.endDate, snapshot.noticePeriodMonths)
        : null;

    let status: ContractStatus = 'preparation';
    if (offer.workflowStatus === 'activation_pending') status = 'activation';
    if (
      offer.workflowStatus === 'activated' ||
      offer.workflowStatus === 'released' ||
      offer.workflowStatus === 'accounted' ||
      offer.workflowStatus === 'paid'
    ) {
      status = 'active';
    }

    const contract: Contract = {
      id: contractId,
      schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
      contractNumber,
      sourceKey,
      leadId: offer.leadId,
      sourceOfferId: offerId,
      acceptedOfferVersionId: offerVersion.id,
      currentVersionId: version.id,
      status,
      ownerUserId: offer.createdByUserId || context.userId,
      startDate: snapshot.startDate,
      termMonths: snapshot.termMonths,
      endDate: snapshot.endDate,
      noticePeriodMonths: snapshot.noticePeriodMonths,
      earliestTerminationDate,
      autoRenewal: snapshot.autoRenewal,
      renewalMonths: snapshot.renewalMonths,
      activationOfferId: offerId,
      commissionCaseId: commissionCase?.id ?? null,
      expectedCommissionCents: commissionCase?.expectedAmountCents ?? null,
      hardwareCount: snapshot.hardware.reduce((sum, line) => sum + line.quantity, 0),
      tariffName: snapshot.tariffSnapshot?.name ?? null,
      customerCompanyName: snapshot.customerSnapshot.companyName || 'Unbekannter Kunde',
      nextDeadlineAt: null,
      nextDeadlineLabel: null,
      plannedChangeAt: null,
      terminationId: null,
      createdAt: timestamp,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };

    const deadline = deriveNextDeadline(contract);
    contract.nextDeadlineAt = deadline.at;
    contract.nextDeadlineLabel = deadline.label;

    await this.versionRepository.create(version);
    await this.contractRepository.create(contract);

    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_created',
        title: `Vertrag ${contract.contractNumber} angelegt`,
        description: `Aus Angebot ${snapshot.sourceOfferNumber ?? offerId}`,
        leadId: contract.leadId,
        offerId,
        contractId: contract.id,
        contractVersionId: version.id,
        sourceKey: `contract_created:${contract.id}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Vertragsprüfung',
          type: 'review_contract',
          priority: 'high',
          dueAt: endOfDayIso(),
          leadId: contract.leadId,
          offerId,
          contractId: contract.id,
          contractVersionId: version.id,
          sourceKey: `auto:review_contract:${contract.id}`,
        },
        context,
      );
    }

    await this.ensureDeadlineTasks(contract.id, context);
    await this.registerContractDocument(
      contract.id,
      {
        type: 'contract',
        fileName: `${contract.contractNumber}_V1.pdf`,
        mimeType: 'application/pdf',
        externalReference: `generated:contract:${version.id}`,
        checksum: null,
        offerVersionId: offerVersion.id,
        contractVersionId: version.id,
        terminationId: null,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'contract_created',
      entityType: 'contract',
      entityId: contract.id,
      summary: `Vertrag ${contract.contractNumber} aus Angebot angelegt`,
      changes: [
        { field: 'sourceOfferId', before: null, after: offerId },
        { field: 'acceptedOfferVersionId', before: null, after: offerVersion.id },
      ],
    });

    return { ok: true, value: contract };
  }

  async getById(id: string, context: UserContext): Promise<Result<Contract>> {
    if (!hasPermission(context.role, 'contracts.view_own') && !hasPermission(context.role, 'contracts.view_team')) {
      return { ok: false, error: 'forbidden' };
    }
    const contract = await this.contractRepository.getById(id);
    if (!contract) return { ok: false, error: 'not_found' };
    if (!canViewContract(contract, context)) return { ok: false, error: 'forbidden' };
    return { ok: true, value: contract };
  }

  async getByOfferId(offerId: string, context: UserContext): Promise<Contract | null> {
    const contract = await this.contractRepository.getByOfferId(offerId);
    if (!contract) return null;
    return canViewContract(contract, context) ? contract : null;
  }

  async listVersions(contractId: string, context: UserContext): Promise<Result<ContractVersion[]>> {
    const contractResult = await this.getById(contractId, context);
    if (!contractResult.ok) return contractResult;
    return { ok: true, value: await this.versionRepository.getByContractId(contractId) };
  }

  async listTerminations(
    contractId: string,
    context: UserContext,
  ): Promise<Result<ContractTermination[]>> {
    const contractResult = await this.getById(contractId, context);
    if (!contractResult.ok) return contractResult;
    return { ok: true, value: await this.terminationRepository.getByContractId(contractId) };
  }

  async list(
    context: UserContext,
    filters: ContractFilters = {},
  ): Promise<Result<ContractListItem[]>> {
    if (!hasPermission(context.role, 'contracts.view_own') && !hasPermission(context.role, 'contracts.view_team')) {
      return { ok: false, error: 'forbidden' };
    }

    const [contracts, tasks] = await Promise.all([
      this.contractRepository.getAll(),
      this.salesTaskRepository.getAll(),
    ]);

    const openTasksByContract = new Map<string, string>();
    for (const task of tasks) {
      if (!task.contractId || (task.status !== 'open' && task.status !== 'in_progress')) continue;
      if (!openTasksByContract.has(task.contractId)) {
        openTasksByContract.set(task.contractId, task.title);
      }
    }

    let items = contracts.filter((contract) => canViewContract(contract, context));

    if (filters.ownerUserId === 'mine') {
      items = items.filter((contract) => contract.ownerUserId === context.userId);
    } else if (filters.ownerUserId && filters.ownerUserId !== 'all') {
      items = items.filter((contract) => contract.ownerUserId === filters.ownerUserId);
    }

    if (filters.status && filters.status !== 'all') {
      items = items.filter((contract) => {
        switch (filters.status) {
          case 'active_group':
            return contract.status === 'active';
          case 'activation_group':
            return contract.status === 'activation' || contract.status === 'preparation';
          case 'expiring':
            return contract.status === 'expiring' || isWithinDays(contract.endDate, 90);
          case 'termination':
            return (
              contract.status === 'termination_pending' ||
              contract.status === 'terminated' ||
              Boolean(contract.terminationId)
            );
          case 'ended_group':
            return (
              contract.status === 'ended' ||
              contract.status === 'archived' ||
              contract.status === 'cancelled_before_start'
            );
          default:
            return contract.status === filters.status;
        }
      });
    }

    if (filters.query) {
      const query = filters.query.toLowerCase();
      items = items.filter((contract) => {
        const haystack = [
          contract.contractNumber,
          contract.customerCompanyName,
          contract.tariffName ?? '',
          contract.leadId ?? '',
          contract.sourceOfferId ?? '',
          contract.acceptedOfferVersionId ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    if (filters.tariffQuery) {
      const query = filters.tariffQuery.toLowerCase();
      items = items.filter((contract) => (contract.tariffName ?? '').toLowerCase().includes(query));
    }

    if (filters.deadlineDays && filters.deadlineDays !== 'all') {
      items = items.filter((contract) => isWithinDays(contract.nextDeadlineAt, filters.deadlineDays as number));
    }

    if (filters.hasOpenTask) {
      items = items.filter((contract) => openTasksByContract.has(contract.id));
    }

    if (filters.hasPlannedChange) {
      items = items.filter((contract) => Boolean(contract.plannedChangeAt));
    }

    const sortBy = filters.sortBy ?? 'deadline';
    items.sort((a, b) => {
      const secondary = a.contractNumber.localeCompare(b.contractNumber);
      switch (sortBy) {
        case 'endDate':
          return (a.endDate ?? '').localeCompare(b.endDate ?? '') || secondary;
        case 'updatedAt':
          return b.updatedAt.localeCompare(a.updatedAt) || secondary;
        case 'company':
          return a.customerCompanyName.localeCompare(b.customerCompanyName) || secondary;
        case 'contractNumber':
          return a.contractNumber.localeCompare(b.contractNumber);
        case 'deadline':
        default:
          return (a.nextDeadlineAt ?? '9999').localeCompare(b.nextDeadlineAt ?? '9999') || secondary;
      }
    });

    return {
      ok: true,
      value: items.map((contract) => {
        const warnings: string[] = [];
        if (contract.status === 'suspended') warnings.push('Gesperrt');
        if (contract.status === 'termination_pending' || contract.status === 'terminated') {
          warnings.push('Kündigung');
        }
        if (isWithinDays(contract.endDate, 90)) warnings.push('Auslaufend');
        if (!contract.currentVersionId) warnings.push('Version fehlt');
        if (!contract.sourceOfferId) warnings.push('Ohne Angebotsbezug');
        return {
          ...contract,
          nextTaskTitle: openTasksByContract.get(contract.id) ?? null,
          warningLabels: warnings,
        };
      }),
    };
  }

  async getMetrics(context: UserContext): Promise<Result<ContractMetrics>> {
    const listResult = await this.list(context);
    if (!listResult.ok) return listResult;
    const items = listResult.value;
    const tasks = await this.salesTaskRepository.getAll();
    const contractsWithOpenTask = new Set(
      tasks
        .filter(
          (task) =>
            task.contractId && (task.status === 'open' || task.status === 'in_progress'),
        )
        .map((task) => task.contractId as string),
    );
    const acceptedWithout = await this.findAcceptedOffersWithoutContract(context);

    return {
      ok: true,
      value: {
        activeCount: items.filter((item) => item.status === 'active').length,
        activationCount: items.filter(
          (item) => item.status === 'activation' || item.status === 'preparation',
        ).length,
        expiringIn90Days: items.filter((item) => isWithinDays(item.endDate, 90)).length,
        openTerminations: items.filter(
          (item) =>
            item.status === 'termination_pending' ||
            (item.terminationId && item.status !== 'ended' && item.status !== 'archived'),
        ).length,
        plannedChanges: items.filter((item) => Boolean(item.plannedChangeAt)).length,
        renewalsDue: items.filter(
          (item) => item.autoRenewal && isWithinDays(item.endDate, 120),
        ).length,
        suspendedCount: items.filter((item) => item.status === 'suspended').length,
        withoutNextTask: items.filter(
          (item) =>
            !contractsWithOpenTask.has(item.id) &&
            item.status !== 'ended' &&
            item.status !== 'archived',
        ).length,
        acceptedOffersWithoutContract: acceptedWithout.length,
      },
    };
  }

  async findAcceptedOffersWithoutContract(
    context: UserContext,
  ): Promise<Array<{ offerId: string; offerNumber: string; workflowStatus: string }>> {
    if (!hasPermission(context.role, 'contracts.view_own') && !hasPermission(context.role, 'contracts.view_team')) {
      return [];
    }
    const [offers, contracts] = await Promise.all([
      this.offerRepository.getAll(),
      this.contractRepository.getAll(),
    ]);
    const linked = new Set(
      contracts.map((contract) => contract.sourceOfferId).filter((id): id is string => Boolean(id)),
    );
    return offers
      .filter((offer) =>
        ['accepted', 'activation_pending', 'activated'].includes(offer.workflowStatus),
      )
      .filter((offer) => !linked.has(offer.id))
      .map((offer) => ({
        offerId: offer.id,
        offerNumber: offer.offerNumber,
        workflowStatus: offer.workflowStatus,
      }));
  }

  async transitionStatus(
    contractId: string,
    nextStatus: ContractStatus,
    context: UserContext,
  ): Promise<Result<Contract>> {
    const permissionNeeded: Permission =
      nextStatus === 'suspended'
        ? 'contracts.suspend'
        : nextStatus === 'activation' || nextStatus === 'active'
          ? 'contracts.activate'
          : 'contracts.change';
    const permission = guard(context, permissionNeeded);
    if (!permission.ok) {
      if (nextStatus === 'suspended') return permission;
      const fallback = guard(context, 'contracts.change');
      if (!fallback.ok) return permission;
    }

    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found' };
    if (!canViewContract(contract, context)) return { ok: false, error: 'forbidden' };
    if (!canTransitionContractStatus(contract.status, nextStatus)) {
      return { ok: false, error: 'invalid_status', message: 'Statusübergang nicht erlaubt.' };
    }

    const updated: Contract = {
      ...contract,
      status: nextStatus,
      updatedAt: nowIso(),
      updatedByUserId: context.userId,
    };
    await this.contractRepository.update(updated);

    const activityType =
      nextStatus === 'suspended'
        ? 'contract_suspended'
        : nextStatus === 'active' && contract.status === 'suspended'
          ? 'contract_reactivated'
          : nextStatus === 'ended'
            ? 'contract_ended'
            : 'status_change';

    await this.activityService?.recordSystemActivity(
      {
        type: activityType,
        title: `Vertragsstatus: ${nextStatus}`,
        description: `${contract.status} → ${nextStatus}`,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        contractId: contract.id,
        sourceKey: `contract_status:${contract.id}:${nextStatus}:${updated.updatedAt}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'contract_status_changed',
      entityType: 'contract',
      entityId: contract.id,
      summary: `Status ${contract.status} → ${nextStatus}`,
      changes: [{ field: 'status', before: contract.status, after: nextStatus }],
    });

    return { ok: true, value: updated };
  }

  async syncFromOfferActivation(offerId: string, context: UserContext): Promise<Result<Contract | null>> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found' };

    let contract = await this.contractRepository.getByOfferId(offerId);
    if (!contract && ['accepted', 'activation_pending', 'activated'].includes(offer.workflowStatus)) {
      const created = await this.createFromAcceptedOffer(offerId, context);
      if (!created.ok) return created;
      contract = created.value;
    }
    if (!contract) return { ok: true, value: null };

    // Operatives Go-live/active kommt nur noch aus ActivationCase (ActivationService).
    // OfferActivation darf den Vertrag höchstens in den Aktivierungsstatus überführen.
    let next: ContractStatus | null = null;
    if (
      (offer.workflowStatus === 'activation_pending' ||
        offer.workflowStatus === 'activated' ||
        offer.workflowStatus === 'released' ||
        offer.workflowStatus === 'accounted' ||
        offer.workflowStatus === 'paid') &&
      contract.status === 'preparation'
    ) {
      next = 'activation';
    }

    if (!next || next === contract.status) {
      return { ok: true, value: contract };
    }
    return this.transitionStatus(contract.id, next, context);
  }

  async startChange(
    contractId: string,
    input: CreateChangeInput,
    context: UserContext,
  ): Promise<Result<ContractVersion>> {
    const permission = guard(context, 'contracts.change');
    if (!permission.ok) return permission;

    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found' };
    if (!canViewContract(contract, context)) return { ok: false, error: 'forbidden' };
    if (!contract.currentVersionId) {
      return { ok: false, error: 'validation', message: 'Keine aktuelle Version.' };
    }

    const current = await this.versionRepository.getById(contract.currentVersionId);
    if (!current) return { ok: false, error: 'validation', message: 'Aktuelle Version fehlt.' };

    const versions = await this.versionRepository.getByContractId(contractId);
    if (versions.some((version) => version.status === 'draft' || version.status === 'planned')) {
      return { ok: false, error: 'conflict', message: 'Es existiert bereits eine geplante Änderung.' };
    }

    const nextSnapshot: ContractVersionSnapshot = structuredClone(current.snapshot);
    const patch = input.patch;
    if (patch.tariffSnapshot !== undefined) nextSnapshot.tariffSnapshot = patch.tariffSnapshot;
    if (patch.termMonths !== undefined) {
      nextSnapshot.termMonths = patch.termMonths;
      if (nextSnapshot.startDate && patch.termMonths) {
        nextSnapshot.endDate = computeContractEndDate(nextSnapshot.startDate, patch.termMonths);
      }
    }
    if (patch.startDate !== undefined) nextSnapshot.startDate = patch.startDate;
    if (patch.endDate !== undefined) nextSnapshot.endDate = patch.endDate;
    if (patch.noticePeriodMonths !== undefined) nextSnapshot.noticePeriodMonths = patch.noticePeriodMonths;
    if (patch.contractModel !== undefined) nextSnapshot.contractModel = patch.contractModel;
    if (patch.terminalLines !== undefined) {
      nextSnapshot.terminalLines = patch.terminalLines;
      nextSnapshot.terminalCount = patch.terminalLines.reduce((sum, line) => sum + line.quantity, 0);
    }
    if (patch.accessoryLines !== undefined) nextSnapshot.accessoryLines = patch.accessoryLines;
    if (patch.hardware !== undefined) nextSnapshot.hardware = patch.hardware;
    if (patch.fees !== undefined) nextSnapshot.fees = { ...nextSnapshot.fees, ...patch.fees };
    if (patch.autoRenewal !== undefined) nextSnapshot.autoRenewal = patch.autoRenewal;
    if (patch.renewalMonths !== undefined) nextSnapshot.renewalMonths = patch.renewalMonths;
    if (patch.customerContactFirstName !== undefined) {
      nextSnapshot.customerSnapshot.contactFirstName = patch.customerContactFirstName;
    }
    if (patch.customerContactLastName !== undefined) {
      nextSnapshot.customerSnapshot.contactLastName = patch.customerContactLastName;
    }
    if (patch.customerEmail !== undefined) nextSnapshot.customerSnapshot.email = patch.customerEmail;
    if (patch.customerStreet !== undefined) nextSnapshot.customerSnapshot.street = patch.customerStreet;
    if (patch.customerPostalCode !== undefined) {
      nextSnapshot.customerSnapshot.postalCode = patch.customerPostalCode;
    }
    if (patch.customerCity !== undefined) nextSnapshot.customerSnapshot.city = patch.customerCity;

    const dateError = validateContractDateRange(nextSnapshot.startDate, nextSnapshot.endDate);
    if (dateError) return { ok: false, error: 'validation', message: dateError };

    const draft: ContractVersion = {
      id: generateId('contract_version'),
      schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
      contractId,
      versionNumber: Math.max(...versions.map((version) => version.versionNumber), 0) + 1,
      status: input.validFrom && input.validFrom > toIsoDateOnly(new Date()) ? 'planned' : 'draft',
      validFrom: input.validFrom ?? toIsoDateOnly(new Date()),
      validTo: null,
      changeReason: input.changeReason,
      changeNote: input.changeNote ?? '',
      previousVersionId: current.id,
      sourceOfferVersionId: null,
      snapshot: nextSnapshot,
      approvalRequired: false,
      approvalReasons: [],
      approvedAt: null,
      approvedByUserId: null,
      activatedAt: null,
      discardedAt: null,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };

    const diffs = compareContractVersions(current, draft);
    const approval = evaluateContractChangeApproval(diffs, input.changeReason);
    draft.approvalRequired = approval.approvalRequired;
    draft.approvalReasons = approval.approvalReasons;

    if (draft.approvalRequired && !hasPermission(context.role, 'contracts.change_approve')) {
      // Draft may be created; activation later requires approve
    }

    await this.versionRepository.create(draft);
    await this.contractRepository.update({
      ...contract,
      plannedChangeAt: draft.validFrom,
      updatedAt: nowIso(),
      updatedByUserId: context.userId,
    });

    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_version_created',
        title: `Vertragsversion ${draft.versionNumber} erstellt`,
        description: input.changeReason,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        contractId,
        contractVersionId: draft.id,
        sourceKey: `contract_version_created:${draft.id}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Vertragsänderung vorbereiten',
          type: 'prepare_contract_change',
          priority: draft.approvalRequired ? 'high' : 'normal',
          dueAt: endOfDayIso(),
          leadId: contract.leadId,
          offerId: contract.sourceOfferId,
          contractId,
          contractVersionId: draft.id,
          sourceKey: `auto:prepare_contract_change:${draft.id}`,
        },
        context,
      );
    }

    await this.auditService.logChange({
      context,
      action: 'contract_version_created',
      entityType: 'contract_version',
      entityId: draft.id,
      summary: `Version ${draft.versionNumber} für ${contract.contractNumber}`,
      changes: diffs.slice(0, 10).map((diff) => ({
        field: diff.field,
        before: diff.before,
        after: diff.after,
      })),
    });

    return { ok: true, value: draft };
  }

  async activateVersion(
    contractId: string,
    versionId: string,
    context: UserContext,
  ): Promise<Result<Contract>> {
    const version = await this.versionRepository.getById(versionId);
    if (!version || version.contractId !== contractId) {
      return { ok: false, error: 'not_found' };
    }
    if (version.status !== 'draft' && version.status !== 'planned') {
      return { ok: false, error: 'invalid_status', message: 'Nur Entwürfe/geplante Versionen aktivierbar.' };
    }
    if (version.approvalRequired && !hasPermission(context.role, 'contracts.change_approve')) {
      return { ok: false, error: 'forbidden', message: 'Freigabe erforderlich.' };
    }
    const changeGuard = guard(context, 'contracts.change');
    if (!changeGuard.ok && !hasPermission(context.role, 'contracts.change_approve')) {
      return changeGuard;
    }

    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found' };

    const versions = await this.versionRepository.getByContractId(contractId);
    const timestamp = nowIso();
    const validFrom = version.validFrom ?? toIsoDateOnly(new Date());

    for (const entry of versions) {
      if (entry.id === version.id) continue;
      if (entry.status === 'active') {
        const validTo = addDaysUtc(validFrom, -1);
        await this.versionRepository.update({
          ...entry,
          status: 'expired',
          validTo: validTo ?? entry.validTo,
        });
      }
    }

    const activated: ContractVersion = {
      ...version,
      status: 'active',
      validFrom,
      activatedAt: timestamp,
      approvedAt: version.approvedAt ?? timestamp,
      approvedByUserId: version.approvedByUserId ?? context.userId,
    };
    await this.versionRepository.update(activated);

    const earliestTerminationDate =
      activated.snapshot.endDate && activated.snapshot.noticePeriodMonths != null
        ? computeEarliestTerminationDate(
            activated.snapshot.endDate,
            activated.snapshot.noticePeriodMonths,
          )
        : null;

    const updated: Contract = {
      ...contract,
      currentVersionId: activated.id,
      startDate: activated.snapshot.startDate,
      termMonths: activated.snapshot.termMonths,
      endDate: activated.snapshot.endDate,
      noticePeriodMonths: activated.snapshot.noticePeriodMonths,
      earliestTerminationDate,
      autoRenewal: activated.snapshot.autoRenewal,
      renewalMonths: activated.snapshot.renewalMonths,
      hardwareCount: activated.snapshot.hardware.reduce((sum, line) => sum + line.quantity, 0),
      tariffName: activated.snapshot.tariffSnapshot?.name ?? contract.tariffName,
      customerCompanyName: activated.snapshot.customerSnapshot.companyName,
      plannedChangeAt: null,
      updatedAt: timestamp,
      updatedByUserId: context.userId,
    };
    const deadline = deriveNextDeadline(updated);
    updated.nextDeadlineAt = deadline.at;
    updated.nextDeadlineLabel = deadline.label;
    await this.contractRepository.update(updated);

    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_version_activated',
        title: `Version ${activated.versionNumber} aktiviert`,
        description: activated.changeReason,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        contractId,
        contractVersionId: activated.id,
        sourceKey: `contract_version_activated:${activated.id}`,
      },
      context,
    );

    await this.registerContractDocument(
      contractId,
      {
        type: 'contract_amendment',
        fileName: `${contract.contractNumber}_V${activated.versionNumber}_Nachtrag.pdf`,
        mimeType: 'application/pdf',
        externalReference: `generated:amendment:${activated.id}`,
        checksum: null,
        offerVersionId: null,
        contractVersionId: activated.id,
        terminationId: null,
      },
      context,
    );

    await this.ensureDeadlineTasks(contractId, context);
    await this.auditService.logChange({
      context,
      action: 'contract_version_activated',
      entityType: 'contract_version',
      entityId: activated.id,
      summary: `Version ${activated.versionNumber} aktiviert`,
    });

    return { ok: true, value: updated };
  }

  async discardVersion(
    contractId: string,
    versionId: string,
    context: UserContext,
  ): Promise<Result<ContractVersion>> {
    const permission = guard(context, 'contracts.change');
    if (!permission.ok) return permission;
    const version = await this.versionRepository.getById(versionId);
    if (!version || version.contractId !== contractId) return { ok: false, error: 'not_found' };
    if (version.status !== 'draft' && version.status !== 'planned') {
      return { ok: false, error: 'invalid_status' };
    }
    const discarded = {
      ...version,
      status: 'discarded' as const,
      discardedAt: nowIso(),
    };
    await this.versionRepository.update(discarded);
    const contract = await this.contractRepository.getById(contractId);
    if (contract) {
      await this.contractRepository.update({
        ...contract,
        plannedChangeAt: null,
        updatedAt: nowIso(),
        updatedByUserId: context.userId,
      });
    }
    return { ok: true, value: discarded };
  }

  async getVersionDiff(
    beforeVersionId: string,
    afterVersionId: string,
    context: UserContext,
  ): Promise<Result<ContractVersionDiffEntry[]>> {
    const [before, after] = await Promise.all([
      this.versionRepository.getById(beforeVersionId),
      this.versionRepository.getById(afterVersionId),
    ]);
    if (!before || !after) return { ok: false, error: 'not_found' };
    const contractResult = await this.getById(before.contractId, context);
    if (!contractResult.ok) return contractResult;
    return { ok: true, value: compareContractVersions(before, after) };
  }

  async recordTermination(
    contractId: string,
    input: RecordTerminationInput,
    context: UserContext,
  ): Promise<Result<ContractTermination>> {
    const permission = guard(context, 'contracts.terminate');
    if (!permission.ok) return permission;
    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found' };
    if (!canViewContract(contract, context)) return { ok: false, error: 'forbidden' };

    if (input.reason === 'other' && !input.otherReasonText?.trim()) {
      return { ok: false, error: 'validation', message: 'Bei Sonstiges ist eine Erläuterung Pflicht.' };
    }

    const receivedAt = input.receivedAt ?? toIsoDateOnly(new Date());
    let effectiveEndDate = input.requestedEndDate ?? contract.endDate;
    let noticePeriodClear = input.noticePeriodClear ?? true;
    let status: ContractTermination['status'] = 'recorded';

    if (contract.earliestTerminationDate && effectiveEndDate) {
      if (effectiveEndDate < contract.earliestTerminationDate) {
        noticePeriodClear = false;
        status = 'review_required';
      }
    } else if (!contract.earliestTerminationDate) {
      noticePeriodClear = false;
      status = 'review_required';
    }

    const termination: ContractTermination = {
      id: generateId('contract_termination'),
      schemaVersion: CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION,
      contractId,
      contractVersionId: contract.currentVersionId,
      status,
      receivedAt,
      requestedEndDate: input.requestedEndDate ?? null,
      effectiveEndDate,
      reason: input.reason,
      otherReasonText: input.otherReasonText ?? null,
      channel: input.channel ?? 'other',
      party: input.party ?? 'customer',
      documentedByUserId: context.userId,
      documentedAt: nowIso(),
      winbackPossible: input.winbackPossible ?? true,
      winbackStatus: input.winbackPossible === false ? 'none' : 'open',
      confirmedAt: null,
      completedAt: null,
      withdrawnAt: null,
      comment: input.comment ?? '',
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      noticePeriodClear,
      reviewNote: noticePeriodClear
        ? null
        : 'Kündigungsfrist unklar oder gewünschtes Ende vor nächstmöglichem Termin – keine automatische Rechtsbewertung.',
    };

    await this.terminationRepository.create(termination);
    await this.contractRepository.update({
      ...contract,
      terminationId: termination.id,
      status:
        status === 'review_required'
          ? contract.status
          : canTransitionContractStatus(contract.status, 'termination_pending')
            ? 'termination_pending'
            : contract.status,
      updatedAt: nowIso(),
      updatedByUserId: context.userId,
    });

    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_termination_recorded',
        title: 'Kündigung erfasst',
        description: input.reason,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        contractId,
        sourceKey: `contract_termination_recorded:${termination.id}`,
      },
      context,
    );

    if (this.taskService) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Kündigung bearbeiten',
          type: 'process_termination',
          priority: 'high',
          dueAt: endOfDayIso(),
          leadId: contract.leadId,
          offerId: contract.sourceOfferId,
          contractId,
          sourceKey: `auto:process_termination:${termination.id}`,
        },
        context,
      );
    }

    await this.auditService.logChange({
      context,
      action: 'contract_termination_recorded',
      entityType: 'contract_termination',
      entityId: termination.id,
      summary: `Kündigung für ${contract.contractNumber} erfasst`,
    });

    return { ok: true, value: termination };
  }

  async confirmTermination(
    terminationId: string,
    context: UserContext,
  ): Promise<Result<ContractTermination>> {
    const permission = guard(context, 'contracts.terminate');
    if (!permission.ok) return permission;
    const termination = await this.terminationRepository.getById(terminationId);
    if (!termination) return { ok: false, error: 'not_found' };
    if (termination.status === 'withdrawn' || termination.status === 'completed') {
      return { ok: false, error: 'invalid_status' };
    }
    if (termination.status === 'review_required' && !hasPermission(context.role, 'contracts.change_approve') && context.role !== 'admin') {
      return {
        ok: false,
        error: 'validation',
        message: 'Unklare Frist – Bestätigung nur mit Freigaberecht.',
      };
    }

    const confirmed: ContractTermination = {
      ...termination,
      status: 'confirmed',
      confirmedAt: nowIso(),
    };
    await this.terminationRepository.update(confirmed);

    const contract = await this.contractRepository.getById(termination.contractId);
    if (contract) {
      const nextStatus: ContractStatus =
        confirmed.effectiveEndDate && confirmed.effectiveEndDate > toIsoDateOnly(new Date())
          ? 'termination_pending'
          : 'terminated';
      if (canTransitionContractStatus(contract.status, nextStatus) || contract.status === nextStatus) {
        await this.contractRepository.update({
          ...contract,
          status: nextStatus,
          endDate: confirmed.effectiveEndDate ?? contract.endDate,
          updatedAt: nowIso(),
          updatedByUserId: context.userId,
        });
      }
    }

    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_termination_confirmed',
        title: 'Kündigung bestätigt',
        leadId: contract?.leadId ?? null,
        offerId: contract?.sourceOfferId ?? null,
        contractId: termination.contractId,
        sourceKey: `contract_termination_confirmed:${termination.id}`,
      },
      context,
    );

    await this.auditService.logChange({
      context,
      action: 'contract_termination_confirmed',
      entityType: 'contract_termination',
      entityId: termination.id,
      summary: 'Kündigung bestätigt',
    });

    return { ok: true, value: confirmed };
  }

  async withdrawTermination(
    terminationId: string,
    context: UserContext,
  ): Promise<Result<ContractTermination>> {
    const permission = guard(context, 'contracts.terminate');
    if (!permission.ok) return permission;
    const termination = await this.terminationRepository.getById(terminationId);
    if (!termination) return { ok: false, error: 'not_found' };
    const withdrawn = {
      ...termination,
      status: 'withdrawn' as const,
      withdrawnAt: nowIso(),
      winbackStatus: 'won' as const,
    };
    await this.terminationRepository.update(withdrawn);
    const contract = await this.contractRepository.getById(termination.contractId);
    if (contract && canTransitionContractStatus(contract.status, 'active')) {
      await this.contractRepository.update({
        ...contract,
        status: 'active',
        terminationId: null,
        updatedAt: nowIso(),
        updatedByUserId: context.userId,
      });
    }
    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_termination_withdrawn',
        title: 'Kündigung zurückgezogen',
        contractId: termination.contractId,
        leadId: contract?.leadId ?? null,
        offerId: contract?.sourceOfferId ?? null,
        sourceKey: `contract_termination_withdrawn:${termination.id}`,
      },
      context,
    );
    return { ok: true, value: withdrawn };
  }

  async startWinback(terminationId: string, context: UserContext): Promise<Result<ContractTermination>> {
    const permission = guard(context, 'contracts.terminate');
    if (!permission.ok) return permission;
    const termination = await this.terminationRepository.getById(terminationId);
    if (!termination) return { ok: false, error: 'not_found' };
    const updated = {
      ...termination,
      status: 'winback' as const,
      winbackPossible: true,
      winbackStatus: 'open' as const,
    };
    await this.terminationRepository.update(updated);
    const contract = await this.contractRepository.getById(termination.contractId);
    if (this.taskService && contract) {
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Rückgewinnung',
          type: 'winback',
          priority: 'high',
          dueAt: endOfDayIso(),
          leadId: contract.leadId,
          offerId: contract.sourceOfferId,
          contractId: contract.id,
          sourceKey: `auto:winback:${termination.id}`,
        },
        context,
      );
    }
    return { ok: true, value: updated };
  }

  async extendContract(
    contractId: string,
    input: { additionalMonths: number; validFrom?: string | null; changeTariffName?: string | null },
    context: UserContext,
  ): Promise<Result<ContractVersion>> {
    const permission = guard(context, 'contracts.extend');
    if (!permission.ok) return permission;
    const contract = await this.contractRepository.getById(contractId);
    if (!contract?.currentVersionId) return { ok: false, error: 'not_found' };
    const current = await this.versionRepository.getById(contract.currentVersionId);
    if (!current) return { ok: false, error: 'not_found' };
    const termMonths = (current.snapshot.termMonths ?? 0) + input.additionalMonths;
    const startDate = current.snapshot.startDate;
    const endDate = startDate ? computeContractEndDate(startDate, termMonths) : null;
    return this.startChange(
      contractId,
      {
        changeReason: 'renewal',
        changeNote: `Verlängerung um ${input.additionalMonths} Monate`,
        validFrom: input.validFrom,
        patch: {
          termMonths,
          endDate,
          tariffSnapshot: input.changeTariffName
            ? {
                ...(current.snapshot.tariffSnapshot as NonNullable<typeof current.snapshot.tariffSnapshot>),
                name: input.changeTariffName,
              }
            : current.snapshot.tariffSnapshot,
        },
      },
      context,
    );
  }

  async changeTariff(
    contractId: string,
    input: { tariffSnapshot: ContractVersionSnapshot['tariffSnapshot']; validFrom?: string | null; changeNote?: string },
    context: UserContext,
  ): Promise<Result<ContractVersion>> {
    return this.startChange(
      contractId,
      {
        changeReason: 'tariff_change',
        changeNote: input.changeNote ?? 'Tarifwechsel',
        validFrom: input.validFrom,
        patch: { tariffSnapshot: input.tariffSnapshot },
      },
      context,
    );
  }

  async changeHardware(
    contractId: string,
    input: { hardware: ContractVersionSnapshot['hardware']; validFrom?: string | null; changeNote?: string },
    context: UserContext,
  ): Promise<Result<ContractVersion>> {
    return this.startChange(
      contractId,
      {
        changeReason: 'terminal_model_change',
        changeNote: input.changeNote ?? 'Hardwareänderung',
        validFrom: input.validFrom,
        patch: { hardware: input.hardware },
      },
      context,
    );
  }

  async completeTermination(
    terminationId: string,
    context: UserContext,
  ): Promise<Result<ContractTermination>> {
    const permission = guard(context, 'contracts.terminate');
    if (!permission.ok) return permission;
    const termination = await this.terminationRepository.getById(terminationId);
    if (!termination) return { ok: false, error: 'not_found' };
    if (termination.status !== 'confirmed') {
      return { ok: false, error: 'invalid_status', message: 'Nur bestätigte Kündigungen können abgeschlossen werden.' };
    }
    const completed: ContractTermination = {
      ...termination,
      status: 'completed',
      completedAt: nowIso(),
    };
    await this.terminationRepository.update(completed);
    const contract = await this.contractRepository.getById(termination.contractId);
    if (contract && canTransitionContractStatus(contract.status, 'ended')) {
      await this.contractRepository.update({
        ...contract,
        status: 'ended',
        updatedAt: nowIso(),
        updatedByUserId: context.userId,
      });
    }
    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_ended',
        title: 'Vertrag beendet',
        contractId: termination.contractId,
        leadId: contract?.leadId ?? null,
        offerId: contract?.sourceOfferId ?? null,
        sourceKey: `contract_ended:${termination.contractId}`,
      },
      context,
    );
    await this.auditService.logChange({
      context,
      action: 'contract_termination_confirmed',
      entityType: 'contract_termination',
      entityId: termination.id,
      summary: 'Kündigung abgeschlossen, Vertrag beendet',
    });
    return { ok: true, value: completed };
  }

  async ensureDeadlineTasks(contractId: string, context: UserContext): Promise<void> {
    if (!this.taskService) return;
    const contract = await this.contractRepository.getById(contractId);
    if (!contract?.endDate) return;

    for (const days of CONTRACT_DEADLINE_OFFSETS_DAYS) {
      if (!isWithinDays(contract.endDate, days)) continue;
      const title =
        days === 180
          ? 'Vertragsende in 180 Tagen prüfen'
          : days === 120
            ? 'Verlängerung vorbereiten'
            : days === 90
              ? 'Kündigungsfrist nachfassen'
              : 'Vertragsabschluss prüfen';
      await this.taskService.ensureAutomaticTask(
        {
          title,
          type: days <= 90 ? 'check_termination_deadline' : 'prepare_renewal',
          priority: days <= 30 ? 'urgent' : 'high',
          dueAt: endOfDayIso(),
          assigneeUserId: contract.ownerUserId,
          leadId: contract.leadId,
          offerId: contract.sourceOfferId,
          contractId: contract.id,
          sourceKey: `auto:contract_deadline:${contract.id}:${days}`,
        },
        context,
      );
    }
  }

  async registerContractDocument(
    contractId: string,
    input: {
      type: SalesDocumentType;
      fileName: string;
      mimeType: string;
      externalReference: string | null;
      checksum: string | null;
      offerVersionId: string | null;
      contractVersionId: string | null;
      terminationId: string | null;
    },
    context: UserContext,
  ): Promise<Result<SalesDocument>> {
    const permission = guard(context, 'contracts.documents');
    if (!permission.ok) return permission;
    const contract = await this.contractRepository.getById(contractId);
    if (!contract) return { ok: false, error: 'not_found' };

    const document: SalesDocument = {
      id: generateId('sales_document'),
      schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
      offerId: contract.sourceOfferId,
      offerVersionId: input.offerVersionId,
      contractId,
      contractVersionId: input.contractVersionId,
      terminationId: input.terminationId,
      activationId: null,
      type: input.type,
      fileName: input.fileName,
      mimeType: input.mimeType,
      externalReference: input.externalReference,
      checksum: input.checksum,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };
    await this.salesDocumentRepository.create(document);
    await this.activityService?.recordSystemActivity(
      {
        type: 'contract_document_created',
        title: `Dokument ${input.fileName}`,
        contractId,
        contractVersionId: input.contractVersionId,
        leadId: contract.leadId,
        offerId: contract.sourceOfferId,
        sourceKey: `contract_document:${document.id}`,
      },
      context,
    );
    return { ok: true, value: document };
  }

  async listDocuments(contractId: string, context: UserContext): Promise<Result<SalesDocument[]>> {
    const contractResult = await this.getById(contractId, context);
    if (!contractResult.ok) return contractResult;
    const all = await this.salesDocumentRepository.getAll();
    return {
      ok: true,
      value: all.filter((document) => document.contractId === contractId),
    };
  }

  /** Mark contracts as expiring when end date approaches – explicit service action, not render-side mutation. */
  async refreshExpiringFlags(context: UserContext): Promise<number> {
    if (!hasPermission(context.role, 'contracts.change') && context.role !== 'admin') {
      return 0;
    }
    const contracts = await this.contractRepository.getAll();
    let changed = 0;
    for (const contract of contracts) {
      if (contract.status !== 'active') continue;
      if (!isWithinDays(contract.endDate, 90)) continue;
      if (!canTransitionContractStatus(contract.status, 'expiring')) continue;
      await this.contractRepository.update({
        ...contract,
        status: 'expiring',
        updatedAt: nowIso(),
        updatedByUserId: context.userId,
      });
      changed += 1;
    }
    return changed;
  }
}
