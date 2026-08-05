import { useCallback, useMemo, useRef, useState } from 'react';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { mergeManualInput } from '../../domain/bestPayComparison/createBestPayComparisonSession';
import { resolveCostCaptureMode, type CostCaptureMode } from '../../domain/bestPayComparison/costCaptureMode';
import {
  getVisibleWizardStepIndex,
  type SalesWizardProspectDraft,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
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
  const [persisted, setPersistedState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persistPromiseRef = useRef<Promise<BestPayComparisonSession | null> | null>(null);
  const sessionRef = useRef<BestPayComparisonSession | null>(initialSession);
  const persistedRef = useRef(false);
  const prospectWriteRef = useRef(0);
  const operationQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const setPersisted = useCallback((value: boolean) => {
    persistedRef.current = value;
    setPersistedState(value);
  }, []);

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
        // Später gesetzte Kunden-/Angebotsbindung darf der erste Persist nicht zurücksetzen.
        leadId: latest.leadId ?? saved.leadId,
        customerLabel: latest.customerLabel ?? saved.customerLabel,
        leadDisplayName: latest.leadDisplayName ?? saved.leadDisplayName,
        offerId: latest.offerId ?? saved.offerId,
        offerNumber: latest.offerNumber ?? saved.offerNumber,
        offerTitle: latest.offerTitle ?? saved.offerTitle,
        result: latest.result ?? saved.result,
        selectedCandidateId: latest.selectedCandidateId ?? saved.selectedCandidateId,
        wizard: {
          ...saved.wizard,
          scenarios: mergeWizardScenariosPreferResults(
            saved.wizard.scenarios,
            latest.wizard.scenarios,
          ),
          selectedScenarioId:
            saved.wizard.selectedScenarioId ?? latest.wizard.selectedScenarioId,
          prospectDraft: latest.wizard.prospectDraft,
          // currentStep kommt aus dem Persist-/Service-Stand (goNext/goBack).
          currentStep: saved.wizard.currentStep,
          approvalNotes: latest.wizard.approvalNotes,
          followUpNotes: latest.wizard.followUpNotes,
          costCaptureMode: latest.wizard.costCaptureMode ?? saved.wizard.costCaptureMode,
        },
        manualInput: latest.manualInput,
      };
    },
    [],
  );

  const ensurePersisted = useCallback(
    async (current: BestPayComparisonSession): Promise<BestPayComparisonSession> => {
      if (persistedRef.current) {
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

      setError(null);
      // Immer den frischesten Stand persistieren (nicht einen veralteten Closure-Snapshot).
      const toPersist = sessionRef.current ?? current;
      persistPromiseRef.current = salesWizardService
        .persistWizardSession(toPersist, userContext)
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
    [mergePersistedSession, salesWizardService, setPersisted, setSession, userContext],
  );

  const withPersist = useCallback(
    async (
      updater: (current: BestPayComparisonSession) => Promise<BestPayComparisonSession | null>,
    ): Promise<BestPayComparisonSession | null> => {
      const run = async (): Promise<BestPayComparisonSession | null> => {
        const active = sessionRef.current;
        if (!active) {
          return null;
        }
        setBusy(true);
        setError(null);
        try {
          const base = await ensurePersisted(active);
          // Nach Queue-Wartezeit immer den frischesten Session-Stand nutzen.
          const current = sessionRef.current ?? base;
          const updated = await updater(current);
          if (updated) {
            const latest = sessionRef.current;
            const merged =
              latest && latest.id === updated.id
                ? {
                    ...updated,
                    leadId: updated.leadId ?? latest.leadId,
                    customerLabel: updated.customerLabel ?? latest.customerLabel,
                    leadDisplayName: updated.leadDisplayName ?? latest.leadDisplayName,
                    offerId: updated.offerId ?? latest.offerId,
                    offerNumber: updated.offerNumber ?? latest.offerNumber,
                    offerTitle: updated.offerTitle ?? latest.offerTitle,
                    result: updated.result ?? latest.result,
                    selectedCandidateId: updated.selectedCandidateId ?? latest.selectedCandidateId,
                    wizard: {
                      ...updated.wizard,
                      scenarios: mergeWizardScenariosPreferResults(
                        updated.wizard.scenarios,
                        latest.wizard.scenarios,
                      ),
                      selectedScenarioId:
                        updated.wizard.selectedScenarioId ?? latest.wizard.selectedScenarioId,
                      prospectDraft: latest.wizard.prospectDraft,
                      // Service-Stand gewinnt – sonst bleibt die UI nach goNext auf dem alten Schritt.
                      currentStep: updated.wizard.currentStep,
                      approvalNotes: latest.wizard.approvalNotes,
                      followUpNotes: latest.wizard.followUpNotes,
                      costCaptureMode: updated.wizard.costCaptureMode ?? latest.wizard.costCaptureMode,
                    },
                    // Persistierte Need-Felder gewinnen; lokale Zwischenstände bleiben ergänzend erhalten.
                    manualInput: {
                      ...latest.manualInput,
                      ...updated.manualInput,
                      paymentUsage: {
                        ...latest.manualInput.paymentUsage,
                        ...updated.manualInput.paymentUsage,
                      },
                    },
                    billingImportSessionId:
                      updated.billingImportSessionId ?? latest.billingImportSessionId,
                    costBaselineId: updated.costBaselineId ?? latest.costBaselineId,
                    costBaselineVersion: updated.costBaselineVersion ?? latest.costBaselineVersion,
                    source: updated.source ?? latest.source,
                    status: updated.status,
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
      };

      const queued = operationQueueRef.current.then(run, run);
      operationQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
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
                  leadId: current.leadId ?? updated.leadId,
                  customerLabel: current.customerLabel ?? updated.customerLabel,
                  result: updated.result ?? current.result,
                  selectedCandidateId: updated.selectedCandidateId ?? current.selectedCandidateId,
                  wizard: {
                    ...updated.wizard,
                    scenarios: mergeWizardScenariosPreferResults(
                      updated.wizard.scenarios,
                      current.wizard.scenarios,
                    ),
                    prospectDraft: current.wizard.prospectDraft,
                    currentStep: updated.wizard.currentStep,
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

  const patchFollowUpNotes = useCallback(
    (notes: string) => {
      if (!session) {
        return;
      }
      setSession({
        ...session,
        wizard: { ...session.wizard, followUpNotes: notes },
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
    (patch: Partial<BestPayComparisonSession['manualInput']>) => {
      const active = sessionRef.current;
      if (!active) {
        return Promise.resolve(null);
      }
      // Optimistisch sofort in die UI übernehmen (verhindert Rücksprung auf „Bitte wählen…“).
      const optimistic: BestPayComparisonSession = {
        ...active,
        manualInput: mergeManualInput(active.manualInput, patch),
        wizard:
          typeof patch.industry === 'string'
            ? {
                ...active.wizard,
                prospectDraft: {
                  ...active.wizard.prospectDraft,
                  industry: patch.industry,
                },
              }
            : active.wizard,
      };
      setSession(optimistic);

      return withPersist(async (current) => {
        const updated = await salesWizardService.updateNeed(current.id, patch, userContext);
        if (!updated) {
          setError('Eingabe konnte nicht gespeichert werden.');
          return null;
        }
        if (typeof patch.industry === 'string') {
          updated.wizard = {
            ...updated.wizard,
            prospectDraft: {
              ...updated.wizard.prospectDraft,
              industry: patch.industry,
            },
          };
        }
        return updated;
      });
    },
    [salesWizardService, setSession, userContext, withPersist],
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
    const moved = await withPersist(async (current) => {
      const result = await salesWizardService.goNext(current.id, userContext);
      if (!result.ok) {
        setError(result.message ?? mapWizardError(result.error));
        return null;
      }
      return result.session;
    });
    return Boolean(moved);
  }, [salesWizardService, userContext, withPersist]);

  const goBack = useCallback(async () => {
    await withPersist(async (current) => {
      const updated = await salesWizardService.goBack(current.id, userContext);
      return updated;
    });
  }, [salesWizardService, userContext, withPersist]);

  const jumpToStep = useCallback(
    async (step: SalesWizardStepId) => {
      if (!session) {
        return null;
      }
      const currentIndex = getVisibleWizardStepIndex(session.wizard.currentStep);
      const targetIndex = getVisibleWizardStepIndex(step);
      // Vorwärts nur über „Weiter“ (inkl. Kunden-Finalisierung) – Rücksprung bleibt frei.
      if (targetIndex > currentIndex) {
        setError('Bitte mit „Weiter“ fortfahren – Schritte nicht überspringen.');
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
            followUpNotes: session?.wizard.followUpNotes ?? current.wizard.followUpNotes,
          },
        };
        const saved =
          merged.wizard.approvalNotes !== current.wizard.approvalNotes ||
          merged.wizard.followUpNotes !== current.wizard.followUpNotes
            ? await salesWizardService.persistWizardSession(merged, userContext)
            : current;
        const result = await salesWizardService.completeWizard(saved.id, userContext);
        if (!result.ok) {
          setError(result.message ?? 'Abschluss nicht möglich.');
          return null;
        }
        return result.session;
      }),
    [
      salesWizardService,
      session?.wizard.approvalNotes,
      session?.wizard.followUpNotes,
      userContext,
      withPersist,
    ],
  );

  const syncBillingBaseline = useCallback(
    async (options: { replaceExistingManualValues?: boolean } = {}) => {
      if (!session) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const updated = await bestPayComparisonService.syncBaselineFromBilling(
          session.id,
          userContext,
          options,
        );
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
    },
    [bestPayComparisonService, session, setSession, userContext],
  );

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
    patchFollowUpNotes,
    offerWorkflowService,
  };
}

function mergeWizardScenariosPreferResults(
  primary: BestPayComparisonSession['wizard']['scenarios'],
  secondary: BestPayComparisonSession['wizard']['scenarios'],
): BestPayComparisonSession['wizard']['scenarios'] {
  if (!secondary.length) {
    return primary;
  }
  if (!primary.length) {
    return secondary;
  }
  const secondaryById = new Map(secondary.map((entry) => [entry.id, entry]));
  return primary.map((entry) => {
    const other = secondaryById.get(entry.id);
    if (!other) {
      return entry;
    }
    return {
      ...entry,
      result: entry.result ?? other.result,
      selectedCandidateId: entry.selectedCandidateId ?? other.selectedCandidateId,
      approval: entry.approval ?? other.approval,
    };
  });
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
