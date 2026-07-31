import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  resolveSelectedScenarioVariant,
  SALES_WIZARD_STEPS,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
import type { Lead } from '../../domain/lead/lead';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { SALES_WORKSPACE_PATH } from '../../utils/routes';
import styles from './SalesWizardPage.module.css';

const OfferBillingImportSection = lazy(async () => {
  const module = await import('../offer/OfferBillingImportSection');
  return { default: module.OfferBillingImportSection };
});

type ProspectMode = 'existing' | 'new' | 'anonymous';

function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
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

function centsToInput(cents: number | null): string {
  if (cents === null) {
    return '';
  }
  return String(cents / 100).replace('.', ',');
}

export function SalesWizardPage() {
  const { currentUser } = useCurrentUser();
  const {
    salesWizardService,
    bestPayComparisonService,
    billingImportService,
    leadService,
  } = useServices();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [session, setSession] = useState<BestPayComparisonSession | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [prospectMode, setProspectMode] = useState<ProspectMode>('anonymous');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [busy, setBusy] = useState(false);
  const [monthlyVolume, setMonthlyVolume] = useState('');
  const [monthlyTransactions, setMonthlyTransactions] = useState('');
  const [monthlyTotal, setMonthlyTotal] = useState('');
  const [terminalCount, setTerminalCount] = useState('1');
  const [girocardPercent, setGirocardPercent] = useState('60');
  const [debitPercent, setDebitPercent] = useState('10');
  const [creditPercent, setCreditPercent] = useState('25');
  const [otherPercent, setOtherPercent] = useState('5');
  const [preferredTerm, setPreferredTerm] = useState('36');
  const [industry, setIndustry] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [scenarioLabel, setScenarioLabel] = useState('');

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const syncNeedFields = useCallback((active: BestPayComparisonSession) => {
    setMonthlyVolume(centsToInput(active.manualInput.monthlyCardVolumeCents));
    setMonthlyTransactions(
      active.manualInput.monthlyTransactions !== null
        ? String(active.manualInput.monthlyTransactions)
        : '',
    );
    setMonthlyTotal(centsToInput(active.manualInput.monthlyTotalCostsCents));
    setTerminalCount(String(active.manualInput.terminalCount));
    setGirocardPercent(String(active.manualInput.girocardPercent ?? 60));
    setDebitPercent(String(active.manualInput.debitPercent ?? 10));
    setCreditPercent(String(active.manualInput.creditPercent ?? 25));
    setOtherPercent(String(active.manualInput.otherPercent ?? 5));
    setPreferredTerm(String(active.manualInput.preferredTermMonths ?? 36));
    setIndustry(active.manualInput.industry || active.wizard.prospectDraft.industry);
    setApprovalNotes(active.wizard.approvalNotes);
    setSelectedLeadId(active.leadId ?? '');
    if (active.leadId) {
      setProspectMode('existing');
    } else if (
      active.wizard.prospectDraft.companyName.trim() ||
      active.wizard.prospectDraft.contactFirstName.trim()
    ) {
      setProspectMode('new');
    } else {
      setProspectMode('anonymous');
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (!userContext) {
      return;
    }
    const sessionId = searchParams.get('session');
    let active: BestPayComparisonSession | null = null;

    if (sessionId) {
      const resumed = salesWizardService.resumeWizard(sessionId, userContext);
      if (!resumed.ok) {
        showToast('Gespeicherter Vorgang nicht gefunden', 'error');
        active = salesWizardService.startWizard(userContext);
      } else {
        active = resumed.session;
        showToast('Vorgang fortgesetzt', 'info');
      }
    } else if (searchParams.get('new') === '1') {
      active = salesWizardService.startWizard(userContext);
    } else {
      const draft = bestPayComparisonService.getActiveDraft(userContext);
      if (draft?.wizard.enabled || draft?.entryMode === 'wizard') {
        const resumed = salesWizardService.resumeWizard(draft.id, userContext);
        active = resumed.ok ? resumed.session : salesWizardService.startWizard(userContext);
      } else {
        active = salesWizardService.startWizard(userContext);
      }
    }

    setSession(active);
    syncNeedFields(active);
  }, [
    bestPayComparisonService,
    salesWizardService,
    searchParams,
    showToast,
    syncNeedFields,
    userContext,
  ]);

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
    return <p className={styles.hint}>Vertriebsprozess wird geladen…</p>;
  }

  const step = session.wizard.currentStep;
  const stepIndex = SALES_WIZARD_STEPS.findIndex((entry) => entry.id === step);
  const selectedScenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(selectedScenario);
  const canSeeCommission = bestPayComparisonService.canSeeCommission(userContext);

  const persistNeed = () => {
    const updated = salesWizardService.updateNeed(
      session.id,
      {
        monthlyCardVolumeCents: parseEuroToCents(monthlyVolume),
        monthlyTransactions: monthlyTransactions
          ? Number.parseInt(monthlyTransactions, 10)
          : null,
        monthlyTotalCostsCents: parseEuroToCents(monthlyTotal),
        terminalCount: Math.max(1, Number.parseInt(terminalCount, 10) || 1),
        girocardPercent: Number.parseInt(girocardPercent, 10) || null,
        debitPercent: Number.parseInt(debitPercent, 10) || null,
        creditPercent: Number.parseInt(creditPercent, 10) || null,
        otherPercent: Number.parseInt(otherPercent, 10) || null,
        preferredTermMonths: Number.parseInt(preferredTerm, 10) || null,
        industry,
        paymentUsage: { ...session.manualInput.paymentUsage },
      },
      userContext,
    );
    if (updated) {
      setSession(updated);
    }
    return updated;
  };

  const handleGoNext = () => {
    if (step === 'need') {
      persistNeed();
    }
    const result = salesWizardService.goNext(session.id, userContext);
    if (!result.ok) {
      showToast(result.message ?? 'Schritt nicht möglich', 'error');
      return;
    }
    setSession(result.session);
  };

  const handleGoBack = () => {
    const updated = salesWizardService.goBack(session.id, userContext);
    if (updated) {
      setSession(updated);
    }
  };

  const handleJumpStep = (target: SalesWizardStepId) => {
    const updated = salesWizardService.setStep(session.id, target, userContext);
    if (updated) {
      setSession(updated);
    }
  };

  const handleCreateLead = async () => {
    setBusy(true);
    const result = await salesWizardService.createLeadFromProspect(session.id, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? 'Lead konnte nicht angelegt werden', 'error');
      return;
    }
    setSession(result.session);
    setProspectMode('existing');
    setSelectedLeadId(result.leadId);
    showToast('Lead angelegt und zugeordnet', 'success');
  };

  const handleAssignLead = async () => {
    if (!selectedLeadId) {
      showToast('Bitte einen Lead auswählen', 'error');
      return;
    }
    setBusy(true);
    const result = await salesWizardService.assignLead(session.id, selectedLeadId, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast('Lead-Zuordnung fehlgeschlagen', 'error');
      return;
    }
    setSession(result.session);
    showToast('Lead zugeordnet', 'success');
  };

  const handleStartBilling = async () => {
    setBusy(true);
    const result = await salesWizardService.startBillingImport(session.id, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast('Abrechnungsimport konnte nicht gestartet werden', 'error');
      return;
    }
    setSession(result.session);
  };

  const handleAddScenario = () => {
    const result = salesWizardService.addScenario(
      session.id,
      userContext,
      scenarioLabel.trim() || undefined,
    );
    if (!result.ok) {
      showToast('Szenario konnte nicht angelegt werden', 'error');
      return;
    }
    setSession(result.session);
    setScenarioLabel('');
  };

  const handleCalculateScenario = async (scenarioId: string) => {
    persistNeed();
    setBusy(true);
    const result = await salesWizardService.calculateScenario(session.id, scenarioId, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? 'Szenario-Berechnung fehlgeschlagen', 'error');
      return;
    }
    setSession(result.session);
    showToast('Szenario berechnet', 'success');
  };

  const handleCreateOffer = async () => {
    setBusy(true);
    const result = await salesWizardService.createOffer(session.id, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? 'Angebot konnte nicht erstellt werden', 'error');
      return;
    }
    setSession(result.session);
    showToast('Angebotsentwurf erzeugt', 'success');
  };

  const handleAcknowledgeApproval = () => {
    const result = salesWizardService.acknowledgeApproval(session.id, approvalNotes, userContext);
    if (!result.ok) {
      showToast(result.message ?? 'Freigabe nicht möglich', 'error');
      return;
    }
    setSession(result.session);
    showToast('Freigabe bestätigt', 'success');
  };

  const handleComplete = () => {
    const result = salesWizardService.completeWizard(session.id, userContext);
    if (!result.ok) {
      showToast(result.message ?? 'Abschluss nicht möglich', 'error');
      return;
    }
    setSession(result.session);
    showToast('Vertriebsprozess abgeschlossen', 'success');
  };

  return (
    <section>
      <PageHeader
        title="BestPay Vertriebsprozess"
        subtitle="Vom Interessenten bis zum Angebotsentwurf – ein durchgängiger Vertriebsprozess"
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.secondaryAction} to="/calculator/bestpay/history">
              Berechnungen
            </Link>
            <Link className={styles.secondaryAction} to={SALES_WORKSPACE_PATH}>
              Zum Vertriebsarbeitsplatz
            </Link>
          </div>
        }
      />

      <div className={styles.statusLine} aria-live="polite">
        <span>Autosave aktiv</span>
        <span>Zuletzt gespeichert: {new Date(session.updatedAt).toLocaleString('de-DE')}</span>
        <span>
          Fortschritt: {stepIndex + 1}/{SALES_WIZARD_STEPS.length}
        </span>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Prozessschritte">
          {SALES_WIZARD_STEPS.map((entry, index) => {
            const isActive = entry.id === step;
            const isDone = index < stepIndex;
            return (
              <button
                key={entry.id}
                type="button"
                className={
                  isActive ? styles.navItemActive : isDone ? styles.navItemDone : styles.navItem
                }
                onClick={() => handleJumpStep(entry.id)}
              >
                <span className={styles.navNumber}>{entry.number}</span>
                <span>{entry.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.main}>
          {step === 'prospect' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Interessent</h2>
                <p className={styles.hint}>
                  Bestehenden Lead wählen, neuen Interessenten erfassen oder zunächst ohne Lead
                  rechnen.
                </p>
                <div className={styles.choiceRow}>
                  {(
                    [
                      ['existing', 'Bestehender Lead'],
                      ['new', 'Neuer Interessent'],
                      ['anonymous', 'Ohne Lead rechnen'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        prospectMode === mode ? styles.choiceButtonActive : styles.choiceButton
                      }
                      onClick={() => setProspectMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>

              {prospectMode === 'existing' ? (
                <article className={styles.card}>
                  <FormField label="Lead auswählen" id="wizardLead">
                    <select
                      id="wizardLead"
                      value={selectedLeadId}
                      onChange={(event) => setSelectedLeadId(event.target.value)}
                    >
                      <option value="">Bitte wählen…</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.companyName} – {lead.contactFirstName} {lead.contactLastName}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={busy}
                      onClick={() => void handleAssignLead()}
                    >
                      Lead zuordnen
                    </button>
                  </div>
                </article>
              ) : null}

              {prospectMode === 'new' ? (
                <article className={styles.card}>
                  <div className={styles.formGrid}>
                    <FormField label="Firma" id="companyName">
                      <input
                        id="companyName"
                        value={session.wizard.prospectDraft.companyName}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { companyName: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="Branche" id="industryProspect">
                      <input
                        id="industryProspect"
                        value={session.wizard.prospectDraft.industry}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { industry: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="Vorname" id="contactFirstName">
                      <input
                        id="contactFirstName"
                        value={session.wizard.prospectDraft.contactFirstName}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { contactFirstName: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="Nachname" id="contactLastName">
                      <input
                        id="contactLastName"
                        value={session.wizard.prospectDraft.contactLastName}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { contactLastName: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="Telefon" id="phone">
                      <input
                        id="phone"
                        value={session.wizard.prospectDraft.phone}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { phone: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="E-Mail" id="email">
                      <input
                        id="email"
                        value={session.wizard.prospectDraft.email}
                        onChange={(event) => {
                          const updated = salesWizardService.updateProspectDraft(
                            session.id,
                            { email: event.target.value },
                            userContext,
                          );
                          if (updated) {
                            setSession(updated);
                          }
                        }}
                      />
                    </FormField>
                  </div>
                  <FormField label="Notizen" id="notes">
                    <textarea
                      id="notes"
                      className={styles.textarea}
                      value={session.wizard.prospectDraft.notes}
                      onChange={(event) => {
                        const updated = salesWizardService.updateProspectDraft(
                          session.id,
                          { notes: event.target.value },
                          userContext,
                        );
                        if (updated) {
                          setSession(updated);
                        }
                      }}
                    />
                  </FormField>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={busy}
                      onClick={() => void handleCreateLead()}
                    >
                      Als Lead anlegen
                    </button>
                    <p className={styles.hint}>Optional – Sie können auch später einen Lead anlegen.</p>
                  </div>
                </article>
              ) : null}

              {prospectMode === 'anonymous' ? (
                <article className={styles.card}>
                  <p>
                    Die Berechnung läuft ohne Lead weiter. Für Angebot und Pipeline-Übernahme ist
                    später ein Lead erforderlich.
                  </p>
                </article>
              ) : null}
            </div>
          ) : null}

          {step === 'costs' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Aktuelle Kosten</h2>
                <p className={styles.hint}>
                  Vorhandene Billing-/OCR-Pipeline: PDF, Foto, OCR oder manuelle Eingabe – danach
                  Ist-Kosten bestätigen.
                </p>
                <div className={styles.actions}>
                  {!session.billingImportSessionId ? (
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={busy}
                      onClick={() => void handleStartBilling()}
                    >
                      Abrechnung einlesen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => {
                      const updated = salesWizardService.updateNeed(
                        session.id,
                        {
                          monthlyTotalCostsCents:
                            session.manualInput.monthlyTotalCostsCents ?? 250_00,
                          monthlyCardVolumeCents:
                            session.manualInput.monthlyCardVolumeCents ?? 50_000_00,
                        },
                        userContext,
                      );
                      if (updated) {
                        setSession(updated);
                        syncNeedFields(updated);
                        showToast('Manuelle Ist-Kosten vorbereitet', 'success');
                      }
                    }}
                  >
                    Manuelle Ist-Kosten
                  </button>
                </div>
              </article>

              {session.billingImportSessionId ? (
                <Suspense fallback={<p className={styles.hint}>Abrechnungsimport wird vorbereitet…</p>}>
                  <OfferBillingImportSection
                    sessionId={session.billingImportSessionId}
                    userContext={userContext}
                    billingImportService={billingImportService}
                    showToast={showToast}
                    title="Abrechnung prüfen und bestätigen"
                    onBaselineConfirmed={() => {
                      void bestPayComparisonService
                        .syncBaselineFromBilling(session.id, userContext)
                        .then((updated) => {
                          if (updated) {
                            setSession(updated);
                            syncNeedFields(updated);
                          }
                        });
                    }}
                  />
                </Suspense>
              ) : (
                <article className={styles.card}>
                  <div className={styles.formGrid}>
                    <FormField label="Monatliche Ist-Gesamtkosten (EUR)" id="manualTotalCosts">
                      <input
                        id="manualTotalCosts"
                        value={monthlyTotal}
                        onChange={(event) => setMonthlyTotal(event.target.value)}
                        inputMode="decimal"
                      />
                    </FormField>
                    <FormField label="Monatlicher Kartenumsatz (EUR)" id="manualVolumeCosts">
                      <input
                        id="manualVolumeCosts"
                        value={monthlyVolume}
                        onChange={(event) => setMonthlyVolume(event.target.value)}
                        inputMode="decimal"
                      />
                    </FormField>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={() => {
                      const updated = persistNeed();
                      if (updated) {
                        showToast('Ist-Kosten gespeichert', 'success');
                      }
                    }}
                  >
                    Ist-Kosten speichern
                  </button>
                </article>
              )}
            </div>
          ) : null}

          {step === 'need' ? (
            <article className={styles.card}>
              <h2>Bedarf</h2>
              <p className={styles.hint}>
                Terminals, Umsatz, Kartenmix, Laufzeit und Besonderheiten für die Empfehlung.
              </p>
              <div className={styles.formGrid}>
                <FormField label="Monatlicher Kartenumsatz (EUR)" id="needVolume">
                  <input
                    id="needVolume"
                    value={monthlyVolume}
                    onChange={(event) => setMonthlyVolume(event.target.value)}
                    inputMode="decimal"
                  />
                </FormField>
                <FormField label="Monatliche Transaktionen" id="needTx">
                  <input
                    id="needTx"
                    value={monthlyTransactions}
                    onChange={(event) => setMonthlyTransactions(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Terminalanzahl" id="needTerminals">
                  <input
                    id="needTerminals"
                    value={terminalCount}
                    onChange={(event) => setTerminalCount(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Bevorzugte Laufzeit (Monate)" id="needTerm">
                  <select
                    id="needTerm"
                    value={preferredTerm}
                    onChange={(event) => setPreferredTerm(event.target.value)}
                  >
                    <option value="36">36 Monate</option>
                    <option value="48">48 Monate</option>
                    <option value="60">60 Monate</option>
                  </select>
                </FormField>
                <FormField label="Branche" id="needIndustry">
                  <input
                    id="needIndustry"
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                  />
                </FormField>
                <FormField label="girocard %" id="giro">
                  <input
                    id="giro"
                    value={girocardPercent}
                    onChange={(event) => setGirocardPercent(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Debit %" id="debit">
                  <input
                    id="debit"
                    value={debitPercent}
                    onChange={(event) => setDebitPercent(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Kreditkarte %" id="credit">
                  <input
                    id="credit"
                    value={creditPercent}
                    onChange={(event) => setCreditPercent(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Sonstige %" id="other">
                  <input
                    id="other"
                    value={otherPercent}
                    onChange={(event) => setOtherPercent(event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
              </div>
              <div className={styles.checkboxRow}>
                {(
                  [
                    ['stationary', 'Stationär'],
                    ['mobile', 'Mobil'],
                    ['ecommerce', 'E-Commerce'],
                    ['softPos', 'SoftPOS'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={session.manualInput.paymentUsage[key]}
                      onChange={(event) => {
                        const updated = salesWizardService.updateNeed(
                          session.id,
                          {
                            paymentUsage: {
                              ...session.manualInput.paymentUsage,
                              [key]: event.target.checked,
                            },
                          },
                          userContext,
                        );
                        if (updated) {
                          setSession(updated);
                        }
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  const updated = persistNeed();
                  if (updated) {
                    showToast('Bedarf gespeichert', 'success');
                  }
                }}
              >
                Bedarf speichern
              </button>
            </article>
          ) : null}

          {step === 'variants' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Variantenvergleich</h2>
                <p className={styles.hint}>
                  Beliebig viele Szenarien anlegen, berechnen und vergleichen. Eine Variante wird
                  ausgewählt.
                </p>
                <div className={styles.actions}>
                  <FormField label="Neues Szenario" id="scenarioLabel">
                    <input
                      id="scenarioLabel"
                      value={scenarioLabel}
                      onChange={(event) => setScenarioLabel(event.target.value)}
                      placeholder="z. B. Classic 36 Monate"
                    />
                  </FormField>
                  <button type="button" className={styles.primaryAction} onClick={handleAddScenario}>
                    Szenario anlegen
                  </button>
                </div>
              </article>

              {session.wizard.scenarios.length === 0 ? (
                <EmptyState
                  title="Noch keine Szenarien"
                  description="Legen Sie z. B. Classic, Variable oder unterschiedliche Laufzeiten an."
                />
              ) : (
                <div className={styles.scenarioList}>
                  {session.wizard.scenarios.map((scenario) => {
                    const isSelected = scenario.id === session.wizard.selectedScenarioId;
                    return (
                      <article
                        key={scenario.id}
                        className={isSelected ? styles.scenarioCardActive : styles.scenarioCard}
                      >
                        <div className={styles.formGrid}>
                          <FormField label="Bezeichnung" id={`label-${scenario.id}`}>
                            <input
                              id={`label-${scenario.id}`}
                              value={scenario.label}
                              onChange={(event) => {
                                const updated = salesWizardService.updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  { label: event.target.value },
                                  userContext,
                                );
                                if (updated) {
                                  setSession(updated);
                                }
                              }}
                            />
                          </FormField>
                          <FormField label="Laufzeit" id={`term-${scenario.id}`}>
                            <select
                              id={`term-${scenario.id}`}
                              value={String(scenario.config.preferredTermMonths ?? 36)}
                              onChange={(event) => {
                                const updated = salesWizardService.updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  {
                                    preferredTermMonths: Number.parseInt(event.target.value, 10),
                                  },
                                  userContext,
                                );
                                if (updated) {
                                  setSession(updated);
                                }
                              }}
                            >
                              <option value="36">36 Monate</option>
                              <option value="48">48 Monate</option>
                              <option value="60">60 Monate</option>
                            </select>
                          </FormField>
                          <FormField label="Terminals" id={`termCount-${scenario.id}`}>
                            <input
                              id={`termCount-${scenario.id}`}
                              value={String(scenario.config.terminalCount)}
                              onChange={(event) => {
                                const updated = salesWizardService.updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  {
                                    terminalCount: Math.max(
                                      1,
                                      Number.parseInt(event.target.value, 10) || 1,
                                    ),
                                  },
                                  userContext,
                                );
                                if (updated) {
                                  setSession(updated);
                                }
                              }}
                              inputMode="numeric"
                            />
                          </FormField>
                        </div>

                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.primaryAction}
                            disabled={busy}
                            onClick={() => void handleCalculateScenario(scenario.id)}
                          >
                            Berechnen
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryAction}
                            onClick={() => {
                              const result = salesWizardService.duplicateScenario(
                                session.id,
                                scenario.id,
                                userContext,
                              );
                              if (result.ok) {
                                setSession(result.session);
                              }
                            }}
                          >
                            Duplizieren
                          </button>
                          <button
                            type="button"
                            className={styles.dangerAction}
                            onClick={() => {
                              const result = salesWizardService.deleteScenario(
                                session.id,
                                scenario.id,
                                userContext,
                              );
                              if (result.ok) {
                                setSession(result.session);
                              }
                            }}
                          >
                            Löschen
                          </button>
                        </div>

                        {scenario.result ? (
                          <>
                            <dl className={styles.metrics}>
                              <div>
                                <dt>Ist monatlich</dt>
                                <dd>{formatEuro(scenario.result.currentMonthlyCostsCents)}</dd>
                              </div>
                              <div>
                                <dt>Varianten</dt>
                                <dd>{scenario.result.variants.length}</dd>
                              </div>
                            </dl>
                            <div className={styles.variantList}>
                              {scenario.result.variants.map((variant) => {
                                const active = scenario.selectedCandidateId === variant.candidateId;
                                return (
                                  <button
                                    key={variant.candidateId}
                                    type="button"
                                    className={active ? styles.variantActive : styles.variant}
                                    onClick={() => {
                                      const updated = salesWizardService.selectScenarioVariant(
                                        session.id,
                                        scenario.id,
                                        variant.candidateId,
                                        userContext,
                                      );
                                      if (updated) {
                                        setSession(updated);
                                      }
                                    }}
                                  >
                                    <strong>{variant.tariffName}</strong>
                                    <span>
                                      BestPay {formatEuro(variant.monthlyTotalCostsCents)} / Monat ·
                                      Ersparnis {formatEuro(variant.savingsMonthlyCents)}
                                    </span>
                                    <span>
                                      Laufzeit {variant.termMonths ?? '—'} Monate · Hardware{' '}
                                      {variant.productName ?? '—'}
                                    </span>
                                    {canSeeCommission ? (
                                      <span>
                                        Provision (intern) {formatEuro(variant.commissionTotalCents)}
                                      </span>
                                    ) : null}
                                    {variant.primaryReasons[0] ? (
                                      <span>Empfehlung: {variant.primaryReasons[0]}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className={styles.hint}>Noch nicht berechnet.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === 'offer' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Angebot</h2>
                <p className={styles.hint}>
                  Nutzt die vorhandene Angebotsengine auf Basis der gewählten Variante.
                </p>
                {selectedVariant ? (
                  <dl className={styles.metrics}>
                    <div>
                      <dt>Variante</dt>
                      <dd>{selectedVariant.tariffName}</dd>
                    </div>
                    <div>
                      <dt>Hardware</dt>
                      <dd>{selectedVariant.productName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Laufzeit</dt>
                      <dd>{selectedVariant.termMonths ?? '—'} Monate</dd>
                    </div>
                    <div>
                      <dt>BestPay monatlich</dt>
                      <dd>{formatEuro(selectedVariant.monthlyTotalCostsCents)}</dd>
                    </div>
                    {canSeeCommission ? (
                      <div>
                        <dt>Provision (intern)</dt>
                        <dd>{formatEuro(selectedVariant.commissionTotalCents)}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <EmptyState
                    title="Keine Variante gewählt"
                    description="Bitte im Variantenvergleich eine Empfehlung auswählen."
                  />
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    disabled={busy || !selectedVariant}
                    onClick={() => void handleCreateOffer()}
                  >
                    Angebotsentwurf erzeugen
                  </button>
                  {session.offerId ? (
                    <Link className={styles.secondaryAction} to={`/offers/${session.offerId}`}>
                      Entwurf öffnen
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => handleJumpStep('variants')}
                  >
                    Zurück zum Variantenvergleich
                  </button>
                </div>
                {session.offerNumber ? (
                  <p>
                    Angebot {session.offerNumber}
                    {session.offerTitle ? ` – ${session.offerTitle}` : ''}
                  </p>
                ) : null}
              </article>
            </div>
          ) : null}

          {step === 'approval' ? (
            <article className={styles.card}>
              <h2>Freigabe</h2>
              {selectedScenario?.approval ? (
                <>
                  <dl className={styles.metrics}>
                    <div>
                      <dt>Admin-Review</dt>
                      <dd>{selectedScenario.approval.adminReviewRequired ? 'Ja' : 'Nein'}</dd>
                    </div>
                    <div>
                      <dt>Schnellprüfung</dt>
                      <dd>{selectedScenario.approval.quickReviewPossible ? 'Möglich' : 'Nein'}</dd>
                    </div>
                    <div>
                      <dt>Detailprüfung</dt>
                      <dd>{selectedScenario.approval.detailReviewRequired ? 'Erforderlich' : 'Nein'}</dd>
                    </div>
                    <div>
                      <dt>Blockiert</dt>
                      <dd>{selectedScenario.approval.approvalBlocked ? 'Ja' : 'Nein'}</dd>
                    </div>
                  </dl>
                  {selectedScenario.approval.reasons.length > 0 ? (
                    <div className={styles.warningBox}>
                      <ul>
                        {selectedScenario.approval.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className={styles.hint}>Keine spezielle Freigabe erforderlich.</p>
              )}
              <FormField label="Interne Notiz / Begründung" id="approvalNotes">
                <textarea
                  id="approvalNotes"
                  className={styles.textarea}
                  value={approvalNotes}
                  onChange={(event) => setApprovalNotes(event.target.value)}
                />
              </FormField>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={handleAcknowledgeApproval}
                >
                  Freigabe bestätigen
                </button>
              </div>
              {session.wizard.approvalAcknowledgedAt ? (
                <p className={styles.hint}>
                  Bestätigt am{' '}
                  {new Date(session.wizard.approvalAcknowledgedAt).toLocaleString('de-DE')}
                </p>
              ) : null}
            </article>
          ) : null}

          {step === 'closing' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Abschluss</h2>
                <dl className={styles.metrics}>
                  <div>
                    <dt>Lead</dt>
                    <dd>{session.leadDisplayName ?? session.customerLabel ?? 'Ohne Lead'}</dd>
                  </div>
                  <div>
                    <dt>Ist monatlich</dt>
                    <dd>{formatEuro(selectedScenario?.result?.currentMonthlyCostsCents)}</dd>
                  </div>
                  <div>
                    <dt>Gewählte Variante</dt>
                    <dd>{selectedVariant?.tariffName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Ersparnis / Monat</dt>
                    <dd>{formatEuro(selectedVariant?.savingsMonthlyCents)}</dd>
                  </div>
                  {canSeeCommission ? (
                    <div>
                      <dt>Provision</dt>
                      <dd>{formatEuro(selectedVariant?.commissionTotalCents)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Angebot</dt>
                    <dd>{session.offerNumber ?? '—'}</dd>
                  </div>
                </dl>
                <div className={styles.actions}>
                  {!session.wizard.wizardCompletedAt ? (
                    <button type="button" className={styles.primaryAction} onClick={handleComplete}>
                      Vertriebsprozess abschließen
                    </button>
                  ) : null}
                  {session.offerId ? (
                    <>
                      <Link className={styles.secondaryAction} to={`/offers/${session.offerId}`}>
                        Angebot öffnen / versenden
                      </Link>
                      <Link
                        className={styles.secondaryAction}
                        to={`/offers/${session.offerId}/preview`}
                      >
                        PDF-Vorschau
                      </Link>
                    </>
                  ) : null}
                  {session.leadId ? (
                    <Link className={styles.secondaryAction} to={`/leads/${session.leadId}`}>
                      Pipeline / Lead öffnen
                    </Link>
                  ) : null}
                  <Link className={styles.secondaryAction} to="/calculator/bestpay/history">
                    Wiedervorlage / Historie
                  </Link>
                </div>
              </article>
            </div>
          ) : null}

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={handleGoBack}
              disabled={step === 'prospect'}
            >
              Zurück
            </button>
            {step !== 'closing' ? (
              <button type="button" className={styles.primaryAction} onClick={handleGoNext}>
                Weiter
              </button>
            ) : (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => navigate(SALES_WORKSPACE_PATH)}
              >
                Zum Vertriebsarbeitsplatz
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
