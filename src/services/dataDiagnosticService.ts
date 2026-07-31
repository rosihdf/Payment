import type { DiagnosticFinding } from '../domain/diagnostic/diagnosticFinding';
import {
  normalizeContracts,
  normalizeContractTerminations,
  normalizeContractVersions,
} from '../domain/contract/normalizeContract';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
import {
  normalizeActivationApplications,
  normalizeActivationBlockers,
  normalizeActivationCases,
  normalizeActivationChecklistItems,
  normalizeActivationHardwareList,
} from '../domain/activation/normalizeActivation';
import type { UserContext } from '../domain/user/user';
import { generateId } from '../utils/id';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';

export class DataDiagnosticService {
  private readonly auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  async runDiagnostics(context: UserContext): Promise<DiagnosticFinding[] | { error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.system');
    if (!guard.ok) {
      return { error: 'forbidden' };
    }

    const findings: DiagnosticFinding[] = [];
    const leads = readStorageItem<unknown[]>(STORAGE_KEYS.leads) ?? [];
    const leadIds = new Set(
      leads
        .map((entry) => (typeof entry === 'object' && entry && 'id' in entry ? String((entry as { id: unknown }).id) : ''))
        .filter(Boolean),
    );

    const offers = normalizeOffers(readStorageItem<unknown[]>(STORAGE_KEYS.offers) ?? []);
    const offerIds = new Set(offers.map((offer) => offer.id));
    const offerNumbers = new Map<string, string>();

    for (const offer of offers) {
      if (offerNumbers.has(offer.offerNumber)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'offer',
          entityId: offer.id,
          description: `Doppelte Angebotsnummer ${offer.offerNumber}`,
          recommendedAction: 'Angebotsnummer prüfen und korrigieren',
          autoRepairable: false,
          repairKey: null,
        });
      } else {
        offerNumbers.set(offer.offerNumber, offer.id);
      }

      if (!leadIds.has(offer.leadId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'offer',
          entityId: offer.id,
          description: 'Leadreferenz fehlt',
          recommendedAction: 'Lead zuordnen oder Angebot prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const versions = normalizeOfferVersions(readStorageItem<unknown[]>(STORAGE_KEYS.offerVersions) ?? []);
    const versionsByOffer = new Map<string, number>();

    for (const version of versions) {
      if (!offerIds.has(version.offerId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'offer_version',
          entityId: version.id,
          description: 'OfferVersion ohne Offer',
          recommendedAction: 'Verwaiste Version isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }

      versionsByOffer.set(version.offerId, (versionsByOffer.get(version.offerId) ?? 0) + 1);
    }

    for (const offer of offers) {
      if (offer.currentVersionId && !versions.some((version) => version.id === offer.currentVersionId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'offer',
          entityId: offer.id,
          description: 'Aktuelle Version ungültig',
          recommendedAction: 'Version neu zuordnen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const tasks = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? [];
    for (const task of tasks) {
      if (!task || typeof task !== 'object') {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'task',
          entityId: 'unknown',
          description: 'Beschädigter Aufgabeneintrag',
          recommendedAction: 'Eintrag entfernen',
          autoRepairable: true,
          repairKey: 'remove_damaged_task',
        });
        continue;
      }
      const row = task as Record<string, unknown>;
      const targetOfferId = typeof row.offerId === 'string' ? row.offerId : null;
      const targetLeadId = typeof row.leadId === 'string' ? row.leadId : null;
      if (targetOfferId && !offerIds.has(targetOfferId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'task',
          entityId: String(row.id ?? 'unknown'),
          description: 'Aufgabe ohne gültiges Offer',
          recommendedAction: 'Aufgabe prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
      if (targetLeadId && !leadIds.has(targetLeadId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'task',
          entityId: String(row.id ?? 'unknown'),
          description: 'Aufgabe ohne gültigen Lead',
          recommendedAction: 'Aufgabe prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const contracts = normalizeContracts(readStorageItem(STORAGE_KEYS.contracts) ?? []);
    const contractVersions = normalizeContractVersions(
      readStorageItem(STORAGE_KEYS.contractVersions) ?? [],
    );
    const terminations = normalizeContractTerminations(
      readStorageItem(STORAGE_KEYS.contractTerminations) ?? [],
    );
    const contractIds = new Set(contracts.map((contract) => contract.id));
    const contractNumbers = new Map<string, string>();
    const contractsByOffer = new Map<string, string[]>();

    for (const contract of contracts) {
      if (contractNumbers.has(contract.contractNumber)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'contract',
          entityId: contract.id,
          description: `Doppelte Vertragsnummer ${contract.contractNumber}`,
          recommendedAction: 'Vertragsnummer prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      } else {
        contractNumbers.set(contract.contractNumber, contract.id);
      }

      if (contract.sourceOfferId) {
        const list = contractsByOffer.get(contract.sourceOfferId) ?? [];
        list.push(contract.id);
        contractsByOffer.set(contract.sourceOfferId, list);
      }

      if (!contract.currentVersionId || !contractVersions.some((version) => version.id === contract.currentVersionId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'contract',
          entityId: contract.id,
          description: 'Contract ohne aktuelle Version',
          recommendedAction: 'Version zuordnen',
          autoRepairable: false,
          repairKey: null,
        });
      }

      if (contract.leadId && !leadIds.has(contract.leadId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'contract',
          entityId: contract.id,
          description: 'Contract mit fehlendem Lead',
          recommendedAction: 'Leadreferenz prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }

      if (contract.sourceOfferId && !offerIds.has(contract.sourceOfferId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'contract',
          entityId: contract.id,
          description: 'Contract mit fehlendem Ursprungsoffer',
          recommendedAction: 'Als Import/Fehlerbestand prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }

      if (
        contract.startDate &&
        contract.endDate &&
        contract.endDate < contract.startDate
      ) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'contract',
          entityId: contract.id,
          description: 'Ungültige Laufzeit (Ende vor Beginn)',
          recommendedAction: 'Laufzeit korrigieren',
          autoRepairable: false,
          repairKey: null,
        });
      }

      if (
        contract.status === 'ended' &&
        contract.startDate &&
        contract.endDate &&
        contract.endDate < contract.startDate
      ) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'contract',
          entityId: contract.id,
          description: 'ended vor Vertragsbeginn',
          recommendedAction: 'Status und Daten prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const [offerId, linked] of contractsByOffer) {
      if (linked.length > 1) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'contract',
          entityId: offerId,
          description: 'Mehrere Verträge für dasselbe Offer',
          recommendedAction: 'Doppelte Vertragserzeugung prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const offer of offers) {
      if (
        ['accepted', 'activation_pending', 'activated'].includes(offer.workflowStatus) &&
        !contractsByOffer.has(offer.id)
      ) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'contract',
          entityId: offer.id,
          description: 'Angenommenes Offer ohne Vertrag',
          recommendedAction: 'Vertrag kontrolliert anlegen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const activeByContract = new Map<string, number>();
    for (const version of contractVersions) {
      if (!contractIds.has(version.contractId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'contract_version',
          entityId: version.id,
          description: 'ContractVersion ohne Contract',
          recommendedAction: 'Verwaiste Version isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
      if (version.status === 'active') {
        activeByContract.set(
          version.contractId,
          (activeByContract.get(version.contractId) ?? 0) + 1,
        );
      }
    }

    for (const [contractId, count] of activeByContract) {
      if (count > 1) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'contract_version',
          entityId: contractId,
          description: 'Mehrere aktive Vertragsversionen',
          recommendedAction: 'Nur eine aktive Version behalten',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const termination of terminations) {
      if (!contractIds.has(termination.contractId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'contract_termination',
          entityId: termination.id,
          description: 'Kündigung ohne Contract',
          recommendedAction: 'Kündigung prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
      if (
        termination.requestedEndDate &&
        termination.receivedAt &&
        termination.requestedEndDate < termination.receivedAt.slice(0, 10)
      ) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'contract_termination',
          entityId: termination.id,
          description: 'Kündigungsdatum vor Eingang',
          recommendedAction: 'Fristen prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const task of tasks) {
      if (!task || typeof task !== 'object') continue;
      const row = task as Record<string, unknown>;
      const contractId = typeof row.contractId === 'string' ? row.contractId : null;
      if (contractId && !contractIds.has(contractId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'task',
          entityId: String(row.id ?? 'unknown'),
          description: 'Task mit fehlendem Contract',
          recommendedAction: 'Contract-Bezug prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const activationCases = normalizeActivationCases(readStorageItem(STORAGE_KEYS.activationCases) ?? []);
    const activationChecklists = normalizeActivationChecklistItems(
      readStorageItem(STORAGE_KEYS.activationChecklists) ?? [],
    );
    const activationApplications = normalizeActivationApplications(
      readStorageItem(STORAGE_KEYS.activationApplications) ?? [],
    );
    const activationHardware = normalizeActivationHardwareList(
      readStorageItem(STORAGE_KEYS.activationHardware) ?? [],
    );
    const activationBlockers = normalizeActivationBlockers(
      readStorageItem(STORAGE_KEYS.activationBlockers) ?? [],
    );
    const activationIds = new Set(activationCases.map((activation) => activation.id));
    const activationNumbers = new Map<string, string>();
    const activationsByContract = new Map<string, string[]>();

    for (const activation of activationCases) {
      if (activationNumbers.has(activation.activationNumber)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'activation_case',
          entityId: activation.id,
          description: `Doppelte Aktivierungsnummer ${activation.activationNumber}`,
          recommendedAction: 'Aktivierungsnummer prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      } else {
        activationNumbers.set(activation.activationNumber, activation.id);
      }

      if (!contractIds.has(activation.contractId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'activation_case',
          entityId: activation.id,
          description: 'Aktivierung ohne gültigen Vertrag',
          recommendedAction: 'Vertragsbezug prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      } else {
        const list = activationsByContract.get(activation.contractId) ?? [];
        list.push(activation.id);
        activationsByContract.set(activation.contractId, list);
      }

      if (
        activation.contractVersionId &&
        !contractVersions.some((version) => version.id === activation.contractVersionId)
      ) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'activation_case',
          entityId: activation.id,
          description: 'Aktivierung mit fehlender Vertragsversion',
          recommendedAction: 'Vertragsversion prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const [contractId, linked] of activationsByContract) {
      if (linked.length > 1) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'critical',
          area: 'activation_case',
          entityId: contractId,
          description: 'Mehrere Aktivierungen für denselben Vertrag',
          recommendedAction: 'Doppelte Aktivierungserzeugung prüfen',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const item of activationChecklists) {
      if (!activationIds.has(item.activationId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'activation_checklist',
          entityId: item.id,
          description: 'Checklistenpunkt ohne Aktivierung',
          recommendedAction: 'Verwaisten Eintrag isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    for (const application of activationApplications) {
      if (!activationIds.has(application.activationId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'activation_application',
          entityId: application.id,
          description: 'Antrag ohne Aktivierung',
          recommendedAction: 'Verwaisten Eintrag isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const hardwareSerials = new Map<string, string>();
    for (const hardware of activationHardware) {
      if (!activationIds.has(hardware.activationId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'activation_hardware',
          entityId: hardware.id,
          description: 'Hardwareeinheit ohne Aktivierung',
          recommendedAction: 'Verwaisten Eintrag isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
      if (hardware.serialNumber) {
        const existing = hardwareSerials.get(hardware.serialNumber);
        if (existing && existing !== hardware.id) {
          findings.push({
            id: generateId('diagnostic'),
            severity: 'warning',
            area: 'activation_hardware',
            entityId: hardware.id,
            description: `Seriennummer ${hardware.serialNumber} mehrfach vergeben`,
            recommendedAction: 'Seriennummern prüfen',
            autoRepairable: false,
            repairKey: null,
          });
        } else {
          hardwareSerials.set(hardware.serialNumber, hardware.id);
        }
      }
    }

    for (const blocker of activationBlockers) {
      if (!activationIds.has(blocker.activationId)) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'error',
          area: 'activation_blocker',
          entityId: blocker.id,
          description: 'Blocker ohne Aktivierung',
          recommendedAction: 'Verwaisten Eintrag isolieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
      if (blocker.status === 'resolved' && !blocker.resolutionNote) {
        findings.push({
          id: generateId('diagnostic'),
          severity: 'warning',
          area: 'activation_blocker',
          entityId: blocker.id,
          description: 'Gelöster Blocker ohne Lösungsvermerk',
          recommendedAction: 'Lösung dokumentieren',
          autoRepairable: false,
          repairKey: null,
        });
      }
    }

    const seenIds = new Set<string>();
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = readStorageItem<unknown[]>(key);
      if (!Array.isArray(raw)) {
        continue;
      }
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const id = 'id' in entry ? String((entry as { id: unknown }).id) : '';
        if (!id) {
          continue;
        }
        const composite = `${key}:${id}`;
        if (seenIds.has(composite)) {
          findings.push({
            id: generateId('diagnostic'),
            severity: 'critical',
            area: 'storage',
            entityId: id,
            description: `Doppelte ID in ${key}`,
            recommendedAction: 'Datensatz prüfen',
            autoRepairable: false,
            repairKey: null,
          });
        }
        seenIds.add(composite);
      }
    }

    return findings;
  }

  async repairFinding(
    context: UserContext,
    finding: DiagnosticFinding,
  ): Promise<{ ok: true } | { ok: false; error: 'forbidden' | 'unsupported' }> {
    const guard = requirePermission(context, 'admin.system');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    if (!finding.autoRepairable || finding.repairKey !== 'remove_damaged_task') {
      return { ok: false, error: 'unsupported' };
    }

    const tasks = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? [];
    const cleaned = tasks.filter((task) => task && typeof task === 'object');
    localStorage.setItem(STORAGE_KEYS.salesTasks, JSON.stringify(cleaned));

    await this.auditService.logChange({
      context,
      action: 'diagnostic_repair',
      entityType: 'system',
      entityId: finding.id,
      summary: finding.description,
    });

    return { ok: true };
  }
}
