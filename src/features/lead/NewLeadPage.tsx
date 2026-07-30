import { useCallback, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { DEFAULT_CREATE_LEAD_INPUT } from '../../domain/lead/defaults';
import type { CreateLeadInput } from '../../domain/lead/lead';
import { isLeadFormDirty, useLeadDraft } from '../../hooks/useLeadDraft';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import {
  getCardMixSummary,
  isCardMixValid,
  type CreateLeadErrors,
} from '../../services/leadValidation';
import { LeadForm } from './LeadForm';
import styles from './NewLeadPage.module.css';

type DialogMode = 'cancel' | 'discard' | null;

export function NewLeadPage() {
  const { currentUser } = useCurrentUser();
  const { leadService, leadDraftService } = useServices();
  const { showToast } = useToast();
  const [values, setValues] = useState<CreateLeadInput>(DEFAULT_CREATE_LEAD_INPUT);
  const [errors, setErrors] = useState<CreateLeadErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);

  const handleDraftRestored = useCallback(() => {
    showToast('Gespeicherter Entwurf wiederhergestellt', 'info');
  }, [showToast]);

  useLeadDraft({
    userId: currentUser?.id,
    values,
    setValues,
    onDraftRestored: handleDraftRestored,
  });

  const showDiscard = isLeadFormDirty(values);
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
    if (isSubmitting || !currentUser) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await leadService.createLead(values, currentUser.id);

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
          focusFirstError();
        } else {
          showToast('Lead konnte nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      await leadDraftService.clearDraft(currentUser.id);
      showToast('Lead wurde gespeichert', 'success');
      setCreatedLeadId(result.lead.id);
    })();
  };

  const resetForm = () => {
    setValues(DEFAULT_CREATE_LEAD_INPUT);
    setErrors({});
  };

  const handleDiscardConfirmed = () => {
    void (async () => {
      if (currentUser) {
        await leadDraftService.clearDraft(currentUser.id);
      }
      resetForm();
      setDialogMode(null);
      showToast('Eingaben wurden verworfen', 'success');
    })();
  };

  const handleCancelConfirmed = () => {
    setDialogMode(null);
    setPendingNavigateTo('/leads');
  };

  if (createdLeadId) {
    return <Navigate to={`/leads/${createdLeadId}`} replace />;
  }

  if (pendingNavigateTo) {
    return <Navigate to={pendingNavigateTo} replace />;
  }

  return (
    <section>
      <PageHeader
        title="Neuen Lead aufnehmen"
        subtitle="Interessent und aktuelle Payment-Situation erfassen"
        actions={
          <Link className={styles.backLink} to="/leads">
            Zur Leadliste
          </Link>
        }
      />

      <LeadForm
        mode="create"
        values={values}
        errors={errors}
        cardMixSummary={cardMixSummary}
        isCardMixValid={isCardMixValid(values.cardMix)}
        isSubmitting={isSubmitting}
        showDiscard={showDiscard}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => {
          if (showDiscard) {
            setDialogMode('cancel');
            return;
          }
          setPendingNavigateTo('/leads');
        }}
        onDiscard={() => {
          if (showDiscard) {
            setDialogMode('discard');
          }
        }}
      />

      <ConfirmDialog
        isOpen={dialogMode === 'cancel'}
        title="Bearbeitung abbrechen?"
        message="Es gibt ungespeicherte Eingaben. Möchten Sie die Seite wirklich verlassen?"
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Änderungen verwerfen"
        onCancel={() => setDialogMode(null)}
        onConfirm={handleCancelConfirmed}
      />

      <ConfirmDialog
        isOpen={dialogMode === 'discard'}
        title="Eingaben verwerfen?"
        message="Alle Eingaben werden zurückgesetzt und der gespeicherte Entwurf gelöscht."
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Eingaben verwerfen"
        onCancel={() => setDialogMode(null)}
        onConfirm={handleDiscardConfirmed}
      />
    </section>
  );
}
