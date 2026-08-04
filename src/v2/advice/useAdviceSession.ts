import { useCallback, useMemo, useRef, useState } from 'react';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { resolveCostCaptureMode, type CostCaptureMode } from '../../domain/bestPayComparison/costCaptureMode';
import type { SalesWizardProspectDraft, SalesWizardStepId } from '../../domain/bestPayComparison/salesWizard';
import type { Lead } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { formatContactName } from '../../utils/format';
import type { BestPayComparisonUserContext } from '../../services/bestPayComparisonService';
import type { SalesWizardError } from '../../services/salesWizardService';
import type { AppServices } from '../../services';

export type ProspectMode = 'existing' | 'new' | 'anonymous';

export interface UseAdviceSessionOptions {
  services: Pick<
    AppServices,
    | 'salesWizardService'
    | 'bestPayComparisonService'
    | 'billingImportService'
    | 'leadService'
    | 'offerWorkflowService'
  >;
  userContext: BestPayComparisonUserContext;
  initialSession: BestPayComparisonSession | null;
  onSessionChange?: (session: BestPayComparisonSession) => void;
}

function formatAdviceError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
}

export function useAdviceSession({
  services,
  userContext,
  initialSession,
  onSessionChange,
}: UseAdviceSessionOptions) {
  const { salesWizardService, bestPayComparisonService, offerWorkflowService } = services;
  const [session, setSessionState] = useState<BestPayComparisonSession | null>(initialSession);
  const [persisted, setPersisted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persistPromiseRef = useRef<Promise<BestPayComparisonSession | null> | null>(null);
  const sessionRef = useRef<BestPayComparisonSession | null>(initialSession);
  const prospectWriteRef = useRef(0);

  const setSession = useCallback(
    (next: BestPayComparisonSession | null) => {
      sessionRef.current = next;
      setSessionState(next);
      if (next) {
        onSessionChange?.(next);
      }
    },
    [onSessionChange],
  );

  const mergePersistedSession = useCallback(
    (saved: BestPayComparisonSession): BestPayComparisonSession => {
      const latest = sessionRef.current;
      if (!latest || latest.id !== saved.id) {
        return saved;
      }
      return {
        ...saved,
        wizard: {
          ...saved.wizard,
          prospectDraft: latest.wizard.prospectDraft,
          currentStep: latest.wizard.currentStep,
          approvalNotes: latest.wizard.approvalNotes,
          costCaptureMode: latest.wizard.costCaptureMode ?? saved.wizard.costCaptureMode,
        },
        manualInput: latest.manualInput,
      };
    },
    [],
  );

  const ensurePersisted = useCallback(
    async (current: BestPayComparisonSession): Promise<BestPayComparisonSession> => {
      if (persisted) {
        return sessionRef.current ?? current;
      }
      if (persistPromiseRef.current) {
        try {
          const result = await persistPromiseRef.current;
          if (!result) {
            throw new Error('Beratung konnte nicht gespeichert werden.');
          }
          return sessionRef.current ?? result ?? current;
        } catch (persistError) {
          setError(formatAdviceError(persistError));
          throw persistError;
        }
      }

      setBusy(true);
      setError(null);
      persistPromiseRef.current = salesWizardService
        .persistWizardSession(current, userContext)
        .then((saved) => {
          setPersisted(true);
          const merged = mergePersistedSession(saved);
          setSession(merged);
          return merged;
        })
        .catch((persistError) => {
          setError(formatAdviceError(persistError));
          throw persistError;
        })
        .finally(() => {
          persistPromiseRef.current = null;
          setBusy(false);
        });

      try {
        const saved = await persistPromiseRef.current;
        if (!saved) {
          throw new Error('Beratung konnte nicht gespeichert werden.');
        }
        return sessionRef.current ?? saved ?? current;
      } catch (persistError) {
        setError(formatAdviceError(persistError));
        throw persistError;
      }
    },
    [mergePersistedSession, persisted, salesWizardService, setSession, userContext],
  );

  const withPersist = useCallback(
    async (
      updater: (current: BestPayComparisonSession) => Promise<BestPayComparisonSession | null>,
    ): Promise<BestPayComparisonSession | null> => {
      const active = sessionRef.current;
      if (!active) {
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        const base = await ensurePersisted(active);
        const updated = await updater(base);
        if (updated) {
          const latest = sessionRef.current;
          const merged =
            latest && latest.id === updated.id
              ? {
                  ...updated,
                  wizard: {
                    ...updated.wizard,
                    prospectDraft: latest.wizard.prospectDraft,
                    currentStep: latest.wizard.currentStep,
                    approvalNotes: latest.wizard.approvalNotes,
                  },
                  manualInput: latest.manualInput,
                }
              : updated;
          setSession(merged);
          return merged;
        }
        return updated;
      } catch (persistError) {
        setError(formatAdviceError(persistError));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ensurePersisted, setSession],
  );

  const patchProspect = useCallback(
    async (patch: Partial<SalesWizardProspectDraft>) => {
      const active = sessionRef.current;
      if (!active) {
        return null;
      }
      const writeId = ++prospectWriteRef.current;
      const optimistic: BestPayComparisonSession = {
        ...active,
        wizard: {
          ...active.wizard,
          prospectDraft: { ...active.wizard.prospectDraft, ...patch },
        },
      };
      setSession(optimistic);

      setBusy(true);
      setError(null);
      try {
        const base = await ensurePersisted(optimistic);
        if (prospectWriteRef.current !== writeId) {
          return sessionRef.current;
        }
        const latestDraft =
          sessionRef.current?.wizard.prospectDraft ?? optimistic.wizard.prospectDraft;
        const updated = await salesWizardService.updateProspectDraft(
          base.id,
          latestDraft,
          userContext,
        );
        if (updated && prospectWriteRef.current === writeId) {
          const current = sessionRef.current;
          const merged =
            current && current.id === updated.id
              ? {
                  ...updated,
                  wizard: {
                    ...updated.wizard,
                    prospectDraft: current.wizard.prospectDraft,
                    currentStep: current.wizard.currentStep,
                  },
                }
              : updated;
          setSession(merged);
          return merged;
        }
        return sessionRef.current;
      } catch (persistError) {
        setError(formatAdviceError(persistError));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ensurePersisted, salesWizardService, setSession, userContext],
  );

  const patchContactName = useCallback(
    (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      const contactFirstName = parts[0] ?? '';
      const contactLastName = parts.slice(1).join(' ');
      return patchProspect({ contactFirstName, contactLastName });
    },
    [patchProspect],
  );

  const assignLead = useCallback(
    (leadId: string) =>
      withPersist(async (current) => {
        const result = await salesWizardService.assignLead(current.id, leadId, userContext);
        if (!result.ok) {
          setError('Kunde konnte nicht zugeordnet werden.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const createLeadFromProspect = useCallback(
    () =>
      withPersist(async (current) => {
        const result = await salesWizardService.createLeadFromProspect(current.id, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Kunde konnte nicht angelegt werden.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const patchApprovalNotes = useCallback(
    (notes: string) => {
      if (!session) {
        return;
      }
      setSession({
        ...session,
        wizard: { ...session.wizard, approvalNotes: notes },
      });
    },
    [session, setSession],
  );

  const setCostCaptureMode = useCallback(
    (mode: CostCaptureMode) =>
      withPersist(async (current) => {
        let next = await salesWizardService.updateCostCaptureMode(current.id, mode, userContext);
        if (!next) {
          setError('Kostenmodus konnte nicht gespeichert werden.');
          return null;
        }
        if (mode === 'billing_import' && !next.billingImportSessionId) {
          const started = await salesWizardService.startBillingImport(next.id, userContext);
          if (!started.ok) {
            setError('Abrechnungsimport konnte nicht gestartet werden.');
            return null;
          }
          next = started.session;
        }
        return next;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const patchManualInput = useCallback(
    (patch: Partial<BestPayComparisonSession['manualInput']>) =>
      withPersist(async (current) => {
        const updated = await salesWizardService.updateNeed(current.id, patch, userContext);
        if (!updated) {
          setError('Eingabe konnte nicht gespeichert werden.');
          return null;
        }
        return updated;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const calculateRecommendation = useCallback(
    () =>
      withPersist(async (current) => {
        let active = current;
        if (active.wizard.scenarios.length === 0) {
          const added = await salesWizardService.addScenario(active.id, userContext);
          if (!added.ok) {
            setError('Empfehlung konnte nicht vorbereitet werden.');
            return null;
          }
          active = added.session;
        }
        const scenarioId = active.wizard.selectedScenarioId ?? active.wizard.scenarios[0]?.id;
        if (!scenarioId) {
          setError('Bitte zuerst ein Szenario anlegen.');
          return null;
        }
        const result = await salesWizardService.calculateScenario(active.id, scenarioId, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Empfehlung konnte nicht berechnet werden.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const selectVariant = useCallback(
    (scenarioId: string, candidateId: string) =>
      withPersist(async (current) => {
        const updated = await salesWizardService.selectScenarioVariant(
          current.id,
          scenarioId,
          candidateId,
          userContext,
        );
        if (!updated) {
          setError('Variante konnte nicht gespeichert werden.');
          return null;
        }
        return updated;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const createOffer = useCallback(
    () =>
      withPersist(async (current) => {
        const result = await salesWizardService.createOffer(current.id, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Angebot konnte nicht erzeugt werden.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const submitApproval = useCallback(
    (notes: string) =>
      withPersist(async (current) => {
        const result = await salesWizardService.acknowledgeApproval(current.id, notes, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Freigabe nicht möglich.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, userContext, withPersist],
  );

  const goNext = useCallback(async (): Promise<boolean> => {
    if (!session) {
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const current = await ensurePersisted(session);
      const result = await salesWizardService.goNext(current.id, userContext);
      if (!result.ok) {
        setError(result.message ?? mapWizardError(result.error));
        return false;
      }
      setSession(result.session);
      return true;
    } catch (persistError) {
      setError(formatAdviceError(persistError));
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensurePersisted, salesWizardService, session, setSession, userContext]);

  const goBack = useCallback(async () => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await salesWizardService.goBack(session.id, userContext);
      if (updated) {
        setSession(updated);
      }
    } catch (persistError) {
      setError(formatAdviceError(persistError));
    } finally {
      setBusy(false);
    }
  }, [salesWizardService, session, setSession, userContext]);

  const jumpToStep = useCallback(
    async (step: SalesWizardStepId) => {
      if (!session) {
        return null;
      }
      const optimistic = {
        ...session,
        wizard: { ...session.wizard, currentStep: step },
      };
      setSession(optimistic);
      if (!persisted) {
        return optimistic;
      }
      const result = await withPersist(async (current) =>
        salesWizardService.setStep(current.id, step, userContext),
      );
      return result ?? optimistic;
    },
    [persisted, salesWizardService, session, setSession, userContext, withPersist],
  );

  const completeWizard = useCallback(
    () =>
      withPersist(async (current) => {
        const merged = {
          ...current,
          wizard: {
            ...current.wizard,
            approvalNotes: session?.wizard.approvalNotes ?? current.wizard.approvalNotes,
          },
        };
        const saved =
          merged.wizard.approvalNotes !== current.wizard.approvalNotes
            ? await salesWizardService.persistWizardSession(merged, userContext)
            : current;
        const result = await salesWizardService.completeWizard(saved.id, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Abschluss nicht möglich.');
          return null;
        }
        return result.session;
      }),
    [salesWizardService, session?.wizard.approvalNotes, userContext, withPersist],
  );

  const syncBillingBaseline = useCallback(async () => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await bestPayComparisonService.syncBaselineFromBilling(session.id, userContext);
      if (updated) {
        setSession(updated);
      } else {
        setError('Abrechnungswerte konnten nicht übernommen werden.');
      }
    } catch (persistError) {
      setError(formatAdviceError(persistError));
    } finally {
      setBusy(false);
    }
  }, [bestPayComparisonService, session, setSession, userContext]);

  const costCaptureMode = useMemo(
    () => (session ? resolveCostCaptureMode(session) : null),
    [session],
  );

  const prospectMode: ProspectMode = useMemo(() => {
    if (!session) {
      return 'anonymous';
    }
    if (session.leadId) {
      return 'existing';
    }
    if (
      session.wizard.prospectDraft.companyName.trim() ||
      session.wizard.prospectDraft.contactFirstName.trim()
    ) {
      return 'new';
    }
    return 'anonymous';
  }, [session]);

  return {
    session,
    setSession,
    persisted,
    setPersisted,
    busy,
    error,
    setError,
    ensurePersisted,
    costCaptureMode,
    prospectMode,
    patchProspect,
    patchContactName,
    assignLead,
    createLeadFromProspect,
    setCostCaptureMode,
    patchManualInput,
    calculateRecommendation,
    selectVariant,
    createOffer,
    submitApproval,
    goNext,
    goBack,
    jumpToStep,
    completeWizard,
    syncBillingBaseline,
    patchApprovalNotes,
    offerWorkflowService,
  };
}

function mapWizardError(error: SalesWizardError): string {
  switch (error) {
    case 'incomplete_input':
      return 'Bitte Pflichtfelder ausfüllen.';
    case 'scenario_required':
      return 'Bitte Empfehlung berechnen und Variante wählen.';
    case 'approval_blocked':
      return 'Freigabe ausstehend oder blockiert.';
    case 'lead_create_failed':
      return 'Kunde konnte nicht angelegt werden.';
    default:
      return 'Aktion nicht möglich.';
  }
}

export function formatLeadSearchResult(lead: Lead): {
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
