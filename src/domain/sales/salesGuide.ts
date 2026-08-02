import type { SalesWizardStepId } from '../bestPayComparison/salesWizard';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';

export const SALES_GUIDE_PRINCIPLE = {
  title: 'AMRtech Payment verkauft Vertrauen',
  summary:
    'AMRtech Payment verkauft keine Terminals – sondern Beratung, Transparenz, Service und langfristige Partnerschaft.',
  reminders: [
    'Vertrauen schaffen, nicht unter Druck setzen.',
    'Transparenz schaffen – Kosten und Bedingungen klar erklären.',
    'Dem Kunden Zeit geben – eine Prüfung zuhause ist ausdrücklich erwünscht.',
    'Seriös beraten – langfristige Kundenbeziehungen statt Schnellabschluss.',
  ],
} as const;

export const NO_SIGNATURE_REQUIRED_MESSAGE =
  'Dieses Angebot muss heute NICHT unterschrieben werden.';

export const OFFER_REVIEW_TIME_MESSAGE =
  'Geben Sie dem Kunden Zeit, das Angebot in Ruhe zu prüfen.';

export const CUSTOMER_MAY_REVIEW_AT_HOME =
  '„Ich möchte das Angebot zuhause noch einmal prüfen." – das ist ausdrücklich gewünscht.';

export const COMPETITOR_COMPARISON_ALLOWED =
  'Mitbewerbervergleich ist ausdrücklich erlaubt – der Kunde darf Angebote in Ruhe vergleichen.';

export const APPROVAL_DEVIATION_FIELD_MESSAGE =
  'Dieses Angebot weicht vom Standard ab und muss vor der Kundenvorlage freigegeben werden.';

export const APPROVAL_WAITING_STATUS_LABEL = 'Wartet auf Freigabe';

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
    summary: 'Nicht sofort verkaufen – erst verstehen.',
    hints: ['Fragen stellen, bevor Sie Produkte vorstellen', 'Den Ist-Zustand verstehen'],
    examples: [
      'Wie kassieren Sie heute?',
      'Welche Kartenzahlungen nutzen Sie?',
      'Was gefällt Ihnen an Ihrem aktuellen Anbieter?',
      'Was könnte besser laufen?',
    ],
  },
  costs: {
    phase: 1,
    title: 'Ausgangslage verstehen',
    summary: 'Die Ist-Situation bildet die Basis für einen fairen Vergleich.',
    hints: [
      'Abrechnung oder manuelle Kosten erfassen',
      'Laufende und einmalige Kosten getrennt betrachten',
      'Noch keine Tarifempfehlung – zuerst die Ausgangslage klären',
    ],
  },
  need: {
    phase: 3,
    title: 'Bedarf aufnehmen',
    summary: 'Der Außendienst erfasst zunächst den Bedarf – noch ohne Tarifempfehlung.',
    hints: [
      'Umsatz, Terminals und Kartenmix erfragen',
      'Besonderheiten und Wachstumspläne notieren',
      'Erst wenn der Bedarf klar ist, geht es in den Vergleich',
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
    title: 'Angebot',
    summary: 'Das Angebot wird erstellt – ohne Zeitdruck.',
    hints: [
      NO_SIGNATURE_REQUIRED_MESSAGE,
      OFFER_REVIEW_TIME_MESSAGE,
      'Standardempfehlung: PDF per E-Mail senden, optional Ausdruck',
    ],
    emphasis: CUSTOMER_MAY_REVIEW_AT_HOME,
  },
  approval: {
    phase: 9,
    title: 'Abweichung vom Standard',
    summary:
      'Bei Abweichungen von Preis, Gebühren, Hardware, Provision, Sonderleistung oder Laufzeit ist keine Kundenunterschrift möglich.',
    hints: [
      'Status: Wartet auf Freigabe',
      'Keine Kundenunterschrift, Annahme oder Vertragserzeugung vor Freigabe',
      'Administrator prüft und gibt frei oder fordert Änderungen an',
      'Erst nach Freigabe darf das Angebot unterschrieben werden',
    ],
    emphasis: APPROVAL_DEVIATION_FIELD_MESSAGE,
  },
  closing: {
    phase: 7,
    title: 'Prüfung & Nachfassen',
    summary: 'Der Kunde prüft in Ruhe – Sie planen das Nachfassen.',
    hints: [
      'Nachfassvorschläge: morgen, in drei Tagen, in einer Woche',
      'Der Außendienst entscheidet über den Zeitpunkt',
      'Nicht jeder Termin endet mit einer Unterschrift – das ist völlig in Ordnung',
    ],
  },
  offer_send: {
    phase: 6,
    title: 'Angebot versenden',
    summary: 'Standardempfehlung: PDF per E-Mail senden, optional Ausdruck.',
    hints: [
      NO_SIGNATURE_REQUIRED_MESSAGE,
      OFFER_REVIEW_TIME_MESSAGE,
      'Beratungsgrundsätze bestätigen, bevor das Angebot bereitgestellt wird',
      'Nachfassdatum festlegen oder automatische Wiedervorlagen nutzen',
    ],
    emphasis: 'Status nach Versand: Angebot versendet.',
  },
  offer_accept: {
    phase: 10,
    title: 'Kundenunterschrift',
    summary: 'Erst jetzt – nicht früher. Die App drängt nicht zum sofortigen Abschluss.',
    hints: [
      'Unterschrift nur nach Freigabe und ausreichender Prüfzeit',
      'Digitale oder spätere Unterschrift ist möglich',
      'Keine Vor-Ort-Unterschrift erzwingen',
    ],
  },
  offer_approval: {
    phase: 9,
    title: 'Interne Freigabe',
    summary:
      'Abweichungen vom Standard erfordern eine Administrator-Freigabe vor der Kundenvorlage.',
    hints: [
      'Preis, Gebühren, Hardware, Provision oder Laufzeit weichen ab',
      'Keine Kundenunterschrift vor Freigabe',
      'Nach Freigabe kann das Angebot bereitgestellt werden',
    ],
    emphasis: APPROVAL_DEVIATION_FIELD_MESSAGE,
  },
  offer_sent: {
    phase: 8,
    title: 'Fragen beantworten',
    summary: 'Der Kunde kann Rückfragen stellen – Sie bleiben erreichbar.',
    hints: [
      'Angebot aktualisieren oder neues Angebot erstellen',
      'Versionierung bleibt erhalten',
      'Ein ehrlicher Rat schafft langfristiges Vertrauen',
    ],
  },
  contract: {
    phase: 11,
    title: 'Vertrag',
    summary: 'Nach Unterschrift – ohne doppelte Datenerfassung.',
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
];

export const SALES_PROCESS_FLOW = [
  'Beratung',
  'Angebot',
  'Kunde prüft in Ruhe',
  'Nachfassen',
  'Fragen beantworten',
  'gegebenenfalls Freigabe',
  'digitale oder spätere Unterschrift',
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
