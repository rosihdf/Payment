import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import type { CardMix } from '../../../domain/lead/lead';
import { CurrencyInput } from '../../../components/common/CurrencyInput';
import { FormField } from '../../ui/FormField';
import { getCardMixSummary, isCardMixValid } from '../../../services/leadValidation';
import { parseOptionalInt } from '../formatters';
import styles from '../AdviceWizard.module.css';

import {
  buildCommercialTermSelectOptions,
  getCommercialTermOptions,
  normalizeReadableTermMonths,
} from '../../../domain/commercial/commercialTermCapability';
import { DEFAULT_COMMERCIAL_TARIFF_ID } from '../../../domain/commercial/commercialConfig';

const INDUSTRY_OPTIONS = [
  'Gastronomie',
  'Einzelhandel',
  'Handwerk',
  'Hotel',
  'Apotheke',
  'Tankstelle',
  'Dienstleistung',
  'Sonstige',
] as const;

type PaymentUsageKey = keyof BestPayComparisonSession['manualInput']['paymentUsage'];

const ACCEPTANCE_OPTIONS: Array<{
  key: PaymentUsageKey;
  title: string;
  description: string;
  available: boolean;
}> = [
  {
    key: 'stationary',
    title: 'Im Geschäft oder am festen Standort',
    description: 'Stationäres Terminal über Kunden-WLAN – Standardbetrieb ohne SIM-Aufpreis.',
    available: true,
  },
  {
    key: 'mobile',
    title: 'Unterwegs beim Kunden',
    description: 'Mobiles Kartenterminal – aktuell im Tarifkatalog verfügbar.',
    available: true,
  },
  {
    key: 'softPos',
    title: 'Smartphone als Kartenterminal',
    description: 'SoftPOS – noch nicht im produktiven Katalog verfügbar.',
    available: false,
  },
  {
    key: 'ecommerce',
    title: 'Zahlungen im Onlineshop',
    description: 'E-Commerce – noch nicht im produktiven Katalog verfügbar.',
    available: false,
  },
];

interface NeedStepProps {
  session: BestPayComparisonSession;
  busy: boolean;
  onPatch: (patch: Partial<BestPayComparisonSession['manualInput']>) => void;
}

/** Laufzeit lesbar halten; Legacy-Werte (z. B. 24) nicht auf Katalogwerte mappen. */
function resolvePreferredTermMonths(
  value: number | null | undefined,
  termOptions: ReturnType<typeof getCommercialTermOptions>,
): number | null {
  return normalizeReadableTermMonths(value, termOptions);
}

function cardMixFromManualInput(
  input: BestPayComparisonSession['manualInput'],
): CardMix {
  return {
    girocardPercent: input.girocardPercent ?? 0,
    debitPercent: input.debitPercent ?? 0,
    creditPercent: input.creditPercent ?? 0,
    otherPercent: input.otherPercent ?? 0,
  };
}

function parseCardMixPercent(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

export function NeedStep({ session, busy, onPatch }: NeedStepProps) {
  const input = session.manualInput;
  const termCapability = getCommercialTermOptions(null, {
    tariffId: DEFAULT_COMMERCIAL_TARIFF_ID,
  });
  const preferredTermMonths = resolvePreferredTermMonths(
    input.preferredTermMonths,
    termCapability,
  );
  const termSelectOptions = buildCommercialTermSelectOptions(termCapability, preferredTermMonths);
  const cardMix = cardMixFromManualInput(input);
  const cardMixSummary = getCardMixSummary(cardMix);
  const cardMixValid = isCardMixValid(cardMix);
  const hasAnyCardMix =
    input.girocardPercent !== null ||
    input.debitPercent !== null ||
    input.creditPercent !== null ||
    input.otherPercent !== null;

  return (
    <article className={styles.card}>
      <h2 className={styles.sectionTitle}>Bedarf</h2>
      <p className={styles.hint}>Einmalig erfassen – keine Doppelabfragen in späteren Schritten.</p>
      <div className={styles.formGrid}>
        <FormField
          type="select"
          id="needIndustry"
          label="Branche"
          value={input.industry || ''}
          disabled={busy}
          onChange={(event) => onPatch({ industry: event.target.value })}
        >
          <option value="">Bitte wählen…</option>
          {INDUSTRY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FormField>
        <CurrencyInput
          id="needVolume"
          label="Monatlicher Kartenumsatz (EUR)"
          value={input.monthlyCardVolumeCents}
          disabled={false}
          commitOnBlur
          onChange={(cents) => onPatch({ monthlyCardVolumeCents: cents })}
        />
        <FormField
          type="text"
          id="needTx"
          label="Monatliche Transaktionen (optional)"
          inputMode="numeric"
          value={input.monthlyTransactions !== null ? String(input.monthlyTransactions) : ''}
          disabled={busy}
          onChange={(event) =>
            onPatch({
              monthlyTransactions: parseOptionalInt(event.target.value, null),
            })
          }
        />
        <FormField
          type="text"
          id="needTerminals"
          label="Anzahl Terminals"
          inputMode="numeric"
          value={String(input.terminalCount)}
          disabled={busy}
          onChange={(event) =>
            onPatch({
              terminalCount: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
            })
          }
        />
        <FormField
          type="select"
          id="needTerm"
          label="Gewünschte Vertragslaufzeit"
          value={preferredTermMonths === null ? '' : String(preferredTermMonths)}
          disabled={busy}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onPatch({ preferredTermMonths: null });
              return;
            }
            onPatch({ preferredTermMonths: Number.parseInt(raw, 10) });
          }}
        >
          <option value="">Noch offen – beste passende Option empfehlen</option>
          {termSelectOptions.map((option) => (
            <option key={option.months} value={option.months}>
              {option.label}
            </option>
          ))}
        </FormField>
        {termCapability.customTermAllowed ? (
          <p className={styles.hint}>
            Andere Laufzeiten auf Anfrage möglich ({termCapability.termSourceReference}).
          </p>
        ) : null}
      </div>

      <div className={styles.acceptanceBlock}>
        <h3 className={styles.subheading}>Kartenmix</h3>
        <p className={styles.hint}>
          Anteile der Kartenzahlungen in Prozent – für die Kostenprojektion erforderlich.
        </p>
        <div className={styles.formGrid}>
          <FormField
            type="text"
            id="needGirocard"
            label="Girocard (%)"
            inputMode="numeric"
            value={input.girocardPercent !== null ? String(input.girocardPercent) : ''}
            disabled={busy}
            onChange={(event) => onPatch({ girocardPercent: parseCardMixPercent(event.target.value) })}
          />
          <FormField
            type="text"
            id="needDebit"
            label="Debitkarten (%)"
            inputMode="numeric"
            value={input.debitPercent !== null ? String(input.debitPercent) : ''}
            disabled={busy}
            onChange={(event) => onPatch({ debitPercent: parseCardMixPercent(event.target.value) })}
          />
          <FormField
            type="text"
            id="needCredit"
            label="Kreditkarten (%)"
            inputMode="numeric"
            value={input.creditPercent !== null ? String(input.creditPercent) : ''}
            disabled={busy}
            onChange={(event) => onPatch({ creditPercent: parseCardMixPercent(event.target.value) })}
          />
          <FormField
            type="text"
            id="needOther"
            label="Sonstige (%)"
            inputMode="numeric"
            value={input.otherPercent !== null ? String(input.otherPercent) : ''}
            disabled={busy}
            onChange={(event) => onPatch({ otherPercent: parseCardMixPercent(event.target.value) })}
          />
        </div>
        <p
          className={
            hasAnyCardMix && cardMixValid
              ? styles.cardMixSummaryValid
              : styles.cardMixSummaryInvalid
          }
          role="status"
        >
          {hasAnyCardMix ? cardMixSummary : 'Kartenmix noch nicht erfasst'}
        </p>
      </div>

      <div className={styles.acceptanceBlock}>
        <h3 className={styles.subheading}>Einsatzart</h3>
        <p className={styles.hint}>
          Wo soll der Kunde Kartenzahlungen annehmen? Aktuell ist nur das mobile Terminal
          tarifseitig verfügbar.
        </p>
        <div className={styles.acceptanceList}>
          {ACCEPTANCE_OPTIONS.map((option) => (
            <label
              key={option.key}
              className={
                option.available ? styles.acceptanceOption : styles.acceptanceOptionDisabled
              }
            >
              <input
                type="checkbox"
                checked={option.available ? input.paymentUsage[option.key] : false}
                disabled={busy || !option.available}
                onChange={(event) =>
                  onPatch({
                    paymentUsage: {
                      ...input.paymentUsage,
                      [option.key]: event.target.checked,
                    },
                  })
                }
              />
              <span>
                <strong>{option.title}</strong>
                <span className={styles.hint}>{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}
