import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { DEFAULT_CREATE_OFFER_INPUT } from '../../domain/offer/offerDefaults';
import type { CreateOfferInput } from '../../domain/offer/offer';
import { isSameOfferInput } from '../../domain/offer/offerFormMapping';
import type { Lead } from '../../domain/lead/lead';
import type { Product } from '../../domain/product/product';
import type { Tariff } from '../../domain/tariff/tariff';
import { OfferForm } from '../../features/offer/OfferForm';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateOfferErrors } from '../../services/offerValidation';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';

export function NewOfferPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadIdFromQuery = searchParams.get('leadId') ?? '';

  const { currentUser } = useCurrentUser();
  const { offerService } = useServices();
  const { showToast } = useToast();

  const [values, setValues] = useState<CreateOfferInput>({
    ...DEFAULT_CREATE_OFFER_INPUT,
    leadId: leadIdFromQuery,
  });
  const [errors, setErrors] = useState<CreateOfferErrors>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void (async () => {
      const context = {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      };

      const [accessibleLeads, activeTariffs, activeProducts] = await Promise.all([
        offerService.getAccessibleLeads(context),
        offerService.getActiveTariffsForSelection(),
        offerService.getActiveProductsForSelection(),
      ]);

      setLeads(accessibleLeads);
      setTariffs(activeTariffs);
      setProducts(activeProducts);
      setIsLoading(false);
    })();
  }, [currentUser, offerService]);

  useEffect(() => {
    if (leadIdFromQuery) {
      setValues((current) => ({ ...current, leadId: leadIdFromQuery }));
    }
  }, [leadIdFromQuery]);

  const baseline: CreateOfferInput = {
    ...DEFAULT_CREATE_OFFER_INPUT,
    leadId: leadIdFromQuery,
  };
  const isDirty = !isSameOfferInput(values, baseline);
  useBeforeUnload(isDirty && !allowLeave);

  const leaveToOverview = () => {
    setAllowLeave(true);
    navigate('/offers', { replace: true });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});

      const result = await offerService.createOffer(values, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
        } else if (result.error === 'forbidden') {
          showToast('Sie haben keinen Zugriff auf den ausgewählten Lead.', 'error');
        } else {
          showToast('Angebot konnte nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Angebot wurde gespeichert', 'success');
      setAllowLeave(true);
      navigate(`/offers/${result.offer.id}`, { replace: true });
    })();
  };

  return (
    <section>
      <PageHeader
        title="Neues Angebot"
        description="BestPay-Angebot für einen Lead konfigurieren"
        actions={
          <Link to="/offers">
            <Button variant="secondary">Zur Angebotsübersicht</Button>
          </Link>
        }
      />

      {isLoading ? (
        <EmptyState title="Formular wird vorbereitet" description="Angebotsdaten werden geladen." />
      ) : (
        <OfferForm
          mode="create"
          values={values}
          errors={errors}
          leads={leads}
          tariffs={tariffs}
          products={products}
          isSubmitting={isSubmitting}
          onChange={setValues}
          onSubmit={handleSubmit}
          onCancel={() => (isDirty ? setShowLeaveDialog(true) : leaveToOverview())}
        />
      )}

      <ConfirmDialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        message="Ihre Eingaben wurden noch nicht gespeichert."
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Änderungen verwerfen"
        onCancel={() => setShowLeaveDialog(false)}
        onConfirm={() => {
          setShowLeaveDialog(false);
          leaveToOverview();
        }}
      />
    </section>
  );
}
