import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../../domain/tariff/defaults';
import type { CreateTariffInput } from '../../domain/tariff/tariff';
import { isSameTariffInput, tariffToFormInput } from '../../domain/tariff/tariffFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateTariffErrors } from '../../services/tariffValidation';
import { AdminLayout } from '../admin/AdminLayout';
import { Dialog } from '../../v2/ui/Dialog';
import { TariffForm } from './TariffForm';

export function EditTariffPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { tariffService } = useServices();
  const { showToast } = useToast();

  const [values, setValues] = useState<CreateTariffInput>(DEFAULT_CREATE_TARIFF_INPUT);
  const [baseline, setBaseline] = useState<CreateTariffInput>(DEFAULT_CREATE_TARIFF_INPUT);
  const [errors, setErrors] = useState<CreateTariffErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotFound(false);

    void tariffService.getTariffById(id).then((tariff) => {
      if (!tariff) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const formInput = tariffToFormInput(tariff);
      setValues(formInput);
      setBaseline(formInput);
      setIsLoading(false);
    });
  }, [id, tariffService]);

  const isDirty = !isSameTariffInput(values, baseline);

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
    if (isSubmitting || !currentUser || !id) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await tariffService.updateTariff(id, values, { role: currentUser.role });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
          focusFirstError();
        } else if (result.error === 'not_found') {
          setNotFound(true);
          showToast('Änderungen konnten nicht gespeichert werden', 'error');
        } else {
          showToast('Änderungen konnten nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Änderungen wurden gespeichert', 'success');
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

  if (notFound) {
    return (
      <AdminLayout title="Tarif bearbeiten">
        <EmptyState
          title="Tarif nicht gefunden"
          description="Der angeforderte Tarif existiert nicht oder wurde entfernt."
          action={
            <Link to="/admin/catalog?tab=tariffs">
              Zu Tarifen
            </Link>
          }
        />
      </AdminLayout>
    );
  }

  if (isLoading) {
    return (
      <AdminLayout title="Tarif bearbeiten" subtitle="Tarifkonditionen und Verfügbarkeit aktualisieren">
        <EmptyState
          title="Tarif wird geladen"
          description="Die Tarifdaten werden vorbereitet."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Tarif bearbeiten"
      subtitle="Tarifkonditionen und Verfügbarkeit aktualisieren"
    >
      <TariffForm
        mode="edit"
        values={values}
        errors={errors}
        isSubmitting={isSubmitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      <Dialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        onClose={() => setShowLeaveDialog(false)}
        secondaryAction={{ label: 'Weiter bearbeiten', onClick: () => setShowLeaveDialog(false) }}
        primaryAction={{
          label: 'Änderungen verwerfen',
          variant: 'destructive',
          onClick: () => {
            setShowLeaveDialog(false);
            leaveToOverview();
          },
        }}
      >
        <p>Deine Änderungen wurden noch nicht gespeichert.</p>
      </Dialog>
    </AdminLayout>
  );
}
