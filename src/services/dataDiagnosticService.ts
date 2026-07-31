import type { DiagnosticFinding } from '../domain/diagnostic/diagnosticFinding';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
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
