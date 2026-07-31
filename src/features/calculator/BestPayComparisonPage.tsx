import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/feedback/EmptyState';
import { FormField } from '../../components/common/FormField';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import type { Lead } from '../../domain/lead/lead';
import styles from './BestPayComparisonPage.module.css';

const OfferBillingImportSection = lazy(async () => {
  const module = await import('../offer/OfferBillingImportSection');
  return { default: module.OfferBillingImportSection };
});

type Step = 'source' | 'review' | 'need' | 'result';

function formatEuro(cents: number | null): string {
  if (cents === null) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function parseEuroToCents(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function BestPayComparisonPage() {
  const { currentUser } = useCurrentUser();
  const { bestPayComparisonService, billingImportService, leadService } = useServices();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<BestPayComparisonSession | null>(null);
  const [step, setStep] = useState<Step>('source');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [monthlyVolume, setMonthlyVolume] = useState('');
  const [monthlyTransactions, setMonthlyTransactions] = useState('');
  const [monthlyTotal, setMonthlyTotal] = useState('');
  const [terminalCount, setTerminalCount] = useState('1');
  const [selectedLeadId, setSelectedLeadId] = useState('');

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const bootstrap = useCallback(async () => {
    if (!userContext) {
      return;
    }
    const mode = searchParams.get('mode');
    const sessionId = searchParams.get('session');
    let active: BestPayComparisonSession | null = null;
    let nextStep: Step = 'source';

    if (sessionId) {
      const resumed = bestPayComparisonService.resumeComparison(sessionId, userContext);
      if (!resumed.ok) {
        showToast('Gespeicherte Berechnung nicht gefunden', 'error');
        active = bestPayComparisonService.createSession(userContext);
        nextStep = 'source';
      } else {
        active = resumed.session;
        nextStep = resumed.step;
      }
    } else if (searchParams.get('new') === '1') {
      active = bestPayComparisonService.createSession(userContext);
      nextStep = mode === 'manual' ? 'need' : 'source';
    } else {
      active = bestPayComparisonService.getActiveDraft(userContext);
      if (!active) {
        active = bestPayComparisonService.createSession(userContext);
      }
      if (active.result) {
        nextStep = 'result';
      } else if (active.billingImportSessionId) {
        nextStep = 'review';
      } else if (active.source === 'manual' || active.status === 'ready_for_calculation') {
        nextStep = 'need';
      }
    }

    if (mode === 'billing' && active && !active.billingImportSessionId) {
      const started = await bestPayComparisonService.startBillingImport(active.id, userContext);
      if (started.ok) {
        active = started.session;
        nextStep = 'review';
      }
    } else if (mode === 'manual' && !sessionId) {
      nextStep = 'need';
    }

    setStep(nextStep);
    setSession(active);
    setSelectedLeadId(active.leadId ?? '');
    setMonthlyVolume(
      active.manualInput.monthlyCardVolumeCents !== null
        ? String(active.manualInput.monthlyCardVolumeCents / 100).replace('.', ',')
        : '',
    );
    setMonthlyTransactions(
      active.manualInput.monthlyTransactions !== null
        ? String(active.manualInput.monthlyTransactions)
        : '',
    );
    setMonthlyTotal(
      active.manualInput.monthlyTotalCostsCents !== null
        ? String(active.manualInput.monthlyTotalCostsCents / 100).replace('.', ',')
        : '',
    );
    setTerminalCount(String(active.manualInput.terminalCount));
  }, [bestPayComparisonService, searchParams, showToast, userContext]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!userContext) {
      return;
    }
    void leadService.getVisibleLeads(userContext).then(setLeads);
  }, [leadService, userContext]);

  if (!currentUser || !userContext) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }

  if (!session) {
    return <p className={styles.hint}>BestPay-Vergleich wird geladen…</p>;
  }

  const selectedVariant =
    session.result?.variants.find((variant) => variant.candidateId === session.selectedCandidateId) ??
    session.result?.variants[0] ??
    null;

  const handleStartBilling = async () => {
    const started = await bestPayComparisonService.startBillingImport(session.id, userContext);
    if (!started.ok) {
      showToast('Abrechnungsimport konnte nicht gestartet werden', 'error');
      return;
    }
    setSession(started.session);
    setStep('review');
  };

  const handleSaveManual = () => {
    const updated = bestPayComparisonService.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: parseEuroToCents(monthlyVolume),
        monthlyTransactions: monthlyTransactions
          ? Number.parseInt(monthlyTransactions, 10)
          : null,
        monthlyTotalCostsCents: parseEuroToCents(monthlyTotal),
        terminalCount: Math.max(1, Number.parseInt(terminalCount, 10) || 1),
        paymentUsage: {
          stationary: false,
          mobile: true,
          ecommerce: false,
          softPos: false,
        },
      },
      userContext,
    );
    if (updated) {
      setSession(updated);
      showToast('Manuelle Werte gespeichert', 'success');
    }
  };

  const handleCalculate = async () => {
    handleSaveManual();
    await bestPayComparisonService.syncBaselineFromBilling(session.id, userContext);
    setIsCalculating(true);
    const result = await bestPayComparisonService.calculate(session.id, userContext);
    setIsCalculating(false);
    if (!result.ok) {
      showToast(result.message ?? 'Berechnung nicht möglich', 'error');
      return;
    }
    setSession(result.session);
    setStep('result');
    showToast('BestPay-Vergleich berechnet', 'success');
  };

  const handleAssignLead = async () => {
    if (!selectedLeadId) {
      showToast('Bitte einen Lead auswählen', 'error');
      return;
    }
    const result = await bestPayComparisonService.assignLead(session.id, selectedLeadId, userContext);
    if (!result.ok) {
      showToast(result.message ?? 'Zuordnung fehlgeschlagen', 'error');
      return;
    }
    setSession(result.session);
    showToast('Lead zugeordnet', 'success');
  };

  const handleCreateOffer = async () => {
    setIsCreatingOffer(true);
    const result = await bestPayComparisonService.createOfferFromComparison(session.id, userContext);
    setIsCreatingOffer(false);
    if (!result.ok) {
      showToast(result.message ?? 'Angebot konnte nicht erstellt werden', 'error');
      return;
    }
    setSession(result.session);
    showToast('Angebot erstellt', 'success');
    navigate(`/offers/${result.offerId}`);
  };

  return (
    <section>
      <PageHeader
        title="BestPay-Vergleich"
        subtitle="Aktuelle Zahlungsverkehrskosten erfassen, BestPay-Varianten vergleichen und Empfehlung berechnen"
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.secondaryAction} to="/calculator/bestpay/history">
              Gespeicherte Berechnungen
            </Link>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                bestPayComparisonService.discardSession(session.id, userContext);
                showToast('Entwurf verworfen', 'success');
                navigate('/calculator');
              }}
            >
              Entwurf verwerfen
            </button>
            <Link className={styles.secondaryAction} to="/calculator">
              Zur Beratung
            </Link>
          </div>
        }
      />

      <nav className={styles.steps} aria-label="Schritte">
        {[
          ['source', '1. Grundlage'],
          ['review', '2. Ist-Daten'],
          ['need', '3. Bedarf'],
          ['result', '4. Ergebnis'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={step === id ? styles.stepActive : styles.step}
            onClick={() => setStep(id as Step)}
          >
            {label}
          </button>
        ))}
      </nav>

      {step === 'source' ? (
        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <h2>Abrechnung einlesen</h2>
            <p>Foto oder PDF hochladen, lokal per OCR auslesen und Ist-Kosten bestätigen.</p>
            <button type="button" className={styles.primaryAction} onClick={() => void handleStartBilling()}>
              Abrechnung einlesen
            </button>
          </article>
          <article className={styles.card}>
            <h2>Werte manuell eingeben</h2>
            <p>Ohne Abrechnung Umsätze, Transaktionen und Kosten direkt erfassen.</p>
            <button type="button" className={styles.secondaryAction} onClick={() => setStep('need')}>
              Werte manuell eingeben
            </button>
          </article>
        </div>
      ) : null}

      {step === 'review' && session.billingImportSessionId ? (
        <div className={styles.stack}>
          <Suspense fallback={<p className={styles.hint}>Abrechnungsimport wird vorbereitet…</p>}>
            <OfferBillingImportSection
              sessionId={session.billingImportSessionId}
              userContext={userContext}
              billingImportService={billingImportService}
              showToast={showToast}
              title="Abrechnung prüfen"
              onBaselineConfirmed={() => {
                void bestPayComparisonService.syncBaselineFromBilling(session.id, userContext).then((updated) => {
                  if (updated) {
                    setSession(updated);
                  }
                });
              }}
            />
          </Suspense>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryAction} onClick={() => setStep('need')}>
              Weiter zu Bedarf
            </button>
            <button type="button" className={styles.primaryAction} disabled={isCalculating} onClick={() => void handleCalculate()}>
              BestPay berechnen
            </button>
          </div>
        </div>
      ) : null}

      {step === 'need' ? (
        <div className={styles.card}>
          <h2>Bedarf und manuelle Werte</h2>
          <div className={styles.formGrid}>
            <FormField label="Monatlicher Kartenumsatz (EUR)" id="monthlyVolume">
              <input id="monthlyVolume" value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value)} inputMode="decimal" />
            </FormField>
            <FormField label="Monatliche Transaktionen" id="monthlyTransactions">
              <input id="monthlyTransactions" value={monthlyTransactions} onChange={(e) => setMonthlyTransactions(e.target.value)} inputMode="numeric" />
            </FormField>
            <FormField label="Monatliche Ist-Gesamtkosten (EUR)" id="monthlyTotal">
              <input id="monthlyTotal" value={monthlyTotal} onChange={(e) => setMonthlyTotal(e.target.value)} inputMode="decimal" />
            </FormField>
            <FormField label="Terminalanzahl" id="terminalCount">
              <input id="terminalCount" value={terminalCount} onChange={(e) => setTerminalCount(e.target.value)} inputMode="numeric" />
            </FormField>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryAction} onClick={handleSaveManual}>
              Entwurf speichern
            </button>
            <button type="button" className={styles.primaryAction} disabled={isCalculating} onClick={() => void handleCalculate()}>
              {isCalculating ? 'Berechnet…' : 'BestPay berechnen'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'result' && session.result ? (
        <div className={styles.stack}>
          {session.result.stale ? (
            <div className={styles.warningBox}>
              <p className={styles.warning}>Ergebnis veraltet: {session.result.staleReasons.join(' ')}</p>
              <button type="button" className={styles.primaryAction} disabled={isCalculating} onClick={() => void handleCalculate()}>
                Neu berechnen
              </button>
            </div>
          ) : null}

          {selectedVariant ? (
            <article className={styles.heroCard}>
              <h2>Empfehlung: {selectedVariant.tariffName}</h2>
              <p>
                {selectedVariant.isHigherCost
                  ? `Voraussichtliche Mehrkosten: ${formatEuro(Math.abs(selectedVariant.savingsMonthlyCents ?? 0))} / Monat`
                  : `Voraussichtliche Ersparnis: ${formatEuro(selectedVariant.savingsMonthlyCents)} / Monat`}
                {selectedVariant.savingsPercent !== null
                  ? ` (${Math.abs(selectedVariant.savingsPercent)} %)`
                  : ''}
              </p>
              <p>
                {selectedVariant.isHigherCost
                  ? `Jährlich: Mehrkosten ${formatEuro(Math.abs(selectedVariant.savingsAnnualCents ?? 0))}`
                  : `Jährlich: Ersparnis ${formatEuro(selectedVariant.savingsAnnualCents)}`}
              </p>
              <dl className={styles.metrics}>
                <div><dt>Ist monatlich</dt><dd>{formatEuro(session.result.currentMonthlyCostsCents)}</dd></div>
                <div><dt>BestPay monatlich</dt><dd>{formatEuro(selectedVariant.monthlyTotalCostsCents)}</dd></div>
                <div><dt>Ist jährlich</dt><dd>{formatEuro(session.result.currentAnnualCostsCents)}</dd></div>
                <div><dt>BestPay jährlich</dt><dd>{formatEuro(selectedVariant.annualTotalCostsCents)}</dd></div>
                <div><dt>Einmalige Kosten</dt><dd>{formatEuro(selectedVariant.oneTimeCostsCents)}</dd></div>
                <div><dt>Laufzeit</dt><dd>{selectedVariant.termMonths ?? '—'} Monate</dd></div>
                <div><dt>Hardware</dt><dd>{selectedVariant.productName ?? '—'}</dd></div>
                {bestPayComparisonService.canSeeCommission(userContext) ? (
                  <div><dt>Provision (intern)</dt><dd>{formatEuro(selectedVariant.commissionTotalCents)}</dd></div>
                ) : null}
              </dl>
              <ul>
                {selectedVariant.primaryReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          ) : (
            <EmptyState title="Keine Empfehlung" description="Es konnten keine geeigneten BestPay-Varianten berechnet werden." />
          )}

          <article className={styles.card}>
            <h3>Alternativen</h3>
            <div className={styles.variantList}>
              {session.result.variants.map((variant) => (
                <button
                  key={variant.candidateId}
                  type="button"
                  className={variant.candidateId === session.selectedCandidateId ? styles.variantActive : styles.variant}
                  onClick={() => {
                    const updated = bestPayComparisonService.selectVariant(session.id, variant.candidateId, userContext);
                    if (updated) {
                      setSession(updated);
                    }
                  }}
                >
                  <strong>{variant.tariffName}</strong>
                  <span>{formatEuro(variant.monthlyTotalCostsCents)} / Monat</span>
                  <span>
                    {variant.isHigherCost
                      ? `Mehrkosten ${formatEuro(Math.abs(variant.savingsMonthlyCents ?? 0))}`
                      : `Ersparnis ${formatEuro(variant.savingsMonthlyCents)}`}
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <h3>Lead zuordnen und Angebot erstellen</h3>
            <FormField label="Lead" id="leadSelect">
              <select id="leadSelect" value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}>
                <option value="">— bitte wählen —</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.companyName}
                  </option>
                ))}
              </select>
            </FormField>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryAction} onClick={() => void handleAssignLead()}>
                Lead zuordnen
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isCreatingOffer || !session.leadId}
                onClick={() => void handleCreateOffer()}
              >
                {isCreatingOffer ? 'Erstellt…' : 'Angebot erstellen'}
              </button>
            </div>
            {session.offerId ? (
              <p>
                Angebot erstellt:{' '}
                <Link to={`/offers/${session.offerId}`}>Zum Angebot</Link>
              </p>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
