import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import { LeadForm } from './LeadForm';

type DialogMode = 'cancel' | 'discard' | null;

export function NewLeadPage() {
  const { currentUser } = useCurrentUser();
  const { leadService, leadDraftService, userService } = useServices();
  const { showToast } = useToast();
  const [values, setValues] = useState<CreateLeadInput>(DEFAULT_CREATE_LEAD_INPUT);
  const [errors, setErrors] = useState<CreateLeadErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const [advisorOptions, setAdvisorOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const canAssignAdvisor = currentUser?.role === 'admin';

  useEffect(() => {
    if (!canAssignAdvisor) {
      return;
    }
    void userService.getAllUsers().then((users) => {
      setAdvisorOptions(
        users
          .filter((user) => user.role === 'field_service' && user.status === 'active')
          .map((user) => ({ id: user.id, name: user.name, email: user.email })),
      );
    });
  }, [canAssignAdvisor, userService]);

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

      const result = await leadService.createLead(
        values,
        currentUser.id,
        { userId: currentUser.id, role: currentUser.role },
      );

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
          focusFirstError();
        } else {
          showToast('Kunde konnte nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      await leadDraftService.clearDraft(currentUser.id);
      showToast('Kunde wurde gespeichert', 'success');
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
        title="Neuen Kunden aufnehmen"
        description="Interessent und aktuelle Payment-Situation erfassen"
        actions={
          <Link to="/leads">
            Zur Kundenliste
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
        canAssignAdvisor={canAssignAdvisor}
        advisorOptions={advisorOptions}
      />

      <Dialog
        isOpen={dialogMode === 'cancel'}
        title="Bearbeitung abbrechen?"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Weiter bearbeiten', onClick: () => setDialogMode(null) }}
        primaryAction={{ label: 'Änderungen verwerfen', variant: 'destructive', onClick: handleCancelConfirmed }}
      >
        <p>Es gibt ungespeicherte Eingaben. Möchten Sie die Seite wirklich verlassen?</p>
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'discard'}
        title="Eingaben verwerfen?"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Weiter bearbeiten', onClick: () => setDialogMode(null) }}
        primaryAction={{ label: 'Eingaben verwerfen', variant: 'destructive', onClick: handleDiscardConfirmed }}
      >
        <p>Alle Eingaben werden zurückgesetzt und der gespeicherte Entwurf gelöscht.</p>
      </Dialog>
    </section>
  );
}
