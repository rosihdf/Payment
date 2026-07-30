import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { CreateOfferInput } from '../../domain/offer/offer';
import { offerToFormInput, isSameOfferInput } from '../../domain/offer/offerFormMapping';
import type { Lead } from '../../domain/lead/lead';
import type { Product } from '../../domain/product/product';
import type { Tariff } from '../../domain/tariff/tariff';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateOfferErrors } from '../../services/offerValidation';
import { OfferForm } from './OfferForm';
import styles from './OfferForm.module.css';

export function EditOfferPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { offerService } = useServices();
  const { showToast } = useToast();

  const [initialValues, setInitialValues] = useState<CreateOfferInput | null>(null);
  const [values, setValues] = useState<CreateOfferInput | null>(null);
  const [errors, setErrors] = useState<CreateOfferErrors>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  useEffect(() => {
    if (!id || !currentUser) {
      setIsLoading(false);
      return;
    }

    const context = {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    };

    void (async () => {
      const [offer, accessibleLeads, activeTariffs, activeProducts] = await Promise.all([
        offerService.getOfferById(id, context),
        offerService.getAccessibleLeads(context),
        offerService.getActiveTariffsForSelection(),
        offerService.getActiveProductsForSelection(),
      ]);

      if (!offer) {
        setIsLoading(false);
        return;
      }

      if (!offerService.canUserAccessOffer(offer, context)) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      const formInput = offerToFormInput(offer);
      setInitialValues(formInput);
      setValues(formInput);
      setIsDraft(offer.status === 'draft');
      setLeads(accessibleLeads);
      setTariffs(activeTariffs);
      setProducts(activeProducts);
      setIsLoading(false);
    })();
  }, [currentUser, id, offerService]);

  const isDirty = initialValues && values ? !isSameOfferInput(values, initialValues) : false;
  useBeforeUnload(Boolean(isDirty && !allowLeave && isDraft));

  const leaveToDetail = () => {
    setAllowLeave(true);
    navigate(id ? `/offers/${id}` : '/offers', { replace: true });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser || !id || !values || !isDraft) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await offerService.updateOffer(id, values, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
        } else if (result.error === 'invalid_status') {
          showToast('Abgeschlossene oder stornierte Angebote können nicht bearbeitet werden.', 'error');
        } else if (result.error === 'forbidden') {
          showToast('Sie haben keinen Zugriff auf dieses Angebot.', 'error');
        } else if (result.error === 'not_found') {
          showToast('Angebot wurde nicht gefunden', 'error');
        } else {
          showToast('Angebot konnte nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Angebot wurde gespeichert', 'success');
      leaveToDetail();
    })();
  };

  if (accessDenied) {
    return <AccessDenied description="Sie haben keinen Zugriff auf dieses Angebot." />;
  }

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Angebot bearbeiten" subtitle="Daten werden geladen…" />
        <EmptyState title="Angebot wird geladen" description="Die Angebotsdaten werden abgerufen." />
      </section>
    );
  }

  if (!values) {
    return (
      <section>
        <PageHeader title="Angebot bearbeiten" />
        <EmptyState
          title="Angebot nicht gefunden"
          description="Das angeforderte Angebot existiert nicht oder Sie haben keinen Zugriff."
          action={
            <Link className={styles.secondary} to="/offers">
              Zur Angebotsübersicht
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Angebot bearbeiten"
        subtitle={isDraft ? 'Entwurf aktualisieren' : 'Nur Ansicht – Bearbeitung nicht möglich'}
        actions={
          <Link className={styles.secondary} to={`/offers/${id}`}>
            Zur Detailansicht
          </Link>
        }
      />

      <OfferForm
        mode="edit"
        values={values}
        errors={errors}
        leads={leads}
        tariffs={tariffs}
        products={products}
        isSubmitting={isSubmitting}
        readOnly={!isDraft}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => (isDirty && isDraft ? setShowLeaveDialog(true) : leaveToDetail())}
      />

      <ConfirmDialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        message="Ihre Eingaben wurden noch nicht gespeichert."
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Änderungen verwerfen"
        onCancel={() => setShowLeaveDialog(false)}
        onConfirm={() => {
          setShowLeaveDialog(false);
          leaveToDetail();
        }}
      />
    </section>
  );
}
