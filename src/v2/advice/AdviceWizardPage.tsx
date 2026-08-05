import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  getVisibleWizardStepIndex,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
import type { Lead } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { ADVICE_PATH } from '../../utils/routes';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { WizardNav } from './WizardNav';
import { useAdviceSession, type ProspectMode } from './useAdviceSession';
import { ProspectStep } from './steps/ProspectStep';
import { CostsStep } from './steps/CostsStep';
import { NeedStep } from './steps/NeedStep';
import { RecommendationStep } from './steps/RecommendationStep';
import { OfferStep } from './steps/OfferStep';
import { ClosingStep } from './steps/ClosingStep';
import styles from './AdviceWizard.module.css';

async function flushActiveField(): Promise<void> {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function AdviceWizardPage() {
  const { currentUser } = useCurrentUser();
  if (!currentUser) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }
  return <AdviceWizardInner currentUser={currentUser} />;
}

function AdviceWizardInner({
  currentUser,
}: {
  currentUser: NonNullable<ReturnType<typeof useCurrentUser>['currentUser']>;
}) {
  const services = useServices();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const bootstrappedRef = useRef<string | null>(null);

  const [initialSession, setInitialSession] = useState<BestPayComparisonSession | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [prospectModeOverride, setProspectModeOverride] = useState<ProspectMode | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [workflowView, setWorkflowView] = useState<Awaited<
    ReturnType<typeof services.offerWorkflowService.getWizardWorkflowView>
  > | null>(null);

  const userContext = useMemo(
    () => ({
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    }),
    [currentUser],
  );

  const advice = useAdviceSession({
    services,
    userContext,
    initialSession,
    onSessionChange: (session) => {
      if (session.offerId) {
        void services.offerWorkflowService
          .getWizardWorkflowView(session.offerId)
          .then(setWorkflowView);
      }
    },
  });

  const setSessionRef = useRef(advice.setSession);
  const setPersistedRef = useRef(advice.setPersisted);
  setSessionRef.current = advice.setSession;
  setPersistedRef.current = advice.setPersisted;

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

  useEffect(() => {
    const sessionId = searchParams.get('session');
    const leadId = searchParams.get('leadId');
    const isNew = searchParams.get('new') === '1';
    const bootKey = sessionId ? `session:${sessionId}` : leadId ? `lead:${leadId}` : isNew ? 'new' : 'none';
    if (bootstrappedRef.current === bootKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let active: BestPayComparisonSession | null = null;
      let persisted = false;

      if (sessionId) {
        const resumed = await services.salesWizardService.resumeWizard(sessionId, userContext);
        if (cancelled) {
          return;
        }
        if (!resumed.ok) {
          showToast('Gespeicherter Vorgang nicht gefunden', 'error');
          active = services.salesWizardService.createTransientWizard(userContext);
        } else {
          active = resumed.session;
          persisted = true;
          showToast('Beratung fortgesetzt', 'info');
        }
      } else if (leadId) {
        active = services.salesWizardService.createTransientWizard(userContext);
        active = await services.salesWizardService.persistWizardSession(active, userContext);
        if (cancelled) {
          return;
        }
        persisted = true;
        const assigned = await services.salesWizardService.assignLead(active.id, leadId, userContext);
        if (cancelled) {
          return;
        }
        if (assigned.ok) {
          active = assigned.session;
        }
        bindSessionToUrl(active.id);
      } else if (isNew) {
        active = services.salesWizardService.createTransientWizard(userContext);
      } else {
        navigate(ADVICE_PATH, { replace: true });
        return;
      }

      if (cancelled || !active) {
        return;
      }

      bootstrappedRef.current = bootKey;
      setPersistedRef.current(persisted);
      setInitialSession(active);
      setSessionRef.current(active);
      setSelectedLeadId(active.leadId ?? '');
      if (active.offerId) {
        setWorkflowView(await services.offerWorkflowService.getWizardWorkflowView(active.offerId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bindSessionToUrl,
    navigate,
    searchParams,
    services.offerWorkflowService,
    services.salesWizardService,
    showToast,
    userContext,
  ]);

  useEffect(() => {
    void services.leadService.getVisibleLeads(userContext).then(setLeads);
  }, [services.leadService, userContext]);

  // Nach erster Persistenz Session in die URL schreiben (kein Mirror-State).
  // bootstrappedRef vorher setzen, damit der Bootstrap die laufende Eingabe nicht neu lädt.
  useEffect(() => {
    if (!advice.persisted || !advice.session) {
      return;
    }
    if (searchParams.get('session') === advice.session.id) {
      bootstrappedRef.current = `session:${advice.session.id}`;
      return;
    }
    bootstrappedRef.current = `session:${advice.session.id}`;
    bindSessionToUrl(advice.session.id);
  }, [advice.persisted, advice.session, bindSessionToUrl, searchParams]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) {
      return leads;
    }
    return leads.filter((lead) =>
      [getLeadDisplayName(lead), lead.companyName, lead.city, lead.email]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [leadSearch, leads]);

  const prospectMode = prospectModeOverride ?? advice.prospectMode;

  const finalizeProspect = async (): Promise<boolean> => {
    if (!advice.session) {
      return false;
    }
    if (prospectMode === 'anonymous') {
      return true;
    }
    const current = await advice.ensurePersisted(advice.session);
    if (prospectMode === 'existing') {
      if (current.leadId) {
        return true;
      }
      if (!selectedLeadId) {
        advice.setError('Bitte einen Kunden aus der Liste wählen.');
        return false;
      }
      const result = await advice.assignLead(selectedLeadId);
      return Boolean(result);
    }
    if (current.leadId) {
      return true;
    }
    const draft = current.wizard.prospectDraft;
    if (!draft.companyName.trim() && !draft.contactFirstName.trim()) {
      advice.setError('Bitte Firma oder Name eingeben.');
      return false;
    }
    const result = await advice.createLeadFromProspect();
    if (result?.leadId) {
      setSelectedLeadId(result.leadId);
    }
    return Boolean(result);
  };

  const handleNext = async () => {
    if (!advice.session) {
      return;
    }
    await flushActiveField();
    const step = advice.session.wizard.currentStep;
    if (step === 'prospect' && prospectMode !== 'anonymous') {
      const ok = await finalizeProspect();
      if (!ok) {
        return;
      }
    }
    if (step === 'offer' && !advice.session.offerId) {
      advice.setError('Bitte zuerst einen Angebotsentwurf erzeugen.');
      return;
    }
    const moved = await advice.goNext();
    if (!moved && !advice.error) {
      showToast('Weiter nicht möglich', 'error');
    }
    if (moved) {
      advice.setError(null);
    }
  };

  const handleJump = (visibleStepId: string) => {
    void (async () => {
      await flushActiveField();
      const map: Record<string, SalesWizardStepId> = {
        prospect: 'prospect',
        costs: 'costs',
        need: 'need',
        variants: 'variants',
        offer: 'offer',
        closing: 'closing',
      };
      const target = map[visibleStepId];
      if (target) {
        await advice.jumpToStep(target);
      }
    })();
  };

  if (!advice.session) {
    return <p className={styles.hint}>Beratung wird geladen…</p>;
  }

  const step = advice.session.wizard.currentStep;
  const stepIndex = getVisibleWizardStepIndex(step);
  const canSeeCommission = services.bestPayComparisonService.canSeeCommission(userContext);
  const visibleStepId =
    step === 'approval' ? 'offer' : step === 'variants' ? 'variants' : step;

  return (
    <section>
      <PageHeader
        title="Beratung"
        description="Sechs Schritte vom Kunden bis zum BestPay-Handoff"
        actions={
          <div className={styles.choiceRow}>
            <Link className={styles.choiceButton} to={ADVICE_PATH}>
              Zur Übersicht
            </Link>
            <Link className={styles.choiceButton} to="/sales">
              Zum Arbeitsplatz
            </Link>
          </div>
        }
      />

      <div className={styles.statusLine} aria-live="polite">
        <span>{advice.persisted ? 'Automatisch gespeichert' : 'Wird beim Fortschritt gespeichert'}</span>
        <span>
          Schritt {stepIndex + 1} von 6
        </span>
      </div>

      {advice.error ? <p className={styles.error}>{advice.error}</p> : null}

      <div className={styles.layout}>
        <WizardNav
          currentStepId={visibleStepId}
          stepIndex={stepIndex}
          onJump={handleJump}
        />
        <div className={styles.main}>
          {step === 'prospect' ? (
            <ProspectStep
              session={advice.session}
              prospectMode={prospectMode}
              leads={filteredLeads}
              leadSearch={leadSearch}
              selectedLeadId={selectedLeadId}
              busy={advice.busy}
              onLeadSearchChange={setLeadSearch}
              onProspectModeChange={setProspectModeOverride}
              onSelectLead={setSelectedLeadId}
              onPatchProspect={(patch) => void advice.patchProspect(patch)}
              onPatchContactName={(name) => void advice.patchContactName(name)}
            />
          ) : null}

          {step === 'costs' ? (
            <CostsStep
              session={advice.session}
              costCaptureMode={advice.costCaptureMode}
              busy={advice.busy}
              userContext={userContext}
              billingImportService={services.billingImportService}
              onSelectMode={(mode) => void advice.setCostCaptureMode(mode)}
              onPatchCosts={(cents) => void advice.patchManualInput({ monthlyTotalCostsCents: cents })}
              onPatchCurrentProvider={(provider) => void advice.patchProspect({ notes: provider })}
              onBaselineConfirmed={(options) => void advice.syncBillingBaseline(options)}
              showToast={showToast}
            />
          ) : null}

          {step === 'need' ? (
            <NeedStep
              session={advice.session}
              busy={advice.busy}
              onPatch={(patch) => void advice.patchManualInput(patch)}
            />
          ) : null}

          {step === 'variants' ? (
            <RecommendationStep
              session={advice.session}
              busy={advice.busy}
              canSeeCommission={canSeeCommission}
              onCalculate={() => void advice.calculateRecommendation()}
              onSelectVariant={(scenarioId, candidateId) =>
                void advice.selectVariant(scenarioId, candidateId)
              }
            />
          ) : null}

          {step === 'offer' || step === 'approval' ? (
            <OfferStep
              session={advice.session}
              step={step === 'approval' ? 'approval' : 'offer'}
              busy={advice.busy}
              canSeeCommission={canSeeCommission}
              workflowView={workflowView}
              approvalNotes={advice.session.wizard.approvalNotes}
              onApprovalNotesChange={(value) => advice.patchApprovalNotes(value)}
              onCreateOffer={() =>
                void advice.createOffer().then((updated) => {
                  if (updated?.offerId) {
                    showToast('Angebotsentwurf erzeugt', 'success');
                    void services.offerWorkflowService
                      .getWizardWorkflowView(updated.offerId)
                      .then(setWorkflowView);
                  }
                })
              }
              onSubmitApproval={() =>
                void advice
                  .submitApproval(advice.session!.wizard.approvalNotes)
                  .then((updated) => {
                    if (updated?.offerId) {
                      showToast('Freigabe eingereicht', 'success');
                      void services.offerWorkflowService
                        .getWizardWorkflowView(updated.offerId)
                        .then(setWorkflowView);
                    }
                  })
              }
              onBackToRecommendation={() => void advice.jumpToStep('variants')}
            />
          ) : null}

          {step === 'closing' ? (
            <ClosingStep
              session={advice.session}
              busy={advice.busy}
              canSeeCommission={canSeeCommission}
              workflowView={workflowView}
              userContext={userContext}
              offerShareService={services.offerShareService}
              offerWorkflowService={services.offerWorkflowService}
              followUpNote={advice.session.wizard.approvalNotes}
              onFollowUpNoteChange={(value) => advice.patchApprovalNotes(value)}
              onComplete={() =>
                void advice.completeWizard().then((updated) => {
                  if (updated) {
                    showToast('Beratung abgeschlossen', 'success');
                  }
                })
              }
              onWorkflowUpdated={() => {
                const offerId = advice.session?.offerId;
                if (offerId) {
                  void services.offerWorkflowService
                    .getWizardWorkflowView(offerId)
                    .then(setWorkflowView);
                }
              }}
              showToast={showToast}
            />
          ) : null}

          <div className={styles.actions}>
            <Button variant="secondary" disabled={step === 'prospect' || advice.busy} onClick={() => void advice.goBack()}>
              Zurück
            </Button>
            {step !== 'closing' ? (
              <Button loading={advice.busy} onClick={() => void handleNext()}>
                Weiter
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
