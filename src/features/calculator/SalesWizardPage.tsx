import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormControl } from '../../components/common/FormControl';
import { FormField, textareaClassName } from '../../components/common/FormField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { SalesGuidePanel } from '../../components/sales/SalesGuidePanel';
import {
  APPROVAL_DEVIATION_FIELD_MESSAGE,
  APPROVAL_WAITING_STATUS_LABEL,
} from '../../domain/sales/salesGuide';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  COST_CAPTURE_MODE_LABELS,
  formatCurrentCostsLabel,
  formatVariantComparisonLabel,
  resolveCostCaptureMode,
  type CostCaptureMode,
} from '../../domain/bestPayComparison/costCaptureMode';
import { isEmptyAdviceSession } from '../../domain/bestPayComparison/isEmptyAdviceSession';
import {
  getNextSalesWizardStep,
  getPreviousSalesWizardStep,
  getVisibleWizardStepIndex,
  resolveSelectedScenarioVariant,
  SALES_WIZARD_VISIBLE_STEPS,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
import { getLeadDisplayName, getSessionCustomerDisplayName } from '../../domain/lead/getLeadDisplayName';
import type { Lead } from '../../domain/lead/lead';
import { formatContactName } from '../../utils/format';
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

function parseOptionalEuroField(
  value: string,
  fallback: number | null,
): number | null {
  if (value.trim() !== '') {
    return parseEuroToCents(value);
  }
  return fallback;
}

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

function parseOptionalIntField(value: string, fallback: number | null): number | null {
  if (value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatLeadResultLines(lead: Lead): {
  company: string;
  contact: string | null;
  city: string | null;
} {
  const company = lead.companyName.trim();
  const contact = formatContactName(lead.contactFirstName, lead.contactLastName) || null;
  const city = lead.city.trim() || null;
  return {
    company: company || getLeadDisplayName(lead),
    contact: company ? contact : null,
    city,
  };
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
  const [sessionPersisted, setSessionPersisted] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [prospectMode, setProspectMode] = useState<ProspectMode>('anonymous');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [contactName, setContactName] = useState('');
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
    setContactName(
      formatContactName(
        active.wizard.prospectDraft.contactFirstName,
        active.wizard.prospectDraft.contactLastName,
      ),
    );
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
    async (current: BestPayComparisonSession): Promise<BestPayComparisonSession> => {
      if (!userContext || sessionPersisted) {
        return current;
      }
      const saved = await salesWizardService.persistWizardSession(current, userContext);
      setSessionPersisted(true);
      bootstrappedSessionIdRef.current = saved.id;
      bindSessionToUrl(saved.id);
      return saved;
    },
    [bindSessionToUrl, salesWizardService, sessionPersisted, userContext],
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
        setSessionPersisted(false);
      } else {
        active = resumed.session;
        setSessionPersisted(true);
        resumedToast = true;
      }
    } else if (searchParams.get('leadId')) {
      // leadId in der URL ist eine fachliche Kundenauswahl → einmal persistieren
      active = salesWizardService.createTransientWizard(userContext);
      active = await salesWizardService.persistWizardSession(active, userContext);
      setSessionPersisted(true);
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
      setSessionPersisted(false);
    } else {
      const draft = await bestPayComparisonService.getActiveDraft(userContext);
      if (
        draft &&
        (draft.wizard.enabled || draft.entryMode === 'wizard') &&
        !isEmptyAdviceSession(draft)
      ) {
        const resumed = await salesWizardService.resumeWizard(draft.id, userContext);
        active = resumed.ok ? resumed.session : salesWizardService.createTransientWizard(userContext);
        setSessionPersisted(resumed.ok);
        resumedToast = resumed.ok;
      } else {
        active = salesWizardService.createTransientWizard(userContext);
        setSessionPersisted(false);
      }
    }

    if (sessionId) {
      setSessionPersisted(true);
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

  const filteredLeads = useMemo(() => {
    const normalizedSearch = leadSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return leads;
    }
    return leads.filter((lead) => {
      const haystack = [
        getLeadDisplayName(lead),
        lead.companyName,
        lead.contactFirstName,
        lead.contactLastName,
        lead.city,
        lead.email,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [leadSearch, leads]);

  if (!currentUser || !userContext) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }

  if (!session) {
    return <p className={styles.hint}>Beratung wird geladen…</p>;
  }

  const step = session.wizard.currentStep;
  const stepIndex = getVisibleWizardStepIndex(step);
  const costCaptureMode = resolveCostCaptureMode(session);
  const selectedScenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(selectedScenario);
  const canSeeCommission = bestPayComparisonService.canSeeCommission(userContext);

  const patchProspectDraft = (patch: Partial<BestPayComparisonSession['wizard']['prospectDraft']>) => {
    void (async () => {
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
      if (!sessionPersisted) {
        if (isEmptyAdviceSession(next)) {
          setSession(next);
          return;
        }
        const saved = await ensurePersisted(next);
        setSession(saved);
        return;
      }
      const updated = await salesWizardService.updateProspectDraft(session.id, patch, userContext);
      if (updated) {
        setSession(updated);
      }
    })();
  };

  const persistNeed = async (): Promise<BestPayComparisonSession | null> => {
    const patch = {
      monthlyCardVolumeCents: parseOptionalEuroField(
        monthlyVolume,
        session.manualInput.monthlyCardVolumeCents,
      ),
      monthlyTransactions: parseOptionalIntField(
        monthlyTransactions,
        session.manualInput.monthlyTransactions,
      ),
      monthlyTotalCostsCents: parseOptionalEuroField(
        monthlyTotal,
        session.manualInput.monthlyTotalCostsCents,
      ),
      terminalCount: Math.max(1, Number.parseInt(terminalCount, 10) || 1),
      girocardPercent: Number.parseInt(girocardPercent, 10) || null,
      debitPercent: Number.parseInt(debitPercent, 10) || null,
      creditPercent: Number.parseInt(creditPercent, 10) || null,
      otherPercent: Number.parseInt(otherPercent, 10) || null,
      preferredTermMonths: Number.parseInt(preferredTerm, 10) || null,
      industry,
      paymentUsage: { ...session.manualInput.paymentUsage },
    };
    const inferredMode =
      session.wizard.costCaptureMode ??
      (patch.monthlyTotalCostsCents === 0
        ? 'no_current_costs'
        : patch.monthlyTotalCostsCents !== null
          ? 'manual'
          : null);
    const next: BestPayComparisonSession = {
      ...session,
      wizard: {
        ...session.wizard,
        costCaptureMode: inferredMode,
      },
      manualInput: {
        ...session.manualInput,
        ...patch,
        paymentUsage: { ...session.manualInput.paymentUsage, ...patch.paymentUsage },
      },
    };
    if (!sessionPersisted) {
      if (isEmptyAdviceSession(next)) {
        setSession(next);
        return next;
      }
      const saved = await ensurePersisted(next);
      setSession(saved);
      return saved;
    }
    const updated = await salesWizardService.updateNeed(session.id, patch, userContext);
    if (updated) {
      setSession(updated);
    }
    return updated;
  };

  const patchContactName = (value: string) => {
    setContactName(value);
    const trimmed = value.trim();
    if (!trimmed) {
      patchProspectDraft({ contactFirstName: '', contactLastName: '' });
      return;
    }
    const parts = trimmed.split(/\s+/);
    patchProspectDraft({
      contactFirstName: parts[0] ?? '',
      contactLastName: parts.slice(1).join(' '),
    });
  };

  const handleSelectExistingLead = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const finalizeProspectStep = async (
    current: BestPayComparisonSession,
  ): Promise<
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; message: string }
  > => {
    if (prospectMode === 'anonymous') {
      return { ok: true, session: current };
    }
    if (prospectMode === 'existing') {
      if (current.leadId) {
        return { ok: true, session: current };
      }
      if (!selectedLeadId) {
        return { ok: false, message: 'Bitte einen Kunden aus der Liste wählen.' };
      }
      const assigned = await salesWizardService.assignLead(current.id, selectedLeadId, userContext);
      if (!assigned.ok) {
        return { ok: false, message: 'Kunde konnte nicht übernommen werden.' };
      }
      return { ok: true, session: assigned.session };
    }
    if (current.leadId) {
      return { ok: true, session: current };
    }
    const draft = current.wizard.prospectDraft;
    const hasInput =
      draft.companyName.trim() ||
      draft.contactFirstName.trim() ||
      draft.contactLastName.trim();
    if (!hasInput) {
      return { ok: false, message: 'Bitte Firma oder Name eingeben.' };
    }
    const created = await salesWizardService.createLeadFromProspect(current.id, userContext);
    if (!created.ok) {
      return { ok: false, message: created.message ?? 'Kunde konnte nicht angelegt werden.' };
    }
    setSelectedLeadId(created.leadId);
    return { ok: true, session: created.session };
  };

  const handleGoNext = () => {
    void (async () => {
      setBusy(true);
      try {
        let current = session;

        if (step === 'prospect' && prospectMode !== 'anonymous') {
          current = await ensurePersisted(session);
          const finalized = await finalizeProspectStep(current);
          if (!finalized.ok) {
            showToast(finalized.message, 'error');
            return;
          }
          current = finalized.session;
          setSession(current);
        } else if (step === 'costs' || step === 'need') {
          const updated = await persistNeed();
          if (updated) {
            current = updated;
            setSession(updated);
          }
        }

        const validation = await salesWizardService.validateStep(current, step);
        if (!validation.ok) {
          showToast(validation.message ?? 'Weiter nicht möglich', 'error');
          return;
        }

        if (!sessionPersisted && !isEmptyAdviceSession(current)) {
          current = await ensurePersisted(current);
          setSession(current);
          setSessionPersisted(true);
        }

        if (!sessionPersisted) {
          const nextStep = getNextSalesWizardStep(step);
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
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleGoBack = () => {
    void (async () => {
      setBusy(true);
      try {
        let current = session;
        if (step === 'costs' || step === 'need') {
          const updated = await persistNeed();
          if (updated) {
            current = updated;
            setSession(updated);
          }
        } else if (!sessionPersisted && !isEmptyAdviceSession(session)) {
          current = await ensurePersisted(session);
          setSession(current);
        }

        if (!sessionPersisted) {
          const previous = getPreviousSalesWizardStep(current.wizard.currentStep);
          if (!previous) {
            return;
          }
          setSession({
            ...current,
            wizard: { ...current.wizard, currentStep: previous },
          });
          return;
        }
        const updated = await salesWizardService.goBack(current.id, userContext);
        if (updated) {
          setSession(updated);
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleJumpStep = (target: SalesWizardStepId) => {
    void (async () => {
      if (!sessionPersisted) {
        setSession({
          ...session,
          wizard: { ...session.wizard, currentStep: target },
        });
        return;
      }
      const updated = await salesWizardService.setStep(session.id, target, userContext);
      if (updated) {
        setSession(updated);
      }
    })();
  };

  const handleStartBilling = async () => {
    setBusy(true);
    try {
      const current = await ensurePersisted(session);
      const result = await salesWizardService.startBillingImport(current.id, userContext);
      if (!result.ok) {
        showToast('Abrechnungsimport konnte nicht gestartet werden', 'error');
        return;
      }
      setSession(result.session);
    } finally {
      setBusy(false);
    }
  };

  const applyCostCaptureMode = async (mode: CostCaptureMode): Promise<void> => {
    if (mode === 'billing_import') {
      await handleStartBilling();
      return;
    }

    const manualPatch =
      mode === 'no_current_costs'
        ? { monthlyTotalCostsCents: 0 as number | null }
        : {};
    const next: BestPayComparisonSession = {
      ...session,
      wizard: { ...session.wizard, costCaptureMode: mode },
      manualInput: { ...session.manualInput, ...manualPatch },
      source: mode === 'no_current_costs' ? 'manual' : session.source,
    };

    if (!sessionPersisted) {
      if (isEmptyAdviceSession(next)) {
        setSession(next);
        syncNeedFields(next);
        return;
      }
      const saved = await ensurePersisted(next);
      setSession(saved);
      syncNeedFields(saved);
      return;
    }

    const updated = await salesWizardService.updateCostCaptureMode(session.id, mode, userContext);
    if (updated) {
      setSession(updated);
      syncNeedFields(updated);
    }
  };

  const handleSelectCostMode = (mode: CostCaptureMode) => {
    void applyCostCaptureMode(mode);
  };

  const handleAddScenario = () => {
    void (async () => {
      const current = await ensurePersisted(session);
      const result = await salesWizardService.addScenario(
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
    })();
  };

  const handleCalculateScenario = async (scenarioId: string) => {
    const needed = await persistNeed();
    setBusy(true);
    const current = await ensurePersisted(needed ?? session);
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
    const current = await ensurePersisted(session);
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
      const current = await ensurePersisted(session);
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
      const current = await ensurePersisted(session);
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
        <span>{sessionPersisted ? 'Automatisch gespeichert' : 'Wird beim Fortschritt gespeichert'}</span>
        {sessionPersisted ? (
          <span>Zuletzt: {new Date(session.updatedAt).toLocaleString('de-DE')}</span>
        ) : null}
        <span>
          Schritt {stepIndex + 1} von {SALES_WIZARD_VISIBLE_STEPS.length}
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
          <SalesGuidePanel context={step} tipSeed={session.id} />
          {step === 'prospect' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Kunde</h2>
                <div className={styles.choiceRow}>
                  {(
                    [
                      ['existing', 'Kunde suchen'],
                      ['new', 'Neuen Kunden anlegen'],
                      ['anonymous', 'Ohne Kunden rechnen'],
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
                  <h3 className={styles.sectionTitle}>Kunde suchen</h3>
                  <FormControl
                    type="search"
                    id="wizardLeadSearch"
                    label="Suche"
                    value={leadSearch}
                    onChange={(event) => setLeadSearch(event.target.value)}
                    placeholder="Firma, Ansprechpartner, Ort…"
                  />
                  {filteredLeads.length === 0 ? (
                    <p className={styles.hint}>Keine Treffer. Suchbegriff anpassen.</p>
                  ) : (
                    <ul className={styles.leadResults} aria-label="Kundentreffer">
                      {filteredLeads.map((lead) => {
                        const isSelected = selectedLeadId === lead.id || session.leadId === lead.id;
                        const lines = formatLeadResultLines(lead);
                        return (
                          <li key={lead.id}>
                            <button
                              type="button"
                              className={isSelected ? styles.leadResultSelected : styles.leadResult}
                              disabled={busy}
                              aria-pressed={isSelected}
                              onClick={() => handleSelectExistingLead(lead.id)}
                            >
                              <span className={styles.leadResultName}>{lines.company}</span>
                              {lines.contact ? (
                                <span className={styles.leadResultMeta}>{lines.contact}</span>
                              ) : null}
                              {lines.city ? (
                                <span className={styles.leadResultMeta}>{lines.city}</span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              ) : null}

              {prospectMode === 'new' ? (
                <article className={styles.card}>
                  <h3 className={styles.sectionTitle}>Neuen Kunden anlegen</h3>
                  <div className={styles.formGrid}>
                    <FormControl
                      type="text"
                      id="companyName"
                      label="Firma"
                      value={session.wizard.prospectDraft.companyName}
                      onChange={(event) => {
                        patchProspectDraft({ companyName: event.target.value });
                      }}
                      placeholder="Optional, wenn Name bekannt ist"
                    />
                    <FormControl
                      type="text"
                      id="contactName"
                      label="Name"
                      value={contactName}
                      onChange={(event) => {
                        patchContactName(event.target.value);
                      }}
                      placeholder="Optional, wenn Firma bekannt ist"
                    />
                    <FormControl
                      type="text"
                      id="phone"
                      label="Telefon (optional)"
                      value={session.wizard.prospectDraft.phone}
                      onChange={(event) => {
                        patchProspectDraft({ phone: event.target.value });
                      }}
                    />
                    <FormControl
                      type="text"
                      id="email"
                      label="E-Mail (optional)"
                      value={session.wizard.prospectDraft.email}
                      onChange={(event) => {
                        patchProspectDraft({ email: event.target.value });
                      }}
                    />
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          {step === 'costs' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Ausgangslage</h2>
                <p className={styles.hint}>Wie möchten Sie die aktuelle Situation erfassen?</p>
                <div className={styles.choiceRow}>
                  {(
                    [
                      ['manual', COST_CAPTURE_MODE_LABELS.manual],
                      ['billing_import', COST_CAPTURE_MODE_LABELS.billing_import],
                      ['no_current_costs', COST_CAPTURE_MODE_LABELS.no_current_costs],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        costCaptureMode === mode ? styles.choiceButtonActive : styles.choiceButton
                      }
                      disabled={busy}
                      onClick={() => handleSelectCostMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>

              {costCaptureMode === 'manual' ? (
                <article className={styles.card}>
                  <div className={styles.formGrid}>
                    <FormControl
                      type="text"
                      id="manualTotalCosts"
                      label="Monatliche Ist-Gesamtkosten (EUR)"
                      inputMode="decimal"
                      value={monthlyTotal}
                      onChange={(event) => setMonthlyTotal(event.target.value)}
                    />
                    <FormControl
                      type="text"
                      id="manualVolumeCosts"
                      label="Monatlicher Kartenumsatz (EUR, optional)"
                      inputMode="decimal"
                      value={monthlyVolume}
                      onChange={(event) => setMonthlyVolume(event.target.value)}
                    />
                  </div>
                </article>
              ) : null}

              {costCaptureMode === 'billing_import' ? (
                session.billingImportSessionId ? (
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
                  <p className={styles.hint}>Abrechnungsimport wird vorbereitet…</p>
                )
              ) : null}

              {costCaptureMode === 'no_current_costs' ? (
                <article className={styles.card}>
                  <p className={styles.hint}>
                    Es liegen keine bisherigen Payment-Kosten vor. Der Vergleich zeigt nur die neuen
                    monatlichen Kosten – ohne Ersparnisberechnung.
                  </p>
                </article>
              ) : null}
            </div>
          ) : null}

          {step === 'need' ? (
            <article className={styles.card}>
              <h2>Bedarf</h2>
              <div className={styles.formGrid}>
                <FormControl type="text" id="needVolume" label="Monatlicher Kartenumsatz (EUR)" inputMode="decimal" value={monthlyVolume} onChange={(event) => setMonthlyVolume(event.target.value)} />
                <FormControl type="text" id="needTx" label="Monatliche Transaktionen" inputMode="numeric" value={monthlyTransactions} onChange={(event) => setMonthlyTransactions(event.target.value)} />
                <FormControl type="text" id="needTerminals" label="Terminalanzahl" inputMode="numeric" value={terminalCount} onChange={(event) => setTerminalCount(event.target.value)} />
                <FormControl type="select" id="needTerm" label="Bevorzugte Laufzeit (Monate)"
                    value={preferredTerm}
                    onChange={(event) => setPreferredTerm(event.target.value)}
                  >
                    <option value="36">36 Monate</option>
                    <option value="48">48 Monate</option>
                    <option value="60">60 Monate</option>
                  </FormControl>
                <FormControl type="text" id="needIndustry" label="Branche" value={industry} onChange={(event) => setIndustry(event.target.value)} />
                <FormControl type="text" id="giro" label="girocard %" inputMode="numeric" value={girocardPercent} onChange={(event) => setGirocardPercent(event.target.value)} />
                <FormControl type="text" id="debit" label="Debit %" inputMode="numeric" value={debitPercent} onChange={(event) => setDebitPercent(event.target.value)} />
                <FormControl type="text" id="credit" label="Kreditkarte %" inputMode="numeric" value={creditPercent} onChange={(event) => setCreditPercent(event.target.value)} />
                <FormControl type="text" id="other" label="Sonstige %" inputMode="numeric" value={otherPercent} onChange={(event) => setOtherPercent(event.target.value)} />
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
                        if (!sessionPersisted) {
                          if (isEmptyAdviceSession(next)) {
                            setSession(next);
                            return;
                          }
                          void ensurePersisted(next).then(setSession);
                          return;
                        }
                        void salesWizardService
                          .updateNeed(session.id, { paymentUsage }, userContext)
                          .then((updated) => {
                            if (updated) {
                              setSession(updated);
                            }
                          });
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </article>
          ) : null}

          {step === 'variants' ? (
            <div className={styles.stack}>
              <article className={styles.heroCard}>
                <h2>Vergleich</h2>
                <div className={styles.actions}>
                  <FormControl type="text" id="scenarioLabel" label="Neues Szenario" value={scenarioLabel} onChange={(event) => setScenarioLabel(event.target.value)} />
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
                          <FormControl
                            type="text"
                            id={`label-${scenario.id}`}
                            label="Bezeichnung"
                            value={scenario.label}
                            onChange={(event) => {
                              void salesWizardService
                                .updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  { label: event.target.value },
                                  userContext,
                                )
                                .then((updated) => {
                                  if (updated) {
                                    setSession(updated);
                                  }
                                });
                            }}
                          />
                          <FormControl
                            type="select"
                            id={`term-${scenario.id}`}
                            label="Laufzeit"
                            value={String(scenario.config.preferredTermMonths ?? 36)}
                            onChange={(event) => {
                              void salesWizardService
                                .updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  {
                                    preferredTermMonths: Number.parseInt(event.target.value, 10),
                                  },
                                  userContext,
                                )
                                .then((updated) => {
                                  if (updated) {
                                    setSession(updated);
                                  }
                                });
                            }}
                          >
                            <option value="36">36 Monate</option>
                            <option value="48">48 Monate</option>
                            <option value="60">60 Monate</option>
                          </FormControl>
                          <FormControl
                            type="text"
                            id={`termCount-${scenario.id}`}
                            label="Terminals"
                            inputMode="numeric"
                            value={String(scenario.config.terminalCount)}
                            onChange={(event) => {
                              void salesWizardService
                                .updateScenarioConfig(
                                  session.id,
                                  scenario.id,
                                  {
                                    terminalCount: Math.max(
                                      1,
                                      Number.parseInt(event.target.value, 10) || 1,
                                    ),
                                  },
                                  userContext,
                                )
                                .then((updated) => {
                                  if (updated) {
                                    setSession(updated);
                                  }
                                });
                            }}
                          />
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
                              void salesWizardService
                                .duplicateScenario(session.id, scenario.id, userContext)
                                .then((result) => {
                                  if (result.ok) {
                                    setSession(result.session);
                                  }
                                });
                            }}
                          >
                            Duplizieren
                          </button>
                          <button
                            type="button"
                            className={styles.dangerAction}
                            onClick={() => {
                              void salesWizardService
                                .deleteScenario(session.id, scenario.id, userContext)
                                .then((result) => {
                                  if (result.ok) {
                                    setSession(result.session);
                                  }
                                });
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
                                <dd>
                                  {formatCurrentCostsLabel(scenario.result.currentMonthlyCostsCents)}
                                </dd>
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
                                      void salesWizardService
                                        .selectScenarioVariant(
                                          session.id,
                                          scenario.id,
                                          variant.candidateId,
                                          userContext,
                                        )
                                        .then((updated) => {
                                          if (updated) {
                                            setSession(updated);
                                          }
                                        });
                                    }}
                                  >
                                    <strong>{variant.tariffName}</strong>
                                    <span>
                                      {formatVariantComparisonLabel(
                                        variant,
                                        scenario.result?.currentMonthlyCostsCents ?? null,
                                      )}
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
              {selectedScenario?.approval?.adminReviewRequired ? (
                <div className={styles.warningBox}>
                  <p>{APPROVAL_DEVIATION_FIELD_MESSAGE}</p>
                  <p className={styles.hint}>Status: {APPROVAL_WAITING_STATUS_LABEL}</p>
                </div>
              ) : null}
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
                  className={textareaClassName()}
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
                    <dd>{getSessionCustomerDisplayName(session)}</dd>
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
              <button
                type="button"
                className={styles.primaryAction}
                onClick={handleGoNext}
                disabled={busy}
              >
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
