import type { SalesWizardStepId } from '../bestPayComparison/salesWizard';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';

export const SALES_GUIDE_PRINCIPLE = {
  title: 'AMRtech Payment verkauft Vertrauen',
  summary:
    'AMRtech Payment verkauft keine Terminals – sondern Beratung, Transparenz, Service und langfristige Partnerschaft.',
  reminders: [
    'Transparenz statt Verkaufsdruck.',
    'Kein Kunde muss vor Ort unterschreiben.',
    'Der Kunde soll das Angebot in Ruhe prüfen.',
    'Ein Vergleich mit Mitbewerbern ist ausdrücklich erlaubt.',
    'Fragen und Änderungen sind erwünscht.',
    'Ein Vertrag entsteht erst nach Annahme.',
    'Langfristige Kundenzufriedenheit vor schnellem Abschluss.',
  ],
} as const;

export const NO_SIGNATURE_REQUIRED_MESSAGE =
  'Dieses Angebot muss heute nicht unterschrieben werden.';

export const OFFER_REVIEW_TIME_MESSAGE =
  'Geben Sie dem Kunden ausreichend Zeit zur Prüfung.';

export const CUSTOMER_MAY_REVIEW_AT_HOME =
  '„Ich möchte das Angebot zuhause noch einmal prüfen.“ – das ist ausdrücklich gewünscht.';

export const COMPETITOR_COMPARISON_ALLOWED =
  'Ein Vergleich mit anderen Anbietern ist ausdrücklich möglich.';

export const APPROVAL_DEVIATION_FIELD_MESSAGE =
  'Dieses Angebot weicht vom Standard ab und muss vor der Kundenvorlage freigegeben werden.';

export const APPROVAL_WAITING_STATUS_LABEL = 'Wartet auf Freigabe';
export const APPROVAL_CHANGES_STATUS_LABEL = 'Änderung erforderlich';
export const APPROVAL_APPROVED_STATUS_LABEL = 'Freigegeben';
export const APPROVAL_REJECTED_STATUS_LABEL = 'Abgelehnt';

export type SalesGuideContext =
  | 'hub'
  | SalesWizardStepId
  | 'offer_send'
  | 'offer_accept'
  | 'offer_approval'
  | 'offer_sent'
  | 'contract'
  | 'activation'
  | 'commission';

export interface SalesGuidePhase {
  phase: number;
  title: string;
  summary: string;
  hints: readonly string[];
  examples?: readonly string[];
  emphasis?: string;
}

export const SALES_GUIDE_PHASES: Record<SalesGuideContext, SalesGuidePhase> = {
  hub: {
    phase: 1,
    title: 'Vorbereitung',
    summary: 'Bevor Sie in die Beratung starten, verschaffen Sie sich einen Überblick.',
    hints: [
      'Kundenhistorie prüfen',
      'Branche ansehen',
      'Bisherige Informationen und offene Vorgänge prüfen',
    ],
  },
  prospect: {
    phase: 2,
    title: 'Kennenlernen',
    summary: 'Wählen Sie einen bestehenden Kunden, legen Sie kurz einen neuen an – oder rechnen Sie ohne Kundenbezug.',
    hints: [
      'Fragen Sie zuerst, bevor Sie Produkte vorstellen.',
      'Mit Weiter wird die Auswahl automatisch übernommen.',
    ],
    examples: [
      'Wie kassieren Sie heute?',
      'Welche Kartenzahlungen nutzen Sie?',
      'Was könnte besser laufen?',
    ],
  },
  costs: {
    phase: 1,
    title: 'Ausgangslage verstehen',
    summary: 'Erfassen Sie die Ist-Kosten als Basis für einen fairen Vergleich.',
    hints: [
      'Abrechnung einlesen oder Kosten manuell erfassen.',
      'Erst die Ausgangslage klären – dann weiter zum Bedarf.',
    ],
  },
  need: {
    phase: 3,
    title: 'Bedarf',
    summary: 'Ermitteln Sie zunächst den Bedarf des Kunden.',
    hints: [
      'Fragen Sie nach Umsatz, Terminals und Kartenmix.',
      'Notieren Sie, welche Probleme der Kunde lösen möchte.',
    ],
    examples: [
      'Welche Kartenzahlungen nutzt Ihr Kunde heute?',
      'Welche Probleme möchte der Kunde lösen?',
      'Wie viele Terminals werden benötigt?',
    ],
  },
  variants: {
    phase: 4,
    title: 'Vergleich',
    summary: 'Jetzt erfolgt die Berechnung – transparent und nachvollziehbar.',
    hints: [
      'Warum wurde dieser Tarif empfohlen?',
      'Welche Vorteile ergeben sich für den Kunden?',
      'Welche Nachteile oder Einschränkungen gibt es?',
      'Erklären Sie den Nutzen vor dem Preis',
      COMPETITOR_COMPARISON_ALLOWED,
    ],
  },
  offer: {
    phase: 5,
    title: 'Angebot erstellen',
    summary: 'Das Angebot wird erstellt – ohne Zeitdruck und ohne Sofortunterschrift.',
    hints: [
      NO_SIGNATURE_REQUIRED_MESSAGE,
      OFFER_REVIEW_TIME_MESSAGE,
      COMPETITOR_COMPARISON_ALLOWED,
      'Standardempfehlung: PDF per E-Mail senden, optional Ausdruck',
    ],
    emphasis: CUSTOMER_MAY_REVIEW_AT_HOME,
  },
  approval: {
    phase: 9,
    title: 'Freigabe',
    summary:
      'Bei Abweichungen von Preis, Gebühren, Hardware, Provision, Sonderleistung oder Laufzeit ist keine Kundenannahme möglich.',
    hints: [
      'Status: Wartet auf Freigabe, Änderung erforderlich, freigegeben oder abgelehnt',
      'Keine Kundenannahme und keine Vertragserzeugung vor Freigabe',
      'Administrator prüft Kunde, Außendienst und Abweichungen',
    ],
    emphasis: APPROVAL_DEVIATION_FIELD_MESSAGE,
  },
  closing: {
    phase: 7,
    title: 'Kunde prüft',
    summary: 'Der Kunde prüft in Ruhe – Sie planen genau eine Wiedervorlage.',
    hints: [
      'Genau eine Option: morgen, in drei Tagen, in einer Woche, eigenes Datum, Kunde meldet sich selbst oder kein Nachfassen',
      'Keine automatischen Mehrfach-Wiedervorlagen',
      'Nicht jeder Termin endet mit einer Unterschrift – das ist völlig in Ordnung',
    ],
  },
  offer_send: {
    phase: 6,
    title: 'Angebot bereitstellen',
    summary: 'Standardempfehlung: PDF per E-Mail senden, optional Ausdruck.',
    hints: [
      NO_SIGNATURE_REQUIRED_MESSAGE,
      OFFER_REVIEW_TIME_MESSAGE,
      COMPETITOR_COMPARISON_ALLOWED,
      'Beratungsgrundsätze bestätigen, bevor das Angebot bereitgestellt wird',
      'Genau eine Nachfassoption wählen',
    ],
    emphasis: 'Status nach Versand: Angebot versendet – Kunde prüft.',
  },
  offer_accept: {
    phase: 10,
    title: 'Annahme / Unterschrift',
    summary: 'Erst jetzt – nicht früher. Die App drängt nicht zum Abschluss.',
    hints: [
      'Unterschrift nur nach Freigabe und ausreichender Prüfzeit',
      'Digitale oder spätere Unterschrift ist möglich',
      'Keine Vor-Ort-Unterschrift erzwingen',
    ],
  },
  offer_approval: {
    phase: 9,
    title: 'Freigabe',
    summary:
      'Abweichungen vom Standard erfordern eine Administrator-Freigabe vor der Kundenvorlage.',
    hints: [
      'Preis, Gebühren, Hardware, Provision oder Laufzeit weichen ab',
      'Keine Kundenannahme und keine Vertragserzeugung vor Freigabe',
      'Nach Freigabe kann das Angebot bereitgestellt werden',
    ],
    emphasis: APPROVAL_DEVIATION_FIELD_MESSAGE,
  },
  offer_sent: {
    phase: 8,
    title: 'Rückfragen / Änderungen',
    summary: 'Der Kunde kann Rückfragen stellen – Änderungen sind erwünscht.',
    hints: [
      'Angebot aktualisieren oder neues Angebot erstellen',
      'Versionierung bleibt erhalten',
      'Ein ehrlicher Rat schafft langfristiges Vertrauen',
    ],
  },
  contract: {
    phase: 11,
    title: 'Vertrag',
    summary: 'Erst nach Annahme – ohne doppelte Datenerfassung.',
    hints: ['Vertragsdaten stammen aus dem angenommenen Angebot', 'Änderungen werden versioniert'],
  },
  activation: {
    phase: 12,
    title: 'Aktivierung',
    summary: 'Bestehender Aktivierungsworkflow – Schritt für Schritt bis Go-live.',
    hints: [
      'Checkliste, Hardware und Testzahlung bearbeiten',
      'Go-live nur, wenn fachlich zulässig',
    ],
  },
  commission: {
    phase: 13,
    title: 'Provision',
    summary: 'Bestehender Provisionsworkflow – keine automatische Auszahlung.',
    hints: [
      'Provision wird berechnet und intern geprüft',
      'Administrator kann freigeben und auszahlen',
    ],
  },
};

export const SALES_GUIDE_TIPS: readonly string[] = [
  'Stellen Sie zunächst Fragen, bevor Sie Produkte vorstellen.',
  'Erklären Sie den Nutzen vor dem Preis.',
  'Lassen Sie dem Kunden Zeit für seine Entscheidung.',
  'Ein ehrlicher Rat schafft langfristiges Vertrauen.',
  'Nicht jeder Termin endet mit einer Unterschrift – das ist völlig in Ordnung.',
  COMPETITOR_COMPARISON_ALLOWED,
  NO_SIGNATURE_REQUIRED_MESSAGE,
];

/** Beratungsworkflow ohne zweite Navigation – Orientierung im bestehenden Flow. */
export const SALES_PROCESS_FLOW = [
  'Vorbereitung',
  'Kennenlernen',
  'Bedarf',
  'Vergleich',
  'Angebot erstellen',
  'Angebot bereitstellen',
  'Kunde prüft',
  'Rückfragen / Änderungen',
  'Freigabe (wenn notwendig)',
  'Annahme / Unterschrift',
  'Vertrag',
  'Aktivierung',
  'Provision',
] as const;

export function resolveSalesGuideContext(step: SalesWizardStepId): SalesGuideContext {
  return step;
}

export function resolveSalesGuideContextFromOfferStatus(
  status: OfferWorkflowStatus,
): SalesGuideContext | null {
  switch (status) {
    case 'approval_required':
    case 'in_approval':
    case 'changes_requested':
      return 'offer_approval';
    case 'ready_to_send':
      return 'offer_send';
    case 'sent':
      return 'offer_sent';
    case 'accepted':
      return 'contract';
    case 'activation_pending':
    case 'activated':
      return 'activation';
    default:
      return null;
  }
}

export function resolveFieldApprovalStatusLabel(status: OfferWorkflowStatus): string | null {
  switch (status) {
    case 'approval_required':
    case 'in_approval':
      return APPROVAL_WAITING_STATUS_LABEL;
    case 'changes_requested':
      return APPROVAL_CHANGES_STATUS_LABEL;
    case 'approved':
    case 'ready_to_send':
    case 'sent':
      return APPROVAL_APPROVED_STATUS_LABEL;
    case 'declined':
    case 'cancelled':
      return APPROVAL_REJECTED_STATUS_LABEL;
    default:
      return null;
  }
}

export function pickSalesGuideTip(seed: string): string {
  if (SALES_GUIDE_TIPS.length === 0) {
    return '';
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % SALES_GUIDE_TIPS.length;
  }
  return SALES_GUIDE_TIPS[hash] ?? SALES_GUIDE_TIPS[0]!;
}

export function containsForbiddenSalesPressure(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('heute unterschreiben') ||
    normalized.includes('sofort entscheiden') ||
    normalized.includes('jetzt abschließen')
  );
}
