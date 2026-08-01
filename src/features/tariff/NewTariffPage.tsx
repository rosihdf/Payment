import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../../domain/tariff/defaults';
import type { CreateTariffInput } from '../../domain/tariff/tariff';
import { isSameTariffInput } from '../../domain/tariff/tariffFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateTariffErrors } from '../../services/tariffValidation';
import { AdminTariffLayout } from './AdminTariffLayout';
import { TariffForm } from './TariffForm';

export function NewTariffPage() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { tariffService } = useServices();
  const { showToast } = useToast();
  const [values, setValues] = useState<CreateTariffInput>(DEFAULT_CREATE_TARIFF_INPUT);
  const [errors, setErrors] = useState<CreateTariffErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  const isDirty = !isSameTariffInput(values, DEFAULT_CREATE_TARIFF_INPUT);

  useBeforeUnload(isDirty && !allowLeave);

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      if (firstInvalid instanceof HTMLElement) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const leaveToOverview = () => {
    setAllowLeave(true);
    navigate('/admin/catalog?tab=tariffs', { replace: true });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await tariffService.createTariff(values, { role: currentUser.role });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
          focusFirstError();
        } else {
          showToast('Tarif konnte nicht angelegt werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Tarif wurde angelegt', 'success');
      leaveToOverview();
    })();
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowLeaveDialog(true);
      return;
    }

    leaveToOverview();
  };

  return (
    <AdminTariffLayout
      title="Tarif anlegen"
      subtitle="Neuen BestPay-Tarif erfassen"
    >
      <TariffForm
        mode="create"
        values={values}
        errors={errors}
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
        onConfirm={() => {
          setShowLeaveDialog(false);
          leaveToOverview();
        }}
      />
    </AdminTariffLayout>
  );
}
