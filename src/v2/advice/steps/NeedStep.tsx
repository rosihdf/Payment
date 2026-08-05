import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { CurrencyInput } from '../../../components/common/CurrencyInput';
import { FormField } from '../../ui/FormField';
import { parseOptionalInt } from '../formatters';
import styles from '../AdviceWizard.module.css';

/** Laufzeiten laut produktivem Vertragskatalog (pricingCatalogSeed). */
const TERM_OPTIONS = [
  { months: 24, label: '24 Monate' },
  { months: 36, label: '36 Monate' },
] as const;

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
    key: 'mobile',
    title: 'Mobiles Kartenterminal',
    description: 'Gerät geht mit zum Kunden – aktuell im Tarifkatalog verfügbar.',
    available: true,
  },
  {
    key: 'stationary',
    title: 'Festes Terminal an der Kasse',
    description: 'Steht fest im Laden. Tarif folgt mit dem Katalog.',
    available: false,
  },
  {
    key: 'softPos',
    title: 'Smartphone als Terminal',
    description: 'Zahlung über App ohne Extra-Gerät. Tarif folgt.',
    available: false,
  },
  {
    key: 'ecommerce',
    title: 'Online-Shop / Internet',
    description: 'Zahlungen im Webshop. Tarif folgt.',
    available: false,
  },
];

interface NeedStepProps {
  session: BestPayComparisonSession;
  busy: boolean;
  onPatch: (patch: Partial<BestPayComparisonSession['manualInput']>) => void;
}

function resolvePreferredTermMonths(value: number | null | undefined): number {
  if (value === 24 || value === 36) {
    return value;
  }
  // Alte Werte (48/60) auf den nächsthöheren Katalogwert 36 begrenzen.
  return 36;
}

export function NeedStep({ session, busy, onPatch }: NeedStepProps) {
  const input = session.manualInput;
  const preferredTermMonths = resolvePreferredTermMonths(input.preferredTermMonths);

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
          label="Maximale Vertragslaufzeit"
          value={String(preferredTermMonths)}
          disabled={busy}
          onChange={(event) =>
            onPatch({ preferredTermMonths: Number.parseInt(event.target.value, 10) || 36 })
          }
        >
          {TERM_OPTIONS.map((option) => (
            <option key={option.months} value={option.months}>
              {option.label}
            </option>
          ))}
        </FormField>
        <p className={styles.hint}>
          Im Katalog gibt es derzeit 24- und 36-Monats-Verträge. Die Auswahl begrenzt die maximale
          Laufzeit der Empfehlung.
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
