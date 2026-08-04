import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { CurrencyInput } from '../../../components/common/CurrencyInput';
import { FormField } from '../../ui/FormField';
import { parseOptionalInt } from '../formatters';
import styles from '../AdviceWizard.module.css';

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

interface NeedStepProps {
  session: BestPayComparisonSession;
  busy: boolean;
  onPatch: (patch: Partial<BestPayComparisonSession['manualInput']>) => void;
}

export function NeedStep({ session, busy, onPatch }: NeedStepProps) {
  const input = session.manualInput;

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
          label="Laufzeitpräferenz (Monate)"
          value={String(input.preferredTermMonths ?? 36)}
          disabled={busy}
          onChange={(event) =>
            onPatch({ preferredTermMonths: Number.parseInt(event.target.value, 10) || 36 })
          }
        >
          <option value="36">36 Monate</option>
          <option value="48">48 Monate</option>
          <option value="60">60 Monate</option>
        </FormField>
      </div>
      <div className={styles.formGrid}>
        {(
          [
            ['stationary', 'Stationär'],
            ['mobile', 'Mobil'],
            ['ecommerce', 'E-Commerce'],
            ['softPos', 'SoftPOS'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={input.paymentUsage[key]}
              disabled={busy}
              onChange={(event) =>
                onPatch({
                  paymentUsage: {
                    ...input.paymentUsage,
                    [key]: event.target.checked,
                  },
                })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </article>
  );
}
