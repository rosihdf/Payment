import { lazy, Suspense, useEffect, useState } from 'react';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import {
  COST_CAPTURE_MODE_LABELS,
  type CostCaptureMode,
} from '../../../domain/bestPayComparison/costCaptureMode';
import type { BestPayComparisonUserContext } from '../../../services/bestPayComparisonService';
import type { BillingImportService } from '../../../services/billingImportService';
import { CurrencyInput } from '../../../components/common/CurrencyInput';
import { FormField } from '../../ui/FormField';
import { formatEuro } from '../formatters';
import styles from '../AdviceWizard.module.css';

const OfferBillingImportSection = lazy(async () => {
  const module = await import('../../../features/offer/OfferBillingImportSection');
  return { default: module.OfferBillingImportSection };
});

interface CostsStepProps {
  session: BestPayComparisonSession;
  costCaptureMode: CostCaptureMode | null;
  busy: boolean;
  userContext: BestPayComparisonUserContext;
  billingImportService: BillingImportService;
  onSelectMode: (mode: CostCaptureMode) => void;
  onPatchCosts: (monthlyTotalCostsCents: number | null) => void;
  onPatchCurrentProvider: (provider: string) => void;
  onBaselineConfirmed: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export function CostsStep({
  session,
  costCaptureMode,
  busy,
  userContext,
  billingImportService,
  onSelectMode,
  onPatchCosts,
  onPatchCurrentProvider,
  onBaselineConfirmed,
  showToast,
}: CostsStepProps) {
  const [providerNotes, setProviderNotes] = useState(session.wizard.prospectDraft.notes);

  useEffect(() => {
    setProviderNotes(session.wizard.prospectDraft.notes);
  }, [session.wizard.prospectDraft.notes]);

  const commitProviderNotes = () => {
    if (providerNotes !== session.wizard.prospectDraft.notes) {
      onPatchCurrentProvider(providerNotes);
    }
  };

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Ausgangslage</h2>
        <p className={styles.hint}>Nur die Ist-Situation – ohne Kartenumsatz.</p>
        <div className={styles.choiceRow}>
          {(
            [
              ['manual', COST_CAPTURE_MODE_LABELS.manual],
              ['no_current_costs', COST_CAPTURE_MODE_LABELS.no_current_costs],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={costCaptureMode === mode ? styles.choiceActive : styles.choiceButton}
              disabled={busy}
              onClick={() => onSelectMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </article>

      {costCaptureMode === 'manual' ? (
        <article className={styles.card}>
          <div className={styles.formGrid}>
            <CurrencyInput
              id="manualTotalCosts"
              label="Monatliche Ist-Gesamtkosten (EUR)"
              value={session.manualInput.monthlyTotalCostsCents}
              disabled={false}
              commitOnBlur
              onChange={(cents) => onPatchCosts(cents)}
            />
            <p className={styles.hint}>0 € ist zulässig. Werte werden beim Verlassen des Feldes gespeichert.</p>
          </div>
        </article>
      ) : null}

      {costCaptureMode === 'billing_import' ? (
        session.billingImportSessionId ? (
          <Suspense fallback={<p className={styles.hint}>Abrechnungsimport wird vorbereitet…</p>}>
            <OfferBillingImportSection
              sessionId={session.billingImportSessionId}
              userContext={{
                ...userContext,
                displayName: userContext.displayName ?? userContext.userId,
              }}
              billingImportService={billingImportService}
              showToast={showToast}
              title="Abrechnung prüfen und bestätigen"
              onBaselineConfirmed={onBaselineConfirmed}
            />
          </Suspense>
        ) : (
          <p className={styles.hint}>Abrechnungsimport wird vorbereitet…</p>
        )
      ) : null}

      {costCaptureMode === 'no_current_costs' ? (
        <article className={styles.card}>
          <p className={styles.hint}>
            Es liegen keine bisherigen Payment-Kosten vor. Der Vergleich zeigt nur die neuen
            monatlichen Kosten – ohne Ersparnisberechnung.
          </p>
          <p className={styles.hint}>
            Ist-Kosten:{' '}
            {formatEuro(session.manualInput.monthlyTotalCostsCents ?? 0)}
          </p>
        </article>
      ) : null}

      {costCaptureMode ? (
        <article className={styles.card}>
          <FormField
            type="text"
            id="currentProvider"
            label="Aktueller Anbieter (optional)"
            value={providerNotes}
            onChange={(event) => setProviderNotes(event.target.value)}
            onBlur={commitProviderNotes}
          />
        </article>
      ) : null}
    </div>
  );
}
