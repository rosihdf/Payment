import type { ContractVersion } from '../contract/contractVersion';
import type { ActivationChecklistCategory } from './activationChecklist';

export const ACTIVATION_CHECKLIST_TEMPLATE_VERSION = 1;

export interface ActivationChecklistTemplateItem {
  category: ActivationChecklistCategory;
  key: string;
  title: string;
  description: string;
  required: boolean;
  evidenceRequired: boolean;
  dependsOnKeys: string[];
  sortOrder: number;
}

/**
 * Builds the checklist template for an activation from the agreed ContractVersion.
 * Pure and deterministic: depends only on the contract model, terminal count, acquiring
 * relevance and accessory lines. Never includes secrets, card data or generated documents.
 */
export function buildChecklistTemplateFromContractVersion(
  version: ContractVersion,
): ActivationChecklistTemplateItem[] {
  const items: ActivationChecklistTemplateItem[] = [];
  let order = 0;
  const next = () => {
    order += 1;
    return order;
  };
  const push = (item: Omit<ActivationChecklistTemplateItem, 'sortOrder'>) => {
    items.push({ ...item, sortOrder: next() });
  };

  const snapshot = version.snapshot;
  const hasAcquiring = snapshot.contractModel === 'acq_only' || snapshot.contractModel === 'terminal_plus_acq';
  const hasTerminals = snapshot.terminalCount > 0 || snapshot.hardware.length > 0;
  const hasAccessories = snapshot.accessoryLines.length > 0;

  push({
    category: 'stammdaten',
    key: 'stammdaten_pruefung',
    title: 'Stammdaten prüfen',
    description: 'Firmierung, Anschrift und Ansprechpartner aus der Vertragsversion prüfen.',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: [],
  });

  push({
    category: 'vertragspruefung',
    key: 'vertrag_bestaetigt',
    title: 'Vertragsdaten bestätigt',
    description: 'Laufzeit, Tarif und Hardware-Positionen der aktuellen Vertragsversion sind abgeglichen.',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: ['stammdaten_pruefung'],
  });

  push({
    category: 'unterlagen',
    key: 'unterlagen_vertrag',
    title: 'Unterschriebener Vertrag vorhanden',
    description: 'Kopie des unterschriebenen Vertrags liegt als Dokument vor.',
    required: true,
    evidenceRequired: true,
    dependsOnKeys: ['vertrag_bestaetigt'],
  });

  push({
    category: 'unterlagen',
    key: 'unterlagen_legitimation',
    title: 'Legitimationsunterlagen vollständig',
    description: 'Ausweis- bzw. Registerauszug-Kopie liegt vor (Metadaten only).',
    required: true,
    evidenceRequired: true,
    dependsOnKeys: ['vertrag_bestaetigt'],
  });

  push({
    category: 'haendlerantrag',
    key: 'haendlerantrag_erstellen',
    title: 'Händlerantrag erstellen',
    description: 'Antrag zur Händlereinrichtung manuell zusammenstellen und einreichen.',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: ['unterlagen_vertrag', 'unterlagen_legitimation'],
  });

  if (hasAcquiring) {
    push({
      category: 'acquiring',
      key: 'acquiring_antrag',
      title: 'Acquiring-Antrag einreichen',
      description: 'Acquiring-Antrag gemäß Vertragsmodell manuell einreichen.',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: ['haendlerantrag_erstellen'],
    });
  }

  if (hasTerminals) {
    snapshot.hardware.forEach((line, index) => {
      push({
        category: 'hardware',
        key: `hardware_bestellen_${index}`,
        title: `Hardware bestellen: ${line.quantity}× ${line.model || line.productName || 'Terminal'}`,
        description: 'Bestellung/Zuordnung der Terminaleinheiten aus der Vertragsversion.',
        required: true,
        evidenceRequired: false,
        dependsOnKeys: ['haendlerantrag_erstellen'],
      });
    });

    if (snapshot.hardware.length === 0) {
      push({
        category: 'hardware',
        key: 'hardware_bestellen_0',
        title: `Hardware bestellen: ${snapshot.terminalCount}× Terminal`,
        description: 'Bestellung/Zuordnung der Terminaleinheiten aus der Vertragsversion.',
        required: true,
        evidenceRequired: false,
        dependsOnKeys: ['haendlerantrag_erstellen'],
      });
    }

    const hardwareKeys = (snapshot.hardware.length > 0 ? snapshot.hardware.map((_, index) => `hardware_bestellen_${index}`) : ['hardware_bestellen_0']);

    push({
      category: 'versand',
      key: 'versand_planen',
      title: 'Versand planen und verfolgen',
      description: 'Versandweg dokumentieren, keine automatische Sendungsverfolgung.',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: hardwareKeys,
    });

    if (hasAccessories) {
      push({
        category: 'versand',
        key: 'versand_zubehoer',
        title: 'Zubehör versenden',
        description: 'Zubehörpositionen aus dem Vertrag mit versenden.',
        required: false,
        evidenceRequired: false,
        dependsOnKeys: ['versand_planen'],
      });
    }

    push({
      category: 'einrichtung',
      key: 'einrichtung_terminal',
      title: 'Terminal einrichten',
      description: 'Einrichtung vor Ort oder per Fernkonfiguration dokumentieren.',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: ['versand_planen'],
    });

    push({
      category: 'test',
      key: 'testzahlung_durchfuehren',
      title: 'Testzahlung durchführen',
      description: 'Testzahlung mit anonymisierter Referenz dokumentieren (keine Kartendaten).',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: ['einrichtung_terminal'],
    });
  } else {
    push({
      category: 'einrichtung',
      key: 'einrichtung_ohne_hardware',
      title: 'Einrichtung ohne Hardware bestätigen',
      description: 'Vertragsmodell ohne Terminal – Einrichtung des reinen Acquiring-Zugangs bestätigen.',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: ['haendlerantrag_erstellen'],
    });

    push({
      category: 'test',
      key: 'test_ohne_hardware',
      title: 'Funktionsprüfung ohne Terminal',
      description: 'Funktionsprüfung des Acquiring-Zugangs dokumentieren.',
      required: true,
      evidenceRequired: false,
      dependsOnKeys: ['einrichtung_ohne_hardware'],
    });
  }

  const testKey = hasTerminals ? 'testzahlung_durchfuehren' : 'test_ohne_hardware';

  push({
    category: 'go_live',
    key: 'go_live_freigabe',
    title: 'Go-live freigeben',
    description: 'Alle Pflichtpunkte erfüllt, keine offenen harten Blocker.',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: [testKey],
  });

  push({
    category: 'abschluss',
    key: 'abschluss_dokumentation',
    title: 'Abschlussdokumentation vervollständigen',
    description: 'Zusammenfassende Dokumentation der Aktivierung ablegen.',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: ['go_live_freigabe'],
  });

  push({
    category: 'uebergabe',
    key: 'uebergabe_kunde',
    title: 'Übergabe an Kundenbetreuung',
    description: 'Vorbereitung der Übergabe an die laufende Kundenbetreuung (Kundenportfolio).',
    required: true,
    evidenceRequired: false,
    dependsOnKeys: ['abschluss_dokumentation'],
  });

  return items;
}
