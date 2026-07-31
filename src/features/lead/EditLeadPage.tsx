import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { DEFAULT_CARD_MIX, DEFAULT_PAYMENT_USAGE } from '../../domain/lead/defaults';
import { leadToEditInput } from '../../domain/lead/leadFormMapping';
import type { EditLeadInput, Lead } from '../../domain/lead/lead';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { isEditFormDirty, useLeadEditDraft } from '../../hooks/useLeadEditDraft';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import {
  getCardMixSummary,
  isCardMixValid,
  type CreateLeadErrors,
} from '../../services/leadValidation';
import { LeadForm } from './LeadForm';
import styles from './EditLeadPage.module.css';

const EMPTY_EDIT_BASELINE: EditLeadInput = {
  companyName: '',
  contactFirstName: '',
  contactLastName: '',
  phone: '',
  email: '',
  street: '',
  postalCode: '',
  city: '',
  industry: '',
  currentProvider: '',
  monthlyCardTurnoverCents: null,
  monthlyTransactions: null,
  averageTransactionValueCents: null,
  currentTerminalCount: null,
  currentTerminalModels: '',
  paymentUsage: { ...DEFAULT_PAYMENT_USAGE },
  cardMix: { ...DEFAULT_CARD_MIX },
  currentContractEndDate: null,
  currentNoticePeriod: '',
  requiredTerminalCount: 1,
  interest: 'medium',
  notes: '',
  nextFollowUpAt: null,
  status: 'new',
};

export function EditLeadPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useCurrentUser();
  const { leadService, leadEditDraftService } = useServices();
  const { showToast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [values, setValues] = useState<EditLeadInput>(EMPTY_EDIT_BASELINE);
  const [baseline, setBaseline] = useState<EditLeadInput>(EMPTY_EDIT_BASELINE);
  const [errors, setErrors] = useState<CreateLeadErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const [isFormReady, setIsFormReady] = useState(false);

  const editContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role }
        : null,
    [currentUser],
  );

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(false);
    setIsFormReady(false);

    void leadService
      .getLeadById(id)
      .then((result) => {
        if (!result) {
          setLead(null);
          setIsLoading(false);
          return;
        }

        const editInput = leadToEditInput(result);
        setLead(result);
        setBaseline(editInput);
        setValues(editInput);
        setIsFormReady(true);
        setIsLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setIsLoading(false);
      });
  }, [id, leadService]);

  const handleDraftRestored = useCallback(() => {
    showToast('Gespeicherte Änderungen wurden wiederhergestellt', 'info');
  }, [showToast]);

  useLeadEditDraft({
    leadId: isFormReady ? id : undefined,
    leadUpdatedAt: isFormReady ? lead?.updatedAt : undefined,
    baseline,
    values,
    setValues,
    onDraftRestored: handleDraftRestored,
  });

  const isDirty = isFormReady ? isEditFormDirty(values, baseline) : false;
  useBeforeUnload(isDirty);

  const cardMixSummary = getCardMixSummary(values.cardMix);

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      if (firstInvalid instanceof HTMLElement) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser || !id || !editContext) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await leadService.updateLead(id, values, editContext);

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
          focusFirstError();
        } else if (result.error === 'not_found') {
          showToast('Lead nicht gefunden', 'error');
        } else {
          showToast('Änderungen konnten nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      await leadEditDraftService.clearDraft(id);
      showToast('Änderungen wurden gespeichert', 'success');
      setSavedLeadId(result.lead.id);
    })();
  };

  const handleCancel = () => {
    if (!id) {
      return;
    }

    if (isDirty) {
      setShowLeaveDialog(true);
      return;
    }

    setPendingNavigateTo(`/leads/${id}`);
  };

  const handleLeaveConfirmed = () => {
    setShowLeaveDialog(false);
    if (id) {
      setPendingNavigateTo(`/leads/${id}`);
    }
  };

  if (savedLeadId) {
    return <Navigate to={`/leads/${savedLeadId}`} replace />;
  }

  if (pendingNavigateTo) {
    return <Navigate to={pendingNavigateTo} replace />;
  }

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Kunde bearbeiten" subtitle="Daten werden geladen…" />
        <EmptyState title="Kunde wird geladen" description="Die Kundendaten werden abgerufen." />
      </section>
    );
  }

  if (loadError) {
    return (
      <section>
        <PageHeader title="Kunde bearbeiten" />
        <EmptyState
          title="Kunde konnte nicht geladen werden"
          description="Bitte versuchen Sie es erneut oder kehren Sie zur Kundenliste zurück."
          action={
            <Link className={styles.listLink} to="/leads">
              Zur Kundenliste
            </Link>
          }
        />
      </section>
    );
  }

  if (!lead) {
    return (
      <section>
        <EmptyState
          title="Kunde nicht gefunden"
          description="Der angeforderte Kunde existiert nicht."
          action={
            <Link className={styles.listLink} to="/leads">
              Zur Kundenliste
            </Link>
          }
        />
      </section>
    );
  }

  if (editContext && !leadService.canUserEditLead(lead, editContext)) {
    return <AccessDenied />;
  }

  return (
    <section>
      <PageHeader
        title="Kunde bearbeiten"
        subtitle="Kontakt-, Payment- und Beratungsdaten aktualisieren"
        actions={
          <Link className={styles.backLink} to={`/leads/${lead.id}`}>
            Zur Detailseite
          </Link>
        }
      />

      <LeadForm
        mode="edit"
        values={values}
        errors={errors}
        cardMixSummary={cardMixSummary}
        isCardMixValid={isCardMixValid(values.cardMix)}
        isSubmitting={isSubmitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      <ConfirmDialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        message="Deine Änderungen wurden noch nicht gespeichert."
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Änderungen verwerfen"
        onCancel={() => setShowLeaveDialog(false)}
        onConfirm={handleLeaveConfirmed}
      />
    </section>
  );
}
