import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { isEmptyAdviceSession } from '../../domain/bestPayComparison/isEmptyAdviceSession';
import {
  getNextSalesWizardStep,
  getPreviousSalesWizardStep,
  getVisibleWizardStepIndex,
  resolveSelectedScenarioVariant,
  SALES_WIZARD_VISIBLE_STEPS,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
import type { Lead } from '../../domain/lead/lead';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { SALES_WORKSPACE_PATH, ADVICE_PATH } from '../../utils/routes';
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
    offerWorkflowService,
  } = useServices();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const bootstrappedSessionIdRef = useRef<string | null>(null);

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
  const [workflowView, setWorkflowView] = useState<Awaited<
    ReturnType<typeof offerWorkflowService.getWizardWorkflowView>
  > | null>(null);

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

  const bindSessionToUrl = useCallback(
    (sessionId: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('new');
          next.set('session', sessionId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const ensurePersisted = useCallback(
    (current: BestPayComparisonSession): BestPayComparisonSession => {
      if (!userContext) {
        return current;
      }
      if (salesWizardService.isWizardPersisted(current.id)) {
        return current;
      }
      const saved = salesWizardService.persistWizardSession(current, userContext);
      bootstrappedSessionIdRef.current = saved.id;
      bindSessionToUrl(saved.id);
      return saved;
    },
    [bindSessionToUrl, salesWizardService, userContext],
  );

  const bootstrap = useCallback(async () => {
    if (!userContext) {
      return;
    }
    const sessionId = searchParams.get('session');
    if (sessionId && bootstrappedSessionIdRef.current === sessionId) {
      return;
    }

    let active: BestPayComparisonSession | null = null;
    let resumedToast = false;

    if (sessionId) {
      const resumed = await salesWizardService.resumeWizard(sessionId, userContext);
      if (!resumed.ok) {
        showToast('Gespeicherter Vorgang nicht gefunden', 'error');
        active = salesWizardService.createTransientWizard(userContext);
      } else {
        active = resumed.session;
        resumedToast = true;
      }
    } else if (searchParams.get('leadId')) {
      // leadId in der URL ist eine fachliche Kundenauswahl → einmal persistieren
      active = salesWizardService.createTransientWizard(userContext);
      active = salesWizardService.persistWizardSession(active, userContext);
      const assigned = await salesWizardService.assignLead(
        active.id,
        searchParams.get('leadId')!,
        userContext,
      );
      if (assigned.ok) {
        active = assigned.session;
      }
      bindSessionToUrl(active.id);
    } else if (searchParams.get('new') === '1') {
      active = salesWizardService.createTransientWizard(userContext);
    } else {
      const draft = bestPayComparisonService.getActiveDraft(userContext);
      if (
        draft &&
        (draft.wizard.enabled || draft.entryMode === 'wizard') &&
        !isEmptyAdviceSession(draft)
      ) {
        const resumed = await salesWizardService.resumeWizard(draft.id, userContext);
        active = resumed.ok ? resumed.session : salesWizardService.createTransientWizard(userContext);
        resumedToast = resumed.ok;
      } else {
        active = salesWizardService.createTransientWizard(userContext);
      }
    }

    bootstrappedSessionIdRef.current = active.id;
    setSession(active);
    syncNeedFields(active);
    if (resumedToast) {
      showToast('Beratung fortgesetzt', 'info');
    }
    if (active.offerId) {
      setWorkflowView(await offerWorkflowService.getWizardWorkflowView(active.offerId));
    } else {
      setWorkflowView(null);
    }
  }, [
    bestPayComparisonService,
    bindSessionToUrl,
    salesWizardService,
    offerWorkflowService,
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
    return <p className={styles.hint}>Beratung wird geladen…</p>;
  }

  const step = session.wizard.currentStep;
  const stepIndex = getVisibleWizardStepIndex(step);
  const selectedScenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(selectedScenario);
  const canSeeCommission = bestPayComparisonService.canSeeCommission(userContext);

  const patchProspectDraft = (patch: Partial<BestPayComparisonSession['wizard']['prospectDraft']>) => {
    const next: BestPayComparisonSession = {
      ...session,
      wizard: {
        ...session.wizard,
        prospectDraft: {
          ...session.wizard.prospectDraft,
          ...patch,
        },
      },
    };
    if (!salesWizardService.isWizardPersisted(session.id)) {
      if (isEmptyAdviceSession(next)) {
        setSession(next);
        return;
      }
      const saved = ensurePersisted(next);
      setSession(saved);
      return;
    }
    const updated = salesWizardService.updateProspectDraft(session.id, patch, userContext);
    if (updated) {
      setSession(updated);
    }
  };

  const persistNeed = () => {
    const patch = {
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
    };
    const next: BestPayComparisonSession = {
      ...session,
      manualInput: {
        ...session.manualInput,
        ...patch,
        paymentUsage: { ...session.manualInput.paymentUsage, ...patch.paymentUsage },
      },
    };
    if (!salesWizardService.isWizardPersisted(session.id)) {
      if (isEmptyAdviceSession(next)) {
        setSession(next);
        return next;
      }
      const saved = ensurePersisted(next);
      setSession(saved);
      return saved;
    }
    const updated = salesWizardService.updateNeed(session.id, patch, userContext);
    if (updated) {
      setSession(updated);
    }
    return updated;
  };

  const handleGoNext = () => {
    void (async () => {
      let current = session;
      if (step === 'need') {
        const updated = persistNeed();
        if (updated) {
          current = updated;
        }
      }
      if (!salesWizardService.isWizardPersisted(current.id)) {
        const validation = await salesWizardService.validateStep(current, current.wizard.currentStep);
        if (!validation.ok) {
          showToast(validation.message ?? 'Weiter nicht möglich', 'error');
          return;
        }
        const nextStep = getNextSalesWizardStep(current.wizard.currentStep);
        if (!nextStep) {
          return;
        }
        setSession({
          ...current,
          wizard: { ...current.wizard, currentStep: nextStep },
        });
        return;
      }
      const result = await salesWizardService.goNext(current.id, userContext);
      if (!result.ok) {
        showToast(result.message ?? 'Weiter nicht möglich', 'error');
        return;
      }
      setSession(result.session);
      if (result.session.offerId) {
        setWorkflowView(await offerWorkflowService.getWizardWorkflowView(result.session.offerId));
      }
    })();
  };

  const handleGoBack = () => {
    if (!salesWizardService.isWizardPersisted(session.id)) {
      const previous = getPreviousSalesWizardStep(session.wizard.currentStep);
      if (!previous) {
        return;
      }
      setSession({
        ...session,
        wizard: { ...session.wizard, currentStep: previous },
      });
      return;
    }
    const updated = salesWizardService.goBack(session.id, userContext);
    if (updated) {
      setSession(updated);
    }
  };

  const handleJumpStep = (target: SalesWizardStepId) => {
    if (!salesWizardService.isWizardPersisted(session.id)) {
      setSession({
        ...session,
        wizard: { ...session.wizard, currentStep: target },
      });
      return;
    }
    const updated = salesWizardService.setStep(session.id, target, userContext);
    if (updated) {
      setSession(updated);
    }
  };

  const handleSaveDraft = () => {
    const saved = ensurePersisted(session);
    setSession(saved);
    showToast('Entwurf gespeichert', 'success');
  };

  const handleCreateLead = async () => {
    setBusy(true);
    const current = ensurePersisted(session);
    const result = await salesWizardService.createLeadFromProspect(current.id, userContext);
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
    const current = ensurePersisted(session);
    const result = await salesWizardService.assignLead(current.id, selectedLeadId, userContext);
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
    const current = ensurePersisted(session);
    const result = await salesWizardService.startBillingImport(current.id, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast('Abrechnungsimport konnte nicht gestartet werden', 'error');
      return;
    }
    setSession(result.session);
  };

  const handleAddScenario = () => {
    const current = ensurePersisted(session);
    const result = salesWizardService.addScenario(
      current.id,
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
    const needed = persistNeed();
    setBusy(true);
    const current = ensurePersisted(needed ?? session);
    const result = await salesWizardService.calculateScenario(current.id, scenarioId, userContext);
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
    const current = ensurePersisted(session);
    const result = await salesWizardService.createOffer(current.id, userContext);
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? 'Angebot konnte nicht erstellt werden', 'error');
      return;
    }
    setSession(result.session);
    setWorkflowView(await offerWorkflowService.getWizardWorkflowView(result.offerId));
    showToast('Angebotsentwurf erzeugt', 'success');
  };

  const handleAcknowledgeApproval = () => {
    void (async () => {
      const current = ensurePersisted(session);
      const result = await salesWizardService.acknowledgeApproval(
        current.id,
        approvalNotes,
        userContext,
      );
      if (!result.ok) {
        showToast(result.message ?? 'Freigabe nicht möglich', 'error');
        return;
      }
      setSession(result.session);
      if (result.session.offerId) {
        setWorkflowView(await offerWorkflowService.getWizardWorkflowView(result.session.offerId));
      }
      showToast('Freigabe eingereicht', 'success');
    })();
  };

  const handleComplete = () => {
    void (async () => {
      const current = ensurePersisted(session);
      const result = await salesWizardService.completeWizard(current.id, userContext);
      if (!result.ok) {
        showToast(result.message ?? 'Abschluss der Beratung nicht möglich', 'error');
        return;
      }
      setSession(result.session);
      showToast('Beratung abgeschlossen', 'success');
    })();
  };

  return (
    <section>
      <PageHeader
        title="Beratung"
        subtitle="Vom Kunden über den Kostenvergleich bis zum Angebot – ein durchgängiger Beratungsweg"
        actions={
          <div className={styles.headerActions}>
            {!salesWizardService.isWizardPersisted(session.id) ? (
              <button type="button" className={styles.secondaryAction} onClick={handleSaveDraft}>
                Entwurf speichern
              </button>
            ) : null}
            <Link className={styles.secondaryAction} to={ADVICE_PATH}>
              Zur Beratung
            </Link>
            <Link className={styles.secondaryAction} to={SALES_WORKSPACE_PATH}>
              Zum Arbeitsplatz
            </Link>
          </div>
        }
      />

      <div className={styles.statusLine} aria-live="polite">
        <span>
          {salesWizardService.isWizardPersisted(session.id)
            ? 'Autosave aktiv'
            : 'Noch nicht gespeichert'}
        </span>
        {salesWizardService.isWizardPersisted(session.id) ? (
          <span>Zuletzt gespeichert: {new Date(session.updatedAt).toLocaleString('de-DE')}</span>
        ) : (
          <span>Eingaben werden lokal gehalten, bis fachliche Daten erfasst sind</span>
        )}
        <span>
          Fortschritt: {stepIndex + 1}/{SALES_WIZARD_VISIBLE_STEPS.length}
        </span>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Beratungsschritte">
          {SALES_WIZARD_VISIBLE_STEPS.map((entry, index) => {
            const isActive = entry.includes.includes(step);
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
                <h2>Kunde</h2>
                <p className={styles.hint}>
                  Bestehenden Kunden wählen, neuen Kunden anlegen oder zunächst ohne Kundenbezug
                  rechnen.
                </p>
                <div className={styles.choiceRow}>
                  {(
                    [
                      ['existing', 'Bestehender Kunde'],
                      ['new', 'Neuer Kunde'],
                      ['anonymous', 'Ohne Kunde rechnen'],
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
                  <FormField label="Kunde auswählen" id="wizardLead">
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
                      Kunde zuordnen
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
                        patchProspectDraft({ companyName: event.target.value });
                      }}
                      />
                    </FormField>
                    <FormField label="Branche" id="industryProspect">
                      <input
                        id="industryProspect"
                        value={session.wizard.prospectDraft.industry}
                        onChange={(event) => {
                        patchProspectDraft({ industry: event.target.value });
                      }}
                      />
                    </FormField>
                    <FormField label="Vorname" id="contactFirstName">
                      <input
                        id="contactFirstName"
                        value={session.wizard.prospectDraft.contactFirstName}
                        onChange={(event) => {
                        patchProspectDraft({ contactFirstName: event.target.value });
                      }}
                      />
                    </FormField>
                    <FormField label="Nachname" id="contactLastName">
                      <input
                        id="contactLastName"
                        value={session.wizard.prospectDraft.contactLastName}
                        onChange={(event) => {
                        patchProspectDraft({ contactLastName: event.target.value });
                      }}
                      />
                    </FormField>
                    <FormField label="Telefon" id="phone">
                      <input
                        id="phone"
                        value={session.wizard.prospectDraft.phone}
                        onChange={(event) => {
                        patchProspectDraft({ phone: event.target.value });
                      }}
                      />
                    </FormField>
                    <FormField label="E-Mail" id="email">
                      <input
                        id="email"
                        value={session.wizard.prospectDraft.email}
                        onChange={(event) => {
                        patchProspectDraft({ email: event.target.value });
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
                        patchProspectDraft({ notes: event.target.value });
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
                <h2>Ausgangslage</h2>
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
                      const patch = {
                        monthlyTotalCostsCents:
                          session.manualInput.monthlyTotalCostsCents ?? 250_00,
                        monthlyCardVolumeCents:
                          session.manualInput.monthlyCardVolumeCents ?? 50_000_00,
                      };
                      const next: BestPayComparisonSession = {
                        ...session,
                        manualInput: { ...session.manualInput, ...patch },
                      };
                      if (!salesWizardService.isWizardPersisted(session.id)) {
                        const saved = ensurePersisted(next);
                        setSession(saved);
                        syncNeedFields(saved);
                        showToast('Manuelle Ist-Kosten vorbereitet', 'success');
                        return;
                      }
                      const updated = salesWizardService.updateNeed(session.id, patch, userContext);
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
                        const paymentUsage = {
                          ...session.manualInput.paymentUsage,
                          [key]: event.target.checked,
                        };
                        const next: BestPayComparisonSession = {
                          ...session,
                          manualInput: { ...session.manualInput, paymentUsage },
                        };
                        if (!salesWizardService.isWizardPersisted(session.id)) {
                          if (isEmptyAdviceSession(next)) {
                            setSession(next);
                            return;
                          }
                          setSession(ensurePersisted(next));
                          return;
                        }
                        const updated = salesWizardService.updateNeed(
                          session.id,
                          { paymentUsage },
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
                <h2>Vergleich</h2>
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
                    description="Bitte im Vergleich eine Empfehlung auswählen."
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
                    Zurück zum Vergleich
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
              <h2>Angebot – Freigabe</h2>
              {workflowView ? (
                <dl className={styles.metrics}>
                  <div>
                    <dt>Workflowstatus</dt>
                    <dd>{workflowView.workflowStatus ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{workflowView.version?.versionNumber ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Freigabe erforderlich</dt>
                    <dd>{workflowView.approvalRequired ? 'Ja' : 'Nein'}</dd>
                  </div>
                  <div>
                    <dt>Freigegeben</dt>
                    <dd>{workflowView.approved ? 'Ja' : 'Nein'}</dd>
                  </div>
                </dl>
              ) : null}
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
                  Freigabe anfordern
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
                <h2>Prüfung & Nachfassen</h2>
                {workflowView ? (
                  <dl className={styles.metrics}>
                    <div>
                      <dt>Workflowstatus</dt>
                      <dd>{workflowView.workflowStatus ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Angebotsversion</dt>
                      <dd>{workflowView.version?.versionNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Freigabe</dt>
                      <dd>{workflowView.approved ? 'Erledigt' : 'Offen'}</dd>
                    </div>
                  </dl>
                ) : null}
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
                      Beratung abschließen
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
                  <Link className={styles.secondaryAction} to={ADVICE_PATH}>
                    Zur Beratung
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
                Zum Arbeitsplatz
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
