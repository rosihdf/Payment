import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../../domain/tariff/defaults';
import type { CreateTariffInput } from '../../domain/tariff/tariff';
import { isSameTariffInput, tariffToFormInput } from '../../domain/tariff/tariffFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateTariffErrors } from '../../services/tariffValidation';
import { AdminTariffLayout } from './AdminTariffLayout';
import { TariffForm } from './TariffForm';
import styles from './EditTariffPage.module.css';

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
    navigate('/admin/tariffs', { replace: true });
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
      <AdminTariffLayout title="Tarif bearbeiten">
        <EmptyState
          title="Tarif nicht gefunden"
          description="Der angeforderte Tarif existiert nicht oder wurde entfernt."
          action={
            <Link className={styles.backLink} to="/admin/tariffs">
              Zur Tarifverwaltung
            </Link>
          }
        />
      </AdminTariffLayout>
    );
  }

  if (isLoading) {
    return (
      <AdminTariffLayout title="Tarif bearbeiten" subtitle="Tarifkonditionen und Verfügbarkeit aktualisieren">
        <EmptyState
          title="Tarif wird geladen"
          description="Die Tarifdaten werden vorbereitet."
        />
      </AdminTariffLayout>
    );
  }

  return (
    <AdminTariffLayout
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
